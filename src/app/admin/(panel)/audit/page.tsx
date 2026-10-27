import type { Metadata } from "next";
import { AuditLog } from "@/components/admin/audit-log";
import { NoAccess, guard } from "@/components/admin/guard";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const { allowed } = await guard("/admin/audit", "audit:read");
  return allowed ? <AuditLog /> : <NoAccess />;
}
