import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { audit } from "@/server/services/audit";
import { exportOrdersCsv } from "@/server/services/orders";
import { orderListQuery } from "@/server/validation/order";

/** CSV download, one row per order line, honouring the list filters (page/limit ignored). */
export const GET = adminApi({ name: "orders.export", permission: "orders:read", rateLimit: { limit: 20, windowSec: 60 } }, async (ctx) => {
  const filters = { ...ctx.query(orderListQuery), page: undefined, limit: undefined };
  const csv = await exportOrdersCsv(filters);
  await audit({ actor: actorOf(ctx.auth), action: "export", resource: "orders", ipHash: ctx.ipHash });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
