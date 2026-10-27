import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { SystemTools } from "@/components/admin/system";

export const metadata: Metadata = { title: "Backup & system" };

export default async function SystemPage() {
  const { allowed } = await guard("/admin/system", "system:manage");
  return allowed ? <SystemTools /> : <NoAccess />;
}
