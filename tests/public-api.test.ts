import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASE, Client } from "./helpers";

const api = new Client();

describe("health", () => {
  it("reports database and mail status", async () => {
    const r = await api.get("/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, "ok");
    assert.equal(r.body.data.checks.database.status, "up");
    assert.equal(r.body.data.checks.mail.status, "configured");
  });
  it("is never cached", async () => assert.match((await api.get("/api/health")).headers.get("cache-control") ?? "", /no-store/));
});

describe("response conventions", () => {
  it("returns a request id and security headers", async () => {
    const r = await api.get("/api/stats");
    assert.match(r.headers.get("x-request-id") ?? "", /^[\w-]{8,}$/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });
  it("echoes a caller-supplied request id", async () => {
    const r = await api.get("/api/stats", { headers: { "X-Request-Id": "trace-abc-12345" } });
    assert.equal(r.headers.get("x-request-id"), "trace-abc-12345");
  });
  it("sets rate-limit headers", async () => assert.ok((await api.get("/api/stats")).headers.get("x-ratelimit-limit")));
  it("makes public reads edge-cacheable", async () => assert.match((await api.get("/api/products")).headers.get("cache-control") ?? "", /s-maxage=60/));
  it("uses a uniform error envelope", async () => {
    const r = await api.get("/api/products/definitely-not-real");
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, "NOT_FOUND");
    assert.ok(r.body.requestId);
  });
  it("does not emit CORS headers to unlisted origins", async () => {
    const r = await api.get("/api/stats", { headers: { Origin: "https://evil.example" } });
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  });
  it("serves pages with security headers", async () => {
    const r = await fetch(`${BASE}/about`);
    assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });
});

describe("settings & stats", () => {
  it("returns public settings without internal fields", async () => {
    const r = await api.get("/api/settings");
    assert.equal(r.status, 200);
    assert.equal(r.body.data.companyName, "Apex Care Technologies");
    assert.ok(r.body.data.phones.length >= 2);
    assert.equal("notifications" in r.body.data, false);
  });
  it("computes stats from live data", async () => {
    const r = await api.get("/api/stats");
    assert.ok(r.body.data.products >= 39);
    assert.ok(r.body.data.yearsInBusiness >= 4);
  });
});

describe("products", () => {
  it("lists with pagination metadata", async () => {
    const r = await api.get("/api/products?limit=5&page=2");
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 5);
    assert.equal(r.body.meta.page, 2);
    assert.ok(r.body.meta.total >= 39);
    assert.ok(r.body.meta.totalPages >= 8);
  });
  it("filters by group", async () => {
    const r = await api.get("/api/products?group=draeger&limit=50");
    assert.equal(r.body.data.length, 6);
    assert.ok(r.body.data.every((p: { group: string }) => p.group === "draeger"));
  });
  it("filters featured products", async () => {
    const r = await api.get("/api/products?featured=true&limit=50");
    assert.equal(r.body.data.length, 8);
  });
  it("searches free text across fields (accent-insensitive via slug/tags not required)", async () => {
    const r = await api.get("/api/products?q=gas%20detector&limit=50");
    assert.ok(r.body.data.some((p: { slug: string }) => p.slug === "gas-detectors"));
  });
  it("rejects unknown query parameters", async () => assert.equal((await api.get("/api/products?bogus=1")).status, 422));
  it("rejects absurd page sizes", async () => assert.equal((await api.get("/api/products?limit=5000")).status, 422));
  it("returns a product with related items", async () => {
    const r = await api.get("/api/products/draeger-x-am-2500");
    assert.equal(r.status, 200);
    assert.equal(r.body.data.brand, "Dräger");
    assert.equal(r.body.data.related.length, 4);
    assert.ok(r.body.data.related.every((p: { slug: string }) => p.slug !== "draeger-x-am-2500"));
  });
  it("lists product groups in order", async () => {
    const r = await api.get("/api/product-groups");
    assert.deepEqual(r.body.data.map((g: { key: string }) => g.key), ["ppe", "draeger", "detection", "fire", "site"]);
  });
});

