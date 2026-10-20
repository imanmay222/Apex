import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, adminClient, freshIp, purgeTestUsers, sleep, uid, userClient } from "./helpers";

let admin: Client;
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const RUN = uid();

before(async () => {
  admin = await adminClient();
});
after(async () => {
  await purgeTestUsers(admin);
});

async function event(body: unknown, ua = BROWSER, ip = freshIp()) {
  return new Client(ip).post("/api/analytics/events", body, { headers: { "User-Agent": ua } });
}

// Only look at events from this suite: other suites (e.g. the browser tests) share the database,
// and the report lists just the top 10, so an unscoped read depends on how busy the site was.
const SUITE_START = new Date(Date.now() - 2_000);
async function summary() {
  const to = new Date(Date.now() + 60_000).toISOString();
  return (await admin.get(`/api/admin/analytics?from=${SUITE_START.toISOString()}&to=${encodeURIComponent(to)}`)).body.data;
}

/** after() work runs post-response, so poll instead of racing it. */
async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (ok(v) || Date.now() > deadline) return v;
    await sleep(300);
  }
}

describe("analytics collection", () => {
  it("records page views and answers 204", async () => {
    const path = `/zz-test-${RUN}-a`;
    for (let i = 0; i < 3; i++) assert.equal((await event({ type: "page_view", path })).status, 204);
    const s = await summary();
    assert.equal(s.topPages.find((p: { name: string }) => p.name === path)?.count, 3);
  });

  it("counts unique visitors per day, not raw hits", async () => {
    const before = (await summary()).totals.visitors;
    const path = `/zz-test-${RUN}-v`;
    const ip = freshIp();
    await event({ type: "page_view", path }, BROWSER, ip);
    await event({ type: "page_view", path }, BROWSER, ip); // same visitor
    await event({ type: "page_view", path }, PHONE, ip); // same IP, different device => new visitor
    await event({ type: "page_view", path }, BROWSER, freshIp()); // new IP
    const after = (await summary()).totals.visitors;
    assert.equal(after - before, 3);
  });

  it("ignores bots and crawlers", async () => {
    const path = `/zz-test-${RUN}-bot`;
    for (const ua of ["Googlebot/2.1", "curl/8.0", "python-requests/2.31", ""]) assert.equal((await event({ type: "page_view", path }, ua)).status, 204);
    assert.equal((await summary()).topPages.find((p: { name: string }) => p.name === path), undefined);
  });

  it("never stores API/admin paths, and strips queries", async () => {
    await event({ type: "page_view", path: `/api/zz-${RUN}` });
    await event({ type: "page_view", path: `/admin/zz-${RUN}` });
    await event({ type: "page_view", path: `/zz-test-${RUN}-q/?email=a@b.com#frag` });
    const pages = (await summary()).topPages.map((p: { name: string }) => p.name);
    assert.ok(!pages.some((p: string) => p.includes(`/api/zz-${RUN}`) || p.includes("/admin/")));
    assert.ok(pages.includes(`/zz-test-${RUN}-q`));
    assert.ok(!pages.some((p: string) => p.includes("email=")), "query strings (possible PII) are dropped");
  });

  it("tracks product views, survey views and CTA clicks", async () => {
    await event({ type: "product_view", path: "/products/scba", ref: "zz-product" });
    await event({ type: "survey_view", path: "/survey/fit-testing", ref: "zz-survey" });
    await event({ type: "cta_click", path: "/", ref: `zz-cta-${RUN}` });
    const s = await summary();
    assert.ok(s.topProducts.some((p: { name: string }) => p.name === "zz-product"));
    assert.ok(s.topSurveys.some((p: { name: string }) => p.name === "zz-survey"));
    assert.ok(s.ctaClicks.some((p: { name: string }) => p.name === `zz-cta-${RUN}`));
  });

  it("classifies devices and referrers", async () => {
    await event({ type: "page_view", path: `/zz-test-${RUN}-d`, referrer: "https://www.google.com/search?q=x" }, PHONE);
    const s = await summary();
    assert.ok(s.devices.some((d: { name: string }) => d.name === "mobile"));
    assert.ok(s.referrers.some((r: { name: string }) => r.name === "google.com"));
  });

  it("only accepts client-reportable event types", async () => {
    for (const type of ["enquiry_submit", "catalogue_download", "search", "bogus"]) {
      assert.equal((await event({ type, path: "/" })).status, 422, type);
    }
    assert.equal((await event({ type: "page_view", path: "/", extra: 1 })).status, 422);
    assert.equal((await event({ type: "page_view" })).status, 422);
  });

  it("records server-side events: catalogue downloads, searches, enquiries", async () => {
    const base = await summary();
    const c = new Client();
    await c.get("/api/catalogue?from=/products", { headers: { "User-Agent": BROWSER } });
    await c.get(`/api/search?q=${encodeURIComponent(`zzsearch${RUN}`)}`, { headers: { "User-Agent": BROWSER } });

    const after = await eventually(summary, (s) => s.totals.catalogueDownloads > base.totals.catalogueDownloads && s.totals.searches > base.totals.searches);
    assert.equal(after.totals.catalogueDownloads - base.totals.catalogueDownloads, 1);
    assert.ok(after.topSearches.some((s: { name: string }) => s.name === `zzsearch${RUN}`));
  });

  it("rate-limits the beacon per IP (120/min)", async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    // 250 requests guarantees a 429 even if the fixed window rolls over part-way through.
    for (let i = 0; i < 250; i++) statuses.push((await event({ type: "page_view", path: `/zz-test-${RUN}-rl` }, BROWSER, ip)).status);
    assert.equal(statuses[0], 204);
    assert.ok(statuses.includes(429), "expected the limiter to engage");
  });
});

