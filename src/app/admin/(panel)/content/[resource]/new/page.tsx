import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resourceConfig } from "@/components/admin/content-config";
import { ContentEditor } from "@/components/admin/content-editor";
import { NoAccess, guard } from "@/components/admin/guard";

type Props = { params: Promise<{ resource: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = resourceConfig((await params).resource);
  return { title: config ? `New ${config.singular}` : "Content" };
}

export default async function NewContentPage({ params }: Props) {
  const { resource } = await params;
  const { allowed } = await guard(`/admin/content/${resource}/new`, "content:write");
  if (!allowed) return <NoAccess />;
  if (!resourceConfig(resource)) notFound();
  return <ContentEditor key={`${resource}-new`} resource={resource} />;
}
