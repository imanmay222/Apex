import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, adminClient, purgeTestUsers, uid } from "./helpers";

let admin: Client;
const anon = new Client();
const MARK = `zz-test-${uid()}`;

const image = { src: "/media/products/head-production.png", alt: "Test image" };
const product = (over: Record<string, unknown> = {}) => ({
  title: `${MARK} Widget ${uid()}`,
  summary: "A test product created by the API suite.",
  image,
  group: "ppe",
  ...over,
});

const created: { resource: string; id: string }[] = [];
async function make(resource: string, body: Record<string, unknown>) {
  const r = await admin.post(`/api/admin/content/${resource}`, body);
  if (r.status === 201) created.push({ resource, id: r.body.data.id });
  return r;
}

before(async () => {
  admin = await adminClient();
});

after(async () => {
  // Children before parents (products reference groups).
  for (const resource of ["products", "surveys", "training", "gallery", "testimonials", "logos", "leaders", "product-groups"]) {
    const list = await admin.get(`/api/admin/content/${resource}?q=${MARK}&limit=100`);
    for (const item of list.body?.data ?? []) await admin.del(`/api/admin/content/${resource}/${item.id}`);
  }
  await purgeTestUsers(admin);
});

describe("products: create → public visibility → update → delete", () => {
  let id: string;
  let slug: string;

  it("derives a slug from the title and appends to the end of the list", async () => {
    const r = await make("products", product({ title: `${MARK} Dräger Widget & Co` }));
    assert.equal(r.status, 201, r.text);
    id = r.body.data.id;
    slug = r.body.data.slug;
    assert.equal(slug, `${MARK}-draeger-widget-and-co`);
    assert.equal(r.body.data.published, true);

    const all = (await admin.get("/api/admin/content/products?limit=100&sort=order")).body.data;
    assert.equal(all[all.length - 1].id, id, "new items go last");
  });

  it("appears on the public API, page, sitemap and search immediately (cache invalidation)", async () => {
    assert.equal((await anon.get(`/api/products/${slug}`)).status, 200);
    assert.match(await (await fetch(`${BASE}/products/${slug}`)).text(), /Widget &amp; Co/);
    assert.match(await (await fetch(`${BASE}/sitemap.xml`)).text(), new RegExp(slug));
    assert.ok((await anon.get(`/api/search?q=${MARK}`)).body.data.some((h: { slug: string }) => h.slug === slug));
    assert.ok((await anon.get("/api/stats")).body.data.products >= 40);
  });

  it("patches only the fields sent", async () => {
    const r = await admin.patch(`/api/admin/content/products/${id}`, {
      summary: "Updated summary",
      features: ["Lightweight", "Adjustable"],
      specs: [{ label: "Weight", value: "300 g" }],
      tags: ["Test", "TEST"],
      brand: "Acme",
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.data.summary, "Updated summary");
    assert.equal(r.body.data.group, "ppe", "untouched fields survive a partial update");
    assert.equal(r.body.data.image.src, image.src);

    const pub = (await anon.get(`/api/products/${slug}`)).body.data;
    assert.equal(pub.summary, "Updated summary");
    assert.deepEqual(pub.features, ["Lightweight", "Adjustable"]);
    assert.equal(pub.specs[0].value, "300 g");
    assert.equal(pub.brand, "Acme");

    const html = await (await fetch(`${BASE}/products/${slug}`)).text();
    assert.match(html, /Lightweight/);
    assert.match(html, /300 g/);
  });

  it("an empty patch is rejected, as are unknown fields", async () => {
    assert.equal((await admin.patch(`/api/admin/content/products/${id}`, {})).status, 422);
    assert.equal((await admin.patch(`/api/admin/content/products/${id}`, { _id: "x" })).status, 422);
    assert.equal((await admin.patch(`/api/admin/content/products/${id}`, { published: "yes" })).status, 422);
  });

  it("unpublishing hides it everywhere public, but not from the admin", async () => {
    assert.equal((await admin.patch(`/api/admin/content/products/${id}`, { published: false })).status, 200);
    assert.equal((await anon.get(`/api/products/${slug}`)).status, 404);
    assert.equal((await fetch(`${BASE}/products/${slug}`)).status, 404);
    assert.ok(!(await (await fetch(`${BASE}/sitemap.xml`)).text()).includes(slug));
    assert.equal((await admin.get(`/api/admin/content/products/${id}`)).status, 200);

    const enquiry = await anon.get("/api/enquiries/token");
    assert.ok(enquiry.body.data.token);
    await admin.patch(`/api/admin/content/products/${id}`, { published: true });
    assert.equal((await anon.get(`/api/products/${slug}`)).status, 200);
  });

  it("deletes and disappears", async () => {
    assert.equal((await admin.del(`/api/admin/content/products/${id}`)).status, 204);
    assert.equal((await anon.get(`/api/products/${slug}`)).status, 404);
    assert.equal((await admin.del(`/api/admin/content/products/${id}`)).status, 404);
  });
});

describe("validation and integrity", () => {
  it("rejects duplicate explicit slugs, but suffixes derived ones", async () => {
    const title = `${MARK} Dup ${uid()}`;
    const a = await make("products", product({ title }));
    const b = await make("products", product({ title }));
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(b.body.data.slug, `${a.body.data.slug}-2`);

    const clash = await make("products", product({ slug: a.body.data.slug }));
    assert.equal(clash.status, 409);
    assert.equal(clash.body.error.details.field, "slug");
  });

  const bad: [string, Record<string, unknown>, string][] = [
    ["unknown group", { group: "no-such-group" }, "group"],
    ["missing title", { title: undefined }, "title"],
    ["javascript: image", { image: { src: "javascript:alert(1)", alt: "x" } }, "image.src"],
    ["protocol-relative image", { image: { src: "//evil.com/x.png", alt: "x" } }, "image.src"],
    ["http (non-https) image", { image: { src: "http://evil.com/x.png", alt: "x" } }, "image.src"],
    ["invalid slug", { slug: "Not A Slug!" }, "slug"],
    ["too many features", { features: Array.from({ length: 25 }, (_, i) => `f${i}`) }, "features"],
    ["unknown field", { isFeatured: true }, ""],
  ];
  for (const [label, over, path] of bad) {
    it(`rejects ${label}`, async () => {
      const r = await admin.post("/api/admin/content/products", product(over));
      assert.equal(r.status, 422, r.text);
      if (path) assert.ok(r.body.error.details.some((d: { path: string }) => d.path === path), r.text);
    });
  }

  it("404s for an unknown content type", async () => {
    assert.equal((await admin.get("/api/admin/content/widgets")).status, 404);
    assert.equal((await admin.post("/api/admin/content/widgets", {})).status, 404);
  });

  it("rejects filters a content type doesn't support", async () => {
    assert.equal((await admin.get("/api/admin/content/surveys?group=ppe")).status, 422);
    assert.equal((await admin.get("/api/admin/content/products?group=ppe&limit=2")).status, 200);
  });
});

describe("product groups", () => {
  it("won't delete or re-key a group that still has products", async () => {
    const key = `${MARK}-group`;
    const g = await make("product-groups", { key, title: `${MARK} Group` });
    assert.equal(g.status, 201);
    const p = await make("products", product({ group: key }));
    assert.equal(p.status, 201);

    assert.equal((await admin.del(`/api/admin/content/product-groups/${g.body.data.id}`)).status, 409);
    assert.equal((await admin.patch(`/api/admin/content/product-groups/${g.body.data.id}`, { key: `${key}-b` })).status, 409);
    assert.equal((await admin.patch(`/api/admin/content/product-groups/${g.body.data.id}`, { title: "Renamed" })).status, 200);

    await admin.del(`/api/admin/content/products/${p.body.data.id}`);
    assert.equal((await admin.del(`/api/admin/content/product-groups/${g.body.data.id}`)).status, 204);
  });

  it("a new group shows up on the public API and products page", async () => {
    const key = `${MARK}-visible`;
    const g = await make("product-groups", { key, title: `${MARK} Visible Group` });
    const p = await make("products", product({ group: key }));
    assert.ok((await anon.get("/api/product-groups")).body.data.some((x: { key: string }) => x.key === key));
    assert.match(await (await fetch(`${BASE}/products`)).text(), new RegExp(`${MARK} Visible Group`));
    await admin.del(`/api/admin/content/products/${p.body.data.id}`);
    await admin.del(`/api/admin/content/product-groups/${g.body.data.id}`);
  });
});

describe("ordering and bulk actions", () => {
  it("reorders items", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await make("products", product({ title: `${MARK} Order ${i}` }))).body.data.id);

    const reversed = [...ids].reverse();
    const r = await admin.post("/api/admin/content/products/reorder", { ids: reversed });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.reordered, 3);

    const list = (await admin.get(`/api/admin/content/products?q=${MARK}%20Order&sort=order`)).body.data;
    assert.deepEqual(list.map((p: { id: string }) => p.id), reversed);

    assert.equal((await admin.post("/api/admin/content/products/reorder", { ids: [ids[0], ids[0]] })).status, 422);
    assert.equal((await admin.post("/api/admin/content/products/reorder", { ids: ["000000000000000000000000"] })).status, 422);
    assert.equal((await admin.post("/api/admin/content/products/reorder", { ids: [] })).status, 422);
  });

  it("bulk publishes, unpublishes and deletes", async () => {
    const ids = [] as string[];
    for (let i = 0; i < 2; i++) ids.push((await make("products", product({ title: `${MARK} Bulk ${i}` }))).body.data.id);

    assert.equal((await admin.post("/api/admin/content/products/bulk", { action: "unpublish", ids })).body.data.affected, 2);
    assert.equal((await admin.get(`/api/admin/content/products?q=${MARK}%20Bulk&published=false`)).body.data.length, 2);
    assert.equal((await admin.post("/api/admin/content/products/bulk", { action: "publish", ids })).body.data.affected, 2);
    assert.equal((await admin.post("/api/admin/content/products/bulk", { action: "delete", ids })).body.data.affected, 2);
    assert.equal((await admin.post("/api/admin/content/products/bulk", { action: "explode", ids })).status, 422);
  });

  it("lists with search, filters and pagination", async () => {
    await make("products", product({ title: `${MARK} Filter A`, featured: true, group: "draeger" }));
    await make("products", product({ title: `${MARK} Filter B`, featured: false, group: "draeger" }));
    const q = `q=${MARK}%20Filter`;

    assert.equal((await admin.get(`/api/admin/content/products?${q}`)).body.data.length, 2);
    assert.equal((await admin.get(`/api/admin/content/products?${q}&featured=true`)).body.data.length, 1);
    assert.equal((await admin.get(`/api/admin/content/products?${q}&group=ppe`)).body.data.length, 0);
    const page = await admin.get(`/api/admin/content/products?${q}&limit=1&page=2`);
    assert.equal(page.body.data.length, 1);
    assert.equal(page.body.meta.totalPages, 2);
    const byTitle = (await admin.get(`/api/admin/content/products?${q}&sort=title`)).body.data;
    assert.ok(byTitle[0].title.endsWith("Filter A"));
  });
});

