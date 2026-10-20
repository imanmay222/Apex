import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { reorderInput } from "@/server/validation/content";
import { reorderResource, resourceFor } from "@/server/services/content-admin";

/** Body: `{ "ids": [...] }` in the desired order. Items are renumbered 10, 20, 30… */
export const POST = adminApi<{ resource: string }>({ name: "content.reorder", permission: "content:write" }, async (ctx) => {
  const { ids } = await ctx.json(reorderInput);
  return reorderResource(resourceFor(ctx.params.resource), ids, actorOf(ctx.auth), ctx.ipHash);
});
