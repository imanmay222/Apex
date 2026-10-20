import { Schema, type InferSchemaType } from "mongoose";
import { registerModel } from "./common";

const schema = new Schema(
  {
    /** SHA-256 of the opaque token. The raw token only ever exists in the cookie. */
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
    lastUsedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    ipHash: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { versionKey: false, collection: "sessions" },
);

// MongoDB removes expired sessions on its own.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof schema>;
export const SessionModel = registerModel<SessionDoc>("Session", schema);
