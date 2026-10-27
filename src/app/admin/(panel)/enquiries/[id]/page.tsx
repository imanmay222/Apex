import type { Metadata } from "next";
import { EnquiryDetail } from "@/components/admin/enquiry-detail";
import { NoAccess, guard } from "@/components/admin/guard";
import { hasPermission } from "@/server/auth/current";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, allowed } = await guard(`/admin/enquiries/${id}`, "enquiries:read");
  if (!allowed) return <NoAccess />;
  return (
    <EnquiryDetail
      key={id}
      id={id}
      viewer={{ id: viewer.id, role: viewer.role }}
      canWrite={hasPermission(viewer, "enquiries:write")}
      canDelete={hasPermission(viewer, "enquiries:delete")}
    />
  );
}
