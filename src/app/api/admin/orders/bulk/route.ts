import { can } from "@/server/auth/permissions";
import { actorOf } from "@/server/lib/admin";
import { forbidden } from "@/server/lib/errors";
import { adminApi } from "@/server/lib/http";
import { orderBulk } from "@/server/validation/order";
import { bulkOrders } from "@/server/services/orders";

export const POST = adminApi({ name: "orders.bulk", permission: "orders:write" }, async (ctx) => {
  const input = await ctx.json(orderBulk);
  // Deleting is a stronger permission than handling orders.
  if (input.action === "delete" && !can(ctx.auth.user.role, "orders:delete")) {
    throw forbidden("Only administrators can delete orders.");
  }
  return bulkOrders(input, actorOf(ctx.auth), ctx.ipHash);
});
