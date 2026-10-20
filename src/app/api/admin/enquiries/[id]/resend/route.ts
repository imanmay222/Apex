import { z } from "zod";
import { NOTIFICATION_CHANNELS } from "@/server/db/models";
import { audit } from "@/server/services/audit";
import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { getEnquiry } from "@/server/services/enquiries";
import { deliverNotifications } from "@/server/services/notifications";

const body = z.object({ channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).max(3).optional() }).strict();

/** Re-sends the sales email / customer acknowledgement / webhook (all channels by default). */
export const POST = adminApi<{ id: string }>({ name: "enquiries.resend", permission: "enquiries:write" }, async (ctx) => {
  await enforce(`enquiries.resend:${ctx.auth.user.id}`, 20, 600);
  const { channels } = await ctx.json(body);
  await getEnquiry(ctx.params.id); // 404 early if it doesn't exist
  await deliverNotifications(ctx.params.id, channels ?? [...NOTIFICATION_CHANNELS]);
  await audit({ actor: actorOf(ctx.auth), action: "resend", resource: "enquiries", resourceId: ctx.params.id, ipHash: ctx.ipHash });
  return getEnquiry(ctx.params.id);
});
