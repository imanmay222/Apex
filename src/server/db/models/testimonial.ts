import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, publishable, registerModel } from "./common";

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, trim: true, maxlength: 100 },
    company: { type: String, trim: true, maxlength: 100 },
    quote: { type: String, required: true, trim: true, maxlength: 600 },
    rating: { type: Number, min: 1, max: 5 },
    /** "public" = submitted through the website (always starts unpublished, awaiting review). */
    source: { type: String, enum: ["admin", "public"], default: "admin", index: true },
    /** Private: only ever returned to admins. */
    submitter: {
      email: { type: String, lowercase: true, trim: true, maxlength: 254 },
      ipHash: { type: String },
    },
    ...publishable,
  },
  { ...baseOptions, collection: "testimonials" },
);

export type TestimonialDoc = InferSchemaType<typeof schema>;
export const TestimonialModel = registerModel<TestimonialDoc>("Testimonial", schema);
