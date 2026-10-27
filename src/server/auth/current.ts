import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { permissionsFor, type Permission } from "./permissions";
import { SESSION_COOKIE, resolveSession, type AuthUser } from "./sessions";

export type AdminViewer = AuthUser & { permissions: Permission[] };

/**
 * The signed-in admin for the current page request, or null. Validates the session cookie
 * against the database (the proxy only checks that a cookie exists). Memoised per request, so
 * the layout and the page share one lookup.
 */
export const currentAdmin = cache(async (): Promise<AdminViewer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const auth = await resolveSession(token);
  if (!auth) return null;
  return { ...auth.user, permissions: [...permissionsFor(auth.user.role)] };
});

/** Only same-site admin paths are honoured as a post-login destination (no open redirects). */
export function safeNext(value: string | null | undefined): string {
  if (!value || !/^\/admin(?:[/?#]|$)/.test(value) || value.startsWith("/admin/login")) return "/admin";
  return value;
}

/** For admin pages: redirects to the sign-in page when there is no valid session. */
export async function requireAdmin(path: string): Promise<AdminViewer> {
  const viewer = await currentAdmin();
  if (!viewer) redirect(`/admin/login?next=${encodeURIComponent(safeNext(path))}`);
  return viewer;
}

export const hasPermission = (viewer: AdminViewer, permission: Permission) => viewer.permissions.includes(permission);
