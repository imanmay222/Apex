import { connectDb } from "../db/connect";
import { SiteSettingsModel } from "../db/models";
import { invalidate, TAGS } from "../lib/cache";
import { settingsSeed } from "../seed/data";
import { audit, type Actor } from "./audit";
import { toAdminSettings } from "./mappers";

/** `{ address: { city: "x" } }` -> `{ "address.city": "x" }`. Arrays and scalars are kept whole. */
function flatten(input: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Creates the singleton from seed defaults if it doesn't exist yet. */
async function ensureSettings() {
  await SiteSettingsModel.updateOne({ key: "site" }, { $setOnInsert: settingsSeed }, { upsert: true });
}

export async function getAdminSettings() {
  await connectDb();
  return toAdminSettings(await SiteSettingsModel.findOne({ key: "site" }).lean());
}

export async function updateSettings(patch: Record<string, unknown>, actor: Actor, ipHash?: string) {
  await connectDb();
  await ensureSettings();

  const doc = await SiteSettingsModel.findOneAndUpdate(
    { key: "site" },
    { $set: flatten(patch) },
    { returnDocument: "after", runValidators: true, lean: true },
  );

  invalidate(TAGS.settings);
  await audit({ actor, action: "update", resource: "settings", resourceId: "site", fields: Object.keys(patch), ipHash });
  return toAdminSettings(doc);
}
