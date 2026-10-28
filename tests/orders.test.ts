import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client, adminClient, mailpit, purgeTestUsers, readyToken, sleep, uid, userClient } from "./helpers";

/**
 * Quote orders: the public basket checkout, its defences, customer tracking, the admin order desk
 * (triage, notes, bulk, CSV, dashboard) and who may do what.
 */

let admin: Client;
let token: string;
const MARK = `zz-order-${uid()}`;
const ALL = "new,quoted,confirmed,dispatched,delivered,cancelled,spam";
const anon = () => new Client();

const order = (over: Record<string, unknown> = {}) => ({
  items: [
    { product: "head-protection", quantity: 120, note: "White, ISI marked" },
    { product: "fire-extinguisher", quantity: 8 },
  ],
  name: `${MARK} Buyer`,
  mobile: "98765 22334",
  email: `buyer-${uid()}@example.com`,
  company: "Coastal Chemicals",
  gstin: "33abcde1234f1z5",
  address: { line1: "Plot 12, SIPCOT Phase II", city: "Cuddalore", state: "Tamil Nadu", postalCode: "607005" },
  notes: `Deliver before the 30th. ${uid()}`,
  token,
  ...over,
});

before(async () => {
  admin = await adminClient();
  await mailpit.clear();
  token = await readyToken(anon());
});

after(async () => {
  const list = await admin.get(`/api/admin/orders?q=${MARK}&status=${ALL}&limit=100`);
  const ids = (list.body?.data ?? []).map((o: { id: string }) => o.id);
  if (ids.length) await admin.post("/api/admin/orders/bulk", { action: "delete", ids });
  await purgeTestUsers(admin);
});

async function place(over: Record<string, unknown> = {}, client = anon()) {
  return client.post("/api/orders", order(over));
}

async function findByRef(reference: string) {
  return (await admin.get(`/api/admin/orders?q=${reference}&status=${ALL}`)).body.data[0];
}

describe("placing an order", () => {
  let reference = "";

  it("stores it with an ORD reference, normalised details and product titles", async () => {
    const r = await place();
    assert.equal(r.status, 201, r.text);
    reference = r.body.data.reference;
    assert.match(reference, /^ORD-\d{4}-\d{6}$/);

    const stored = await findByRef(reference);
    assert.equal(stored.status, "new");
    assert.equal(stored.mobile, "+919876522334");
    assert.equal(stored.gstin, "33ABCDE1234F1Z5");
    assert.deepEqual(
      stored.items.map((i: { product: { slug: string; title: string }; quantity: number }) => [i.product.slug, i.quantity]),
      [["head-protection", 120], ["fire-extinguisher", 8]],
    );
    assert.equal(stored.items[0].product.title, "Head Protection");
    assert.equal(stored.totalUnits, 128);
    assert.equal(stored.address.city, "Cuddalore");
  });

  it("emails the sales team (reply-to the customer) and confirms to the customer", async () => {
    const sales = await mailpit.waitFor((m) => m.Subject.includes(reference) && m.To.some((t) => t.Address === "sales@apexcare.local"));
    assert.match(sales.Subject, /New order: 2 items/);
    const body = await mailpit.body(sales.ID);
    assert.match(body.Text, /Head Protection x 120 \(White, ISI marked\)/);
    assert.match(body.Text, /33ABCDE1234F1Z5/);
    assert.ok(body.ReplyTo?.some((r) => r.Address.startsWith("buyer-")));

    const customer = await mailpit.waitFor((m) => m.Subject === `We received your order (${reference})`);
    assert.match((await mailpit.body(customer.ID)).Text, /\/quote\/track/);

    await sleep(300);
    const stored = await findByRef(reference);
    assert.equal(stored.notifications.sales.status, "sent");
    assert.equal(stored.notifications.customer.status, "sent");
  });

  it("merges repeated lines for the same product and note", async () => {
    const r = await place({
      items: [
        { product: "eye-protection", quantity: 10, note: "Clear" },
        { product: "eye-protection", quantity: 5, note: "clear" },
        { product: "eye-protection", quantity: 2, note: "Smoke" },
      ],
      mobile: "9876522335",
    });
    assert.equal(r.status, 201, r.text);
    const stored = await findByRef(r.body.data.reference);
    assert.deepEqual(stored.items.map((i: { quantity: number; note: string }) => [i.quantity, i.note]), [[15, "Clear"], [2, "Smoke"]]);
  });

  it("collapses an accidental double submit onto the same reference", async () => {
    const client = anon();
    const first = await place({ mobile: "9876522336" }, client);
    const second = await place({ mobile: "9876522336" }, client);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.duplicate, true);
    assert.equal(second.body.data.reference, first.body.data.reference);
  });
});