describe("every other content type", () => {
  it("surveys: appear in the API, page and enquiry options", async () => {
    const r = await make("surveys", { title: `${MARK} Survey`, image, description: "A full description of this survey service.", featured: true });
    assert.equal(r.status, 201, r.text);
    const slug = r.body.data.slug;
    assert.equal((await anon.get(`/api/surveys/${slug}`)).status, 200);
    assert.equal((await fetch(`${BASE}/survey/${slug}`)).status, 200);
    assert.ok((await anon.get("/api/surveys?featured=true")).body.data.some((s: { slug: string }) => s.slug === slug));
    assert.equal((await admin.patch(`/api/admin/content/surveys/${r.body.data.id}`, { description: "short" })).status, 422);
  });

  it("training: validates icon names", async () => {
    const ok = await make("training", { title: `${MARK} Training`, summary: "Hands-on session.", icon: "Flame" });
    assert.equal(ok.status, 201, ok.text);
    assert.ok((await anon.get("/api/training")).body.data.some((t: { slug: string }) => t.slug === ok.body.data.slug));
    assert.equal((await make("training", { title: `${MARK} Bad icon`, summary: "x y z", icon: "<script>" })).status, 422);
  });

  it("gallery: accepts site paths and https only", async () => {
    const ok = await make("gallery", { src: "/media/training/gallery-1.jpeg", alt: `${MARK} photo` });
    assert.equal(ok.status, 201, ok.text);
    assert.ok((await anon.get("/api/gallery")).body.data.some((g: { alt: string }) => g.alt === `${MARK} photo`));
    assert.equal((await make("gallery", { src: "ftp://x/y.png", alt: `${MARK} bad` })).status, 422);
  });

  it("testimonials: rating bounds", async () => {
    const ok = await make("testimonials", { name: `${MARK} Customer`, quote: "Fast delivery and good service.", rating: 5, company: "Acme" });
    assert.equal(ok.status, 201, ok.text);
    assert.ok((await anon.get("/api/testimonials")).body.data.some((t: { name: string }) => t.name === `${MARK} Customer`));
    assert.equal((await make("testimonials", { name: `${MARK} X`, quote: "Fast delivery and good service.", rating: 6 })).status, 422);
  });

  it("logos: kind enum, https-only link", async () => {
    const ok = await make("logos", { kind: "client", name: `${MARK} Client`, src: "/media/clients/client-1.png", url: "https://example.com" });
    assert.equal(ok.status, 201, ok.text);
    assert.ok((await anon.get("/api/logos?kind=client")).body.data.some((l: { name: string }) => l.name === `${MARK} Client`));
    assert.equal((await make("logos", { kind: "partner", name: `${MARK} Bad`, src: "/x.png" })).status, 422);
    assert.equal((await make("logos", { kind: "client", name: `${MARK} Bad2`, src: "/x.png", url: "javascript:alert(1)" })).status, 422);
  });

  it("leaders", async () => {
    const ok = await make("leaders", { name: `${MARK} Leader`, role: "Director", qualification: "B.E.", image: "/media/about/profile.jpg" });
    assert.equal(ok.status, 201, ok.text);
    assert.ok((await anon.get("/api/leaders")).body.data.some((l: { name: string }) => l.name === `${MARK} Leader`));
  });
});

