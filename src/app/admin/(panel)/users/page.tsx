import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { UsersAdmin } from "@/components/admin/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const { viewer, allowed } = await guard("/admin/users", "users:manage");
  return allowed ? <UsersAdmin viewerId={viewer.id} /> : <NoAccess />;
}