describe("order validation", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["an empty basket", { items: [] }, "items"],
    ["a zero quantity", { items: [{ product: "head-protection", quantity: 0 }] }, "items.0.quantity"],
    ["a huge quantity", { items: [{ product: "head-protection", quantity: 1_000_001 }] }, "items.0.quantity"],
    ["a bad PIN code", { address: { line1: "Plot 1", city: "Cuddalore", state: "Tamil Nadu", postalCode: "12345" } }, "address.postalCode"],
    ["a missing city", { address: { line1: "Plot 1", city: "", state: "Tamil Nadu", postalCode: "607005" } }, "address.city"],
    ["a bad GSTIN", { gstin: "12345" }, "gstin"],
    ["a bad mobile", { mobile: "12345" }, "mobile"],
  ];
  for (const [label, over, path] of cases) {
    it(`rejects ${label}`, async () => {
      const r = await place(over);
      assert.equal(r.status, 422, r.text);
      assert.ok(r.body.error.details.some((d: { path: string }) => d.path === path), JSON.stringify(r.body.error.details));
    });
  }

  it("rejects unknown or hidden products, pointing at the basket line", async () => {
    const r = await place({ items: [{ product: "head-protection", quantity: 1 }, { product: "no-such-product", quantity: 2 }] });
    assert.equal(r.status, 422);
    assert.deepEqual(r.body.error.details.map((d: { path: string }) => d.path), ["items.1.product"]);
  });

  it("rejects unknown fields and a forged form token", async () => {
    assert.equal((await place({ price: 1 })).status, 422);
    const forged = await place({ token: "1.abc.0123456789abcdef0123456789abcdef" });
    assert.equal(forged.status, 400);
    assert.equal(forged.body.error.code, "INVALID_FORM_TOKEN");
  });

  it("quietly files bot submissions (honeypot) as spam, unseen and unemailed", async () => {
    const r = await place({ website: "http://bot.example", mobile: "9876522337" });
    assert.equal(r.status, 201);
    const stored = await findByRef(r.body.data.reference);
    assert.equal(stored.status, "spam");
    const inbox = await admin.get(`/api/admin/orders?q=${r.body.data.reference}`);
    assert.equal(inbox.body.data.length, 0, "spam is hidden from the default list");
    await sleep(500);
    const after = await findByRef(r.body.data.reference);
    assert.equal(after.notifications.sales.status, "skipped", "spam is never emailed to the team");
  });
});

describe("customer tracking", () => {
  let reference = "";
  before(async () => {
    reference = (await place({ mobile: "9876522338" })).body.data.reference;
  });

  it("needs the right mobile number, and shows items but no address", async () => {
    const wrong = await anon().post("/api/orders/track", { reference, mobile: "9123456780" });
    assert.equal(wrong.status, 404);

    const r = await anon().post("/api/orders/track", { reference, mobile: "+91 98765 22338" });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, "Received");
    assert.equal(r.body.data.step, 1);
    assert.deepEqual(r.body.data.steps, ["Received", "Quote sent", "Confirmed", "Dispatched", "Delivered"]);
    assert.equal(r.body.data.items.length, 2);
    assert.ok(!r.text.includes("SIPCOT"), "the delivery address is never exposed");
    assert.ok(!r.text.includes("notes"), "internal notes are never exposed");
  });

  it("follows the status the team sets, including cancellation", async () => {
    const id = (await findByRef(reference)).id;
    await admin.patch(`/api/admin/orders/${id}`, { status: "dispatched" });
    let r = await anon().post("/api/orders/track", { reference, mobile: "9876522338" });
    assert.equal(r.body.data.status, "Dispatched");
    assert.equal(r.body.data.step, 4);

    await admin.patch(`/api/admin/orders/${id}`, { status: "cancelled" });
    r = await anon().post("/api/orders/track", { reference, mobile: "9876522338" });
    assert.equal(r.body.data.status, "Cancelled");
    assert.equal(r.body.data.cancelled, true);
  });

  it("rejects malformed references", async () => {
    assert.equal((await anon().post("/api/orders/track", { reference: "ENQ-2026-000001", mobile: "9876522338" })).status, 422);
  });
});

