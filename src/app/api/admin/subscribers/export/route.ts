import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { audit } from "@/server/services/audit";
import { exportSubscribersCsv } from "@/server/services/subscribers";
import { subscriberListQuery } from "@/server/validation/engagement";

/** CSV of subscribers (confirmed ones unless `?status=` says otherwise), ready for a mailing tool. */
export const GET = adminApi({ name: "subscribers.export", permission: "subscribers:read", rateLimit: { limit: 20, windowSec: 60 } }, async (ctx) => {
  const { status, q } = ctx.query(subscriberListQuery);
  const csv = await exportSubscribersCsv({ status, q });
  await audit({ actor: actorOf(ctx.auth), action: "export", resource: "subscribers", ipHash: ctx.ipHash });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
