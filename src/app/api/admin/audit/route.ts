import { z } from "zod";
import { connectDb } from "@/server/db/connect";
import { AuditModel } from "@/server/db/models";
import { adminApi, paged } from "@/server/lib/http";
import { pageMeta, pagination, resolvePagination } from "@/server/validation/primitives";

const query = z
  .object({
    ...pagination,
    action: z.string().trim().max(60).optional(),
    resource: z.string().trim().max(60).optional(),
    actor: z.string().trim().max(254).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export const GET = adminApi({ name: "audit.list", permission: "audit:read" }, async (ctx) => {
  const q = ctx.query(query);
  const { page, limit, skip } = resolvePagination(q, 50);
  await connectDb();

  const filter: Record<string, unknown> = {};
  if (q.action) filter.action = q.action;
  if (q.resource) filter.resource = q.resource;
  if (q.actor) filter.actorEmail = q.actor.toLowerCase();
  if (q.from || q.to) filter.at = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };

  const [docs, total] = await Promise.all([
    AuditModel.find(filter).sort({ at: -1 }).skip(skip).limit(limit).lean(),
    AuditModel.countDocuments(filter),
  ]);

  return paged(
    docs.map((d) => ({
      id: String(d._id),
      at: d.at.toISOString(),
      actor: d.actorEmail ?? null,
      action: d.action,
      resource: d.resource,
      resourceId: d.resourceId ?? null,
      summary: d.summary ?? null,
      fields: d.fields ?? [],
    })),
    pageMeta(total, page, limit),
  );
});
