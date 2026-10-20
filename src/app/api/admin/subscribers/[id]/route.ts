import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent } from "@/server/lib/http";
import { deleteSubscriber } from "@/server/services/subscribers";

/** Permanent erasure of a subscriber (data-protection requests). */
export const DELETE = adminApi<{ id: string }>({ name: "subscribers.delete", permission: "subscribers:manage" }, async (ctx) => {
  await deleteSubscriber(ctx.params.id, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
