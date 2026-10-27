import type { Metadata } from "next";
import { NoAccess, guard } from "@/components/admin/guard";
import { MediaLibrary } from "@/components/admin/media-library";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage() {
  const { allowed } = await guard("/admin/media", "media:write");
  return allowed ? <MediaLibrary /> : <NoAccess />;
}
