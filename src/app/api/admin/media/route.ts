import { z } from "zod";
import { actorOf } from "@/server/lib/admin";
import { badRequest, payloadTooLarge } from "@/server/lib/errors";
import { adminApi, created, paged } from "@/server/lib/http";
import { pageMeta, pagination, resolvePagination } from "@/server/validation/primitives";
import { listMedia, uploadMedia } from "@/server/services/media";

const query = z
  .object({ ...pagination, q: z.string().trim().max(100).optional(), kind: z.enum(["image", "pdf"]).optional() })
  .strict();

export const GET = adminApi({ name: "media.list", permission: "media:write" }, async (ctx) => {
  const params = ctx.query(query);
  const { page, limit, skip } = resolvePagination(params, 30);
  const { items, total } = await listMedia({ page, limit, skip, q: params.q, kind: params.kind });
  return paged(items, pageMeta(total, page, limit));
});

/** multipart/form-data with `file` (required) and `alt` (optional). Stored in MongoDB GridFS. */
export const POST = adminApi({ name: "media.upload", permission: "media:write", rateLimit: { limit: 60, windowSec: 60 } }, async (ctx) => {
  const declared = Number(ctx.req.headers.get("content-length") ?? 0);
  // Generous ceiling (PDFs may be larger than images); exact per-type limits are enforced after sniffing.
  if (declared > 26 * 1024 * 1024 + 4096) throw payloadTooLarge();

  const type = ctx.req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw badRequest("Send the file as multipart/form-data.");

  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest('Missing "file" field.');
  const alt = String(form.get("alt") ?? "");

  const { media, duplicate } = await uploadMedia(file, alt, actorOf(ctx.auth), ctx.ipHash);
  return duplicate ? Response.json({ data: media, meta: { duplicate: true } }) : created(media);
});

