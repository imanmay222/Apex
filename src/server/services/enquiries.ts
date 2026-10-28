import { Types, type Model } from "mongoose";
import { env } from "../config/env";
import { connectDb } from "../db/connect";
import {
  AdminUserModel,
  CounterModel,
  EnquiryModel,
  ProductModel,
  SurveyModel,
  TrainingModel,
  type EnquiryDoc,
  type EnquiryStatus,
  type EnquiryType,
} from "../db/models";
import { hmacHex, randomToken, safeEqual, sha256 } from "../lib/crypto";
import { forbidden, notFound, validationFailed } from "../lib/errors";
import { csvCell, escapeRegex } from "../lib/text";
import { pageMeta, resolvePagination } from "../validation/primitives";
import type { EnquiryCreateInput, EnquiryListQuery } from "../validation/enquiry";
import { audit, type Actor } from "./audit";
import type { Lean } from "./mappers";

/* ------------------------------------------------------------------ */
/* Form tokens: stateless proof that the form was loaded by a browser  */
/* ------------------------------------------------------------------ */

const MIN_FILL_MS = 2_000;
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function issueFormToken(): string {
  const payload = `${Date.now()}.${randomToken(6)}`;
  return `${payload}.${hmacHex(env().sessionSecret, `form:${payload}`).slice(0, 32)}`;
}

export type TokenCheck = "ok" | "invalid" | "too-fast" | "expired";

export function checkFormToken(token: string): TokenCheck {
  const [issuedAt, nonce, signature] = token.split(".");
  if (!issuedAt || !nonce || !signature) return "invalid";

  const expected = hmacHex(env().sessionSecret, `form:${issuedAt}.${nonce}`).slice(0, 32);
  if (!safeEqual(signature, expected)) return "invalid";

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0) return "invalid";
  if (age < MIN_FILL_MS) return "too-fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}

/* ------------------------------------------------------------------ */
/* Spam scoring                                                        */
/* ------------------------------------------------------------------ */

const SPAM_THRESHOLD = 4;
const SPAM_WORDS = /\b(viagra|casino|crypto|bitcoin|forex|backlinks?|seo (services|expert)|payday loan|escort|porn|lottery|winner)\b/i;
const DISPOSABLE = /@(mailinator|guerrillamail|10minutemail|tempmail|yopmail|trashmail|sharklasers)\./i;

