import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent } from "@/server/lib/http";
import { orderUpdate } from "@/server/validation/order";
import { deleteOrder, getOrder, updateOrder } from "@/server/services/orders";

export const GET = adminApi<{ id: string }>({ name: "orders.get", permission: "orders:read" }, async ({ params }) => getOrder(params.id));

export const PATCH = adminApi<{ id: string }>({ name: "orders.update", permission: "orders:write" }, async (ctx) =>
  updateOrder(ctx.params.id, await ctx.json(orderUpdate), actorOf(ctx.auth), ctx.ipHash),
);

export const DELETE = adminApi<{ id: string }>({ name: "orders.delete", permission: "orders:delete" }, async (ctx) => {
  await deleteOrder(ctx.params.id, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
