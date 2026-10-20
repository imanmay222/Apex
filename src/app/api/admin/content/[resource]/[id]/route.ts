import { notFound } from "@/server/lib/errors";
import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent } from "@/server/lib/http";
import { contentSchemas, type ContentResourceKey } from "@/server/validation/content";
import { deleteResource, getResource, resourceFor, updateResource } from "@/server/services/content-admin";

type Params = { resource: string; id: string };

export const GET = adminApi<Params>({ name: "content.get", permission: "content:write" }, async ({ params }) =>
  getResource(resourceFor(params.resource), params.id),
);

/** Partial update: only the fields sent are changed. */
export const PATCH = adminApi<Params>({ name: "content.update", permission: "content:write", maxBodyBytes: 64 * 1024 }, async (ctx) => {
  const def = resourceFor(ctx.params.resource);
  const schemas = (contentSchemas as Record<string, (typeof contentSchemas)[ContentResourceKey] | undefined>)[ctx.params.resource];
  if (!schemas) throw notFound("Content type");
  return updateResource(def, ctx.params.id, await ctx.json(schemas.update), actorOf(ctx.auth), ctx.ipHash);
});

export const DELETE = adminApi<Params>({ name: "content.delete", permission: "content:write" }, async (ctx) => {
  await deleteResource(resourceFor(ctx.params.resource), ctx.params.id, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
