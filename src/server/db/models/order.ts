import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, registerModel } from "./common";
import { NOTIFICATION_STATUSES } from "./enquiry";

/**
 * A quote order: a basket of product categories with quantities, sent without prices or payment.
 * The team replies with a quote, then confirms, dispatches and delivers it.
 */
export const ORDER_STATUSES = ["new", "quoted", "confirmed", "dispatched", "delivered", "cancelled", "spam"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MAX_ORDER_ITEMS = 50;
export const MAX_ORDER_QUANTITY = 100_000;

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

const itemSchema = new Schema(
  {
    productSlug: { type: String, required: true, trim: true, maxlength: 80 },
    /** Title at the time of ordering, so renaming a product never rewrites past orders. */
    productTitle: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, required: true, min: 1, max: MAX_ORDER_QUANTITY },
    /** Size, model, colour… whatever the customer needs us to know about this line. */
    note: { type: String, trim: true, maxlength: 200 },
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
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: () => new Date() },
    byId: { type: Schema.Types.ObjectId },
    byName: { type: String, maxlength: 100 },
  },
  { _id: false },
);

const schema = new Schema(
  {
    /** Human-friendly id shown to the customer, e.g. ORD-2026-000042. */
    reference: { type: String, required: true, unique: true },
    items: { type: [itemSchema], required: true },
    /** Hash of the normalised basket, used to collapse accidental double submits. */
    itemsHash: { type: String, required: true },

    name: { type: String, required: true, trim: true, maxlength: 100 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    company: { type: String, trim: true, maxlength: 120 },
    gstin: { type: String, uppercase: true, trim: true, maxlength: 15 },
    address: {
      line1: { type: String, required: true, trim: true, maxlength: 200 },
      line2: { type: String, trim: true, maxlength: 200 },
      city: { type: String, required: true, trim: true, maxlength: 100 },
      state: { type: String, required: true, trim: true, maxlength: 100 },
      postalCode: { type: String, required: true, trim: true, maxlength: 10 },
    },
    /** The customer's own notes (delivery timing, site contact…). */
    customerNotes: { type: String, trim: true, maxlength: 2000 },

    status: { type: String, enum: ORDER_STATUSES, default: "new" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    notes: { type: [noteSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
    firstResponseAt: { type: Date },

    source: {
      path: { type: String, maxlength: 300 },
      referrer: { type: String, maxlength: 300 },
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
  { ...baseOptions, collection: "orders" },
);

schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ assignedTo: 1, status: 1 });
schema.index({ mobile: 1, itemsHash: 1, createdAt: -1 });
schema.index({ "items.productSlug": 1 });
// Spam is purged automatically, like spam enquiries.
schema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: (Number.parseInt(process.env.SPAM_RETENTION_DAYS ?? "", 10) || 30) * 86400,
    partialFilterExpression: { status: "spam" },
  },
);

export type OrderDoc = InferSchemaType<typeof schema>;
export const OrderModel = registerModel<OrderDoc>("Order", schema);
