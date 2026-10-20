import { after } from "next/server";
import { getSiteSettings } from "@/server/data/public";
import { api } from "@/server/lib/http";
import { userAgent } from "@/server/lib/request";
import { recordEvent } from "@/server/services/analytics";

/**
 * Tracked catalogue download. Every "Download catalogue" link points here; we count the
 * download, then redirect to whatever file the admin currently has configured (a static asset
 * or an uploaded GridFS PDF), so replacing the catalogue never breaks existing links.
 */
export const GET = api({ name: "catalogue.get", rateLimit: { limit: 60, windowSec: 60 } }, async (ctx) => {
  const settings = await getSiteSettings();
  const from = ctx.req.nextUrl.searchParams.get("from") ?? "/products";

  after(() =>
    recordEvent(
      { type: "catalogue_download", path: from.startsWith("/") ? from : "/products", ref: "catalogue" },
      { ip: ctx.ip, userAgent: userAgent(ctx.req), host: ctx.req.headers.get("host") },
    ).catch(() => undefined),
  );

  // Relative Location: never leaks an internal hostname when running behind a proxy.
  return new Response(null, { status: 302, headers: { Location: settings.catalogue.url } });
});
