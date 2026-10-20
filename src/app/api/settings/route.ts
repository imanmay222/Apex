import { getSiteSettings } from "@/server/data/public";
import { PUBLIC_CACHE, api, preflight } from "@/server/lib/http";

export const OPTIONS = preflight();

/** Public site settings: contact details, social links, certificates, copy. */
export const GET = api({ name: "settings.get", cors: true, cache: PUBLIC_CACHE }, async () => getSiteSettings());
