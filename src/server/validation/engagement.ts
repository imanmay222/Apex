import { z } from "zod";
import { SUBSCRIBER_STATUSES } from "../db/models/subscriber";
import { email, line, pagination, phone, text } from "./primitives";

const optionalEmail = z.union([email, z.literal("")]).optional();

/** Public "share your experience" form. Always lands unpublished, awaiting review. */
export const testimonialSubmit = z
  .object({
    name: line(2, 100),
    role: line(0, 100).optional(),
    company: line(0, 100).optional(),
    quote: text(20, 600),
    rating: z.number().int().min(1).max(5).optional(),
    /** Private; lets the team follow up. Never shown publicly. */
    email: optionalEmail,
    token: z.string().min(10).max(300),
    website: z.string().max(300).optional(),
  })
  .strict();

export type TestimonialSubmit = z.infer<typeof testimonialSubmit>;

/** Customer enquiry tracking: the reference alone is not enough, the mobile must match too. */
export const trackInput = z
  .object({
    reference: z.string().trim().toUpperCase().regex(/^ENQ-\d{4}-\d{6}$/, "Reference looks like ENQ-2026-000123"),
    mobile: phone,
  })
  .strict();

export const subscribeInput = z
  .object({
    email,
    name: line(0, 100).optional(),
    path: z.string().max(300).optional(),
    token: z.string().min(10).max(300),
    website: z.string().max(300).optional(),
  })
  .strict();

export const subscriberListQuery = z
  .object({
    ...pagination,
    status: z.enum(SUBSCRIBER_STATUSES).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(["newest", "oldest", "email"]).optional(),
  })
  .strict();

/** `/api/admin/import?mode=merge|replace&confirm=true` */
export const importQuery = z
  .object({ mode: z.enum(["merge", "replace"]).optional(), confirm: z.enum(["true"]).optional() })
  .strict();
