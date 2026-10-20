import { getProductBySlug, getRelatedProducts } from "@/server/data/public";
import { notFound } from "@/server/lib/errors";
import { PUBLIC_CACHE, api, preflight } from "@/server/lib/http";

export const OPTIONS = preflight();

export const GET = api<{ slug: string }>({ name: "products.get", cors: true, cache: PUBLIC_CACHE }, async ({ params }) => {
  const product = await getProductBySlug(params.slug);
  if (!product) throw notFound("Product");
  return { ...product, related: await getRelatedProducts(product.slug, product.group, 4) };
});
