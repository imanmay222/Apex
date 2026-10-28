import { Types } from "mongoose";
import { connectDb } from "../db/connect";
import { MAX_ORDER_QUANTITY, OrderModel, ProductModel, type OrderDoc, type OrderStatus } from "../db/models";
import { forbidden, notFound, validationFailed } from "../lib/errors";
import { sha256 } from "../lib/crypto";
import { csvCell, escapeRegex } from "../lib/text";
import { pageMeta, resolvePagination } from "../validation/primitives";
import type { OrderCreateInput, OrderListQuery } from "../validation/order";
import { audit, type Actor } from "./audit";
import { assertAssignable, assigneeNames, nextReference, scoreSpam, type CreateResult } from "./enquiries";
import type { Lean } from "./mappers";

type OrderLean = Lean<OrderDoc>;

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

type Line = { product: string; quantity: number; note?: string };

/** Same product + same note = one line; quantities add up (capped). Order of first appearance is kept. */
function mergeLines(items: Line[]): Line[] {
  const merged = new Map<string, Line>();
  for (const item of items) {
    const note = item.note?.trim() || undefined;
    const key = `${item.product}\u0000${(note ?? "").toLowerCase()}`;
    const existing = merged.get(key);
    if (existing) existing.quantity = Math.min(MAX_ORDER_QUANTITY, existing.quantity + item.quantity);
    else merged.set(key, { product: item.product, quantity: item.quantity, note });
  }
  return [...merged.values()];
}

/** Resolves slugs to published products; unknown or hidden ones are reported against their basket line. */
async function resolveProducts(items: Line[], original: Line[]): Promise<Map<string, string>> {
  const slugs = [...new Set(items.map((item) => item.product))];
  const docs = await ProductModel.find({ slug: { $in: slugs }, published: true }).select("slug title").lean();
  const titles = new Map(docs.map((doc) => [doc.slug, doc.title]));

  const problems = original
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !titles.has(item.product))
    .map(({ item, index }) => ({ path: `items.${index}.product`, message: `“${item.product}” is not available any more` }));
  if (problems.length) throw validationFailed(problems);
  return titles;
}

export async function createOrder(input: OrderCreateInput, meta: { ipHash: string; userAgent: string }): Promise<CreateResult> {
  await connectDb();

  const lines = mergeLines(input.items);
  const titles = await resolveProducts(lines, input.items);
  const email = input.email ? input.email : undefined;
  const gstin = input.gstin ? input.gstin : undefined;

  const spamText = [input.notes ?? "", ...lines.map((line) => line.note ?? ""), input.address.line1, input.address.line2 ?? ""].join("\n");
  const spam = scoreSpam({ name: input.name, message: spamText, email, honeypot: input.website });

  const itemsHash = sha256(
    lines
      .map((line) => `${line.product}:${line.quantity}:${(line.note ?? "").toLowerCase()}`)
      .sort()
      .join("|"),
  );
  const recent = await OrderModel.findOne({ mobile: input.mobile, itemsHash, createdAt: { $gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) } })
    .select("reference")
    .lean();
  if (recent) return { reference: recent.reference, duplicate: true, spam: false };

  const reference = await nextReference("order");
  const status: OrderStatus = spam.isSpam ? "spam" : "new";
  const doc = await OrderModel.create({
    reference,
    items: lines.map((line) => ({ productSlug: line.product, productTitle: titles.get(line.product)!, quantity: line.quantity, note: line.note })),
    itemsHash,
    name: input.name,
    mobile: input.mobile,
    email,
    company: input.company || undefined,
    gstin,
    address: {
      line1: input.address.line1,
      line2: input.address.line2 || undefined,
      city: input.address.city,
      state: input.address.state,
      postalCode: input.address.postalCode,
    },
    customerNotes: input.notes || undefined,
    status,
    statusHistory: [{ status, at: new Date(), byName: "system" }],
    source: input.source,
    client: { ipHash: meta.ipHash, userAgent: meta.userAgent },
    spam: { score: spam.score, reasons: spam.reasons },
  });

  return { reference, id: String(doc._id), duplicate: false, spam: spam.isSpam };
}

/* ------------------------------------------------------------------ */
/* Admin read model                                                    */
/* ------------------------------------------------------------------ */

