/* eslint-disable @typescript-eslint/no-explicit-any -- a generic engine over heterogeneous Mongoose models */
import { Types, type Model } from "mongoose";
import { z } from "zod";
import { connectDb } from "../db/connect";
import {
  GalleryModel,
  LeaderModel,
  LogoModel,
  ProductGroupModel,
  ProductModel,
  SurveyModel,
  TestimonialModel,
  TrainingModel,
} from "../db/models";
import { conflict, isDuplicateKeyError, notFound, validationFailed } from "../lib/errors";
import { invalidate, TAGS, type Tag } from "../lib/cache";
import { escapeRegex, slugify } from "../lib/text";
import { pageMeta, pagination, queryBool, resolvePagination } from "../validation/primitives";
import type { ContentResourceKey } from "../validation/content";
import { audit, type Actor } from "./audit";
import {
  toGalleryImage,
  toLeader,
  toLogo,
  toProduct,
  toProductGroup,
  toSurvey,
  toTestimonialAdmin,
  toTraining,
} from "./mappers";

type FilterSpec = { name: string; type: "string" | "boolean" };

interface ResourceDef {
  key: ContentResourceKey;
  label: string;
  model: Model<any>;
  tags: Tag[];
  /** Property holding the human title (used for sorting and audit summaries). */
  titleField: string;
  searchFields: string[];
  filters: FilterSpec[];
  /** Natural unique key, auto-derived from the title on create when omitted. */
  uniqueField?: "slug" | "key";
  toDTO: (doc: any) => unknown;
  beforeWrite?: (data: Record<string, any>, existing: any | null) => Promise<void>;
  beforeDelete?: (existing: any) => Promise<void>;
}

async function ensureGroupExists(data: Record<string, any>) {
  if (data.group === undefined) return;
  const exists = await ProductGroupModel.exists({ key: data.group });
  if (!exists) {
    throw validationFailed([{ path: "group", message: `Unknown product group "${data.group}"` }]);
  }
}

export const RESOURCES: Record<ContentResourceKey, ResourceDef> = {
  products: {
    key: "products",
    label: "Product",
    model: ProductModel,
    tags: [TAGS.products],
    titleField: "title",
    searchFields: ["title", "summary", "slug", "brand", "tags"],
    filters: [
      { name: "group", type: "string" },
      { name: "featured", type: "boolean" },
      { name: "brand", type: "string" },
    ],
    uniqueField: "slug",
    toDTO: toProduct,
    beforeWrite: async (data) => ensureGroupExists(data),
  },

  "product-groups": {
    key: "product-groups",
    label: "Product group",
    model: ProductGroupModel,
    tags: [TAGS.groups, TAGS.products],
    titleField: "title",
    searchFields: ["title", "key"],
    filters: [],
    uniqueField: "key",
    toDTO: toProductGroup,
    beforeWrite: async (data, existing) => {
      if (existing && data.key && data.key !== existing.key) {
        const inUse = await ProductModel.countDocuments({ group: existing.key });
        if (inUse > 0) {
          throw conflict(`Cannot change the key of a group used by ${inUse} product(s). Move the products first.`);
        }
      }
    },
    beforeDelete: async (existing) => {
      const inUse = await ProductModel.countDocuments({ group: existing.key });
      if (inUse > 0) throw conflict(`This group still contains ${inUse} product(s). Move or delete them first.`);
    },
  },

  surveys: {
    key: "surveys",
    label: "Survey",
    model: SurveyModel,
    tags: [TAGS.surveys],
    titleField: "title",
    searchFields: ["title", "shortTitle", "slug", "description"],
    filters: [{ name: "featured", type: "boolean" }],
    uniqueField: "slug",
    toDTO: toSurvey,
  },

  training: {
    key: "training",
    label: "Training programme",
    model: TrainingModel,
    tags: [TAGS.training],
    titleField: "title",
    searchFields: ["title", "slug", "summary"],
    filters: [],
    uniqueField: "slug",
    toDTO: toTraining,
  },

  gallery: {
    key: "gallery",
    label: "Gallery image",
    model: GalleryModel,
    tags: [TAGS.gallery],
    titleField: "alt",
    searchFields: ["alt", "caption"],
    filters: [],
    toDTO: toGalleryImage,
  },

  testimonials: {
    key: "testimonials",
    label: "Testimonial",
    model: TestimonialModel,
    tags: [TAGS.testimonials],
    titleField: "name",
    searchFields: ["name", "company", "quote"],
    // ?source=public&published=false is the moderation queue.
    filters: [{ name: "source", type: "string" }],
    toDTO: toTestimonialAdmin,
  },

  logos: {
    key: "logos",
    label: "Logo",
    model: LogoModel,
    tags: [TAGS.logos],
    titleField: "name",
    searchFields: ["name"],
    filters: [{ name: "kind", type: "string" }],
    toDTO: toLogo,
  },

  leaders: {
    key: "leaders",
    label: "Leader",
    model: LeaderModel,
    tags: [TAGS.leaders],
    titleField: "name",
    searchFields: ["name", "role"],
    filters: [],
    toDTO: toLeader,
  },
};

