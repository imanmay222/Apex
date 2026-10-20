import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, adminClient, mailpit, purgeTestEnquiries, purgeTestUsers, readyToken, sleep, uid, userClient } from "./helpers";

let admin: Client;
let token: string;
const MARK = `zz-test-${uid()}`;
const anon = () => new Client();

before(async () => {
  admin = await adminClient();
  await mailpit.clear();
  token = await readyToken(anon());
});

after(async () => {
  const q = await admin.get(`/api/admin/content/testimonials?q=${MARK}&limit=100`);
  for (const t of q.body?.data ?? []) await admin.del(`/api/admin/content/testimonials/${t.id}`);
  const subs = await admin.get(`/api/admin/subscribers?q=${MARK}&limit=100`);
  for (const s of subs.body?.data ?? []) await admin.del(`/api/admin/subscribers/${s.id}`);
  await purgeTestEnquiries(admin);
  await purgeTestUsers(admin);
});

/* -------------------------------------------------------------------------------------------- */

describe("customer testimonials", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    name: `${MARK} Customer ${uid()}`,
    company: "Acme Industries",
    quote: `Reliable supplier, delivered on schedule and the team trained our operators. ${uid()}`,
    rating: 5,
    email: `fan-${uid()}@example.com`,
    token,
    ...over,
  });
  const queue = async () => (await admin.get(`/api/admin/content/testimonials?source=public&published=false&q=${MARK}&limit=100`)).body.data;

  it("is stored unpublished and kept off the public site", async () => {
    const payload = body();
    const r = await anon().post("/api/testimonials", payload);
    assert.equal(r.status, 201, r.text);
    assert.match(r.body.data.message, /approved/);

    const pending = (await queue()).find((t: { name: string }) => t.name === payload.name);
    assert.ok(pending, "appears in the moderation queue");
    assert.equal(pending.published, false);
    assert.equal(pending.source, "public");
    assert.equal(pending.submitterEmail, payload.email, "admins can see who to follow up with");

    const publicList = await anon().get("/api/testimonials");
    assert.ok(!publicList.text.includes(payload.name), "not public until approved");
    assert.ok(!publicList.text.includes(payload.email as string), "submitter email never public");
  });

  it("emails the team that a review is waiting", async () => {
    await mailpit.clear();
    const payload = body({ name: `${MARK} Mail ${uid()}` });
    await anon().post("/api/testimonials", payload);
    const mail = await mailpit.waitFor((m) => m.Subject.includes("awaiting review") && m.Subject.includes(payload.name));
    assert.ok(mail.To.some((t) => t.Address === "sales@apexcare.local"));
  });

  it("goes live once an editor approves it, and can be rejected by deleting", async () => {
    const payload = body({ name: `${MARK} Approve ${uid()}` });
    await anon().post("/api/testimonials", payload);
    const item = (await queue()).find((t: { name: string }) => t.name === payload.name);

    assert.equal((await admin.patch(`/api/admin/content/testimonials/${item.id}`, { published: true })).status, 200);
    const live = (await anon().get("/api/testimonials")).body.data;
    const shown = live.find((t: { name: string }) => t.name === payload.name);
    assert.ok(shown, "visible after approval");
    assert.equal("submitterEmail" in shown, false);
    assert.equal(shown.company, "Acme Industries");

    assert.equal((await admin.del(`/api/admin/content/testimonials/${item.id}`)).status, 204);
    assert.ok(!(await anon().get("/api/testimonials")).text.includes(payload.name));
  });

  it("silently drops spam, honeypot hits and repeats while still answering success", async () => {
    const before = (await queue()).length;
    assert.equal((await anon().post("/api/testimonials", body({ website: "http://bot.example" }))).status, 201);
    assert.equal((await anon().post("/api/testimonials", body({ quote: "Cheap backlinks here http://a.com http://b.com http://c.com seo services" }))).status, 201);

    const repeat = body();
    assert.equal((await anon().post("/api/testimonials", repeat)).status, 201);
    assert.equal((await anon().post("/api/testimonials", repeat)).status, 201);
    assert.equal((await queue()).length, before + 1, "only the single genuine, non-repeated review was stored");
  });

  it("validates input and requires a valid form token", async () => {
    // A fresh client per call keeps each check clear of the 4-per-10-minutes limiter.
    assert.equal((await anon().post("/api/testimonials", body({ quote: "too short" }))).status, 422);
    assert.equal((await anon().post("/api/testimonials", body({ rating: 6 }))).status, 422);
    assert.equal((await anon().post("/api/testimonials", body({ email: "nope" }))).status, 422);
    assert.equal((await anon().post("/api/testimonials", body({ published: true }))).status, 422, "cannot self-publish");
    const forged = await anon().post("/api/testimonials", body({ token: "1.abc.0123456789abcdef0123456789abcdef" }));
    assert.equal(forged.status, 400);
    assert.equal(forged.body.error.code, "INVALID_FORM_TOKEN");
  });

  it("rate-limits a single IP", async () => {
    const c = anon();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await c.post("/api/testimonials", body())).status);
    assert.deepEqual(statuses.slice(0, 4), [201, 201, 201, 201]);
    assert.equal(statuses[4], 429);
  });

  it("keeps the moderation queue admin-only", async () => {
    assert.equal((await anon().get("/api/admin/content/testimonials?source=public")).status, 401);
    const { client: sales } = await userClient(admin, "sales");
    assert.equal((await sales.get("/api/admin/content/testimonials")).status, 403);
  });
});

