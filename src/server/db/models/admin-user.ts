import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, registerModel } from "./common";

export const ROLES = ["admin", "editor", "sales"] as const;
export type Role = (typeof ROLES)[number];

const schema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: ROLES, required: true, default: "editor" },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date, default: () => new Date() },
  },
  { ...baseOptions, collection: "admin_users" },
);

export type AdminUserDoc = InferSchemaType<typeof schema>;
export const AdminUserModel = registerModel<AdminUserDoc>("AdminUser", schema);
