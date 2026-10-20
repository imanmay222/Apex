import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, adminClient, mailpit, purgeTestEnquiries, purgeTestUsers, readyToken, sleep, uid, userClient } from "./helpers";

let admin: Client;
let token: string;
const anon = () => new Client();

const payload = (over: Record<string, unknown> = {}) => ({
  name: "Test Buyer",
  mobile: "98765 43210",
  type: "products",
  subject: "head-protection",
  message: `Need 200 helmets for our plant. ref ${uid()} apex-test`,
  token,
  ...over,
});

before(async () => {
  admin = await adminClient();
  await mailpit.clear();
  token = await readyToken(anon());
});

after(async () => {
  await purgeTestEnquiries(admin);
  await purgeTestUsers(admin);
});

async function submit(over: Record<string, unknown> = {}, client = anon()) {
  return client.post("/api/enquiries", payload(over));
}

async function findByRef(reference: string) {
  const list = await admin.get(`/api/admin/enquiries?q=${reference}&status=new,contacted,quoted,won,lost,spam,archived`);
  return list.body.data[0];
}

describe("form token", () => {
  it("issues signed tokens", async () => {
    const r = await anon().get("/api/enquiries/token");
    assert.equal(r.status, 200);
    assert.match(r.body.data.token, /^\d+\.[\w-]+\.[0-9a-f]{32}$/);
  });
  it("rejects a missing/forged token", async () => {
    const r = await submit({ token: "1.abc.0123456789abcdef0123456789abcdef" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "INVALID_FORM_TOKEN");
  });
  it("rejects a submission faster than a human could fill the form", async () => {
    const c = anon();
    const fresh = (await c.get("/api/enquiries/token")).body.data.token;
    const r = await c.post("/api/enquiries", payload({ token: fresh }));
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "SUBMITTED_TOO_FAST");
  });
});

describe("submitting an enquiry", () => {
  it("stores it with a reference, normalised mobile and resolved subject", async () => {
    const r = await submit();
    assert.equal(r.status, 201);
    assert.match(r.body.data.reference, /^ENQ-\d{4}-\d{6}$/);

    const stored = await findByRef(r.body.data.reference);
    assert.equal(stored.mobile, "+919876543210");
    assert.equal(stored.type, "products");
    assert.deepEqual(stored.subject, { slug: "head-protection", title: "Head Protection" });
    assert.equal(stored.status, "new");
    assert.equal(stored.statusHistory.length, 1);
  });

  it("numbers references sequentially", async () => {
    const a = await submit();
    const b = await submit();
    const seq = (ref: string) => Number(ref.split("-")[2]);
    assert.equal(seq(b.body.data.reference), seq(a.body.data.reference) + 1);
  });

  it("emails the sales team (HTML-escaped) with reply-to set to the customer", async () => {
    await mailpit.clear();
    const marker = uid();
    const r = await submit({
      name: `<script>alert(1)</script> ${marker}`,
      email: `buyer-${marker}@example.com`,
      message: `Please quote <b>bold</b> & "quotes" ${marker} apex-test`,
    });
    const ref = r.body.data.reference;

    const mail = await mailpit.waitFor((m) => m.Subject.includes(ref) && m.To.some((t) => t.Address === "sales@apexcare.local"));
    assert.match(mail.Subject, /Product quote: Head Protection/);

    const body = await mailpit.body(mail.ID);
    assert.ok(!body.HTML.includes("<script>alert(1)"), "raw <script> must never reach the HTML body");
    assert.ok(body.HTML.includes("&lt;script&gt;"));
    assert.ok(body.HTML.includes("&lt;b&gt;bold&lt;/b&gt;"));
    assert.equal(body.ReplyTo?.[0]?.Address, `buyer-${marker}@example.com`);
    assert.match(body.Text, /\+919876543210/);
  });

  it("sends the customer an acknowledgement containing the reference", async () => {
    const email = `ack-${uid()}@example.com`;
    const r = await submit({ email });
    const ref = r.body.data.reference;
    const mail = await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
    assert.match(mail.Subject, new RegExp(ref));
    assert.match((await mailpit.body(mail.ID)).Text, new RegExp(ref));
  });

  it("records per-channel delivery status", async () => {
    const email = `status-${uid()}@example.com`;
    const ref = (await submit({ email })).body.data.reference;
    await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
    await sleep(500);
    const stored = await findByRef(ref);
    assert.equal(stored.notifications.sales.status, "sent");
    assert.equal(stored.notifications.customer.status, "sent");
    assert.equal(stored.notifications.webhook.status, "skipped");
    assert.equal(stored.notifications.sales.attempts, 1);
  });

  it("skips the customer email when no address was given", async () => {
    const ref = (await submit()).body.data.reference;
    await sleep(2000);
    assert.equal((await findByRef(ref)).notifications.customer.status, "skipped");
  });

  it("collapses accidental double submits", async () => {
    const message = `Double click test ${uid()} apex-test`;
    const first = await submit({ message });
    const second = await submit({ message });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.duplicate, true);
    assert.equal(second.body.data.reference, first.body.data.reference);
  });

  it("accepts general enquiries without a subject", async () => {
    const r = await submit({ type: "general", subject: undefined });
    assert.equal(r.status, 201);
    assert.equal((await findByRef(r.body.data.reference)).subject, null);
  });

  it("supports survey and training enquiries", async () => {
    const survey = await submit({ type: "survey", subject: "fit-testing" });
    const training = await submit({ type: "training", subject: "first-aid-training" });
    assert.equal((await findByRef(survey.body.data.reference)).subject.title, "Respirator Fit Testing");
    assert.equal((await findByRef(training.body.data.reference)).subject.title, "First Aid Training");
  });

  it("accepts international numbers", async () => {
    const r = await submit({ mobile: "+44 20 7946 0958" });
    assert.equal((await findByRef(r.body.data.reference)).mobile, "+442079460958");
  });
});

