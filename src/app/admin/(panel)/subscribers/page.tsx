import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { Subscribers } from "@/components/admin/subscribers";
import { hasPermission } from "@/server/auth/current";

export const metadata: Metadata = { title: "Subscribers" };

export default async function SubscribersPage() {
  const { viewer, allowed } = await guard("/admin/subscribers", "subscribers:read");
  return allowed ? <Subscribers canManage={hasPermission(viewer, "subscribers:manage")} /> : <NoAccess />;
}
