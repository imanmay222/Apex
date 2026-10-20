import type { Model } from "mongoose";
import { connectDb } from "../db/connect";
import {
  AdminUserModel,
  GalleryModel,
  LeaderModel,
  LogoModel,
  ProductGroupModel,
  ProductModel,
  SiteSettingsModel,
  SurveyModel,
  TestimonialModel,
  TrainingModel,
  allModels,
} from "../db/models";
import { env } from "../config/env";
import { createUser } from "../services/users";
import {
  gallerySeed,
  leaderSeed,
  logoSeed,
  productGroupSeed,
  productSeed,
  settingsSeed,
  surveySeed,
  testimonialSeed,
  trainingSeed,
} from "./data";

export interface SeedOptions {
  /** Delete and re-create all content (never touches users, enquiries or media). */
  reset?: boolean;
  log?: (message: string) => void;
}

interface Plan {
  label: string;
  model: Model<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  docs: Record<string, unknown>[];
  /** Fields identifying "the same" document across runs. */
  key: string[];
}

const plans: Plan[] = [
  { label: "product groups", model: ProductGroupModel, docs: productGroupSeed, key: ["key"] },
  { label: "products", model: ProductModel, docs: productSeed, key: ["slug"] },
  { label: "surveys", model: SurveyModel, docs: surveySeed, key: ["slug"] },
  { label: "training programmes", model: TrainingModel, docs: trainingSeed, key: ["slug"] },
  { label: "gallery images", model: GalleryModel, docs: gallerySeed, key: ["src"] },
  { label: "testimonials", model: TestimonialModel, docs: testimonialSeed, key: ["name", "quote"] },
  { label: "logos", model: LogoModel, docs: logoSeed, key: ["kind", "name"] },
  { label: "leaders", model: LeaderModel, docs: leaderSeed, key: ["name"] },
];

export async function syncIndexes(log: (m: string) => void = () => undefined) {
  await connectDb();
  for (const model of allModels) {
    await model.syncIndexes();
  }
  log(`indexes synced for ${allModels.length} collections`);
}

/**
 * Idempotent: documents are inserted only when missing (matched on their natural key), so
 * re-running never overwrites edits made through the admin API.
 */
export async function runSeed({ reset = false, log = () => undefined }: SeedOptions = {}) {
  await connectDb();
  await syncIndexes(log);

  if (reset) {
    for (const plan of plans) await plan.model.deleteMany({});
    await SiteSettingsModel.deleteMany({});
    log("reset: existing content removed");
  }

  for (const plan of plans) {
    const result = await plan.model.bulkWrite(
      plan.docs.map((doc) => ({
        updateOne: {
          filter: Object.fromEntries(plan.key.map((field) => [field, doc[field]])),
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
    );
    log(`${plan.label}: ${result.upsertedCount} added, ${plan.docs.length - result.upsertedCount} already present`);
  }

  const settings = await SiteSettingsModel.updateOne({ key: "site" }, { $setOnInsert: settingsSeed }, { upsert: true });
  log(`site settings: ${settings.upsertedCount ? "created" : "already present"}`);

  await ensureFirstAdmin(log);
}

async function ensureFirstAdmin(log: (m: string) => void) {
  if ((await AdminUserModel.estimatedDocumentCount()) > 0) {
    log("admin users: already present");
    return;
  }

  const { email, password, name } = env().seedAdmin;
  if (!email || !password) {
    log("admin users: none exist and ADMIN_EMAIL / ADMIN_PASSWORD are not set. Run `npm run create-admin`.");
    return;
  }

  await createUser({ email: email.toLowerCase(), name, role: "admin", password }, null);
  log(`admin users: created ${email.toLowerCase()}`);
}
