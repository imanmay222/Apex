import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { OrderDetail } from "@/components/admin/order-detail";
import { hasPermission } from "@/server/auth/current";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, allowed } = await guard(`/admin/orders/${id}`, "orders:read");
  if (!allowed) return <NoAccess />;
  return (
    <OrderDetail
      key={id}
      id={id}
      viewer={{ id: viewer.id, role: viewer.role }}
      canWrite={hasPermission(viewer, "orders:write")}
      canDelete={hasPermission(viewer, "orders:delete")}
    />
  );
}
