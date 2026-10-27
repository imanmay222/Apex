import type { Metadata } from "next";
import { EnquiriesList, type EnquiryFilters } from "@/components/admin/enquiries-list";
import { NoAccess, guard } from "@/components/admin/guard";
import { hasPermission } from "@/server/auth/current";

export const metadata: Metadata = { title: "Enquiries" };

const KEYS = ["status", "type", "priority", "assignedTo", "q", "from", "to", "sort", "page"] as const;

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await guard("/admin/enquiries", "enquiries:read");
  if (!allowed) return <NoAccess />;

  const params = await searchParams;
  const initial: EnquiryFilters = {};
  for (const key of KEYS) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) initial[key] = first.slice(0, 200);
  }

  return (
    <EnquiriesList
      initial={initial}
      viewerId={viewer.id}
      canWrite={hasPermission(viewer, "enquiries:write")}
      canDelete={hasPermission(viewer, "enquiries:delete")}
    />
  );
}
