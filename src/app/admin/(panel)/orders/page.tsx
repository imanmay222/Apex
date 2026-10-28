import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { OrdersList, type OrderFilters } from "@/components/admin/orders-list";
import { hasPermission } from "@/server/auth/current";

export const metadata: Metadata = { title: "Orders" };

const KEYS = ["status", "assignedTo", "product", "q", "from", "to", "sort", "page"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await guard("/admin/orders", "orders:read");
  if (!allowed) return <NoAccess />;

  const params = await searchParams;
  const initial: OrderFilters = {};
  for (const key of KEYS) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) initial[key] = first.slice(0, 200);
  }

  return <OrdersList initial={initial} viewerId={viewer.id} canWrite={hasPermission(viewer, "orders:write")} canDelete={hasPermission(viewer, "orders:delete")} />;
}
