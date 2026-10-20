import { z } from "zod";
import { permissionsFor } from "@/server/auth/permissions";
import { sessionCookie } from "@/server/auth/sessions";
import { sha256 } from "@/server/lib/crypto";
import { authApi, ok } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { userAgent } from "@/server/lib/request";
import { email } from "@/server/validation/primitives";
import { signIn } from "@/server/services/users";

const body = z.object({ email, password: z.string().min(1).max(200) }).strict();

/**
 * Sign in. Throttled twice: per IP (any email) and per IP+email, on top of the per-account
 * lockout inside `signIn`. Sets an HttpOnly cookie; the token is also returned for API clients
 * that prefer `Authorization: Bearer`.
 */
export const POST = authApi({ name: "auth.login", rateLimit: { limit: 20, windowSec: 900 }, maxBodyBytes: 4 * 1024 }, async (ctx) => {
  const input = await ctx.json(body);
  await enforce(`auth.login.account:${ctx.ipHash}:${sha256(input.email).slice(0, 16)}`, 5, 900);

  const session = await signIn(input.email, input.password, { ipHash: ctx.ipHash, userAgent: userAgent(ctx.req) });

  return ok(
    {
      user: { ...session.user, permissions: permissionsFor(session.user.role) },
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } },
  );
});
