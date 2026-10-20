import { z } from "zod";
import { getSurveys } from "@/server/data/public";
import { PUBLIC_CACHE, api, preflight } from "@/server/lib/http";
import { queryBool } from "@/server/validation/primitives";

export const OPTIONS = preflight();

const query = z.object({ featured: queryBool.optional() }).strict();

export const GET = api({ name: "surveys.list", cors: true, cache: PUBLIC_CACHE }, async (ctx) => {
  const { featured } = ctx.query(query);
  const surveys = await getSurveys();
  return featured === undefined ? surveys : surveys.filter((s) => s.featured === featured);
});