/* -------------------------------------------------------------------------------------------- */

describe("enquiry tracking", () => {
  const make = async (over: Record<string, unknown> = {}) => {
    const r = await anon().post("/api/enquiries", {
      name: "Track Tester",
      mobile: "98765 43210",
      type: "survey",
      subject: "fit-testing",
      message: `Please book a fit test for our team ${uid()} apex-test`,
      token,
      ...over,
    });
    return r.body.data.reference as string;
  };
  const track = (reference: string, mobile: string, c = anon()) => c.post("/api/enquiries/track", { reference, mobile });

  it("shows a customer where their enquiry stands, without internal details", async () => {
    const reference = await make({ email: `t-${uid()}@example.com` });
    const r = await track(reference, "+91 98765-43210");
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.data.status, "Received");
    assert.equal(r.body.data.step, 1);
    assert.equal(r.body.data.subject, "Respirator Fit Testing");
    for (const secret of ["notes", "assignedTo", "spam", "email", "mobile", "message", "tags", "notifications", "client"]) {
      assert.equal(secret in r.body.data, false, `${secret} must not be exposed`);
    }

    const id = (await admin.get(`/api/admin/enquiries?q=${reference}`)).body.data[0].id;
    await admin.post(`/api/admin/enquiries/${id}/notes`, { body: "internal-only note" });
    await admin.patch(`/api/admin/enquiries/${id}`, { status: "contacted" });
    await admin.patch(`/api/admin/enquiries/${id}`, { status: "quoted" });

    const after = await track(reference, "9876543210");
    assert.equal(after.body.data.status, "Quote sent");
    assert.deepEqual(after.body.data.history.map((h: { status: string }) => h.status), ["Received", "In progress", "Quote sent"]);
    assert.ok(!after.text.includes("internal-only note"));
  });

  it("needs the matching mobile number, and misses look identical to mismatches", async () => {
    const reference = await make();
    const wrongMobile = await track(reference, "9123456780");
    const unknownRef = await track("ENQ-2026-999999", "9876543210");
    assert.equal(wrongMobile.status, 404);
    assert.equal(unknownRef.status, 404);
    assert.deepEqual(wrongMobile.body.error, unknownRef.body.error);
  });

  it("treats spam as nonexistent", async () => {
    const reference = await make({ website: "http://bot.example" });
    assert.equal((await track(reference, "9876543210")).status, 404);
  });

  it("validates input", async () => {
    assert.equal((await track("not-a-reference", "9876543210")).status, 422);
    assert.equal((await track("ENQ-2026-000001", "123")).status, 422);
    assert.equal((await anon().post("/api/enquiries/track", { reference: "ENQ-2026-000001", mobile: "9876543210", extra: 1 })).status, 422);
  });

  it("limits guessing per reference even across many IPs", async () => {
    const reference = "ENQ-2026-000777";
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await track(reference, "9876543210")).status);
    assert.equal(statuses.slice(0, 8).every((s) => s === 404), true);
    assert.equal(statuses[8], 429);
  });
});

