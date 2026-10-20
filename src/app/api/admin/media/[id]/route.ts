import { z } from "zod";
import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent, ok } from "@/server/lib/http";
import { line, queryBool } from "@/server/validation/primitives";
import { deleteMedia, findMediaUsage, updateMedia } from "@/server/services/media";

type Params = { id: string };

/** Where this file is used, so editors know what a delete would break. */
export const GET = adminApi<Params>({ name: "media.usage", permission: "media:write" }, async ({ params }) => ({
  id: params.id,
  usage: await findMediaUsage(params.id),
}));

export const PATCH = adminApi<Params>({ name: "media.update", permission: "media:write" }, async (ctx) => {
  const patch = await ctx.json(z.object({ alt: line(0, 200) }).strict());
  return ok(await updateMedia(ctx.params.id, patch, actorOf(ctx.auth), ctx.ipHash));
});

/** Refuses (409) if the file is still referenced, unless `?force=true`. */
export const DELETE = adminApi<Params>({ name: "media.delete", permission: "media:write" }, async (ctx) => {
  const { force } = ctx.query(z.object({ force: queryBool.optional() }).strict());
  await deleteMedia(ctx.params.id, force ?? false, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
