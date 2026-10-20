import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, publishable, registerModel } from "./common";

const schema = new Schema(
  {
    /** Stable identifier used in URLs/anchors and by Product.group, e.g. "ppe". */
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    blurb: { type: String, default: "", trim: true, maxlength: 300 },
    ...publishable,
  },
  { ...baseOptions, collection: "product_groups" },
);

export type ProductGroupDoc = InferSchemaType<typeof schema>;
export const ProductGroupModel = registerModel<ProductGroupDoc>("ProductGroup", schema);
