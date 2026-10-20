import { adminApi, noContent } from "@/server/lib/http";
import { revokeOwnSession } from "@/server/services/users";

export const DELETE = adminApi<{ id: string }>({ name: "auth.sessions.revoke", permission: "authenticated" }, async ({ auth, params }) => {
  await revokeOwnSession(auth.user.id, params.id);
  return noContent();
});
