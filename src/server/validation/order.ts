import { z } from "zod";
import { MAX_ORDER_ITEMS, MAX_ORDER_QUANTITY, ORDER_STATUSES } from "../db/models/order";
import { email, line, objectId, pagination, phone, slug, text } from "./primitives";

const optionalEmail = z.union([email, z.literal("")]).optional();

/** Indian GSTIN: 2-digit state code, PAN, entity number, "Z", checksum. */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const optionalGstin = z
  .union([z.string().trim().toUpperCase().regex(GSTIN, "Enter a valid 15-character GSTIN"), z.literal("")])
  .optional();

export const orderItemInput = z
  .object({
    /** Slug of a published product. */
    product: slug,
    quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY),
    note: line(0, 200).optional(),
  })
  .strict();

/** Public quote-basket checkout. */
export const orderCreate = z
  .object({
    items: z.array(orderItemInput).min(1, "Add at least one product").max(MAX_ORDER_ITEMS),
    name: line(2, 100),
    mobile: phone,
    email: optionalEmail,
    company: line(0, 120).optional(),
    gstin: optionalGstin,
    address: z
      .object({
        line1: line(3, 200),
        line2: line(0, 200).optional(),
        city: line(2, 100),
        state: line(2, 100),
        postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
      })
      .strict(),
    notes: text(0, 2000).optional(),
    /** Signed token from GET /api/enquiries/token. */
    token: z.string().min(10).max(300),
    /** Honeypot: humans never see or fill this field. */
    website: z.string().max(300).optional(),
    source: z
      .object({ path: z.string().max(300).optional(), referrer: z.string().max(300).optional() })
      .strict()
      .optional(),
  })
  .strict();

export type OrderCreateInput = z.infer<typeof orderCreate>;

/** Admin triage update. */
export const orderUpdate = z
  .object({
    status: z.enum(ORDER_STATUSES),
    assignedTo: objectId.nullable(),
  })
  .partial()
  .strict();

export const orderNote = z.object({ body: text(1, 2000) }).strict();

export const orderBulk = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(objectId).min(1).max(200), status: z.enum(ORDER_STATUSES) }).strict(),
  z.object({ action: z.literal("assign"), ids: z.array(objectId).min(1).max(200), assignedTo: objectId.nullable() }).strict(),
  z.object({ action: z.literal("delete"), ids: z.array(objectId).min(1).max(200) }).strict(),
]);

const csvList = <S extends z.ZodType>(schema: S) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.length <= 200 ? value.split(",").map((part) => part.trim()).filter(Boolean) : value),
    schema,
  );

/** GET /api/admin/orders query string. */
export const orderListQuery = z
  .object({
    ...pagination,
    status: csvList(z.array(z.enum(ORDER_STATUSES)).max(10)).optional(),
    assignedTo: z.union([objectId, z.literal("unassigned")]).optional(),
    /** Orders containing this product. */
    product: slug.optional(),
    q: z.string().trim().max(100).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sort: z.enum(["newest", "oldest", "status"]).optional(),
  })
  .strict();

export type OrderListQuery = z.infer<typeof orderListQuery>;

/** Customer order tracking: reference AND the mobile number used. */
export const trackOrderInput = z
  .object({
    reference: z.string().trim().toUpperCase().regex(/^ORD-\d{4}-\d{6}$/, "Reference looks like ORD-2026-000123"),
    mobile: phone,
  })
  .strict();