describe("the admin order desk", () => {
  let id = "";
  let reference = "";
  before(async () => {
    reference = (await place({ mobile: "9876522339" })).body.data.reference;
    id = (await findByRef(reference)).id;
  });

  it("changes status with history and records the first response", async () => {
    const r = await admin.patch(`/api/admin/orders/${id}`, { status: "quoted" });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, "quoted");
    assert.ok(r.body.data.firstResponseAt);
    assert.deepEqual(r.body.data.statusHistory.map((h: { status: string }) => h.status), ["new", "quoted"]);
  });

  it("assigns, adds and removes internal notes", async () => {
    const me = (await admin.get("/api/admin/auth/me")).body.data;
    assert.equal((await admin.patch(`/api/admin/orders/${id}`, { assignedTo: me.id })).body.data.assignedTo.id, me.id);

    const noted = await admin.post(`/api/admin/orders/${id}/notes`, { body: "Quoted ₹1,24,000 + GST" });
    assert.equal(noted.status, 201);
    const noteId = noted.body.data.notes[0].id;
    const removed = await admin.del(`/api/admin/orders/${id}/notes/${noteId}`);
    assert.equal(removed.body.data.notes.length, 0);
  });

  it("filters by status, product and text", async () => {
    const byProduct = await admin.get(`/api/admin/orders?product=fire-extinguisher&q=${MARK}&status=${ALL}`);
    assert.ok(byProduct.body.data.length >= 1);
    assert.ok(byProduct.body.data.every((o: { items: { product: { slug: string } }[] }) => o.items.some((i) => i.product.slug === "fire-extinguisher")));
    const quoted = await admin.get(`/api/admin/orders?status=quoted&q=${reference}`);
    assert.equal(quoted.body.data.length, 1);
    const byCity = await admin.get(`/api/admin/orders?q=Cuddalore&status=${ALL}&limit=100`);
    assert.ok(byCity.body.data.some((o: { reference: string }) => o.reference === reference));
  });

  it("bulk-updates statuses", async () => {
    const r = await admin.post("/api/admin/orders/bulk", { action: "status", ids: [id], status: "confirmed" });
    assert.equal(r.body.data.affected, 1);
    assert.equal((await admin.get(`/api/admin/orders/${id}`)).body.data.status, "confirmed");
  });

  it("exports CSV with one row per order line, safe for Excel", async () => {
    const r = await admin.get(`/api/admin/orders/export?q=${reference}&status=${ALL}`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /text\/csv/);
    assert.ok(r.text.startsWith("﻿"));
    const lines = r.text.trim().split("\r\n");
    assert.equal(lines.length, 3, "header + one row per product line");
    assert.match(lines[1], /Head Protection/);
  });

  it("shows orders on the dashboard and in analytics", async () => {
    const dash = (await admin.get("/api/admin/dashboard")).body.data;
    assert.ok(dash.orders.open >= 1);
    assert.equal(dash.orders.last14Days.length, 14);
    assert.ok(dash.orders.recent.length >= 1);
    const stats = (await admin.get("/api/admin/analytics?days=7")).body.data;
    assert.ok(stats.totals.orders >= 1);
  });

  it("re-sends notifications on request", async () => {
    const r = await admin.post(`/api/admin/orders/${id}/resend`, { channels: ["customer"] });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.notifications.customer.status, "sent");
    assert.ok(r.body.data.notifications.customer.attempts >= 2);
  });
});

describe("order permissions", () => {
  it("sales handle orders but cannot delete them; editors cannot see them", async () => {
    const reference = (await place({ mobile: "9876522340" })).body.data.reference;
    const id = (await findByRef(reference)).id;

    const { client: sales } = await userClient(admin, "sales");
    assert.equal((await sales.get("/api/admin/orders")).status, 200);
    assert.equal((await sales.patch(`/api/admin/orders/${id}`, { status: "quoted" })).status, 200);
    assert.equal((await sales.del(`/api/admin/orders/${id}`)).status, 403);
    assert.equal((await sales.post("/api/admin/orders/bulk", { action: "delete", ids: [id] })).status, 403);
    assert.ok((await sales.get("/api/admin/dashboard")).body.data.orders, "sales see the orders section");

    const { client: editor } = await userClient(admin, "editor");
    assert.equal((await editor.get("/api/admin/orders")).status, 403);
    assert.equal((await editor.get(`/api/admin/orders/${id}`)).status, 403);

    assert.equal((await anon().get("/api/admin/orders")).status, 401);
    assert.equal((await admin.del(`/api/admin/orders/${id}`)).status, 204);
  });
});
