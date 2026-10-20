import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { disconnectDb } from "../src/server/db/connect";
import { EnquiryModel } from "../src/server/db/models";
import { createEnquiry } from "../src/server/services/enquiries";
import { MAX_NOTIFICATION_ATTEMPTS, deliverNotifications, retryFailedNotifications } from "../src/server/services/notifications";
import { uid } from "./helpers";

const SECRET = `whsec-${uid()}${uid()}`;

interface Received {
  headers: IncomingMessage["headers"];
  body: string;
}

let server: Server;
let received: Received[] = [];
let mode: "ok" | "fail" = "ok";
const references: string[] = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.statusCode = mode === "ok" ? 200 : 500;
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };

  // Must be set before the first env() read, which happens on the first DB call below.
  process.env.ENQUIRY_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
  process.env.ENQUIRY_WEBHOOK_SECRET = SECRET;
  process.env.SMTP_HOST = ""; // mail off: this suite is about the webhook channel
});

after(async () => {
  await EnquiryModel.deleteMany({ reference: { $in: references } });
  await disconnectDb();
  await new Promise((resolve) => server.close(resolve));
});

async function newEnquiry(over: Record<string, unknown> = {}) {
  const result = await createEnquiry(
    {
      name: "Webhook Tester",
      mobile: "+919876543210",
      type: "general",
      message: `Webhook delivery check ${uid()} apex-test`,
      token: "unused-by-service",
      ...over,
    } as Parameters<typeof createEnquiry>[0],
    { ipHash: "test", userAgent: "node-test" },
  );
  references.push(result.reference);
  return result;
}

const stateOf = async (reference: string) => (await EnquiryModel.findOne({ reference }).lean())!.notifications!.webhook!;

describe("webhook channel", () => {
  it("POSTs the enquiry with a verifiable HMAC signature", async () => {
    received = [];
    mode = "ok";
    const { id, reference } = await newEnquiry();
    await deliverNotifications(id!);

    assert.equal(received.length, 1);
    const { headers, body } = received[0];
    assert.equal(headers["content-type"], "application/json");

    const timestamp = headers["x-apex-timestamp"] as string;
    assert.ok(Math.abs(Date.now() / 1000 - Number(timestamp)) < 30, "timestamp is current (replay window)");
    const expected = `sha256=${createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex")}`;
    assert.equal(headers["x-apex-signature"], expected);

    const payload = JSON.parse(body);
    assert.equal(payload.event, "enquiry.created");
    assert.equal(payload.reference, reference);
    assert.equal(payload.mobile, "+919876543210");
    assert.equal(payload.email, null);

    const state = await stateOf(reference);
    assert.equal(state.status, "sent");
    assert.equal(state.attempts, 1);
    assert.ok(state.sentAt);
  });

  it("a tampered body fails signature verification", async () => {
    received = [];
    const { id } = await newEnquiry();
    await deliverNotifications(id!);
    const { headers, body } = received[0];
    const forged = body.replace("Webhook Tester", "Mallory");
    const check = `sha256=${createHmac("sha256", SECRET).update(`${headers["x-apex-timestamp"]}.${forged}`).digest("hex")}`;
    assert.notEqual(check, headers["x-apex-signature"]);
  });

  it("does not call out for spam", async () => {
    received = [];
    const { id, reference, spam } = await newEnquiry({ website: "http://bot.example" });
    assert.equal(spam, true);
    await deliverNotifications(id!);
    assert.equal(received.length, 0);
    assert.equal((await stateOf(reference)).status, "skipped");
  });

  it("records failures, retries them, and clears the error on success", async () => {
    received = [];
    mode = "fail";
    const { id, reference } = await newEnquiry();
    await deliverNotifications(id!);

    let state = await stateOf(reference);
    assert.equal(state.status, "failed");
    assert.equal(state.attempts, 1);
    assert.match(state.lastError ?? "", /HTTP 500/);

    await retryFailedNotifications();
    state = await stateOf(reference);
    assert.equal(state.status, "failed");
    assert.equal(state.attempts, 2, "a retry that fails again counts as another attempt");

    mode = "ok";
    const outcome = await retryFailedNotifications();
    assert.ok(outcome.retried >= 1);
    state = await stateOf(reference);
    assert.equal(state.status, "sent");
    assert.equal(state.attempts, 3);
    assert.equal(state.lastError, undefined);
  });

  it("gives up after the attempt limit", async () => {
    mode = "fail";
    const { id, reference } = await newEnquiry();
    await deliverNotifications(id!);
    await EnquiryModel.updateOne({ reference }, { $set: { "notifications.webhook.attempts": MAX_NOTIFICATION_ATTEMPTS } });

    received = [];
    await retryFailedNotifications();
    assert.equal(received.length, 0, "exhausted notifications are not retried");
    assert.equal((await stateOf(reference)).status, "failed");
    mode = "ok";
  });

  it("an unreachable endpoint fails cleanly and does not throw", async () => {
    const { id, reference } = await newEnquiry();
    await EnquiryModel.updateOne({ reference }, { $set: { "notifications.webhook.status": "pending" } });
    const url = process.env.ENQUIRY_WEBHOOK_URL;
    server.close();
    // env() is memoised, so point the live receiver somewhere dead by stopping it.
    await deliverNotifications(id!);
    const state = await stateOf(reference);
    assert.equal(state.status, "failed");
    assert.ok(state.lastError);
    process.env.ENQUIRY_WEBHOOK_URL = url;
  });
});
