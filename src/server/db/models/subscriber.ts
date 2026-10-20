import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, registerModel } from "./common";

export const SUBSCRIBER_STATUSES = ["pending", "subscribed", "unsubscribed"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

const schema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 100 },
    /** Double opt-in: "pending" until the address owner clicks the confirmation link. */
    status: { type: String, enum: SUBSCRIBER_STATUSES, default: "pending", index: true },
    sourcePath: { type: String, maxlength: 300 },
    confirmedAt: { type: Date },
    unsubscribedAt: { type: Date },
    lastConfirmationSentAt: { type: Date },
    confirmationsSent: { type: Number, default: 0 },
    ipHash: { type: String },
  },
  { ...baseOptions, collection: "subscribers" },
);

schema.index({ createdAt: -1 });
// Unconfirmed sign-ups that never click the link are removed after 14 days.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 86400, partialFilterExpression: { status: "pending" } });

export type SubscriberDoc = InferSchemaType<typeof schema>;
export const SubscriberModel = registerModel<SubscriberDoc>("Subscriber", schema);
