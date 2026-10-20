import { Schema, model, models, type Model } from "mongoose";

/** Re-use an already-registered model (dev HMR / multiple route bundles). */
export function registerModel<T>(name: string, schema: Schema): Model<T> {
  // `model()`'s generic is the *schema* type in Mongoose 9, so it is deliberately not given T;
  // the cast pins the document type we inferred from the schema.
  return (models[name] ?? model(name, schema)) as unknown as Model<T>;
}

export const imageSchema = new Schema(
  {
    src: { type: String, required: true, trim: true, maxlength: 500 },
    alt: { type: String, default: "", trim: true, maxlength: 200 },
  },
  { _id: false },
);

export const seoSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 170 },
  },
  { _id: false },
);

/** Fields shared by every editable, orderable, publishable content collection. */
export const publishable = {
  order: { type: Number, default: 0, index: true },
  published: { type: Boolean, default: true, index: true },
};

export const baseOptions = { timestamps: true, versionKey: false } as const;
