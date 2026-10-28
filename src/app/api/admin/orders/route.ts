import { adminApi, paged } from "@/server/lib/http";
import { orderListQuery } from "@/server/validation/order";
import { listOrders } from "@/server/services/orders";

export const GET = adminApi({ name: "orders.list", permission: "orders:read" }, async (ctx) => {
  const { items, meta } = await listOrders(ctx.query(orderListQuery));
  return paged(items, meta);
});
