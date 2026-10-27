import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resourceConfig } from "@/components/admin/content-config";
import { ContentList } from "@/components/admin/content-list";
import { NoAccess, guard } from "@/components/admin/guard";

type Props = { params: Promise<{ resource: string }>; searchParams: Promise<{ view?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: resourceConfig((await params).resource)?.label ?? "Content" };
}

export default async function ContentResourcePage({ params, searchParams }: Props) {
  const { resource } = await params;
  const { allowed } = await guard(`/admin/content/${resource}`, "content:write");
  if (!allowed) return <NoAccess />;
  if (!resourceConfig(resource)) notFound();
  const { view } = await searchParams;
  return <ContentList key={resource} resource={resource} initialView={view} />;
}
