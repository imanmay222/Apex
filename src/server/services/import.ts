/* eslint-disable @typescript-eslint/no-explicit-any -- generic over heterogeneous Mongoose models */
import { connectDb } from "../db/connect";
import { ProductGroupModel } from "../db/models";
import { invalidate, TAGS } from "../lib/cache";
import { validationFailed } from "../lib/errors";
import { contentSchemas, settingsUpdate, type ContentResourceKey } from "../validation/content";
import { formatIssues } from "../validation/primitives";
import { audit, type Actor } from "./audit";
import { RESOURCES } from "./content-admin";
import { updateSettings } from "./settings";

/** Natural key used to recognise "the same document" when merging. */
const NATURAL_KEY: Record<ContentResourceKey, string[]> = {
  "product-groups": ["key"],
  products: ["slug"],
  surveys: ["slug"],
  training: ["slug"],
  gallery: ["src"],
  testimonials: ["name", "quote"],
  logos: ["kind", "name"],
  leaders: ["name"],
};

// Parents first on insert; children first on delete.
const ORDER: ContentResourceKey[] = ["product-groups", "products", "surveys", "training", "gallery", "testimonials", "logos", "leaders"];

/** Fields present in an export that the create schemas (rightly) refuse as input. */
const EXPORT_ONLY = ["id", "createdAt", "updatedAt", "source", "submitterEmail"];

export interface ImportSummary {
  mode: "merge" | "replace";
  collections: Record<string, { created: number; updated: number; deleted: number }>;
  settingsUpdated: boolean;
}

export async function importContent(
  snapshot: unknown,
  mode: "merge" | "replace",
  actor: Actor,
  ipHash?: string,
): Promise<ImportSummary> {
  const root = snapshot as { version?: unknown; collections?: Record<string, unknown>; settings?: unknown } | null;
  if (!root || typeof root !== "object" || root.version !== 1 || typeof root.collections !== "object" || root.collections === null) {
    throw validationFailed([{ path: "", message: 'Expected an export produced by GET /api/admin/export ({ "version": 1, "collections": { … } })' }]);
  }
  const unknownKeys = Object.keys(root.collections).filter((key) => !(key in contentSchemas));
  if (unknownKeys.length) {
    throw validationFailed(unknownKeys.map((key) => ({ path: `collections.${key}`, message: "Unknown collection" })));
  }

  /* ---- 1. validate everything before touching the database ---- */
  const problems: { path: string; message: string }[] = [];
  // Keeps each item's original position so error paths point at the right row of the file.
  const parsed = new Map<ContentResourceKey, { index: number; data: Record<string, any> }[]>();

  for (const key of ORDER) {
    const items = root.collections[key];
    if (items === undefined) continue;
    if (!Array.isArray(items)) {
      problems.push({ path: `collections.${key}`, message: "Must be an array" });
      continue;
    }

    const valid: { index: number; data: Record<string, any> }[] = [];
    items.forEach((raw, index) => {
      const item = { ...(raw as Record<string, unknown>) };
      for (const field of EXPORT_ONLY) delete item[field];

      const result = contentSchemas[key].create.safeParse(item);
      if (!result.success) {
        for (const issue of formatIssues(result.error)) {
          problems.push({ path: `collections.${key}[${index}]${issue.path ? `.${issue.path}` : ""}`, message: issue.message });
        }
        return;
      }
      const data = result.data as Record<string, any>;
      for (const field of NATURAL_KEY[key]) {
        if (data[field] === undefined) problems.push({ path: `collections.${key}[${index}].${field}`, message: "Required for import" });
      }
      valid.push({ index, data });
    });
    parsed.set(key, valid);
  }

  const settings = root.settings === undefined ? undefined : settingsUpdate.safeParse(root.settings);
  if (settings && !settings.success) {
    for (const issue of formatIssues(settings.error)) problems.push({ path: `settings${issue.path ? `.${issue.path}` : ""}`, message: issue.message });
  }

  /* ---- 2. referential integrity: every product needs a group that will exist ---- */
  await connectDb();
  const groupKeys = new Set<string>(
    parsed.has("product-groups") ? parsed.get("product-groups")!.map((g) => g.data.key) : (await ProductGroupModel.find().select("key").lean()).map((g) => g.key),
  );
  if (parsed.has("product-groups") && mode === "merge") {
    for (const g of await ProductGroupModel.find().select("key").lean()) groupKeys.add(g.key);
  }
  for (const { index, data } of parsed.get("products") ?? []) {
    if (!groupKeys.has(data.group)) problems.push({ path: `collections.products[${index}].group`, message: `Unknown product group "${data.group}"` });
  }

  if (problems.length) throw validationFailed(problems.slice(0, 50), `Import rejected: ${problems.length} problem(s). Nothing was changed.`);

  /* ---- 3. apply ---- */
  const summary: ImportSummary = { mode, collections: {}, settingsUpdated: false };

  if (mode === "replace") {
    for (const key of [...ORDER].reverse()) {
      if (!parsed.has(key)) continue;
      const result = await RESOURCES[key].model.deleteMany({});
      summary.collections[key] = { created: 0, updated: 0, deleted: result.deletedCount ?? 0 };
    }
  }

  for (const key of ORDER) {
    const items = parsed.get(key)?.map((entry) => entry.data);
    if (!items) continue;
    const entry = (summary.collections[key] ??= { created: 0, updated: 0, deleted: 0 });
    if (items.length === 0) continue;

    const result = await RESOURCES[key].model.bulkWrite(
      items.map((data, index) => ({
        updateOne: {
          filter: Object.fromEntries(NATURAL_KEY[key].map((field) => [field, data[field]])),
          // Keep the file's relative order for items that don't carry one.
          update: { $set: { ...data, order: data.order ?? (index + 1) * 10 } },
          upsert: true,
        },
      })),
    );
    entry.created += result.upsertedCount;
    entry.updated += result.modifiedCount;
  }

  if (settings?.success) {
    await updateSettings(settings.data as Record<string, unknown>, actor, ipHash);
    summary.settingsUpdated = true;
  }

  invalidate(...Object.values(TAGS));
  await audit({
    actor,
    action: `import-${mode}`,
    resource: "content",
    summary: Object.entries(summary.collections).map(([k, v]) => `${k}: +${v.created} ~${v.updated} -${v.deleted}`).join(", ").slice(0, 280),
    ipHash,
  });
  return summary;
}
