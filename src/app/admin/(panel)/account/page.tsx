import type { Metadata } from "next";
import { Account } from "@/components/admin/account";
import { guard } from "@/components/admin/guard";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const { viewer } = await guard("/admin/account");
  return <Account viewer={viewer} />;
}
