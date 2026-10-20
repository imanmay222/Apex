import { getSurveyBySlug } from "@/server/data/public";
import { notFound } from "@/server/lib/errors";
import { PUBLIC_CACHE, api, preflight } from "@/server/lib/http";

export const OPTIONS = preflight();

export const GET = api<{ slug: string }>({ name: "surveys.get", cors: true, cache: PUBLIC_CACHE }, async ({ params }) => {
  const survey = await getSurveyBySlug(params.slug);
  if (!survey) throw notFound("Survey");
  return survey;
});
