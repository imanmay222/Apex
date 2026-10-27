import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { SettingsForm } from "@/components/admin/settings-form";
import { hasPermission } from "@/server/auth/current";

export const metadata: Metadata = { title: "Site settings" };

export default async function SettingsPage() {
  const { viewer, allowed } = await guard("/admin/settings", "settings:write");
  return allowed ? <SettingsForm canUseMedia={hasPermission(viewer, "media:write")} /> : <NoAccess />;
}
