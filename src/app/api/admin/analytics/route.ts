import { z } from "zod";
import { badRequest } from "@/server/lib/errors";
import { adminApi } from "@/server/lib/http";
import { analyticsSummary } from "@/server/services/analytics";

const query = z
  .object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), days: z.coerce.number().int().min(1).max(400).optional() })
  .strict();

/** `?days=30` (default) or an explicit `?from=…&to=…` range. */
export const GET = adminApi({ name: "analytics.summary", permission: "analytics:read" }, async (ctx) => {
  const { from, to, days } = ctx.query(query);
  const end = to ?? new Date();
  const start = from ?? new Date(end.getTime() - (days ?? 30) * 86_400_000);
  if (start >= end) throw badRequest('"from" must be before "to".');
  return analyticsSummary(start, end);
});
