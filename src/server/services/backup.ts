import { connectDb } from "../db/connect";
import { RESOURCES } from "./content-admin";
import { getAdminSettings } from "./settings";

/**
 * Full content snapshot as JSON (all editable content + settings). Enquiries have their own
 * CSV export; users, sessions and secrets are deliberately never included.
 */
export async function exportContent() {
  await connectDb();

  const collections: Record<string, unknown[]> = {};
  for (const [key, def] of Object.entries(RESOURCES)) {
    const docs = await def.model.find().sort({ order: 1, createdAt: 1 }).lean();
    collections[key] = docs.map(def.toDTO);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await getAdminSettings(),
    collections,
  };
}
