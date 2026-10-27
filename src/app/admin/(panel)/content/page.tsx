import type { Metadata } from "next";
import { ContentIndex } from "@/components/admin/content-index";
import { NoAccess, guard } from "@/components/admin/guard";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  const { allowed } = await guard("/admin/content", "content:write");
  return allowed ? <ContentIndex /> : <NoAccess />;
}