describe("analytics reporting", () => {
  it("returns a complete, well-formed summary", async () => {
    const s = await summary();
    for (const key of ["range", "totals", "timeseries", "topPages", "topProducts", "topSurveys", "topSearches", "ctaClicks", "devices", "referrers"]) {
      assert.ok(key in s, key);
    }
    for (const key of ["pageViews", "visitors", "enquiries", "conversionRate", "catalogueDownloads", "ctaClicks", "searches"]) {
      assert.ok(key in s.totals, key);
    }
    assert.ok(s.timeseries.length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(s.timeseries[0].date));
  });
  it("validates ranges", async () => {
    assert.equal((await admin.get("/api/admin/analytics?days=0")).status, 422);
    assert.equal((await admin.get("/api/admin/analytics?from=2030-01-02&to=2030-01-01")).status, 400);
    assert.equal((await admin.get("/api/admin/analytics?from=2020-01-01&to=2020-01-02")).status, 200);
  });
});

describe("audit log", () => {
  it("records who did what, without values", async () => {
    const created = await admin.post("/api/admin/content/training", { title: `zz-test-${RUN} audit`, summary: "Audit trail check.", icon: "Flame" });
    await admin.patch(`/api/admin/content/training/${created.body.data.id}`, { summary: "Edited summary" });
    await admin.del(`/api/admin/content/training/${created.body.data.id}`);

    const log = await admin.get("/api/admin/audit?resource=training&limit=10");
    const mine = log.body.data.filter((e: { resourceId: string }) => e.resourceId === created.body.data.id);
    assert.deepEqual(mine.map((e: { action: string }) => e.action).sort(), ["create", "delete", "update"]);
    const update = mine.find((e: { action: string }) => e.action === "update");
    assert.deepEqual(update.fields, ["summary"]);
    assert.equal(update.actor, process.env.ADMIN_EMAIL!.toLowerCase());
    assert.ok(!JSON.stringify(log.body).includes("Edited summary"), "field values are not stored");
  });

  it("logs sign-ins and failures", async () => {
    await new Client().login(process.env.ADMIN_EMAIL!, "wrong-password-xyz");
    const failed = await admin.get("/api/admin/audit?action=login-failed&limit=5");
    assert.ok(failed.body.data.length >= 1);
    assert.ok((await admin.get("/api/admin/audit?action=login&limit=5")).body.data.length >= 1);
  });

  it("filters and paginates", async () => {
    const page = await admin.get("/api/admin/audit?limit=2&page=2");
    assert.equal(page.body.data.length, 2);
    assert.ok(page.body.meta.total > 4);
    assert.equal((await admin.get("/api/admin/audit?from=2099-01-01")).body.data.length, 0);
    assert.equal((await admin.get("/api/admin/audit?bogus=1")).status, 422);
  });
});

describe("content export, cache and cron", () => {
  it("exports a content backup without secrets or people", async () => {
    const r = await admin.get("/api/admin/export");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-disposition") ?? "", /attachment; filename="apex-content-/);
    const backup = JSON.parse(r.text);
    assert.equal(backup.version, 1);
    assert.ok(backup.collections.products.length >= 39);
    for (const key of ["product-groups", "surveys", "training", "gallery", "testimonials", "logos", "leaders"]) assert.ok(Array.isArray(backup.collections[key]), key);
    assert.ok(backup.settings.companyName);
    assert.ok(!r.text.includes("passwordHash") && !r.text.includes("scrypt$") && !/tokenHash|"email":\s*"[^"]*@apexcare\.local"/.test(r.text));
  });

  it("purges caches on demand", async () => {
    const r = await admin.post("/api/admin/cache");
    assert.equal(r.status, 200);
    assert.ok(r.body.data.revalidated.includes("products"));
  });

  it("protects the cron endpoint", async () => {
    assert.equal((await new Client().post("/api/cron/notifications")).status, 401);
    assert.equal((await new Client().post("/api/cron/notifications", undefined, { headers: { Authorization: "Bearer wrong" } })).status, 401);
    const ok = await new Client().post("/api/cron/notifications", undefined, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal(ok.status, 200);
    assert.equal(typeof ok.body.data.examined, "number");
  });
});

describe("access to operational endpoints", () => {
  it("is closed to anonymous users", async () => {
    const c = new Client();
    for (const path of ["/api/admin/analytics", "/api/admin/audit", "/api/admin/export", "/api/admin/dashboard", "/api/admin/settings"]) {
      assert.equal((await c.get(path)).status, 401, path);
    }
  });
  it("lets sales read analytics but not audit", async () => {
    const { client } = await userClient(admin, "sales");
    assert.equal((await client.get("/api/admin/analytics")).status, 200);
    assert.equal((await client.get("/api/admin/audit")).status, 403);
  });
  it("serves nothing sensitive from guessable URLs", async () => {
    for (const path of ["/.env", "/docker-compose.yml", "/package.json", "/src/server/config/env.ts", "/api/admin"]) {
      const r = await fetch(`${BASE}${path}`);
      assert.ok([401, 404].includes(r.status), `${path} -> ${r.status}`);
    }
  });
});