describe("site settings", () => {
  let original: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  before(async () => {
    original = (await admin.get("/api/admin/settings")).body.data;
  });
  after(async () => {
    await admin.patch("/api/admin/settings", {
      address: original.address,
      phones: original.phones,
      home: original.home,
      emails: original.emails,
      notifications: original.notifications,
      certificates: original.certificates,
    });
  });

  it("merges nested objects field-by-field and reflects on the site at once", async () => {
    const r = await admin.patch("/api/admin/settings", { address: { city: "Testville" }, home: { heroTitle: `${MARK} headline` } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.data.address.city, "Testville");
    assert.equal(r.body.data.address.street, original.address.street, "sibling fields are preserved");
    assert.equal(r.body.data.home.heroLead, original.home.heroLead);

    assert.equal((await anon.get("/api/settings")).body.data.address.city, "Testville");
    assert.match(await (await fetch(`${BASE}/`)).text(), new RegExp(`${MARK} headline`));
    assert.match(await (await fetch(`${BASE}/contact`)).text(), /Testville/);
  });

  it("replaces arrays wholesale and keeps internal fields out of the public API", async () => {
    await admin.patch("/api/admin/settings", {
      phones: ["+91 90000 11111"],
      emails: ["hello@example.com"],
      notifications: { salesEmails: ["secret-sales@example.com"] },
    });
    const pub = (await anon.get("/api/settings")).body;
    assert.deepEqual(pub.data.phones, ["+91 90000 11111"]);
    assert.deepEqual(pub.data.emails, ["hello@example.com"]);
    assert.ok(!JSON.stringify(pub).includes("secret-sales@example.com"));
    assert.deepEqual((await admin.get("/api/admin/settings")).body.data.notifications.salesEmails, ["secret-sales@example.com"]);
    assert.match(await (await fetch(`${BASE}/contact`)).text(), /hello@example\.com/);
  });

  const invalid: [string, Record<string, unknown>][] = [
    ["a non-Google map embed", { mapEmbedSrc: "https://evil.example/phish" }],
    ["a non-numeric WhatsApp number", { whatsapp: "call me" }],
    ["a bad email", { emails: ["nope"] }],
    ["an unknown field", { companyOwner: "x" }],
    ["an out-of-range founding year", { foundedYear: 1200 }],
  ];
  for (const [label, body] of invalid) {
    it(`rejects ${label}`, async () => assert.equal((await admin.patch("/api/admin/settings", body)).status, 422));
  }
});