const iso = (date?: Date | null) => (date ? date.toISOString() : null);

export interface OrderDTO {
  id: string;
  reference: string;
  items: { product: { slug: string; title: string }; quantity: number; note: string | null }[];
  totalUnits: number;
  name: string;
  mobile: string;
  email: string | null;
  company: string | null;
  gstin: string | null;
  address: { line1: string; line2: string | null; city: string; state: string; postalCode: string };
  customerNotes: string | null;
  status: OrderStatus;
  assignedTo: { id: string; name: string } | null;
  notes: { id: string; authorId: string | null; authorName: string; body: string; createdAt: string }[];
  statusHistory: { status: string; at: string; by: string }[];
  firstResponseAt: string | null;
  source: Record<string, string | undefined>;
  spam: { score: number; reasons: string[] };
  notifications: Record<"sales" | "customer" | "webhook", { status: string; attempts: number; lastAttemptAt: string | null; sentAt: string | null; lastError: string | null }>;
  createdAt: string;
  updatedAt: string;
}

function toOrder(doc: OrderLean, assignees: Map<string, string>): OrderDTO {
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
  const items = (doc.items ?? []).map((item) => ({
    product: { slug: item.productSlug, title: item.productTitle },
    quantity: item.quantity,
    note: item.note ?? null,
  }));

  return {
    id: String(doc._id),
    reference: doc.reference,
    items,
    totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email ?? null,
    company: doc.company ?? null,
    gstin: doc.gstin ?? null,
    address: {
      line1: doc.address?.line1 ?? "",
      line2: doc.address?.line2 ?? null,
      city: doc.address?.city ?? "",
      state: doc.address?.state ?? "",
      postalCode: doc.address?.postalCode ?? "",
    },
    customerNotes: doc.customerNotes ?? null,
    status: doc.status as OrderStatus,
    assignedTo: assignedId ? { id: assignedId, name: assignees.get(assignedId) ?? "Unknown user" } : null,
    notes: (doc.notes ?? []).map((note) => ({
      id: String((note as { _id?: Types.ObjectId })._id),
      authorId: note.authorId ? String(note.authorId) : null,
      authorName: note.authorName ?? "Unknown",
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })),
    statusHistory: (doc.statusHistory ?? []).map((entry) => ({ status: entry.status, at: entry.at.toISOString(), by: entry.byName ?? "system" })),
    firstResponseAt: iso(doc.firstResponseAt),
    source: { ...(doc.source ?? {}) } as Record<string, string | undefined>,
    spam: { score: doc.spam?.score ?? 0, reasons: [...(doc.spam?.reasons ?? [])] },
    notifications: { sales: channel("sales"), customer: channel("customer"), webhook: channel("webhook") },
    createdAt: iso(doc.createdAt) ?? "",
    updatedAt: iso(doc.updatedAt) ?? "",
  };
}

function buildFilter(query: Partial<OrderListQuery>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // Spam is hidden unless explicitly requested.
  filter.status = query.status?.length ? { $in: query.status } : { $ne: "spam" };
  if (query.assignedTo === "unassigned") filter.assignedTo = { $exists: false };
  else if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
  if (query.product) filter["items.productSlug"] = query.product;

  if (query.from || query.to) {
    filter.createdAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = ["reference", "name", "mobile", "email", "company", "gstin", "items.productTitle", "address.city", "address.postalCode"].map((field) => ({
      [field]: pattern,
    }));
  }
  return filter;
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  status: { status: 1, createdAt: -1 },
} as const;

export async function listOrders(query: OrderListQuery) {
  await connectDb();
  const { page, limit, skip } = resolvePagination(query);
  const filter = buildFilter(query);
  const [docs, total] = await Promise.all([
    OrderModel.find(filter).sort(SORTS[query.sort ?? "newest"]).skip(skip).limit(limit).lean(),
    OrderModel.countDocuments(filter),
  ]);
  const names = await assigneeNames(docs);
  return { items: docs.map((doc) => toOrder(doc, names)), meta: pageMeta(total, page, limit) };
}

function orderObjectId(id: string): Types.ObjectId {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw notFound("Order");
  return new Types.ObjectId(id);
}