export function scoreSpam(input: { name: string; message: string; email?: string; honeypot?: string }) {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (input.honeypot) add(10, "honeypot");

  const links = (input.message.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links >= 3) add(3, "many-links");
  else if (links >= 1) add(1, "link");

  if (SPAM_WORDS.test(input.message) || SPAM_WORDS.test(input.name)) add(3, "spam-words");
  if (/https?:\/\/|www\./i.test(input.name)) add(3, "url-in-name");
  if (input.email && DISPOSABLE.test(input.email)) add(2, "disposable-email");
  if (input.message.length > 25 && input.message === input.message.toUpperCase() && /[A-Z]/.test(input.message)) {
    add(1, "all-caps");
  }
  if (/(.)\1{9,}/.test(input.message)) add(2, "repeated-characters");

  return { score, reasons, isSpam: score >= SPAM_THRESHOLD };
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

const REFERENCE_PREFIX = { enquiry: "ENQ", order: "ORD" } as const;

/** Next human-friendly reference (ENQ-2026-000123 / ORD-2026-000123); the counter restarts each year. */
export async function nextReference(kind: keyof typeof REFERENCE_PREFIX = "enquiry"): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await CounterModel.findOneAndUpdate(
    { _id: `${kind}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  return `${REFERENCE_PREFIX[kind]}-${year}-${String(counter?.seq ?? 1).padStart(6, "0")}`;
}

async function resolveSubject(type: EnquiryType, slug?: string): Promise<{ slug: string; title: string } | null> {
  if (!slug || type === "general") return null;

  // The three models share the fields queried here; widen to one shape so the call type-checks.
  const model = (type === "products" ? ProductModel : type === "survey" ? SurveyModel : TrainingModel) as unknown as Model<{
    slug: string;
    title: string;
    published: boolean;
  }>;
  const doc = await model.findOne({ slug, published: true }).select("slug title").lean<{ slug: string; title: string }>();
  if (!doc) throw validationFailed([{ path: "subject", message: `Unknown ${type} "${slug}"` }]);
  return { slug: doc.slug, title: doc.title };
}

export interface CreateResult {
  reference: string;
  /** Internal id; undefined when the submission was a duplicate. */
  id?: string;
  duplicate: boolean;
  spam: boolean;
}

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export async function createEnquiry(
  input: EnquiryCreateInput,
  meta: { ipHash: string; userAgent: string },
): Promise<CreateResult> {
  await connectDb();

  const subject = await resolveSubject(input.type, input.subject);
  const email = input.email ? input.email : undefined;
  const spam = scoreSpam({ name: input.name, message: input.message, email, honeypot: input.website });

  const messageHash = sha256(input.message.toLowerCase().replace(/\s+/g, " ").trim());
  const recent = await EnquiryModel.findOne({
    mobile: input.mobile,
    messageHash,
    createdAt: { $gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  })
    .select("reference")
    .lean();
  if (recent) return { reference: recent.reference, duplicate: true, spam: false };

  const reference = await nextReference();
  const doc = await EnquiryModel.create({
    reference,
    type: input.type,
    subjectSlug: subject?.slug,
    subjectTitle: subject?.title,
    name: input.name,
    mobile: input.mobile,
    email,
    message: input.message,
    messageHash,
    status: spam.isSpam ? "spam" : "new",
    statusHistory: [{ status: spam.isSpam ? "spam" : "new", at: new Date(), byName: "system" }],
    source: input.source,
    client: { ipHash: meta.ipHash, userAgent: meta.userAgent },
    spam: { score: spam.score, reasons: spam.reasons },
  });

  return { reference, id: String(doc._id), duplicate: false, spam: spam.isSpam };
}

/* ------------------------------------------------------------------ */
/* Admin read model                                                    */
/* ------------------------------------------------------------------ */

type EnquiryLean = Lean<EnquiryDoc>;

export interface EnquiryDTO {
  id: string;
  reference: string;
  type: EnquiryType;
  subject: { slug: string; title: string } | null;
  name: string;
  mobile: string;
  email: string | null;
  message: string;
  status: EnquiryStatus;
  priority: string;
  assignedTo: { id: string; name: string } | null;
  tags: string[];
  notes: { id: string; authorId: string | null; authorName: string; body: string; createdAt: string }[];
  statusHistory: { status: string; at: string; by: string }[];
  firstResponseAt: string | null;
  source: Record<string, string | undefined>;
  spam: { score: number; reasons: string[] };
  notifications: Record<string, { status: string; attempts: number; lastAttemptAt: string | null; sentAt: string | null; lastError: string | null }>;
  createdAt: string;
  updatedAt: string;
}

const iso = (date?: Date | null) => (date ? date.toISOString() : null);

function toEnquiry(doc: EnquiryLean, assignees: Map<string, string>): EnquiryDTO {
  const assignedId = doc.assignedTo ? String(doc.assignedTo) : null;
  const channel = (key: "sales" | "customer" | "webhook") => {
    const n = doc.notifications?.[key];
    return {
      status: n?.status ?? "pending",
      attempts: n?.attempts ?? 0,
      lastAttemptAt: iso(n?.lastAttemptAt),
      sentAt: iso(n?.sentAt),
      lastError: n?.lastError ?? null,
    };
  };

  return {
    id: String(doc._id),
    reference: doc.reference,
    type: doc.type,
    subject: doc.subjectSlug ? { slug: doc.subjectSlug, title: doc.subjectTitle ?? doc.subjectSlug } : null,
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email ?? null,
    message: doc.message,
    status: doc.status,
    priority: doc.priority,
    assignedTo: assignedId ? { id: assignedId, name: assignees.get(assignedId) ?? "Unknown user" } : null,
    tags: [...(doc.tags ?? [])],
    notes: (doc.notes ?? []).map((note) => ({
      id: String((note as { _id?: Types.ObjectId })._id),
      authorId: note.authorId ? String(note.authorId) : null,
      authorName: note.authorName ?? "Unknown",
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })),
    statusHistory: (doc.statusHistory ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at.toISOString(),
      by: entry.byName ?? "system",
    })),
    firstResponseAt: iso(doc.firstResponseAt),
    source: { ...(doc.source ?? {}) } as Record<string, string | undefined>,
    spam: { score: doc.spam?.score ?? 0, reasons: [...(doc.spam?.reasons ?? [])] },
    notifications: { sales: channel("sales"), customer: channel("customer"), webhook: channel("webhook") },
    createdAt: iso(doc.createdAt) ?? "",
    updatedAt: iso(doc.updatedAt) ?? "",
  };
}

export async function assigneeNames(docs: { assignedTo?: unknown }[]): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((d) => d.assignedTo).filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const users = await AdminUserModel.find({ _id: { $in: ids } }).select("name").lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

function buildFilter(query: Partial<EnquiryListQuery>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // Spam is hidden unless explicitly requested.
  filter.status = query.status?.length ? { $in: query.status } : { $ne: "spam" };
  if (query.type?.length) filter.type = { $in: query.type };
  if (query.priority) filter.priority = query.priority;
  if (query.assignedTo === "unassigned") filter.assignedTo = { $exists: false };
  else if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);

  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = ["reference", "name", "mobile", "email", "message", "subjectTitle"].map((field) => ({ [field]: pattern }));
  }
  return filter;
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  status: { status: 1, createdAt: -1 },
} as const;

export async function listEnquiries(query: EnquiryListQuery) {
  await connectDb();
  const { page, limit, skip } = resolvePagination(query);
  const filter = buildFilter(query);

  const [docs, total] = await Promise.all([
    EnquiryModel.find(filter).sort(SORTS[query.sort ?? "newest"]).skip(skip).limit(limit).lean(),
    EnquiryModel.countDocuments(filter),
  ]);
  const names = await assigneeNames(docs);
  return { items: docs.map((doc) => toEnquiry(doc, names)), meta: pageMeta(total, page, limit) };
}

function enquiryObjectId(id: string): Types.ObjectId {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw notFound("Enquiry");
  return new Types.ObjectId(id);
}

export async function getEnquiry(id: string): Promise<EnquiryDTO> {
  await connectDb();
  const doc = await EnquiryModel.findById(enquiryObjectId(id)).lean();
  if (!doc) throw notFound("Enquiry");
  return toEnquiry(doc, await assigneeNames([doc]));
}

/* ------------------------------------------------------------------ */
/* Admin mutations                                                     */
/* ------------------------------------------------------------------ */

interface UpdateInput {
  status?: EnquiryStatus;
  priority?: "low" | "normal" | "high";
  assignedTo?: string | null;
  tags?: string[];
}

export async function assertAssignable(userId: string) {
  const user = await AdminUserModel.findOne({ _id: userId, active: true }).select("_id").lean();
  if (!user) throw validationFailed([{ path: "assignedTo", message: "No active user with that id" }]);
}

export async function updateEnquiry(id: string, input: UpdateInput, actor: Actor & { name: string }, ipHash?: string) {
  await connectDb();
  const _id = enquiryObjectId(id);
  if (Object.keys(input).length === 0) {
    throw validationFailed([{ path: "", message: "Provide at least one field to update" }]);
  }

  const existing = await EnquiryModel.findById(_id).lean();
  if (!existing) throw notFound("Enquiry");

  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const push: Record<string, unknown> = {};

  if (input.priority) set.priority = input.priority;
  if (input.tags) set.tags = [...new Set(input.tags)];

  if (input.assignedTo === null) unset.assignedTo = "";
  else if (input.assignedTo) {
    await assertAssignable(input.assignedTo);
    set.assignedTo = new Types.ObjectId(input.assignedTo);
  }

  if (input.status && input.status !== existing.status) {
    set.status = input.status;
    push.statusHistory = { status: input.status, at: new Date(), byId: new Types.ObjectId(actor.id), byName: actor.name };
    // First real human response = first move out of "new" into an engaged state.
    if (!existing.firstResponseAt && ["contacted", "quoted", "won", "lost"].includes(input.status)) {
      set.firstResponseAt = new Date();
    }
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (Object.keys(push).length) update.$push = push;

  if (Object.keys(update).length) await EnquiryModel.updateOne({ _id }, update);

  await audit({
    actor,
    action: "update",
    resource: "enquiries",
    resourceId: id,
    summary: existing.reference,
    fields: Object.keys(input),
    ipHash,
  });
  return getEnquiry(id);
}

export async function addNote(id: string, body: string, actor: Actor & { name: string }, ipHash?: string) {
  await connectDb();
  const result = await EnquiryModel.updateOne(
    { _id: enquiryObjectId(id) },
    { $push: { notes: { authorId: new Types.ObjectId(actor.id), authorName: actor.name, body, createdAt: new Date() } } },
  );
  if (result.matchedCount === 0) throw notFound("Enquiry");
  await audit({ actor, action: "note", resource: "enquiries", resourceId: id, ipHash });
  return getEnquiry(id);
}

export async function deleteNote(
  id: string,
  noteId: string,
  actor: Actor & { role: string },
  ipHash?: string,
) {
  await connectDb();
  const _id = enquiryObjectId(id);
  const doc = await EnquiryModel.findById(_id).select("notes").lean();
  if (!doc) throw notFound("Enquiry");

  const note = (doc.notes ?? []).find((n) => String((n as { _id?: Types.ObjectId })._id) === noteId);
  if (!note) throw notFound("Note");
  if (actor.role !== "admin" && String(note.authorId) !== actor.id) {
    throw forbidden("Only the author or an administrator can delete a note.");
  }

  await EnquiryModel.updateOne({ _id }, { $pull: { notes: { _id: new Types.ObjectId(noteId) } } });
  await audit({ actor, action: "note-delete", resource: "enquiries", resourceId: id, ipHash });
  return getEnquiry(id);
}

export async function deleteEnquiry(id: string, actor: Actor, ipHash?: string) {
  await connectDb();
  const doc = await EnquiryModel.findByIdAndDelete(enquiryObjectId(id)).select("reference").lean();
  if (!doc) throw notFound("Enquiry");
  await audit({ actor, action: "delete", resource: "enquiries", resourceId: id, summary: doc.reference, ipHash });
}

export type BulkEnquiryAction =
  | { action: "status"; ids: string[]; status: EnquiryStatus }
  | { action: "assign"; ids: string[]; assignedTo: string | null }
  | { action: "delete"; ids: string[] };

export async function bulkEnquiries(input: BulkEnquiryAction, actor: Actor & { name: string }, ipHash?: string) {
  await connectDb();
  const ids = input.ids.map(enquiryObjectId);

  let affected = 0;
  if (input.action === "delete") {
    affected = (await EnquiryModel.deleteMany({ _id: { $in: ids } })).deletedCount ?? 0;
  } else if (input.action === "assign") {
    if (input.assignedTo) await assertAssignable(input.assignedTo);
    const update = input.assignedTo
      ? { $set: { assignedTo: new Types.ObjectId(input.assignedTo) } }
      : { $unset: { assignedTo: "" as const } };
    affected = (await EnquiryModel.updateMany({ _id: { $in: ids } }, update)).modifiedCount;
  } else {
    // Only touch documents whose status actually changes, so history stays truthful.
    affected = (
      await EnquiryModel.updateMany(
        { _id: { $in: ids }, status: { $ne: input.status } },
        {
          $set: { status: input.status },
          $push: { statusHistory: { status: input.status, at: new Date(), byId: new Types.ObjectId(actor.id), byName: actor.name } },
        },
      )
    ).modifiedCount;
  }

  await audit({ actor, action: `bulk-${input.action}`, resource: "enquiries", summary: `${affected} item(s)`, ipHash });
  return { affected };
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

const EXPORT_LIMIT = 10_000;

export async function exportEnquiriesCsv(query: Partial<EnquiryListQuery>): Promise<string> {
  await connectDb();
  const docs = await EnquiryModel.find(buildFilter(query)).sort({ createdAt: -1 }).limit(EXPORT_LIMIT).lean();
  const names = await assigneeNames(docs);

  const header = [
    "Reference", "Received", "Status", "Priority", "Type", "About", "Name", "Mobile", "Email",
    "Message", "Assigned to", "Tags", "First response", "Page", "Spam score",
  ];

  const rows = docs.map((doc) => [
    doc.reference,
    doc.createdAt,
    doc.status,
    doc.priority,
    doc.type,
    doc.subjectTitle ?? "",
    doc.name,
    doc.mobile,
    doc.email ?? "",
    doc.message,
    doc.assignedTo ? (names.get(String(doc.assignedTo)) ?? "") : "",
    (doc.tags ?? []).join("; "),
    doc.firstResponseAt ?? "",
    doc.source?.path ?? "",
    doc.spam?.score ?? 0,
  ]);

  // BOM so Excel opens UTF-8 (e.g. Devanagari/Tamil names) correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Customer tracking                                                   */
/* ------------------------------------------------------------------ */

const PUBLIC_STATUS: Record<string, { label: string; step: number }> = {
  new: { label: "Received", step: 1 },
  contacted: { label: "In progress", step: 2 },
  quoted: { label: "Quote sent", step: 3 },
  won: { label: "Completed", step: 4 },
  lost: { label: "Closed", step: 4 },
  archived: { label: "Closed", step: 4 },
};

/**
 * Lets a customer check progress with the reference they were given AND the mobile number they used.
 * Internal notes, assignees and spam state are never exposed; a miss and a mismatch are indistinguishable.
 */
export async function trackEnquiry(reference: string, mobile: string) {
  await connectDb();
  const doc = await EnquiryModel.findOne({ reference, mobile, status: { $ne: "spam" } }).lean();
  if (!doc) throw notFound("Enquiry");

  const current = PUBLIC_STATUS[doc.status] ?? PUBLIC_STATUS.new;
  return {
    reference: doc.reference,
    kind: "enquiry" as const,
    type: doc.type,
    subject: doc.subjectTitle ?? null,
    status: current.label,
    step: current.step,
    steps: ["Received", "In progress", "Quote sent", "Closed"],
    cancelled: false,
    receivedAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    history: (doc.statusHistory ?? [])
      .filter((entry) => PUBLIC_STATUS[entry.status])
      .map((entry) => ({ status: PUBLIC_STATUS[entry.status].label, at: entry.at.toISOString() })),
  };
}
