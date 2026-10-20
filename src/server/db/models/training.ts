import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, publishable, registerModel } from "./common";

const schema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    /** Name of an icon in the front-end icon set. Unknown names fall back to a default. */
    icon: { type: String, default: "ShieldCheck", trim: true, maxlength: 40 },
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    ...publishable,
  },
  { ...baseOptions, collection: "training_programs" },
);

export type TrainingDoc = InferSchemaType<typeof schema>;
export const TrainingModel = registerModel<TrainingDoc>("TrainingProgram", schema);
