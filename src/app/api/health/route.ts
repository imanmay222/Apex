import { mailConfigured } from "@/server/mail/mailer";
import { pingDb } from "@/server/db/connect";
import { api, ok } from "@/server/lib/http";

/** Liveness + readiness. 503 when MongoDB is unreachable so orchestrators can react. */
export const GET = api({ name: "health.get", rateLimit: false }, async () => {
  const database = await pingDb();
  const body = {
    status: database.ok ? "ok" : "degraded",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database: database.ok ? { status: "up", latencyMs: database.latencyMs } : { status: "down", error: database.error },
      mail: { status: mailConfigured() ? "configured" : "disabled" },
    },
  };
  return ok(body, { status: database.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
});
