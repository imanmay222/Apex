import type { MetadataRoute } from "next";
import { getProducts, getSurveys } from "@/server/data/public";

export const dynamic = "force-dynamic";

const baseUrl = (process.env.PUBLIC_SITE_URL ?? "https://apexcaretechnologies.com").replace(/\/+$/, "");

/** Generated from the database, so new products and surveys appear without a deploy. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, surveys] = await Promise.all([getProducts(), getSurveys()]);

  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/products", priority: 0.9 },
    { path: "/survey", priority: 0.9 },
    { path: "/training", priority: 0.8 },
    { path: "/about", priority: 0.7 },
    { path: "/contact", priority: 0.7 },
  ].map((route) => ({
    url: `${baseUrl}${route.path}`,
    changeFrequency: "monthly" as const,
    priority: route.priority,
  }));

  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...surveys.map((survey) => ({
      url: `${baseUrl}/survey/${survey.slug}`,
      lastModified: new Date(survey.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