/* -------------------------------------------------------------------------------------------- */

describe("newsletter (double opt-in)", () => {
  const address = () => `${MARK}-${uid()}@example.com`;
  const subscribe = (email: string, over: Record<string, unknown> = {}, c = anon()) => c.post("/api/newsletter/subscribe", { email, token, ...over });
  const find = async (email: string) => (await admin.get(`/api/admin/subscribers?q=${encodeURIComponent(email)}`)).body.data[0];

  async function linkFor(email: string, kind: "confirm" | "unsubscribe") {
    const mail = await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
    const text = (await mailpit.body(mail.ID)).Text;
    const url = text.match(new RegExp(`https?://\\S*/api/newsletter/${kind}\\?token=\\S+`))?.[0];
    assert.ok(url, `no ${kind} link in email:\n${text}`);
    return new URL(url!).pathname + new URL(url!).search;
  }
  const form = (path: string, token: string) =>
    fetch(`${BASE}${path.split("?")[0]}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });

  it("creates a pending subscriber and emails a confirmation link", async () => {
    const email = address();
    const r = await subscribe(email, { name: "Pat" });
    assert.equal(r.status, 201, r.text);
    assert.equal((await find(email)).status, "pending");

    const link = await linkFor(email, "confirm");
    assert.match(link, /token=[\w-]+\.[0-9a-f]{64}$/);
  });

  it("only subscribes after the link's button is pressed (scanner-safe)", async () => {
    const email = address();
    await subscribe(email);
    const link = await linkFor(email, "confirm");

    const page = await fetch(`${BASE}${link}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<button type="submit">Confirm subscription<\/button>/);
    assert.match(page.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.equal((await find(email)).status, "pending", "merely opening the link changes nothing");

    const token = new URL(`${BASE}${link}`).searchParams.get("token")!;
    const done = await form(link, token);
    assert.equal(done.status, 200);
    assert.match(await done.text(), /You&#39;re subscribed|You're subscribed/);
    const subscriber = await find(email);
    assert.equal(subscriber.status, "subscribed");
    assert.ok(subscriber.confirmedAt);

    assert.equal((await form(link, token)).status, 200, "idempotent");
  });

  it("answers identically for new and already-subscribed addresses and sends no extra mail", async () => {
    const email = address();
    await subscribe(email);
    const token2 = new URL(`${BASE}${await linkFor(email, "confirm")}`).searchParams.get("token")!;
    await form("/api/newsletter/confirm", token2);

    await mailpit.clear();
    const again = await subscribe(email);
    assert.equal(again.status, 201);
    await sleep(1500);
    assert.equal((await mailpit.list()).filter((m) => m.To.some((t) => t.Address === email)).length, 0);
  });

  it("does not re-send a pending confirmation more than once every few minutes", async () => {
    const email = address();
    await subscribe(email);
    await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
    await sleep(500);
    await mailpit.clear();
    await subscribe(email);
    await sleep(1500);
    assert.equal((await mailpit.list()).length, 0);
  });

  it("rejects forged, wrong-purpose and garbage tokens", async () => {
    const email = address();
    await subscribe(email);
    const confirmLink = await linkFor(email, "confirm");
    const good = new URL(`${BASE}${confirmLink}`).searchParams.get("token")!;

    const [body, sig] = good.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ a: "confirm", id: "000000000000000000000000" })).toString("base64url")}.${sig}`;
    assert.equal((await form("/api/newsletter/confirm", tampered)).status, 400);
    assert.equal((await form("/api/newsletter/confirm", "garbage")).status, 400);
    assert.equal((await form("/api/newsletter/confirm", `${body}.`)).status, 400);
    assert.equal((await form("/api/newsletter/unsubscribe", good)).status, 400, "a confirm token cannot unsubscribe");
    assert.equal((await fetch(`${BASE}/api/newsletter/confirm?token=nope`)).status, 400);
    assert.equal((await find(email)).status, "pending");
  });

  it("unsubscribes with one click, and re-subscribing needs a fresh confirmation", async () => {
    const email = address();
    await subscribe(email);
    const confirm = new URL(`${BASE}${await linkFor(email, "confirm")}`).searchParams.get("token")!;
    await form("/api/newsletter/confirm", confirm);

    const confirmMail = (await mailpit.list()).find((m) => m.To.some((t) => t.Address === email))!;
    const unsub = (await mailpit.body(confirmMail.ID)).Text.match(/\/api\/newsletter\/unsubscribe\?token=(\S+)/)![1];

    const page = await fetch(`${BASE}/api/newsletter/unsubscribe?token=${unsub}`);
    assert.match(await page.text(), /Unsubscribe me/);
    assert.equal((await find(email)).status, "subscribed", "page view alone does nothing");

    assert.equal((await form("/api/newsletter/unsubscribe", unsub)).status, 200);
    assert.equal((await find(email)).status, "unsubscribed");
    assert.equal((await form("/api/newsletter/confirm", confirm)).status, 410, "old confirm link is dead after unsubscribing");

    await mailpit.clear();
    await subscribe(email);
    assert.equal((await find(email)).status, "pending");
    await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
  });

  it("ignores bots (honeypot / spam) without telling them", async () => {
    const email = address();
    await mailpit.clear();
    assert.equal((await subscribe(email, { website: "http://x.example" })).status, 201);
    await sleep(1200);
    assert.equal(await find(email), undefined);
    assert.equal((await mailpit.list()).length, 0);
  });

  it("validates input and enforces the form token and a rate limit", async () => {
    assert.equal((await subscribe("not-an-email")).status, 422);
    assert.equal((await anon().post("/api/newsletter/subscribe", { email: address() })).status, 422);
    assert.equal((await subscribe(address(), { token: "1.abc.0123456789abcdef0123456789abcdef" })).status, 400);
    const c = anon();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await subscribe(address(), {}, c)).status);
    assert.equal(statuses[5], 429);
  });

  it("gives admins a list, a CSV export of confirmed subscribers, and erasure", async () => {
    const confirmed = address();
    const pending = address();
    await subscribe(confirmed);
    await subscribe(pending);
    const tok = new URL(`${BASE}${await linkFor(confirmed, "confirm")}`).searchParams.get("token")!;
    await form("/api/newsletter/confirm", tok);

    const list = await admin.get(`/api/admin/subscribers?q=${MARK}&status=subscribed`);
    assert.ok(list.body.data.some((s: { email: string }) => s.email === confirmed));
    assert.ok(!list.body.data.some((s: { email: string }) => s.email === pending));
    assert.ok(list.body.meta.byStatus.subscribed >= 1);

    const csv = await admin.get(`/api/admin/subscribers/export?q=${MARK}`);
    assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
    assert.ok(csv.text.includes(confirmed) && !csv.text.includes(pending), "export defaults to people who consented");

    const { client: sales } = await userClient(admin, "sales");
    const { client: editor } = await userClient(admin, "editor");
    assert.equal((await sales.get("/api/admin/subscribers")).status, 200);
    assert.equal((await editor.get("/api/admin/subscribers")).status, 403);
    const target = await find(pending);
    assert.equal((await sales.del(`/api/admin/subscribers/${target.id}`)).status, 403);
    assert.equal((await admin.del(`/api/admin/subscribers/${target.id}`)).status, 204);
    assert.equal(await find(pending), undefined);
    assert.equal((await admin.del(`/api/admin/subscribers/${target.id}`)).status, 404);
  });
});

/* -------------------------------------------------------------------------------------------- */

describe("content import / restore", () => {
  const exportAll = async () => JSON.parse((await admin.get("/api/admin/export")).text);
  const productCount = async () => (await admin.get("/api/admin/content/products?limit=1")).body.meta.total;

  it("merge restores a deleted item and creates nothing else", async () => {
    const snapshot = await exportAll();
    const victim = (await admin.get("/api/admin/content/products?q=raincoat")).body.data[0];
    assert.equal((await admin.del(`/api/admin/content/products/${victim.id}`)).status, 204);
    assert.equal((await anon().get("/api/products/raincoat")).status, 404);

    const r = await admin.post("/api/admin/import", snapshot);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.data.mode, "merge");
    assert.equal(r.body.data.collections.products.created, 1);
    assert.equal(r.body.data.collections.surveys.created, 0);
    assert.equal((await anon().get("/api/products/raincoat")).status, 200, "visible again immediately");
  });

  it("replace needs explicit confirmation, then makes the database match the file exactly", async () => {
    const snapshot = await exportAll();
    const before = await productCount();

    assert.equal((await admin.post("/api/admin/import?mode=replace", snapshot)).status, 422);

    const junk = await admin.post("/api/admin/content/products", {
      title: `${MARK} junk`, summary: "Added after the snapshot.", image: { src: "/media/products/head-production.png", alt: "x" }, group: "ppe",
    });
    assert.equal(junk.status, 201);
    assert.equal(await productCount(), before + 1);

    const r = await admin.post("/api/admin/import?mode=replace&confirm=true", snapshot);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.data.collections.products.deleted, before + 1);
    assert.equal(r.body.data.collections.products.created, before);
    assert.equal(await productCount(), before);
    assert.equal((await anon().get(`/api/products/${junk.body.data.slug}`)).status, 404);
    assert.equal((await anon().get("/api/products/head-protection")).status, 200);
  });

  it("restores settings too", async () => {
    const snapshot = await exportAll();
    const original = snapshot.settings.tagline;
    await admin.patch("/api/admin/settings", { tagline: `${MARK} changed` });
    assert.equal((await anon().get("/api/settings")).body.data.tagline, `${MARK} changed`);

    const r = await admin.post("/api/admin/import", snapshot);
    assert.equal(r.body.data.settingsUpdated, true);
    assert.equal((await anon().get("/api/settings")).body.data.tagline, original);
  });

  it("rejects the whole file when any item is invalid, changing nothing", async () => {
    const snapshot = await exportAll();
    const before = await productCount();
    snapshot.collections.products[0].image.src = "javascript:alert(1)";
    snapshot.collections.products[1].group = "no-such-group";
    snapshot.collections.surveys[0].description = "short";

    const r = await admin.post("/api/admin/import", snapshot);
    assert.equal(r.status, 422);
    const paths = r.body.error.details.map((d: { path: string }) => d.path);
    assert.ok(paths.includes("collections.products[0].image.src"), paths.join());
    assert.ok(paths.includes("collections.products[1].group"));
    assert.ok(paths.includes("collections.surveys[0].description"));
    assert.equal(await productCount(), before);
  });

  it("rejects wrong versions, unknown collections and non-snapshots", async () => {
    const snapshot = await exportAll();
    assert.equal((await admin.post("/api/admin/import", { ...snapshot, version: 2 })).status, 422);
    assert.equal((await admin.post("/api/admin/import", { ...snapshot, collections: { users: [] } })).status, 422);
    assert.equal((await admin.post("/api/admin/import", { hello: "world" })).status, 422);
    assert.equal((await admin.post("/api/admin/import?mode=nuke", snapshot)).status, 422);
  });

  it("is restricted to system administrators", async () => {
    const { client: editor } = await userClient(admin, "editor");
    assert.equal((await editor.post("/api/admin/import", { version: 1, collections: {} })).status, 403);
    assert.equal((await anon().post("/api/admin/import", { version: 1, collections: {} })).status, 401);
  });
});
