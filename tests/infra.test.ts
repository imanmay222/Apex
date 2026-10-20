import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { connectDb, disconnectDb } from "../src/server/db/connect";
import { AdminUserModel, ProductModel } from "../src/server/db/models";
import { runSeed } from "../src/server/seed/run";
import { PNG_1X1, adminClient, uid } from "./helpers";

type IndexInfo = { name: string; key: Record<string, number>; unique?: boolean; expireAfterSeconds?: number; partialFilterExpression?: unknown };

let indexes: (collection: string) => Promise<IndexInfo[]>;

before(async () => {
  const mongoose = await connectDb();
  indexes = async (collection) => (await mongoose.connection.db!.collection(collection).indexes()) as IndexInfo[];
});
after(async () => {
  await disconnectDb();
});

const find = (list: IndexInfo[], field: string) => list.find((i) => Object.keys(i.key).join() === field);

describe("indexes", () => {
  it("expires sessions automatically", async () => {
    assert.equal(find(await indexes("sessions"), "expiresAt")?.expireAfterSeconds, 0);
  });
  it("expires rate-limit windows automatically", async () => {
    assert.equal(find(await indexes("rate_limits"), "expiresAt")?.expireAfterSeconds, 0);
  });
  it("applies the configured retention to analytics and audit data", async () => {
    assert.equal(find(await indexes("analytics_events"), "at")?.expireAfterSeconds, 400 * 86400);
    assert.equal(find(await indexes("audit_logs"), "at")?.expireAfterSeconds, 730 * 86400);
  });
  it("purges only spam enquiries (partial TTL index)", async () => {
    const ttl = (await indexes("enquiries")).find((i) => i.expireAfterSeconds !== undefined)!;
    assert.equal(ttl.expireAfterSeconds, 30 * 86400);
    assert.deepEqual(ttl.partialFilterExpression, { status: "spam" });
  });
  it("enforces natural-key uniqueness", async () => {
    for (const [collection, field] of [
      ["products", "slug"],
      ["surveys", "slug"],
      ["training_programs", "slug"],
      ["product_groups", "key"],
      ["admin_users", "email"],
      ["enquiries", "reference"],
      ["sessions", "tokenHash"],
      ["site_settings", "key"],
    ] as const) {
      assert.equal(find(await indexes(collection), field)?.unique, true, `${collection}.${field}`);
    }
  });
  it("creates the GridFS indexes on first upload", async () => {
    // Self-contained: make sure at least one file exists, whatever order the suites ran in.
    const admin = await adminClient();
    const form = new FormData();
    form.set("file", new File([new Uint8Array(Buffer.concat([PNG_1X1, Buffer.from(uid())]))], "infra-check.png", { type: "image/png" }));
    const upload = await admin.request("POST", "/api/admin/media", { form });
    assert.equal(upload.status, 201);

    const names = (await indexes("media.files")).map((i) => Object.keys(i.key).join());
    assert.ok(names.includes("filename,uploadDate"));
    assert.ok((await indexes("media.chunks")).some((i) => i.unique && Object.keys(i.key).join() === "files_id,n"));
    await admin.del(`/api/admin/media/${upload.body.data.id}`);
  });
});

describe("seeding", () => {
  it("is idempotent and never overwrites edits made through the admin", async () => {
    const before = await ProductModel.countDocuments();
    const original = (await ProductModel.findOne({ slug: "head-protection" }).lean())!;

    await ProductModel.updateOne({ slug: "head-protection" }, { $set: { summary: "EDITED BY AN ADMIN" } });
    const lines: string[] = [];
    await runSeed({ log: (m) => lines.push(m) });

    assert.equal(await ProductModel.countDocuments(), before, "no duplicates");
    assert.equal((await ProductModel.findOne({ slug: "head-protection" }).lean())!.summary, "EDITED BY AN ADMIN");
    assert.ok(lines.some((l) => /products: 0 added/.test(l)), lines.join("\n"));

    await ProductModel.updateOne({ slug: "head-protection" }, { $set: { summary: original.summary } });
  });

  it("restores a deleted document without touching the others", async () => {
    const doc = (await ProductModel.findOne({ slug: "raincoat" }).lean())!;
    await ProductModel.deleteOne({ slug: "raincoat" });
    await runSeed();
    assert.ok(await ProductModel.exists({ slug: "raincoat" }));
    assert.equal((await ProductModel.findOne({ slug: "raincoat" }).lean())!.title, doc.title);
  });

  it("does not create a second admin when users already exist", async () => {
    const count = await AdminUserModel.countDocuments();
    await runSeed();
    assert.equal(await AdminUserModel.countDocuments(), count);
  });

  it("stores only a scrypt hash, never the password", async () => {
    const admin = await AdminUserModel.findOne({ email: process.env.ADMIN_EMAIL!.toLowerCase() }).select("+passwordHash").lean();
    assert.match(admin!.passwordHash, /^scrypt\$32768\$8\$1\$/);
    assert.ok(!admin!.passwordHash.includes(process.env.ADMIN_PASSWORD!));
  });
});
