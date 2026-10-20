import type {
  EnquiryOptions,
  GalleryImage,
  Leader,
  Logo,
  Product,
  ProductGroup,
  SiteSettings,
  SiteStats,
  SurveyService,
  Testimonial,
  TrainingProgram,
} from "@/lib/types";
import { connectDb } from "../db/connect";
import {
  GalleryModel,
  LeaderModel,
  LogoModel,
  ProductGroupModel,
  ProductModel,
  SiteSettingsModel,
  SurveyModel,
  TestimonialModel,
  TrainingModel,
} from "../db/models";
import { cached, TAGS } from "../lib/cache";
import {
  toGalleryImage,
  toLeader,
  toLogo,
  toProduct,
  toProductGroup,
  toSettings,
  toSurvey,
  toTestimonial,
  toTraining,
} from "../services/mappers";

/*
 * Cached, published-only reads. Used by server components and by the public API alike, so a
 * page and its JSON twin can never disagree. Admin writes invalidate the matching tags.
 */

const visible = { published: true } as const;
const byOrder = { order: 1, createdAt: 1 } as const;

export const getSiteSettings = cached(
  "site-settings",
  [TAGS.settings],
  async (): Promise<SiteSettings> => {
    await connectDb();
    return toSettings(await SiteSettingsModel.findOne({ key: "site" }).lean());
  },
);

export const getProductGroups = cached(
  "product-groups",
  [TAGS.groups],
  async (): Promise<ProductGroup[]> => {
    await connectDb();
    return (await ProductGroupModel.find(visible).sort(byOrder).lean()).map(toProductGroup);
  },
);

export const getProducts = cached(
  "products",
  [TAGS.products],
  async (): Promise<Product[]> => {
    await connectDb();
    return (await ProductModel.find(visible).sort(byOrder).lean()).map(toProduct);
  },
);

export const getProductBySlug = cached(
  "product-by-slug",
  [TAGS.products],
  async (slug: string): Promise<Product | null> => {
    await connectDb();
    const doc = await ProductModel.findOne({ slug, ...visible }).lean();
    return doc ? toProduct(doc) : null;
  },
);

export const getRelatedProducts = cached(
  "related-products",
  [TAGS.products],
  async (slug: string, group: string, limit: number): Promise<Product[]> => {
    await connectDb();
    const docs = await ProductModel.find({ group, slug: { $ne: slug }, ...visible })
      .sort(byOrder)
      .limit(limit)
      .lean();
    return docs.map(toProduct);
  },
);

export const getSurveys = cached(
  "surveys",
  [TAGS.surveys],
  async (): Promise<SurveyService[]> => {
    await connectDb();
    return (await SurveyModel.find(visible).sort(byOrder).lean()).map(toSurvey);
  },
);

export const getSurveyBySlug = cached(
  "survey-by-slug",
  [TAGS.surveys],
  async (slug: string): Promise<SurveyService | null> => {
    await connectDb();
    const doc = await SurveyModel.findOne({ slug, ...visible }).lean();
    return doc ? toSurvey(doc) : null;
  },
);

export const getTrainingPrograms = cached(
  "training",
  [TAGS.training],
  async (): Promise<TrainingProgram[]> => {
    await connectDb();
    return (await TrainingModel.find(visible).sort(byOrder).lean()).map(toTraining);
  },
);

export const getGallery = cached(
  "gallery",
  [TAGS.gallery],
  async (): Promise<GalleryImage[]> => {
    await connectDb();
    return (await GalleryModel.find(visible).sort(byOrder).lean()).map(toGalleryImage);
  },
);

export const getTestimonials = cached(
  "testimonials",
  [TAGS.testimonials],
  async (): Promise<Testimonial[]> => {
    await connectDb();
    return (await TestimonialModel.find(visible).sort(byOrder).lean()).map(toTestimonial);
  },
);

export const getLogos = cached(
  "logos",
  [TAGS.logos],
  async (kind: "client" | "brand"): Promise<Logo[]> => {
    await connectDb();
    return (await LogoModel.find({ kind, ...visible }).sort(byOrder).lean()).map(toLogo);
  },
);

export const getLeaders = cached(
  "leaders",
  [TAGS.leaders],
  async (): Promise<Leader[]> => {
    await connectDb();
    return (await LeaderModel.find(visible).sort(byOrder).lean()).map(toLeader);
  },
);

/** Headline numbers for the home page, computed from live data rather than hard-coded. */
export const getSiteStats = cached(
  "site-stats",
  [TAGS.products, TAGS.surveys, TAGS.training, TAGS.settings],
  async (): Promise<SiteStats> => {
    await connectDb();
    const [products, surveys, training, settings] = await Promise.all([
      ProductModel.countDocuments(visible),
      SurveyModel.countDocuments(visible),
      TrainingModel.countDocuments(visible),
      SiteSettingsModel.findOne({ key: "site" }).lean(),
    ]);
    const site = toSettings(settings);
    return {
      products,
      surveys,
      training,
      team: site.teamSize,
      yearsInBusiness: Math.max(0, new Date().getFullYear() - site.foundedYear),
    };
  },
);

/** Dropdown choices for the enquiry form, so they always match what is actually published. */
export const getEnquiryOptions = cached(
  "enquiry-options",
  [TAGS.products, TAGS.surveys, TAGS.training],
  async (): Promise<EnquiryOptions> => {
    await connectDb();
    const [products, surveys, training] = await Promise.all([
      ProductModel.find(visible).sort(byOrder).select("slug title").lean(),
      SurveyModel.find(visible).sort(byOrder).select("slug title").lean(),
      TrainingModel.find(visible).sort(byOrder).select("slug title").lean(),
    ]);
    const pick = (docs: { slug: string; title: string }[]) =>
      docs.map((doc) => ({ value: doc.slug, label: doc.title }));
    return { products: pick(products), survey: pick(surveys), training: pick(training) };
  },
);

/** Products grouped for the catalogue page. */
export async function getCatalogue() {
  const [groups, products] = await Promise.all([getProductGroups(), getProducts()]);
  return groups
    .map((group) => ({ group, products: products.filter((product) => product.group === group.key) }))
    .filter((entry) => entry.products.length > 0);
}
