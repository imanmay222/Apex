import { actorOf } from "@/server/lib/admin";
import { TAGS, invalidate } from "@/server/lib/cache";
import { adminApi } from "@/server/lib/http";
import { audit } from "@/server/services/audit";

/** Force every cached public read to refresh. Useful after editing the database directly. */
export const POST = adminApi({ name: "cache.revalidate", permission: "system:manage" }, async (ctx) => {
  invalidate(...Object.values(TAGS));
  await audit({ actor: actorOf(ctx.auth), action: "revalidate", resource: "cache", ipHash: ctx.ipHash });
  return { revalidated: Object.values(TAGS) };
});
