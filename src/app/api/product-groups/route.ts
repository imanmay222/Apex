import { getProductGroups } from "@/server/data/public";
import { PUBLIC_CACHE, api, preflight } from "@/server/lib/http";

export const OPTIONS = preflight();

export const GET = api({ name: "groups.list", cors: true, cache: PUBLIC_CACHE }, async () => getProductGroups());
