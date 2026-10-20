import { permissionsFor } from "@/server/auth/permissions";
import { adminApi } from "@/server/lib/http";

export const GET = adminApi({ name: "auth.me", permission: "authenticated" }, async ({ auth }) => ({
  ...auth.user,
  permissions: permissionsFor(auth.user.role),
}));
