import { after } from "next/server";
import { z } from "zod";
import { recordEvent } from "@/server/services/analytics";
import { searchSite, type SearchType } from "@/server/services/search";
import { api, ok, preflight } from "@/server/lib/http";
import { userAgent } from "@/server/lib/request";

export const OPTIONS = preflight();

const query = z
  .object({
    q: z.string().trim().min(2, "Enter at least 2 characters").max(100),
    types: z
      .preprocess(
        (value) => (typeof value === "string" ? value.split(",").map((part) => part.trim()).filter(Boolean) : value),
        z.array(z.enum(["products", "surveys", "training"])).min(1).max(3),
      )
      .optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

/** Cross-collection site search over products, surveys and training programmes. */
export const GET = api({ name: "search.get", cors: true, rateLimit: { limit: 60, windowSec: 60 } }, async (ctx) => {
  const params = ctx.query(query);
  const types: SearchType[] = params.types ?? ["products", "surveys", "training"];
  const hits = await searchSite(params.q, types, params.limit ?? 20);

  after(() =>
    recordEvent(
      { type: "search", path: "/search", ref: params.q.toLowerCase().slice(0, 100) },
      { ip: ctx.ip, userAgent: userAgent(ctx.req), host: ctx.req.headers.get("host") },
    ).catch(() => undefined),
  );

  return ok(hits, {
    meta: { query: params.q, total: hits.length },
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
  });
});
