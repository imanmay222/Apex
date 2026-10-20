import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { bulkContentInput } from "@/server/validation/content";
import { bulkResource, resourceFor } from "@/server/services/content-admin";

/** Body: `{ "action": "publish" | "unpublish" | "delete", "ids": [...] }`. */
export const POST = adminApi<{ resource: string }>({ name: "content.bulk", permission: "content:write" }, async (ctx) => {
  const { action, ids } = await ctx.json(bulkContentInput);
  return bulkResource(resourceFor(ctx.params.resource), action, ids, actorOf(ctx.auth), ctx.ipHash);
});