export async function getOrder(id: string): Promise<OrderDTO> {
  await connectDb();
  const doc = await OrderModel.findById(orderObjectId(id)).lean();
  if (!doc) throw notFound("Order");
  return toOrder(doc, await assigneeNames([doc]));
}

/* ------------------------------------------------------------------ */
/* Admin writes                                                        */
/* ------------------------------------------------------------------ */

/** Statuses that count as the team having responded to the customer. */
const RESPONDED: OrderStatus[] = ["quoted", "confirmed", "dispatched", "delivered", "cancelled"];

export async function updateOrder(id: string, input: { status?: OrderStatus; assignedTo?: string | null }, actor: Actor & { name: string }, ipHash?: string) {
  await connectDb();
  const _id = orderObjectId(id);
  if (Object.keys(input).length === 0) throw validationFailed([{ path: "", message: "Provide at least one field to update" }]);

  const existing = await OrderModel.findById(_id).lean();
  if (!existing) throw notFound("Order");

  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const push: Record<string, unknown> = {};

  if (input.assignedTo === null) unset.assignedTo = "";
  else if (input.assignedTo) {
    await assertAssignable(input.assignedTo);
    set.assignedTo = new Types.ObjectId(input.assignedTo);
  }

  if (input.status && input.status !== existing.status) {
    set.status = input.status;
    push.statusHistory = { status: input.status, at: new Date(), byId: new Types.ObjectId(actor.id), byName: actor.name };
    if (!existing.firstResponseAt && RESPONDED.includes(input.status)) set.firstResponseAt = new Date();
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (Object.keys(push).length) update.$push = push;
  if (Object.keys(update).length) await OrderModel.updateOne({ _id }, update);

  await audit({ actor, action: "update", resource: "orders", resourceId: id, summary: existing.reference, fields: Object.keys(input), ipHash });
  return getOrder(id);
}

export async function addOrderNote(id: string, body: string, actor: Actor & { name: string }, ipHash?: string) {
  await connectDb();
  const result = await OrderModel.updateOne(
    { _id: orderObjectId(id) },
    { $push: { notes: { authorId: new Types.ObjectId(actor.id), authorName: actor.name, body, createdAt: new Date() } } },
  );
  if (result.matchedCount === 0) throw notFound("Order");
  await audit({ actor, action: "note", resource: "orders", resourceId: id, ipHash });
  return getOrder(id);
}

export async function deleteOrderNote(id: string, noteId: string, actor: Actor & { role: string }, ipHash?: string) {
  await connectDb();
  const _id = orderObjectId(id);
  const doc = await OrderModel.findById(_id).select("notes").lean();
  if (!doc) throw notFound("Order");

  const note = (doc.notes ?? []).find((n) => String((n as { _id?: Types.ObjectId })._id) === noteId);
  if (!note) throw notFound("Note");
  if (actor.role !== "admin" && String(note.authorId) !== actor.id) throw forbidden("Only the author or an administrator can delete a note.");

  await OrderModel.updateOne({ _id }, { $pull: { notes: { _id: new Types.ObjectId(noteId) } } });
  await audit({ actor, action: "note-delete", resource: "orders", resourceId: id, ipHash });
  return getOrder(id);
}

export async function deleteOrder(id: string, actor: Actor, ipHash?: string) {
  await connectDb();
  const doc = await OrderModel.findByIdAndDelete(orderObjectId(id)).select("reference").lean();
  if (!doc) throw notFound("Order");
  await audit({ actor, action: "delete", resource: "orders", resourceId: id, summary: doc.reference, ipHash });
}

export type BulkOrderAction =
  | { action: "status"; ids: string[]; status: OrderStatus }
  | { action: "assign"; ids: string[]; assignedTo: string | null }
  | { action: "delete"; ids: string[] };

export async function bulkOrders(input: BulkOrderAction, actor: Actor & { name: string }, ipHash?: string) {
  await connectDb();
  const ids = input.ids.map(orderObjectId);

  let affected = 0;
  if (input.action === "delete") {
    affected = (await OrderModel.deleteMany({ _id: { $in: ids } })).deletedCount ?? 0;
  } else if (input.action === "assign") {
    if (input.assignedTo) await assertAssignable(input.assignedTo);
    const update = input.assignedTo ? { $set: { assignedTo: new Types.ObjectId(input.assignedTo) } } : { $unset: { assignedTo: "" as const } };
    affected = (await OrderModel.updateMany({ _id: { $in: ids } }, update)).modifiedCount;
  } else {
    const entry = { status: input.status, at: new Date(), byId: new Types.ObjectId(actor.id), byName: actor.name };
    // Only touch orders whose status actually changes, so history stays truthful.
    affected = (await OrderModel.updateMany({ _id: { $in: ids }, status: { $ne: input.status } }, { $set: { status: input.status }, $push: { statusHistory: entry } })).modifiedCount;
    if (RESPONDED.includes(input.status)) {
      await OrderModel.updateMany({ _id: { $in: ids }, firstResponseAt: { $exists: false } }, { $set: { firstResponseAt: entry.at } });
    }
  }

  await audit({ actor, action: `bulk-${input.action}`, resource: "orders", summary: `${affected} item(s)`, ipHash });
  return { affected };
}

/* ------------------------------------------------------------------ */
/* CSV export: one row per order line, so it pivots well in Excel      */
/* ------------------------------------------------------------------ */

const EXPORT_LIMIT = 10_000;

export async function exportOrdersCsv(query: Partial<OrderListQuery>): Promise<string> {
  await connectDb();
  const docs = await OrderModel.find(buildFilter(query)).sort({ createdAt: -1 }).limit(EXPORT_LIMIT).lean();
  const names = await assigneeNames(docs);

  const header = [
    "Reference", "Received", "Status", "Name", "Company", "GSTIN", "Mobile", "Email",
    "Address", "City", "State", "PIN", "Product", "Quantity", "Line note", "Customer notes", "Assigned to",
  ];

  const rows = docs.flatMap((doc) =>
    (doc.items ?? []).map((item) => [
      doc.reference,
      doc.createdAt,
      doc.status,
      doc.name,
      doc.company ?? "",
      doc.gstin ?? "",
      doc.mobile,
      doc.email ?? "",
      [doc.address?.line1, doc.address?.line2].filter(Boolean).join(", "),
      doc.address?.city ?? "",
      doc.address?.state ?? "",
      doc.address?.postalCode ?? "",
      item.productTitle,
      item.quantity,
      item.note ?? "",
      doc.customerNotes ?? "",
      doc.assignedTo ? (names.get(String(doc.assignedTo)) ?? "") : "",
    ]),
  );

  // BOM so Excel opens UTF-8 (e.g. Tamil names) correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Customer tracking                                                   */
/* ------------------------------------------------------------------ */

export const ORDER_STEPS = ["Received", "Quote sent", "Confirmed", "Dispatched", "Delivered"] as const;

const PUBLIC_STATUS: Record<string, { label: string; step: number }> = {
  new: { label: "Received", step: 1 },
  quoted: { label: "Quote sent", step: 2 },
  confirmed: { label: "Confirmed", step: 3 },
  dispatched: { label: "Dispatched", step: 4 },
  delivered: { label: "Delivered", step: 5 },
  cancelled: { label: "Cancelled", step: 0 },
};

/**
 * "Where is my order?" with the reference AND the mobile number used. Internal notes, assignees,
 * spam state and the delivery address are never exposed; a miss and a mismatch are indistinguishable.
 */
export async function trackOrder(reference: string, mobile: string) {
  await connectDb();
  const doc = await OrderModel.findOne({ reference, mobile, status: { $ne: "spam" } }).lean();
  if (!doc) throw notFound("Order");

  const current = PUBLIC_STATUS[doc.status] ?? PUBLIC_STATUS.new;
  return {
    reference: doc.reference,
    kind: "order" as const,
    subject: `${doc.items.length} product${doc.items.length === 1 ? "" : "s"}`,
    items: doc.items.map((item) => ({ title: item.productTitle, quantity: item.quantity })),
    status: current.label,
    step: current.step,
    steps: [...ORDER_STEPS],
    cancelled: doc.status === "cancelled",
    receivedAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    history: (doc.statusHistory ?? [])
      .filter((entry) => PUBLIC_STATUS[entry.status])
      .map((entry) => ({ status: PUBLIC_STATUS[entry.status].label, at: entry.at.toISOString() })),
  };
}