describe("validation", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["a bad mobile number", { mobile: "12345" }, "mobile"],
    ["a too-short message", { message: "hi" }, "message"],
    ["an empty name", { name: " " }, "name"],
    ["a malformed email", { email: "not-an-email" }, "email"],
    ["an unknown type", { type: "refund" }, "type"],
    ["an unknown product", { subject: "no-such-product" }, "subject"],
    ["control characters", { name: "Bad\u0000Name" }, "name"],
    ["unexpected fields", { isAdmin: true }, ""],
  ];
  for (const [label, over, path] of cases) {
    it(`rejects ${label}`, async () => {
      const r = await submit(over);
      assert.equal(r.status, 422, r.text);
      if (path) assert.ok(r.body.error.details.some((d: { path: string }) => d.path === path), r.text);
    });
  }
  it("rejects non-JSON bodies", async () => {
    const r = await anon().request("POST", "/api/enquiries", { headers: { "Content-Type": "text/plain" } });
    assert.equal(r.status, 415);
  });
  it("rejects malformed JSON", async () => {
    const r = await fetch(`${BASE}/api/enquiries`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.9.9.9" }, body: "{oops" });
    assert.equal(r.status, 400);
  });
  it("rejects oversized bodies", async () => {
    const r = await submit({ message: "x".repeat(40_000) });
    assert.equal(r.status, 413);
  });
});

describe("abuse protection", () => {
  it("hides honeypot hits but answers as if they succeeded", async () => {
    await mailpit.clear();
    const r = await submit({ website: "http://bot.example", message: `bot post ${uid()} apex-test` });
    assert.equal(r.status, 201);
    const hidden = await admin.get(`/api/admin/enquiries?q=${r.body.data.reference}`);
    assert.equal(hidden.body.data.length, 0, "spam must not appear in the default inbox");
    const spam = await findByRef(r.body.data.reference);
    assert.equal(spam.status, "spam");
    assert.ok(spam.spam.reasons.includes("honeypot"));
    await sleep(1500);
    assert.equal((await mailpit.list()).filter((m) => m.Subject.includes(r.body.data.reference)).length, 0, "no email for spam");
  });

  it("classifies link-heavy spam", async () => {
    const r = await submit({ message: `buy backlinks http://a.com http://b.com http://c.com ${uid()} apex-test` });
    assert.equal((await findByRef(r.body.data.reference)).status, "spam");
  });

  it("rate-limits a single IP (6 per 10 minutes)", async () => {
    const c = anon();
    const results: number[] = [];
    for (let i = 0; i < 7; i++) results.push((await submit({ message: `burst ${i} ${uid()} apex-test` }, c)).status);
    assert.deepEqual(results.slice(0, 6), [201, 201, 201, 201, 201, 201]);
    assert.equal(results[6], 429);
    const blocked = await submit({ message: `burst again ${uid()} apex-test` }, c);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal(blocked.body.error.code, "RATE_LIMITED");
  });
});

