import Link from "next/link";
import { hasPermission, requireAdmin, type AdminViewer } from "@/server/auth/current";
import type { Permission } from "@/server/auth/permissions";
import { btn } from "./styles";

/**
 * Server-side gate for an admin page: redirects to sign-in without a valid session and reports
 * whether the viewer holds `permission`. The API enforces the same permission on every call.
 */
export async function guard(path: string, permission?: Permission): Promise<{ viewer: AdminViewer; allowed: boolean }> {
  const viewer = await requireAdmin(path);
  return { viewer, allowed: !permission || hasPermission(viewer, permission) };
}

export function NoAccess() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="eyebrow">Restricted</p>
      <h1 className="font-display mt-2 text-2xl font-semibold text-foreground">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-sm text-muted">Your role doesn&apos;t include this area. Ask an administrator if you need it.</p>
      <Link href="/admin" className={`${btn("brand")} mt-6`}>
        Back to dashboard
      </Link>
    </div>
  );
}
