import { z } from "zod";
import { getProducts } from "@/server/data/public";
import { PUBLIC_CACHE, api, paged, preflight } from "@/server/lib/http";
import { tokenize } from "@/server/lib/text";
import { pageMeta, pagination, queryBool, resolvePagination, slug } from "@/server/validation/primitives";

export const OPTIONS = preflight();

const query = z
  .object({
    ...pagination,
    group: slug.optional(),
    featured: queryBool.optional(),
    brand: z.string().trim().max(80).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(["order", "title"]).optional(),
  })
  .strict();

/** Published products, filterable by group / brand / featured / free text. */
export const GET = api({ name: "products.list", cors: true, cache: PUBLIC_CACHE }, async (ctx) => {
  const params = ctx.query(query);
  const { page, limit, skip } = resolvePagination(params, 24);

  let items = await getProducts();
  if (params.group) items = items.filter((p) => p.group === params.group);
  if (params.featured !== undefined) items = items.filter((p) => p.featured === params.featured);
  if (params.brand) items = items.filter((p) => p.brand?.toLowerCase() === params.brand!.toLowerCase());

  if (params.q) {
    const tokens = tokenize(params.q);
    items = items.filter((p) => {
      const haystack = [p.title, p.summary, p.description, p.brand, p.group, ...p.tags].join(" ").toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }
  if (params.sort === "title") items = [...items].sort((a, b) => a.title.localeCompare(b.title));

  return paged(items.slice(skip, skip + limit), pageMeta(items.length, page, limit), PUBLIC_CACHE);
});
