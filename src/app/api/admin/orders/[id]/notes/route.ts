import { actorOf } from "@/server/lib/admin";
import { adminApi, created } from "@/server/lib/http";
import { orderNote } from "@/server/validation/order";
import { addOrderNote } from "@/server/services/orders";

export const POST = adminApi<{ id: string }>({ name: "orders.note", permission: "orders:write" }, async (ctx) => {
  const { body } = await ctx.json(orderNote);
  return created(await addOrderNote(ctx.params.id, body, actorOf(ctx.auth), ctx.ipHash));
});
