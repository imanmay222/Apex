import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, registerModel } from "./common";

export const ENQUIRY_TYPES = ["products", "survey", "training", "general"] as const;
export const ENQUIRY_STATUSES = ["new", "contacted", "quoted", "won", "lost", "spam", "archived"] as const;
export const ENQUIRY_PRIORITIES = ["low", "normal", "high"] as const;
export const NOTIFICATION_CHANNELS = ["sales", "customer", "webhook"] as const;
export const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "skipped"] as const;

export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export type EnquiryPriority = (typeof ENQUIRY_PRIORITIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

const notificationSchema = new Schema(
  {
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "pending" },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    sentAt: { type: Date },
    lastError: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const noteSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId },
    authorName: { type: String, trim: true, maxlength: 100 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: () => new Date() },
  },
  {},
);

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: ENQUIRY_STATUSES, required: true },
    at: { type: Date, default: () => new Date() },
    byId: { type: Schema.Types.ObjectId },
    byName: { type: String, maxlength: 100 },
  },
  { _id: false },
);

const schema = new Schema(
  {
    /** Human-friendly id shown to the customer, e.g. ENQ-2026-000123. */
    reference: { type: String, required: true, unique: true },
    type: { type: String, enum: ENQUIRY_TYPES, required: true },
    subjectSlug: { type: String, trim: true, maxlength: 100 },
    subjectTitle: { type: String, trim: true, maxlength: 200 },

    name: { type: String, required: true, trim: true, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    /** Normalised-message hash, used to collapse accidental double submits. */
    messageHash: { type: String, required: true },

    status: { type: String, enum: ENQUIRY_STATUSES, default: "new" },
    priority: { type: String, enum: ENQUIRY_PRIORITIES, default: "normal" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] },
    notes: { type: [noteSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
    firstResponseAt: { type: Date },

    source: {
      path: { type: String, maxlength: 300 },
      referrer: { type: String, maxlength: 300 },
      utmSource: { type: String, maxlength: 100 },
      utmMedium: { type: String, maxlength: 100 },
      utmCampaign: { type: String, maxlength: 100 },
    },
    client: {
      ipHash: { type: String },
      userAgent: { type: String, maxlength: 300 },
    },
    spam: {
      score: { type: Number, default: 0 },
      reasons: { type: [String], default: [] },
    },

    notifications: {
      sales: { type: notificationSchema, default: () => ({}) },
      customer: { type: notificationSchema, default: () => ({}) },
      webhook: { type: notificationSchema, default: () => ({}) },
    },
  },
  { ...baseOptions, collection: "enquiries" },
);

schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ type: 1, createdAt: -1 });
schema.index({ mobile: 1, createdAt: -1 });
schema.index({ assignedTo: 1, status: 1 });
// Collapse duplicate submissions quickly: same mobile + same message hash.
schema.index({ mobile: 1, messageHash: 1, createdAt: -1 });
// Spam is purged automatically; re-classifying a false positive removes it from the filter.
schema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: (Number.parseInt(process.env.SPAM_RETENTION_DAYS ?? "", 10) || 30) * 86400,
    partialFilterExpression: { status: "spam" },
  },
);

export type EnquiryDoc = InferSchemaType<typeof schema>;
export const EnquiryModel = registerModel<EnquiryDoc>("Enquiry", schema);
