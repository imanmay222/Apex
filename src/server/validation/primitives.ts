import { z } from "zod";

/*
 * Design notes
 * - No `.default()` anywhere in request schemas. Defaults live in the Mongoose schemas, so a
 *   PATCH built with `.partial()` can never silently reset fields it didn't receive.
 * - No object-level `.refine()`, so `.partial()` stays valid; cross-field rules live in services.
 */

const CONTROL_CHARS = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;
const NO_NEWLINES = /^[^\r\n]*$/;

/** Multi-line plain text. Rejects control characters; length is measured after trimming. */
export const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max).regex(CONTROL_CHARS, "Contains invalid characters");

/** Single-line plain text (names, titles). */
export const line = (min: number, max: number) =>
  text(min, max).regex(NO_NEWLINES, "Must be a single line");

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens");

export const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/** Site-relative path (`/media/x.png`, `/api/media/<id>`) or an https URL. Never `javascript:`/`//host`. */
export const assetUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => /^\/(?!\/)[^\s\\]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value),
    "Must be a site-relative path or an https URL",
  );

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^https:\/\/[^\s]+$/.test(value), "Must be an https URL");

export const image = z.object({ src: assetUrl, alt: line(0, 200) }).strict();

export const iconName = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Must be an icon name");

export const sortOrder = z.number().int().min(0).max(1_000_000);

/* ------------------------------------------------------------------ */
/* Phone numbers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Accepts Indian mobiles (with or without +91 / 91 / 0) and E.164 numbers, returns a
 * normalised string: `+91XXXXXXXXXX` or `+<digits>`.
 */
export function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(stripped)) return null;

  const digits = stripped.replace(/^\+/, "");
  const national = digits.replace(/^(?:91|0)(?=[6-9]\d{9}$)/, "");
  if (/^[6-9]\d{9}$/.test(national)) return `+91${national}`;

  if (stripped.startsWith("+") && /^\d{8,15}$/.test(digits)) return `+${digits}`;
  return null;
}

export const phone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => normalizePhone(value) !== null, "Enter a valid mobile number")
  .transform((value) => normalizePhone(value) as string);

/* ------------------------------------------------------------------ */
/* Query-string helpers                                                */
/* ------------------------------------------------------------------ */

/** "true"/"false" -> boolean (z.coerce.boolean() would treat "false" as true). */
export const queryBool = z.enum(["true", "false"]).transform((value) => value === "true");

export const pagination = {
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export function resolvePagination(input: { page?: number; limit?: number }, defaultLimit = 20) {
  const page = input.page ?? 1;
  const limit = input.limit ?? defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Flattens zod issues into `{ path, message }` pairs for error responses. */
export function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
