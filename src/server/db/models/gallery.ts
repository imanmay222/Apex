import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, publishable, registerModel } from "./common";

const schema = new Schema(
  {
    src: { type: String, required: true, trim: true, maxlength: 500 },
    alt: { type: String, default: "", trim: true, maxlength: 200 },
    caption: { type: String, trim: true, maxlength: 200 },
    ...publishable,
  },
  { ...baseOptions, collection: "gallery_images" },
);

export type GalleryDoc = InferSchemaType<typeof schema>;
export const GalleryModel = registerModel<GalleryDoc>("GalleryImage", schema);
