import { notFound } from "@/server/lib/errors";
import { actorOf } from "@/server/lib/admin";
import { adminApi, created, paged } from "@/server/lib/http";
import { contentSchemas, type ContentResourceKey } from "@/server/validation/content";
import { createResource, listQuerySchema, listResource, resourceFor } from "@/server/services/content-admin";

type Params = { resource: string };

function schemasFor(resource: string) {
  const schemas = (contentSchemas as Record<string, (typeof contentSchemas)[ContentResourceKey] | undefined>)[resource];
  if (!schemas) throw notFound("Content type");
  return schemas;
}

/** Lists every item (published or not) of a content type: products, product-groups, surveys, training, gallery, testimonials, logos, leaders. */
export const GET = adminApi<Params>({ name: "content.list", permission: "content:write" }, async (ctx) => {
  const def = resourceFor(ctx.params.resource);
  const { items, meta } = await listResource(def, ctx.query(listQuerySchema(def)));
  return paged(items, meta);
});

export const POST = adminApi<Params>({ name: "content.create", permission: "content:write", maxBodyBytes: 64 * 1024 }, async (ctx) => {
  const def = resourceFor(ctx.params.resource);
  const input = await ctx.json(schemasFor(ctx.params.resource).create);
  return created(await createResource(def, input, actorOf(ctx.auth), ctx.ipHash));
});
