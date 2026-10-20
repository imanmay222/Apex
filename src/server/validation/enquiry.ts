import { z } from "zod";
import { ENQUIRY_PRIORITIES, ENQUIRY_STATUSES, ENQUIRY_TYPES } from "../db/models/enquiry";
import { email, line, objectId, pagination, phone, slug, text } from "./primitives";

const optionalEmail = z.union([email, z.literal("")]).optional();

/** Public enquiry submission. */
export const enquiryCreate = z
  .object({
    name: line(2, 100),
    mobile: phone,
    email: optionalEmail,
    type: z.enum(ENQUIRY_TYPES),
    /** Slug of the product / survey / training the enquiry is about. */
    subject: slug.optional(),
    message: text(10, 4000),
    /** Signed token from GET /api/enquiries/token. */
    token: z.string().min(10).max(300),
    /** Honeypot: humans never see or fill this field. */
    website: z.string().max(300).optional(),
    source: z
      .object({
        path: z.string().max(300).optional(),
        referrer: z.string().max(300).optional(),
        utmSource: z.string().max(100).optional(),
        utmMedium: z.string().max(100).optional(),
        utmCampaign: z.string().max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type EnquiryCreateInput = z.infer<typeof enquiryCreate>;

/** Admin triage update. */
export const enquiryUpdate = z
  .object({
    status: z.enum(ENQUIRY_STATUSES),
    priority: z.enum(ENQUIRY_PRIORITIES),
    assignedTo: objectId.nullable(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10),
  })
  .partial()
  .strict();

export const enquiryNote = z.object({ body: text(1, 2000) }).strict();

export const enquiryBulk = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("status"), ids: z.array(objectId).min(1).max(200), status: z.enum(ENQUIRY_STATUSES) }).strict(),
    z.object({ action: z.literal("assign"), ids: z.array(objectId).min(1).max(200), assignedTo: objectId.nullable() }).strict(),
    z.object({ action: z.literal("delete"), ids: z.array(objectId).min(1).max(200) }).strict(),
  ]);

/** "a,b,c" -> ["a","b","c"], then validated against `schema` (an array schema). */
const csvList = <S extends z.ZodType>(schema: S) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.length <= 200 ? value.split(",").map((part) => part.trim()).filter(Boolean) : value),
    schema,
  );

/** GET /api/admin/enquiries query string. */
export const enquiryListQuery = z
  .object({
    ...pagination,
    status: csvList(z.array(z.enum(ENQUIRY_STATUSES)).max(10)).optional(),
    type: csvList(z.array(z.enum(ENQUIRY_TYPES)).max(10)).optional(),
    priority: z.enum(ENQUIRY_PRIORITIES).optional(),
    assignedTo: z.union([objectId, z.literal("unassigned")]).optional(),
    q: z.string().trim().max(100).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sort: z.enum(["newest", "oldest", "status"]).optional(),
  })
  .strict();

export type EnquiryListQuery = z.infer<typeof enquiryListQuery>;