describe("surveys, training, gallery, testimonials, logos, leaders", () => {
  it("lists all 9 surveys and filters featured", async () => {
    assert.equal((await api.get("/api/surveys")).body.data.length, 9);
    assert.equal((await api.get("/api/surveys?featured=true")).body.data.length, 3);
  });
  it("returns a survey by slug", async () => {
    const r = await api.get("/api/surveys/fit-testing");
    assert.equal(r.status, 200);
    assert.match(r.body.data.description, /fit testing/i);
    assert.equal((await api.get("/api/surveys/nope")).status, 404);
  });
  it("lists training programmes", async () => assert.equal((await api.get("/api/training")).body.data.length, 10));
  it("lists the training gallery", async () => assert.equal((await api.get("/api/gallery")).body.data.length, 8));
  it("lists testimonials", async () => assert.ok((await api.get("/api/testimonials")).body.data.length >= 6));
  it("lists leaders", async () => assert.equal((await api.get("/api/leaders")).body.data.length, 3));
  it("requires and honours the logo kind", async () => {
    assert.equal((await api.get("/api/logos")).status, 422);
    assert.equal((await api.get("/api/logos?kind=client")).body.data.length, 12);
    assert.equal((await api.get("/api/logos?kind=brand")).body.data.length, 7);
    assert.equal((await api.get("/api/logos?kind=other")).status, 422);
  });
});

describe("search", () => {
  it("ranks title matches first across collections", async () => {
    const r = await api.get("/api/search?q=scba");
    assert.equal(r.status, 200);
    const types = new Set(r.body.data.map((h: { type: string }) => h.type));
    assert.ok(types.has("products") && types.has("surveys") && types.has("training"));
    assert.ok(r.body.data[0].score >= r.body.data[r.body.data.length - 1].score);
  });
  it("requires every term (AND)", async () => {
    const hits = (await api.get("/api/search?q=fire%20suppression")).body.data;
    assert.ok(hits.some((h: { slug: string }) => h.slug === "fire-suppression-system"));
    assert.ok(hits.every((h: { title: string; summary: string }) => /fire/i.test(h.title + h.summary)));
  });
  it("can be limited to one type", async () => {
    const hits = (await api.get("/api/search?q=safety&types=surveys")).body.data;
    assert.ok(hits.length > 0 && hits.every((h: { type: string }) => h.type === "surveys"));
  });
  it("returns an empty list for nonsense", async () => assert.deepEqual((await api.get("/api/search?q=zzqqxx")).body.data, []));
  it("validates the query", async () => {
    assert.equal((await api.get("/api/search?q=a")).status, 422);
    assert.equal((await api.get("/api/search")).status, 422);
    assert.equal((await api.get("/api/search?q=abc&types=users")).status, 422);
  });
  it("treats regex metacharacters literally (no ReDoS / injection)", async () => {
    const r = await api.get("/api/search?q=" + encodeURIComponent("(a+)+$.*"));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data, []);
  });
});

describe("catalogue download", () => {
  it("redirects to the configured file", async () => {
    const r = await api.get("/api/catalogue?from=/products");
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location") ?? "", /\/media\/pdf\/apexcare-technologies\.pdf$/);
  });
  it("serves that file, complete and readable", async () => {
    const r = await fetch(`${BASE}/media/pdf/apexcare-technologies.pdf`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /pdf/);
    // A truncated PDF still downloads with a 200, but no viewer can open it: check both ends.
    const bytes = Buffer.from(await r.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(bytes.subarray(-1024).toString("latin1").includes("%%EOF"), "the PDF must end with %%EOF (file is truncated)");
  });
});

describe("pages are rendered from the database", () => {
  it("home shows live stats and DB-driven hero copy", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    assert.match(html, /Industrial safety equipment that actually gets worn/);
    assert.match(html, /Product categories/);
  });
  it("renders a product page with JSON-LD", async () => {
    const html = await (await fetch(`${BASE}/products/scba`)).text();
    assert.match(html, /Self Contained Breathing Apparatus/);
    assert.match(html, /application\/ld\+json/);
  });
  it("returns a real 404 for unknown products and surveys", async () => {
    assert.equal((await fetch(`${BASE}/products/nope-nope`)).status, 404);
    assert.equal((await fetch(`${BASE}/survey/nope-nope`)).status, 404);
  });
  it("lists DB content in the sitemap and robots", async () => {
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    assert.match(sitemap, /\/products\/head-protection/);
    assert.match(sitemap, /\/survey\/fit-testing/);
    assert.match(await (await fetch(`${BASE}/robots.txt`)).text(), /Sitemap:/i);
  });
});
