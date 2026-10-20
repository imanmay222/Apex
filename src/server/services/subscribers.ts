import { Types } from "mongoose";
import { env } from "../config/env";
import { connectDb } from "../db/connect";
import { SubscriberModel, type SubscriberDoc, type SubscriberStatus } from "../db/models";
import { notFound } from "../lib/errors";
import { errorFields, logger } from "../lib/logger";
import { signToken, verifyToken } from "../lib/signed-token";
import { csvCell, escapeRegex } from "../lib/text";
import { mailConfigured, sendMail } from "../mail/mailer";
import { subscriptionConfirmation } from "../mail/templates";
import { pageMeta, resolvePagination } from "../validation/primitives";
import { audit, type Actor } from "./audit";
import type { Lean } from "./mappers";

const CONFIRM_TTL_SECONDS = 7 * 86_400;
const RESEND_AFTER_MS = 5 * 60_000;
const MAX_CONFIRMATIONS = 5;

const link = (path: string, token: string) => `${env().publicSiteUrl}${path}?token=${encodeURIComponent(token)}`;

async function sendConfirmation(id: string, email: string, name?: string) {
  if (!mailConfigured()) {
    logger.warn("newsletter confirmation not sent: SMTP is not configured", { id });
    return;
  }
  try {
    const mail = subscriptionConfirmation({
      name,
      confirmUrl: link("/api/newsletter/confirm", signToken({ a: "confirm", id }, CONFIRM_TTL_SECONDS)),
      unsubscribeUrl: link("/api/newsletter/unsubscribe", signToken({ a: "unsub", id })),
    });
    await sendMail({ to: [email], ...mail });
    await SubscriberModel.updateOne({ _id: id }, { $set: { lastConfirmationSentAt: new Date() }, $inc: { confirmationsSent: 1 } });
  } catch (error) {
    logger.warn("newsletter confirmation failed", { id, ...errorFields(error) });
  }
}

/**
 * Starts (or restarts) a double opt-in subscription. The caller always gets the same answer
 * whether or not the address already existed, so the form can't be used to probe the list.
 * Returns the id when a confirmation email should be sent.
 */
export async function subscribe(
  input: { email: string; name?: string; path?: string },
  meta: { ipHash: string },
): Promise<{ id: string; send: boolean } | null> {
  await connectDb();
  const existing = await SubscriberModel.findOne({ email: input.email }).lean();

  if (!existing) {
    const doc = await SubscriberModel.create({ email: input.email, name: input.name || undefined, sourcePath: input.path, ipHash: meta.ipHash });
    return { id: String(doc._id), send: true };
  }
  if (existing.status === "subscribed") return null;

  const recentlySent = existing.lastConfirmationSentAt && Date.now() - existing.lastConfirmationSentAt.getTime() < RESEND_AFTER_MS;
  if (existing.status === "pending" && (recentlySent || (existing.confirmationsSent ?? 0) >= MAX_CONFIRMATIONS)) return null;

  // Re-subscribing after an unsubscribe requires a fresh confirmation.
  await SubscriberModel.updateOne({ _id: existing._id }, { $set: { status: "pending", name: input.name || existing.name }, $unset: { unsubscribedAt: "" } });
  return { id: String(existing._id), send: true };
}

export async function deliverConfirmation(id: string): Promise<void> {
  await connectDb();
  const doc = await SubscriberModel.findById(id).lean();
  if (doc && doc.status === "pending") await sendConfirmation(id, doc.email, doc.name ?? undefined);
}

export type TokenOutcome = "ok" | "invalid" | "gone";

/** Peek at what a token would do without changing anything (for the confirmation page). */
export function inspectToken(token: string, action: "confirm" | "unsub"): boolean {
  const payload = verifyToken<{ a?: string; id?: string }>(token);
  return payload?.a === action && typeof payload.id === "string" && /^[0-9a-f]{24}$/.test(payload.id);
}

export async function confirmSubscription(token: string): Promise<TokenOutcome> {
  const payload = verifyToken<{ a?: string; id?: string }>(token);
  if (payload?.a !== "confirm" || !payload.id || !/^[0-9a-f]{24}$/.test(payload.id)) return "invalid";

  await connectDb();
  const doc = await SubscriberModel.findById(payload.id).lean();
  if (!doc) return "gone";
  if (doc.status === "subscribed") return "ok";
  if (doc.status === "unsubscribed") return "gone";

  await SubscriberModel.updateOne({ _id: doc._id }, { $set: { status: "subscribed", confirmedAt: new Date() } });
  return "ok";
}

export async function unsubscribe(token: string): Promise<TokenOutcome> {
  const payload = verifyToken<{ a?: string; id?: string }>(token);
  if (payload?.a !== "unsub" || !payload.id || !/^[0-9a-f]{24}$/.test(payload.id)) return "invalid";

  await connectDb();
  const result = await SubscriberModel.updateOne(
    { _id: payload.id, status: { $ne: "unsubscribed" } },
    { $set: { status: "unsubscribed", unsubscribedAt: new Date() } },
  );
  if (result.matchedCount === 0 && !(await SubscriberModel.exists({ _id: payload.id }))) return "gone";
  return "ok";
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface SubscriberDTO {
  id: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  sourcePath: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

const iso = (d?: Date | null) => (d ? d.toISOString() : null);

const toSubscriber = (doc: Lean<SubscriberDoc>): SubscriberDTO => ({
  id: String(doc._id),
  email: doc.email,
  name: doc.name ?? null,
  status: doc.status as SubscriberStatus,
  sourcePath: doc.sourcePath ?? null,
  confirmedAt: iso(doc.confirmedAt),
  unsubscribedAt: iso(doc.unsubscribedAt),
  createdAt: iso(doc.createdAt) ?? "",
});

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, email: { email: 1 } } as const;

function filterFor(query: { status?: SubscriberStatus; q?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.q) filter.email = new RegExp(escapeRegex(query.q), "i");
  return filter;
}

export async function listSubscribers(query: { page?: number; limit?: number; status?: SubscriberStatus; q?: string; sort?: keyof typeof SORTS }) {
  await connectDb();
  const { page, limit, skip } = resolvePagination(query, 25);
  const filter = filterFor(query);
  const [docs, total, counts] = await Promise.all([
    SubscriberModel.find(filter).sort(SORTS[query.sort ?? "newest"]).skip(skip).limit(limit).lean(),
    SubscriberModel.countDocuments(filter),
    SubscriberModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return {
    items: docs.map(toSubscriber),
    meta: { ...pageMeta(total, page, limit), byStatus: Object.fromEntries(counts.map((c: { _id: string; count: number }) => [c._id, c.count])) },
  };
}

export async function exportSubscribersCsv(query: { status?: SubscriberStatus; q?: string }): Promise<string> {
  await connectDb();
  // Default to people who actually consented.
  const docs = await SubscriberModel.find(filterFor({ status: query.status ?? "subscribed", q: query.q })).sort({ email: 1 }).limit(50_000).lean();
  const rows = docs.map((d) => [d.email, d.name ?? "", d.status, d.confirmedAt ?? "", d.sourcePath ?? ""]);
  return "﻿" + [["Email", "Name", "Status", "Confirmed at", "Signed up on"], ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Permanent erasure (e.g. a "delete my data" request). */
export async function deleteSubscriber(id: string, actor: Actor, ipHash?: string) {
  await connectDb();
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw notFound("Subscriber");
  const doc = await SubscriberModel.findByIdAndDelete(new Types.ObjectId(id)).lean();
  if (!doc) throw notFound("Subscriber");
  await audit({ actor, action: "delete", resource: "subscribers", resourceId: id, ipHash });
}
