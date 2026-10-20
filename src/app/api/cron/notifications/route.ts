import { env } from "@/server/config/env";
import { safeEqual } from "@/server/lib/crypto";
import { unauthorized, unavailable } from "@/server/lib/errors";
import { api } from "@/server/lib/http";
import { retryFailedNotifications } from "@/server/services/notifications";

/**
 * Retries failed email/webhook deliveries (max 5 attempts each). Call it from any scheduler:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/notifications
 */
export const POST = api({ name: "cron.notifications", rateLimit: { limit: 30, windowSec: 60 } }, async ({ req }) => {
  const secret = env().cronSecret;
  if (!secret) throw unavailable("CRON_SECRET is not configured.");

  const supplied = req.headers.get("authorization")?.replace(/^bearer\s+/i, "") ?? "";
  if (!supplied || !safeEqual(supplied, secret)) throw unauthorized();

  return retryFailedNotifications();
});
