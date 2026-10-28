import { Schema, type InferSchemaType } from "mongoose";
import { registerModel } from "./common";

/* ------------------------------------------------------------------ */
/* Counters: atomic sequences (enquiry and order reference numbers)    */
/* ------------------------------------------------------------------ */

const counterSchema = new Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false, collection: "counters" },
);

export type CounterDoc = InferSchemaType<typeof counterSchema>;
export const CounterModel = registerModel<CounterDoc>("Counter", counterSchema);

/* ------------------------------------------------------------------ */
/* Rate limits: fixed-window counters, expired by a TTL index          */
/* ------------------------------------------------------------------ */

const rateLimitSchema = new Schema(
  {
    /** "<bucket>:<window-start>" */
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "rate_limits" },
);
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema>;
export const RateLimitModel = registerModel<RateLimitDoc>("RateLimit", rateLimitSchema);

/* ------------------------------------------------------------------ */
/* Audit log: who changed what                                         */
/* ------------------------------------------------------------------ */

/** Retention is fixed at index-creation time, so it is read straight from the environment. */
const retentionDays = (name: string, fallback: number) => {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const auditSchema = new Schema(
  {
    at: { type: Date, default: () => new Date() },
    actorId: { type: Schema.Types.ObjectId },
    actorEmail: { type: String, maxlength: 254 },
    action: { type: String, required: true, maxlength: 60, index: true },
    resource: { type: String, required: true, maxlength: 60, index: true },
    resourceId: { type: String, maxlength: 80 },
    summary: { type: String, maxlength: 300 },
    /** Names of the fields that changed (values are deliberately not stored). */
    fields: { type: [String], default: [] },
    ipHash: { type: String },
  },
  { versionKey: false, collection: "audit_logs" },
);
auditSchema.index({ at: 1 }, { expireAfterSeconds: retentionDays("AUDIT_RETENTION_DAYS", 730) * 86400 });

export type AuditDoc = InferSchemaType<typeof auditSchema>;
export const AuditModel = registerModel<AuditDoc>("AuditLog", auditSchema);

/* ------------------------------------------------------------------ */
/* Analytics events: privacy-friendly, no raw IPs, TTL-expired         */
/* ------------------------------------------------------------------ */

export const EVENT_TYPES = [
  "page_view",
  "product_view",
  "survey_view",
  "catalogue_download",
  "cta_click",
  "search",
  "enquiry_submit",
  "order_submit",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const analyticsSchema = new Schema(
  {
    type: { type: String, enum: EVENT_TYPES, required: true },
    path: { type: String, required: true, maxlength: 300 },
    /** Slug / label the event refers to (product slug, CTA name, search term). */
    ref: { type: String, maxlength: 120 },
    referrerHost: { type: String, maxlength: 120 },
    device: { type: String, enum: ["mobile", "tablet", "desktop"], default: "desktop" },
    /** Daily-rotating hash of ip+ua: counts unique visitors without identifying them. */
    visitor: { type: String, required: true },
    at: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: "analytics_events" },
);
analyticsSchema.index({ at: 1 }, { expireAfterSeconds: retentionDays("ANALYTICS_RETENTION_DAYS", 400) * 86400 });
analyticsSchema.index({ type: 1, at: -1 });
analyticsSchema.index({ type: 1, ref: 1, at: -1 });

export type AnalyticsDoc = InferSchemaType<typeof analyticsSchema>;
export const AnalyticsModel = registerModel<AnalyticsDoc>("AnalyticsEvent", analyticsSchema);
