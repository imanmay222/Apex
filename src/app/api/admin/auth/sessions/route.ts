import { adminApi } from "@/server/lib/http";
import { destroyUserSessions } from "@/server/auth/sessions";
import { listOwnSessions } from "@/server/services/users";

/** The signed-in user's active sessions (devices). */
export const GET = adminApi({ name: "auth.sessions.list", permission: "authenticated" }, async ({ auth }) =>
  listOwnSessions(auth.user.id, auth.tokenHash),
);

/** Sign out everywhere except this device. */
export const DELETE = adminApi({ name: "auth.sessions.revoke-others", permission: "authenticated" }, async ({ auth }) => ({
  revoked: await destroyUserSessions(auth.user.id, auth.tokenHash),
}));
