import { connectDb } from "../db/connect";
import { ProductModel, SurveyModel, TrainingModel } from "../db/models";
import { escapeRegex, tokenize } from "../lib/text";

export type SearchType = "products" | "surveys" | "training";

export interface SearchHit {
  type: SearchType;
  slug: string;
  title: string;
  summary: string;
  image: string | null;
  url: string;
  score: number;
}

interface Candidate {
  slug: string;
  title: string;
  summary: string;
  tags?: string[];
  body?: string;
}

/** Every token must appear somewhere; earlier/higher-value fields score higher. */
function score(candidate: Candidate, tokens: string[]): number {
  const title = candidate.title.toLowerCase();
  const summary = candidate.summary.toLowerCase();
  const tags = (candidate.tags ?? []).join(" ").toLowerCase();
  const body = (candidate.body ?? "").toLowerCase();

  let total = 0;
  for (const token of tokens) {
    let points = 0;
    if (title.startsWith(token)) points += 10;
    else if (title.split(/\W+/).some((word) => word.startsWith(token))) points += 7;
    else if (title.includes(token)) points += 5;
    if (tags.includes(token)) points += 3;
    if (summary.includes(token)) points += 2;
    if (body.includes(token)) points += 1;
    if (points === 0) return 0; // AND semantics
    total += points;
  }
  return total;
}

function anyFieldMatches(tokens: string[], fields: string[]) {
  return {
    $and: tokens.map((token) => {
      const pattern = new RegExp(escapeRegex(token), "i");
      return { $or: fields.map((field) => ({ [field]: pattern })) };
    }),
  };
}

export async function searchSite(query: string, types: SearchType[], limit: number): Promise<SearchHit[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  await connectDb();

  const visible = { published: true };
  const hits: SearchHit[] = [];

  if (types.includes("products")) {
    const docs = await ProductModel.find({ ...visible, ...anyFieldMatches(tokens, ["title", "summary", "description", "tags", "brand", "group"]) })
      .limit(100)
      .lean();
    for (const doc of docs) {
      const s = score({ slug: doc.slug, title: doc.title, summary: doc.summary, tags: [...(doc.tags ?? []), doc.brand ?? ""], body: doc.description ?? undefined }, tokens);
      if (s > 0) hits.push({ type: "products", slug: doc.slug, title: doc.title, summary: doc.summary, image: doc.image?.src ?? null, url: `/products/${doc.slug}`, score: s });
    }
  }

  if (types.includes("surveys")) {
    const docs = await SurveyModel.find({ ...visible, ...anyFieldMatches(tokens, ["title", "shortTitle", "description"]) }).limit(100).lean();
    for (const doc of docs) {
      const summary = doc.description.length > 160 ? `${doc.description.slice(0, 157).trimEnd()}…` : doc.description;
      const s = score({ slug: doc.slug, title: doc.shortTitle ? `${doc.title} ${doc.shortTitle}` : doc.title, summary, body: doc.description ?? undefined }, tokens);
      if (s > 0) hits.push({ type: "surveys", slug: doc.slug, title: doc.title, summary, image: doc.image?.src ?? null, url: `/survey/${doc.slug}`, score: s });
    }
  }

  if (types.includes("training")) {
    const docs = await TrainingModel.find({ ...visible, ...anyFieldMatches(tokens, ["title", "summary"]) }).limit(100).lean();
    for (const doc of docs) {
      const s = score({ slug: doc.slug, title: doc.title, summary: doc.summary }, tokens);
      if (s > 0) hits.push({ type: "training", slug: doc.slug, title: doc.title, summary: doc.summary, image: null, url: "/training", score: s });
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
