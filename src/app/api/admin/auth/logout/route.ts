import { SESSION_COOKIE, clearedSessionCookie, destroySession } from "@/server/auth/sessions";
import { adminApi, noContent } from "@/server/lib/http";
import { audit } from "@/server/services/audit";

export const POST = adminApi({ name: "auth.logout", permission: "authenticated" }, async ({ req, auth, ipHash }) => {
  const bearer = req.headers.get("authorization")?.replace(/^bearer\s+/i, "").trim();
  const token = bearer || req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);

  await audit({ actor: auth.user, action: "logout", resource: "auth", ipHash });
  return noContent({ "Set-Cookie": clearedSessionCookie() });
});
