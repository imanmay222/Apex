import { Schema, type InferSchemaType } from "mongoose";
import { baseOptions, registerModel } from "./common";

const pillarSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    icon: { type: String, default: "Sparkle", trim: true, maxlength: 40 },
    text: { type: String, default: "", trim: true, maxlength: 600 },
  },
  { _id: false },
);

const certificateSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { _id: false },
);

const schema = new Schema(
  {
    /** Singleton document: always "site". */
    key: { type: String, required: true, unique: true, default: "site" },

    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    legalName: { type: String, trim: true, maxlength: 160 },
    tagline: { type: String, default: "", trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    foundedYear: { type: Number, min: 1900, max: 2100 },
    teamSize: { type: Number, min: 0, default: 0 },

    phones: { type: [{ type: String, trim: true, maxlength: 30 }], default: [] },
    landline: { type: String, trim: true, maxlength: 30 },
    whatsapp: { type: String, trim: true, maxlength: 20 },
    /** Public contact addresses shown on the site. */
    emails: { type: [{ type: String, trim: true, lowercase: true, maxlength: 254 }], default: [] },

    address: {
      street: { type: String, default: "", trim: true, maxlength: 200 },
      locality: { type: String, default: "", trim: true, maxlength: 120 },
      city: { type: String, default: "", trim: true, maxlength: 100 },
      state: { type: String, default: "", trim: true, maxlength: 100 },
      country: { type: String, default: "", trim: true, maxlength: 100 },
      postalCode: { type: String, default: "", trim: true, maxlength: 20 },
    },
    mapsLink: { type: String, trim: true, maxlength: 500 },
    mapEmbedSrc: { type: String, trim: true, maxlength: 1500 },

    social: {
      facebook: { type: String, trim: true, maxlength: 500 },
      instagram: { type: String, trim: true, maxlength: 500 },
      whatsapp: { type: String, trim: true, maxlength: 500 },
    },
    certificates: { type: [certificateSchema], default: [] },

    about: {
      intro: { type: String, default: "", trim: true, maxlength: 2000 },
      network: { type: String, default: "", trim: true, maxlength: 2000 },
    },
    home: {
      heroBadge: { type: String, default: "", trim: true, maxlength: 80 },
      heroTitle: { type: String, default: "", trim: true, maxlength: 160 },
      heroLead: { type: String, default: "", trim: true, maxlength: 400 },
    },
    valuePillars: { type: [pillarSchema], default: [] },
    differentiators: {
      type: [new Schema({ title: { type: String, required: true, maxlength: 80 }, icon: { type: String, default: "BadgeCheck", maxlength: 40 } }, { _id: false })],
      default: [],
    },

    catalogue: {
      title: { type: String, default: "Product catalogue", trim: true, maxlength: 120 },
      /** Site path or https URL of the downloadable catalogue (PDF). */
      url: { type: String, trim: true, maxlength: 500 },
    },

    /** INTERNAL: never returned by public endpoints. */
    notifications: {
      salesEmails: { type: [{ type: String, trim: true, lowercase: true, maxlength: 254 }], default: [] },
    },
  },
  { ...baseOptions, collection: "site_settings" },
);

export type SiteSettingsDoc = InferSchemaType<typeof schema>;
export const SiteSettingsModel = registerModel<SiteSettingsDoc>("SiteSettings", schema);
