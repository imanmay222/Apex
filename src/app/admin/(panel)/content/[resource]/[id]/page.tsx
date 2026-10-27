import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resourceConfig } from "@/components/admin/content-config";
import { ContentEditor } from "@/components/admin/content-editor";
import { NoAccess, guard } from "@/components/admin/guard";

type Props = { params: Promise<{ resource: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = resourceConfig((await params).resource);
  return { title: config ? `Edit ${config.singular}` : "Content" };
}

export default async function EditContentPage({ params }: Props) {
  const { resource, id } = await params;
  const { allowed } = await guard(`/admin/content/${resource}/${id}`, "content:write");
  if (!allowed) return <NoAccess />;
  if (!resourceConfig(resource)) notFound();
  return <ContentEditor key={`${resource}-${id}`} resource={resource} id={id} />;
}
