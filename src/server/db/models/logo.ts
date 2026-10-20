import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, publishable, registerModel } from "./common";

export const LOGO_KINDS = ["client", "brand"] as const;
export type LogoKind = (typeof LOGO_KINDS)[number];

const schema = new Schema(
  {
    kind: { type: String, enum: LOGO_KINDS, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    src: { type: String, required: true, trim: true, maxlength: 500 },
    url: { type: String, trim: true, maxlength: 500 },
    ...publishable,
  },
  { ...baseOptions, collection: "logos" },
);

schema.index({ kind: 1, published: 1, order: 1 });

export type LogoDoc = InferSchemaType<typeof schema>;
export const LogoModel = registerModel<LogoDoc>("Logo", schema);
