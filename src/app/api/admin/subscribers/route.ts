import { adminApi, paged } from "@/server/lib/http";
import { listSubscribers } from "@/server/services/subscribers";
import { subscriberListQuery } from "@/server/validation/engagement";

export const GET = adminApi({ name: "subscribers.list", permission: "subscribers:read" }, async (ctx) => {
  const { items, meta } = await listSubscribers(ctx.query(subscriberListQuery));
  return paged(items, meta);
});
