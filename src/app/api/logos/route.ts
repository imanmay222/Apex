import { z } from "zod";
import { getLogos } from "@/server/data/public";
import { LOGO_KINDS } from "@/server/db/models/logo";
import { PUBLIC_CACHE, api, preflight } from "@/server/lib/http";

export const OPTIONS = preflight();

const query = z.object({ kind: z.enum(LOGO_KINDS) }).strict();

/** `?kind=client` or `?kind=brand` (required). */
export const GET = api({ name: "logos.list", cors: true, cache: PUBLIC_CACHE }, async (ctx) => {
  const { kind } = ctx.query(query);
  return getLogos(kind);
});
