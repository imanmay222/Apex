import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, imageSchema, publishable, registerModel, seoSchema } from "./common";

const specSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const schema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 5000 },
    image: { type: imageSchema, required: true },
    gallery: { type: [imageSchema], default: [] },
    /** Key of a product group (see ProductGroup.key). */
    group: { type: String, required: true, trim: true, lowercase: true, index: true },
    brand: { type: String, trim: true, maxlength: 80 },
    features: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    specs: { type: [specSchema], default: [] },
    tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] },
    featured: { type: Boolean, default: false, index: true },
    seo: { type: seoSchema },
    ...publishable,
  },
  { ...baseOptions, collection: "products" },
);

schema.index({ published: 1, group: 1, order: 1 });
schema.index({ published: 1, featured: 1, order: 1 });

export type ProductDoc = InferSchemaType<typeof schema>;
export const ProductModel = registerModel<ProductDoc>("Product", schema);
