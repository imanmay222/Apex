import { z } from "zod";
import { NOTIFICATION_CHANNELS } from "@/server/db/models";
import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { audit } from "@/server/services/audit";
import { deliverOrderNotifications } from "@/server/services/notifications";
import { getOrder } from "@/server/services/orders";

const body = z.object({ channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).max(3).optional() }).strict();

/** Re-sends the sales email / customer confirmation / webhook (all channels by default). */
export const POST = adminApi<{ id: string }>({ name: "orders.resend", permission: "orders:write" }, async (ctx) => {
  await enforce(`orders.resend:${ctx.auth.user.id}`, 20, 600);
  const { channels } = await ctx.json(body);
  await getOrder(ctx.params.id); // 404 early if it doesn't exist
  await deliverOrderNotifications(ctx.params.id, channels ?? [...NOTIFICATION_CHANNELS]);
  await audit({ actor: actorOf(ctx.auth), action: "resend", resource: "orders", resourceId: ctx.params.id, ipHash: ctx.ipHash });
  return getOrder(ctx.params.id);
});