export function resourceFor(key: string): ResourceDef {
  const def = (RESOURCES as Record<string, ResourceDef | undefined>)[key];
  if (!def) throw notFound("Content type");
  return def;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function objectId(id: string, label: string): Types.ObjectId {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw notFound(label);
  return new Types.ObjectId(id);
}

async function uniqueValue(def: ResourceDef, base: string): Promise<string> {
  const field = def.uniqueField!;
  let candidate = base;
  for (let n = 2; n < 100; n += 1) {
    if (!(await def.model.exists({ [field]: candidate }))) return candidate;
    candidate = `${base}-${n}`.slice(0, 80);
  }
  throw conflict(`Could not derive a unique ${field} from the title.`);
}

function conflictFrom(def: ResourceDef, error: unknown): never {
  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? def.uniqueField ?? "value";
    throw conflict(`${def.label} with this ${field} already exists.`, { field });
  }
  throw error;
}

const DEFAULT_SORT: Record<string, Record<string, 1 | -1>> = {
  order: { order: 1, createdAt: 1 },
  "-order": { order: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
};

/** Builds the list-query schema for a resource, including only the filters it supports. */
export function listQuerySchema(def: ResourceDef) {
  const filterShape: Record<string, z.ZodTypeAny> = {};
  for (const filter of def.filters) {
    filterShape[filter.name] = (filter.type === "boolean" ? queryBool : z.string().trim().max(100)).optional();
  }
  return z
    .object({
      ...pagination,
      q: z.string().trim().max(100).optional(),
      published: queryBool.optional(),
      sort: z.enum(["order", "-order", "newest", "oldest", "updated", "title"]).optional(),
      ...filterShape,
    })
    .strict();
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export async function listResource(def: ResourceDef, query: Record<string, any>) {
  await connectDb();
  const { page, limit, skip } = resolvePagination(query);

  const filter: Record<string, any> = {};
  if (query.published !== undefined) filter.published = query.published;
  for (const spec of def.filters) {
    if (query[spec.name] !== undefined) filter[spec.name] = query[spec.name];
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = def.searchFields.map((field) => ({ [field]: pattern }));
  }

  const sort = query.sort === "title" ? { [def.titleField]: 1 as const } : DEFAULT_SORT[query.sort ?? "order"];

  const [docs, total] = await Promise.all([
    def.model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    def.model.countDocuments(filter),
  ]);

  return { items: docs.map(def.toDTO), meta: pageMeta(total, page, limit) };
}

export async function getResource(def: ResourceDef, id: string) {
  await connectDb();
  const doc = await def.model.findById(objectId(id, def.label)).lean();
  if (!doc) throw notFound(def.label);
  return def.toDTO(doc);
}

export async function createResource(def: ResourceDef, input: Record<string, any>, actor: Actor, ipHash?: string) {
  await connectDb();
  const data = { ...input };

  if (def.uniqueField) {
    if (data[def.uniqueField]) {
      if (await def.model.exists({ [def.uniqueField]: data[def.uniqueField] })) {
        throw conflict(`${def.label} with this ${def.uniqueField} already exists.`, { field: def.uniqueField });
      }
    } else {
      const base = slugify(String(data[def.titleField] ?? ""));
      if (!base) throw validationFailed([{ path: def.titleField, message: "Cannot derive a slug from this title" }]);
      data[def.uniqueField] = await uniqueValue(def, base);
    }
  }

  await def.beforeWrite?.(data, null);

  // Append new items to the end of the list unless an explicit order was given.
  if (data.order === undefined) {
    const last = await def.model.findOne().sort({ order: -1 }).select("order").lean<{ order?: number }>();
    data.order = (last?.order ?? 0) + 10;
  }

  let created;
  try {
    created = await def.model.create(data);
  } catch (error) {
    conflictFrom(def, error);
  }

  invalidate(...def.tags);
  await audit({
    actor,
    action: "create",
    resource: def.key,
    resourceId: String(created._id),
    summary: String(data[def.titleField] ?? data[def.uniqueField ?? ""] ?? ""),
    ipHash,
  });
  return def.toDTO(created.toObject());
}

export async function updateResource(
  def: ResourceDef,
  id: string,
  input: Record<string, any>,
  actor: Actor,
  ipHash?: string,
) {
  await connectDb();
  const _id = objectId(id, def.label);

  if (Object.keys(input).length === 0) {
    throw validationFailed([{ path: "", message: "Provide at least one field to update" }]);
  }

  const existing = await def.model.findById(_id).lean();
  if (!existing) throw notFound(def.label);

  await def.beforeWrite?.(input, existing);

  let updated;
  try {
    updated = await def.model.findOneAndUpdate({ _id }, { $set: input }, { returnDocument: "after", runValidators: true, lean: true });
  } catch (error) {
    conflictFrom(def, error);
  }
  if (!updated) throw notFound(def.label);

  invalidate(...def.tags);
  await audit({
    actor,
    action: "update",
    resource: def.key,
    resourceId: id,
    summary: String((updated as any)[def.titleField] ?? ""),
    fields: Object.keys(input),
    ipHash,
  });
  return def.toDTO(updated);
}

export async function deleteResource(def: ResourceDef, id: string, actor: Actor, ipHash?: string) {
  await connectDb();
  const _id = objectId(id, def.label);

  const existing = await def.model.findById(_id).lean();
  if (!existing) throw notFound(def.label);

  await def.beforeDelete?.(existing);
  await def.model.deleteOne({ _id });

  invalidate(...def.tags);
  await audit({
    actor,
    action: "delete",
    resource: def.key,
    resourceId: id,
    summary: String((existing as any)[def.titleField] ?? ""),
    ipHash,
  });
}

export async function reorderResource(def: ResourceDef, ids: string[], actor: Actor, ipHash?: string) {
  await connectDb();
  if (new Set(ids).size !== ids.length) {
    throw validationFailed([{ path: "ids", message: "Duplicate ids in list" }]);
  }

  const objectIds = ids.map((id) => objectId(id, def.label));
  const found = await def.model.countDocuments({ _id: { $in: objectIds } });
  if (found !== objectIds.length) {
    throw validationFailed([{ path: "ids", message: `${objectIds.length - found} id(s) do not exist` }]);
  }

  await def.model.bulkWrite(
    objectIds.map((_id, index) => ({
      updateOne: { filter: { _id }, update: { $set: { order: (index + 1) * 10 } } },
    })),
  );

  invalidate(...def.tags);
  await audit({
    actor,
    action: "reorder",
    resource: def.key,
    summary: `${ids.length} item(s)`,
    ipHash,
  });
  return { reordered: ids.length };
}

export async function bulkResource(
  def: ResourceDef,
  action: "publish" | "unpublish" | "delete",
  ids: string[],
  actor: Actor,
  ipHash?: string,
) {
  await connectDb();
  const objectIds = ids.map((id) => objectId(id, def.label));

  if (action === "delete") {
    const docs = await def.model.find({ _id: { $in: objectIds } }).lean();
    // Run per-item guards first so a blocked delete doesn't leave a half-applied batch.
    for (const doc of docs) await def.beforeDelete?.(doc);
    const result = await def.model.deleteMany({ _id: { $in: objectIds } });
    invalidate(...def.tags);
    await audit({ actor, action: "bulk-delete", resource: def.key, summary: `${result.deletedCount} item(s)`, ipHash });
    return { affected: result.deletedCount ?? 0 };
  }

  const result = await def.model.updateMany({ _id: { $in: objectIds } }, { $set: { published: action === "publish" } });
  invalidate(...def.tags);
  await audit({ actor, action: `bulk-${action}`, resource: def.key, summary: `${result.modifiedCount} item(s)`, ipHash });
  return { affected: result.modifiedCount };
}
