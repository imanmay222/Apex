import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { audit } from "@/server/services/audit";
import { exportContent } from "@/server/services/backup";

/** JSON backup of all editable content and settings (no users, sessions or enquiries). */
export const GET = adminApi({ name: "content.export", permission: "system:manage", rateLimit: { limit: 10, windowSec: 60 } }, async (ctx) => {
  const snapshot = await exportContent();
  await audit({ actor: actorOf(ctx.auth), action: "export", resource: "content", ipHash: ctx.ipHash });
  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="apex-content-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
