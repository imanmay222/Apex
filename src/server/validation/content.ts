import { z } from "zod";
import { LOGO_KINDS } from "../db/models/logo";
import {
  assetUrl,
  email,
  httpsUrl,
  iconName,
  image,
  line,
  slug,
  sortOrder,
  text,
} from "./primitives";

const seo = z.object({ title: line(0, 70).optional(), description: line(0, 170).optional() }).strict();
const tag = z.string().trim().toLowerCase().min(1).max(40);

/* ------------------------------------------------------------------ */
/* Each resource exposes `create` (the base) and `update` (partial).   */
/* ------------------------------------------------------------------ */

const productBase = z
  .object({
    slug: slug.optional(),
    title: line(2, 120),
    summary: line(2, 300),
    description: text(0, 5000).optional(),
    image,
    gallery: z.array(image).max(12).optional(),
    group: slug,
    brand: line(0, 80).optional(),
    features: z.array(line(1, 200)).max(20).optional(),
    specs: z.array(z.object({ label: line(1, 80), value: line(1, 200) }).strict()).max(30).optional(),
    tags: z.array(tag).max(20).optional(),
    featured: z.boolean().optional(),
    seo: seo.optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const groupBase = z
  .object({
    key: slug,
    title: line(2, 120),
    blurb: line(0, 300).optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const surveyBase = z
  .object({
    slug: slug.optional(),
    title: line(2, 140),
    shortTitle: line(0, 80).optional(),
    image,
    description: text(10, 5000),
    featured: z.boolean().optional(),
    seo: seo.optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const trainingBase = z
  .object({
    slug: slug.optional(),
    title: line(2, 120),
    icon: iconName.optional(),
    summary: line(2, 300),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const galleryBase = z
  .object({
    src: assetUrl,
    alt: line(0, 200).optional(),
    caption: line(0, 200).optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const testimonialBase = z
  .object({
    name: line(2, 100),
    role: line(0, 100).optional(),
    company: line(0, 100).optional(),
    quote: text(10, 600),
    rating: z.number().int().min(1).max(5).optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const logoBase = z
  .object({
    kind: z.enum(LOGO_KINDS),
    name: line(1, 100),
    src: assetUrl,
    url: httpsUrl.optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

const leaderBase = z
  .object({
    name: line(2, 100),
    qualification: line(0, 120).optional(),
    role: line(2, 100),
    image: assetUrl,
    bio: text(0, 1000).optional(),
    order: sortOrder.optional(),
    published: z.boolean().optional(),
  })
  .strict();

export const contentSchemas = {
  products: { create: productBase, update: productBase.partial() },
  "product-groups": { create: groupBase, update: groupBase.partial() },
  surveys: { create: surveyBase, update: surveyBase.partial() },
  training: { create: trainingBase, update: trainingBase.partial() },
  gallery: { create: galleryBase, update: galleryBase.partial() },
  testimonials: { create: testimonialBase, update: testimonialBase.partial() },
  logos: { create: logoBase, update: logoBase.partial() },
  leaders: { create: leaderBase, update: leaderBase.partial() },
} as const;

export type ContentResourceKey = keyof typeof contentSchemas;

/* ------------------------------------------------------------------ */
/* Shared admin list / reorder / bulk inputs                           */
/* ------------------------------------------------------------------ */

export const reorderInput = z
  .object({ ids: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).max(500) })
  .strict();

export const bulkContentInput = z
  .object({
    action: z.enum(["publish", "unpublish", "delete"]),
    ids: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).max(200),
  })
  .strict();

/* ------------------------------------------------------------------ */
/* Site settings                                                       */
/* ------------------------------------------------------------------ */

const addressInput = z
  .object({
    street: line(0, 200),
    locality: line(0, 120),
    city: line(0, 100),
    state: line(0, 100),
    country: line(0, 100),
    postalCode: line(0, 20),
  })
  .partial()
  .strict();

export const settingsUpdate = z
  .object({
    companyName: line(2, 120),
    legalName: line(0, 160),
    tagline: line(0, 200),
    description: text(0, 500),
    foundedYear: z.number().int().min(1900).max(2100),
    teamSize: z.number().int().min(0).max(100_000),
    phones: z.array(line(5, 30)).max(10),
    landline: line(0, 30),
    whatsapp: z.string().trim().regex(/^\d{8,15}$/, "Digits only, with country code"),
    emails: z.array(email).max(10),
    address: addressInput,
    mapsLink: httpsUrl,
    mapEmbedSrc: z
      .string()
      .trim()
      .max(1500)
      .refine((value) => value.startsWith("https://www.google.com/maps/embed"), "Must be a Google Maps embed URL"),
    social: z
      .object({ facebook: httpsUrl, instagram: httpsUrl, whatsapp: httpsUrl })
      .partial()
      .strict(),
    certificates: z.array(z.object({ label: line(1, 60), value: line(1, 100) }).strict()).max(12),
    about: z.object({ intro: text(0, 2000), network: text(0, 2000) }).partial().strict(),
    home: z
      .object({ heroBadge: line(0, 80), heroTitle: line(0, 160), heroLead: line(0, 400) })
      .partial()
      .strict(),
    valuePillars: z
      .array(z.object({ title: line(1, 100), icon: iconName, text: text(0, 600) }).strict())
      .max(12),
    differentiators: z.array(z.object({ title: line(1, 80), icon: iconName }).strict()).max(12),
    catalogue: z.object({ title: line(0, 120), url: assetUrl }).partial().strict(),
    notifications: z.object({ salesEmails: z.array(email).max(10) }).partial().strict(),
  })
  .partial()
  .strict();
