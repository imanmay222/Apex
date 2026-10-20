import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, imageSchema, publishable, registerModel, seoSchema } from "./common";

const schema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    shortTitle: { type: String, trim: true, maxlength: 80 },
    image: { type: imageSchema, required: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    featured: { type: Boolean, default: false, index: true },
    seo: { type: seoSchema },
    ...publishable,
  },
  { ...baseOptions, collection: "surveys" },
);

export type SurveyDoc = InferSchemaType<typeof schema>;
export const SurveyModel = registerModel<SurveyDoc>("Survey", schema);
