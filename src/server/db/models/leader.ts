import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, publishable, registerModel } from "./common";

const schema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    qualification: { type: String, default: "", trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 100 },
    image: { type: String, required: true, trim: true, maxlength: 500 },
    bio: { type: String, trim: true, maxlength: 1000 },
    ...publishable,
  },
  { ...baseOptions, collection: "leaders" },
);

export type LeaderDoc = InferSchemaType<typeof schema>;
export const LeaderModel = registerModel<LeaderDoc>("Leader", schema);
