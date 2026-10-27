import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/server/auth/current";
import { getSiteSettings } from "@/server/data/public";

/** Every page in the panel requires a valid session; pages additionally check their own permission. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-admin-path") ?? "/admin";
  const [viewer, site] = await Promise.all([requireAdmin(path), getSiteSettings()]);
  return (
    <AdminShell viewer={viewer} companyName={site.companyName}>
      {children}
    </AdminShell>
  );
}
