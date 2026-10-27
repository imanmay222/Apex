import type { Metadata } from "next";
import { Analytics } from "@/components/admin/analytics";
import { NoAccess, guard } from "@/components/admin/guard";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { allowed } = await guard("/admin/analytics", "analytics:read");
  return allowed ? <Analytics /> : <NoAccess />;
}
