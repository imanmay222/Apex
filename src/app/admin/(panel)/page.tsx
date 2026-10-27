import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard";
import { guard } from "@/components/admin/guard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminHome() {
  const { viewer } = await guard("/admin");
  return <Dashboard name={viewer.name} permissions={viewer.permissions} />;
}
