import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, PNG_1X1, adminClient, purgeTestUsers, uid, userClient } from "./helpers";

let admin: Client;
const anon = new Client();
const MARK = `zz-test-${uid()}`;
const toDelete: string[] = [];
const productIds: string[] = [];

/** A PNG that is unique per call (extra trailing bytes change the hash but not the header). */
const uniquePng = () => Buffer.concat([PNG_1X1, Buffer.from(uid())]);

function form(bytes: Buffer, filename: string, type = "image/png", alt?: string) {
  const f = new FormData();
  f.set("file", new File([new Uint8Array(bytes)], filename, { type }));
  if (alt !== undefined) f.set("alt", alt);
  return f;
}

async function upload(bytes: Buffer, filename = `${MARK}.png`, type = "image/png", alt = "Test alt") {
  const r = await admin.request("POST", "/api/admin/media", { form: form(bytes, filename, type, alt) });
  if (r.status === 201) toDelete.push(r.body.data.id);
  return r;
}

before(async () => {
  admin = await adminClient();
});
after(async () => {
  for (const id of productIds) await admin.del(`/api/admin/content/products/${id}`);
  for (const id of toDelete) await admin.del(`/api/admin/media/${id}?force=true`);
  await purgeTestUsers(admin);
});

describe("uploading to GridFS", () => {
  const bytes = uniquePng();
  let id: string;
  let url: string;

  it("stores a PNG and returns its metadata", async () => {
    const r = await upload(bytes, `${MARK} My Photo!.PNG`);
    assert.equal(r.status, 201, r.text);
    id = r.body.data.id;
    url = r.body.data.url;
    assert.equal(url, `/api/media/${id}`);
    assert.equal(r.body.data.contentType, "image/png");
    assert.equal(r.body.data.size, bytes.length);
    assert.match(r.body.data.filename, /^zz-test-[0-9a-f]+-my-photo\.png$/, "filename is slugified and the extension comes from the sniffed type");
    assert.equal(r.body.data.alt, "Test alt");
    assert.match(r.body.data.sha256, /^[0-9a-f]{64}$/);
  });

  it("serves the exact bytes with immutable caching and hardened headers", async () => {
    const res = await fetch(`${BASE}${url}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("content-security-policy") ?? "", /sandbox/);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
  });

  it("supports conditional requests", async () => {
    const first = await fetch(`${BASE}${url}`);
    const etag = first.headers.get("etag")!;
    await first.arrayBuffer();
    const again = await fetch(`${BASE}${url}`, { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304);
    assert.equal((await again.arrayBuffer()).byteLength, 0);
  });

  it("de-duplicates identical files", async () => {
    const r = await upload(bytes);
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.duplicate, true);
    assert.equal(r.body.data.id, id);
  });

  it("works through the Next.js image optimiser", async () => {
    const res = await fetch(`${BASE}/_next/image?url=${encodeURIComponent(url)}&w=256&q=75`);
    assert.equal(res.status, 200, "localPatterns must allow /api/media/**");
    assert.match(res.headers.get("content-type") ?? "", /^image\//);
  });

  it("lists, filters and edits metadata", async () => {
    const list = await admin.get(`/api/admin/media?q=${MARK}&kind=image`);
    assert.ok(list.body.data.some((m: { id: string }) => m.id === id));
    assert.equal((await admin.get(`/api/admin/media?q=${MARK}&kind=pdf`)).body.data.length, 0);

    const patched = await admin.patch(`/api/admin/media/${id}`, { alt: "Updated alt text" });
    assert.equal(patched.body.data.alt, "Updated alt text");
    assert.equal((await admin.patch(`/api/admin/media/${id}`, { alt: "x", filename: "evil" })).status, 422);
  });

  it("refuses to delete a file that content still uses, unless forced", async () => {
    const p = await admin.post("/api/admin/content/products", {
      title: `${MARK} uses media`,
      summary: "Product that uses an uploaded image.",
      image: { src: url, alt: "uploaded" },
      group: "ppe",
    });
    assert.equal(p.status, 201, p.text);
    productIds.push(p.body.data.id);

    const usage = await admin.get(`/api/admin/media/${id}`);
    assert.deepEqual(usage.body.data.usage.map((u: { resource: string }) => u.resource), ["products"]);

    const blocked = await admin.del(`/api/admin/media/${id}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.details.usage[0].label, `${MARK} uses media`);

    await admin.del(`/api/admin/content/products/${p.body.data.id}`);
    productIds.length = 0;
    assert.equal((await admin.del(`/api/admin/media/${id}`)).status, 204);
    assert.equal((await fetch(`${BASE}${url}`)).status, 404);
  });
});