describe("admin inbox", () => {
  it("requires authentication", async () => {
    assert.equal((await anon().get("/api/admin/enquiries")).status, 401);
    assert.equal((await anon().get("/api/admin/enquiries/export")).status, 401);
  });

  it("filters, searches and paginates", async () => {
    const tag = uid();
    const a = await submit({ type: "survey", subject: "height-safety", message: `inbox filter ${tag} one apex-test` });
    await submit({ type: "training", subject: "mock-drill-training", message: `inbox filter ${tag} two apex-test` });

    const byQ = await admin.get(`/api/admin/enquiries?q=${tag}`);
    assert.equal(byQ.body.data.length, 2);
    assert.equal(byQ.body.meta.total, 2);

    const byType = await admin.get(`/api/admin/enquiries?q=${tag}&type=survey`);
    assert.deepEqual(byType.body.data.map((e: { reference: string }) => e.reference), [a.body.data.reference]);

    const paged = await admin.get(`/api/admin/enquiries?q=${tag}&limit=1&page=2`);
    assert.equal(paged.body.data.length, 1);
    assert.equal(paged.body.meta.totalPages, 2);

    const oldest = await admin.get(`/api/admin/enquiries?q=${tag}&sort=oldest`);
    assert.equal(oldest.body.data[0].reference, a.body.data.reference);

    const future = new Date(Date.now() + 86_400_000).toISOString();
    assert.equal((await admin.get(`/api/admin/enquiries?q=${tag}&from=${encodeURIComponent(future)}`)).body.data.length, 0);

    assert.equal((await admin.get("/api/admin/enquiries?status=bogus")).status, 422);
    assert.equal((await admin.get("/api/admin/enquiries?nope=1")).status, 422);
  });

  it("tracks status changes and first response time", async () => {
    const ref = (await submit()).body.data.reference;
    const id = (await findByRef(ref)).id;

    const r = await admin.patch(`/api/admin/enquiries/${id}`, { status: "contacted" });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, "contacted");
    assert.ok(r.body.data.firstResponseAt);
    assert.deepEqual(r.body.data.statusHistory.map((h: { status: string }) => h.status), ["new", "contacted"]);
    assert.equal(r.body.data.statusHistory[1].by, "Site Administrator");

    const again = await admin.patch(`/api/admin/enquiries/${id}`, { status: "quoted" });
    assert.equal(again.body.data.firstResponseAt, r.body.data.firstResponseAt, "first response is not overwritten");
  });

  it("validates updates", async () => {
    const id = (await findByRef((await submit()).body.data.reference)).id;
    assert.equal((await admin.patch(`/api/admin/enquiries/${id}`, { status: "weird" })).status, 422);
    assert.equal((await admin.patch(`/api/admin/enquiries/${id}`, {})).status, 422);
    assert.equal((await admin.patch(`/api/admin/enquiries/${id}`, { reference: "ENQ-hack" })).status, 422);
    assert.equal((await admin.patch(`/api/admin/enquiries/000000000000000000000000`, { status: "won" })).status, 404);
    assert.equal((await admin.patch(`/api/admin/enquiries/not-an-id`, { status: "won" })).status, 404);
  });

  it("assigns, unassigns and normalises tags/priority", async () => {
    const id = (await findByRef((await submit()).body.data.reference)).id;
    const me = (await admin.get("/api/admin/auth/me")).body.data;

    const assigned = await admin.patch(`/api/admin/enquiries/${id}`, { assignedTo: me.id, priority: "high", tags: ["Urgent", "urgent", "ppe"] });
    assert.equal(assigned.body.data.assignedTo.id, me.id);
    assert.equal(assigned.body.data.priority, "high");
    assert.deepEqual(assigned.body.data.tags.sort(), ["ppe", "urgent"]);

    const mine = await admin.get(`/api/admin/enquiries?assignedTo=${me.id}&q=apex-test`);
    assert.ok(mine.body.data.some((e: { id: string }) => e.id === id));

    assert.equal((await admin.patch(`/api/admin/enquiries/${id}`, { assignedTo: "000000000000000000000000" })).status, 422);
    assert.equal((await admin.patch(`/api/admin/enquiries/${id}`, { assignedTo: null })).body.data.assignedTo, null);
  });

  it("supports internal notes with author-only deletion", async () => {
    const id = (await findByRef((await submit()).body.data.reference)).id;
    const added = await admin.post(`/api/admin/enquiries/${id}/notes`, { body: "Called, will revisit Monday." });
    assert.equal(added.status, 201);
    assert.equal(added.body.data.notes.length, 1);
    const noteId = added.body.data.notes[0].id;

    const { client: sales } = await userClient(admin, "sales");
    assert.equal((await sales.del(`/api/admin/enquiries/${id}/notes/${noteId}`)).status, 403);
    assert.equal((await admin.post(`/api/admin/enquiries/${id}/notes`, { body: "" })).status, 422);

    const removed = await admin.del(`/api/admin/enquiries/${id}/notes/${noteId}`);
    assert.equal(removed.body.data.notes.length, 0);
  });

  it("re-sends notifications on demand", async () => {
    await mailpit.clear();
    const email = `resend-${uid()}@example.com`;
    const ref = (await submit({ email })).body.data.reference;
    await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
    const id = (await findByRef(ref)).id;

    const r = await admin.post(`/api/admin/enquiries/${id}/resend`, { channels: ["customer"] });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.notifications.customer.attempts, 2);
    await sleep(500);
    assert.equal((await mailpit.list()).filter((m) => m.To.some((t) => t.Address === email)).length, 2);
  });

  it("bulk-updates status and assignment, and restricts bulk delete to admins", async () => {
    const tag = uid();
    const ids = [] as string[];
    for (const n of [1, 2]) ids.push((await findByRef((await submit({ message: `bulk ${tag} ${n} apex-test` })).body.data.reference)).id);

    const status = await admin.post("/api/admin/enquiries/bulk", { action: "status", ids, status: "quoted" });
    assert.equal(status.body.data.affected, 2);
    const repeat = await admin.post("/api/admin/enquiries/bulk", { action: "status", ids, status: "quoted" });
    assert.equal(repeat.body.data.affected, 0, "unchanged items are not touched or re-logged");

    const { client: sales } = await userClient(admin, "sales");
    assert.equal((await sales.post("/api/admin/enquiries/bulk", { action: "status", ids, status: "won" })).status, 200);
    assert.equal((await sales.post("/api/admin/enquiries/bulk", { action: "delete", ids })).status, 403);
    assert.equal((await admin.post("/api/admin/enquiries/bulk", { action: "delete", ids })).body.data.affected, 2);
    assert.equal((await admin.post("/api/admin/enquiries/bulk", { action: "delete", ids: ["bad"] })).status, 422);
  });

  it("exports CSV with Excel BOM and formula-injection protection", async () => {
    const tag = uid();
    await submit({ name: `=HYPERLINK("http://evil","x") ${tag}`, message: `csv export, with "quotes"\nand newline ${tag} apex-test` });
    const r = await admin.get(`/api/admin/enquiries/export?q=${tag}`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(r.headers.get("content-disposition") ?? "", /attachment; filename="enquiries-\d{4}-\d{2}-\d{2}\.csv"/);
    assert.ok(r.text.startsWith("﻿Reference,Received,Status"));
    assert.ok(r.text.includes(`"'=HYPERLINK`), "leading = must be neutralised");
    assert.ok(r.text.includes('""quotes""'));
  });

  it("deletes (admin only)", async () => {
    const id = (await findByRef((await submit()).body.data.reference)).id;
    const { client: sales } = await userClient(admin, "sales");
    assert.equal((await sales.del(`/api/admin/enquiries/${id}`)).status, 403);
    assert.equal((await admin.del(`/api/admin/enquiries/${id}`)).status, 204);
    assert.equal((await admin.get(`/api/admin/enquiries/${id}`)).status, 404);
  });

  it("feeds the dashboard", async () => {
    await submit();
    const d = (await admin.get("/api/admin/dashboard")).body.data;
    assert.ok(d.enquiries.byStatus.new >= 1);
    assert.equal(d.enquiries.last14Days.length, 14);
    assert.ok(d.enquiries.recent.length > 0);
    assert.equal(d.content.products >= 39, true);
  });
});