describe("rejecting bad uploads", () => {
  it("rejects SVG (script-capable) even when named .png with an image MIME type", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
    assert.equal((await upload(svg, "evil.png", "image/png")).status, 415);
    assert.equal((await upload(svg, "evil.svg", "image/svg+xml")).status, 415);
  });
  it("rejects HTML and text disguised as images", async () => {
    assert.equal((await upload(Buffer.from("<html><body><script>1</script></body></html>"), "x.jpg", "image/jpeg")).status, 415);
    assert.equal((await upload(Buffer.from("plain text"), "x.png")).status, 415);
  });
  it("rejects executables", async () => {
    assert.equal((await upload(Buffer.from("MZ\x90\x00\x03\x00\x00\x00".padEnd(64, "\0")), "x.png")).status, 415);
  });
  it("rejects empty files", async () => assert.equal((await upload(Buffer.alloc(0))).status, 415));
  it("enforces the image size limit (8 MB)", async () => {
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(9 * 1024 * 1024, 1)]);
    assert.equal((await upload(big)).status, 413);
  });
  it("requires a file field and multipart encoding", async () => {
    assert.equal((await admin.request("POST", "/api/admin/media", { form: new FormData() })).status, 400);
    assert.equal((await admin.post("/api/admin/media", { file: "x" })).status, 400);
  });
  it("rejects unknown ids", async () => {
    assert.equal((await anon.get("/api/media/nope")).status, 404);
    assert.equal((await anon.get("/api/media/000000000000000000000000")).status, 404);
  });
});

describe("permissions", () => {
  it("needs authentication, and the media permission", async () => {
    const f = () => form(uniquePng(), "x.png");
    assert.equal((await anon.request("POST", "/api/admin/media", { form: f() })).status, 401);
    const { client: sales } = await userClient(admin, "sales");
    assert.equal((await sales.request("POST", "/api/admin/media", { form: f() })).status, 403);
    const { client: editor } = await userClient(admin, "editor");
    const ok = await editor.request("POST", "/api/admin/media", { form: f() });
    assert.equal(ok.status, 201);
    toDelete.push(ok.body.data.id);
  });
});

describe("PDF catalogue replacement", () => {
  it("serves an uploaded PDF as the tracked catalogue download", async () => {
    const original = (await admin.get("/api/admin/settings")).body.data.catalogue;
    const pdf = Buffer.from(`%PDF-1.4\n% ${MARK} ${uid()}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`);

    const up = await upload(pdf, `${MARK}-catalogue.pdf`, "application/pdf");
    assert.equal(up.status, 201, up.text);
    assert.equal(up.body.data.contentType, "application/pdf");

    try {
      assert.equal((await admin.patch("/api/admin/settings", { catalogue: { url: up.body.data.url } })).status, 200);
      const redirect = await anon.get("/api/catalogue?from=/products");
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get("location"), up.body.data.url);

      const file = await fetch(`${BASE}${up.body.data.url}`);
      assert.equal(file.headers.get("content-type"), "application/pdf");
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);

      const blocked = await admin.del(`/api/admin/media/${up.body.data.id}`);
      assert.equal(blocked.status, 409, "the live catalogue file is protected from deletion");
    } finally {
      await admin.patch("/api/admin/settings", { catalogue: { url: original.url } });
    }
  });
});
