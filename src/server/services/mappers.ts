import type { Types } from "mongoose";
import type {
  AdminSiteSettings,
  GalleryImage,
  Img,
  Leader,
  Logo,
  Product,
  ProductGroup,
  SiteSettings,
  SurveyService,
  Testimonial,
  TrainingProgram,
} from "@/lib/types";
import type {
  GalleryDoc,
  LeaderDoc,
  LogoDoc,
  ProductDoc,
  ProductGroupDoc,
  SiteSettingsDoc,
  SurveyDoc,
  TestimonialDoc,
  TrainingDoc,
} from "../db/models";
import { settingsSeed } from "../seed/data";

/** A `.lean()` result: the inferred document plus the fields Mongoose adds at runtime. */
export type Lean<T> = T & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date };

export const iso = (value?: Date | null): string => (value ? value.toISOString() : new Date(0).toISOString());

const image = (value?: { src?: string | null; alt?: string | null } | null): Img => ({
  src: value?.src ?? "",
  alt: value?.alt ?? "",
});

const seo = (value?: { title?: string | null; description?: string | null } | null) => {
  if (!value || (!value.title && !value.description)) return undefined;
  return {
    ...(value.title ? { title: value.title } : {}),
    ...(value.description ? { description: value.description } : {}),
  };
};

const editable = (doc: { _id: Types.ObjectId; order?: number | null; published?: boolean | null }) => ({
  id: String(doc._id),
  order: doc.order ?? 0,
  published: doc.published ?? true,
});

export function toProduct(doc: Lean<ProductDoc>): Product {
  return {
    ...editable(doc),
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    ...(doc.description ? { description: doc.description } : {}),
    image: image(doc.image),
    gallery: (doc.gallery ?? []).map(image),
    group: doc.group,
    ...(doc.brand ? { brand: doc.brand } : {}),
    features: [...(doc.features ?? [])],
    specs: (doc.specs ?? []).map((spec) => ({ label: spec.label, value: spec.value })),
    tags: [...(doc.tags ?? [])],
    featured: doc.featured ?? false,
    ...(seo(doc.seo) ? { seo: seo(doc.seo) } : {}),
    updatedAt: iso(doc.updatedAt),
  };
}

export function toProductGroup(doc: Lean<ProductGroupDoc>): ProductGroup {
  return { ...editable(doc), key: doc.key, title: doc.title, blurb: doc.blurb ?? "" };
}

export function toSurvey(doc: Lean<SurveyDoc>): SurveyService {
  return {
    ...editable(doc),
    slug: doc.slug,
    title: doc.title,
    ...(doc.shortTitle ? { shortTitle: doc.shortTitle } : {}),
    image: image(doc.image),
    description: doc.description,
    featured: doc.featured ?? false,
    ...(seo(doc.seo) ? { seo: seo(doc.seo) } : {}),
    updatedAt: iso(doc.updatedAt),
  };
}

export function toTraining(doc: Lean<TrainingDoc>): TrainingProgram {
  return { ...editable(doc), slug: doc.slug, title: doc.title, icon: doc.icon ?? "ShieldCheck", summary: doc.summary };
}

export function toGalleryImage(doc: Lean<GalleryDoc>): GalleryImage {
  return {
    ...editable(doc),
    src: doc.src,
    alt: doc.alt ?? "",
    ...(doc.caption ? { caption: doc.caption } : {}),
  };
}

export function toTestimonial(doc: Lean<TestimonialDoc>): Testimonial {
  return {
    ...editable(doc),
    name: doc.name,
    ...(doc.role ? { role: doc.role } : {}),
    ...(doc.company ? { company: doc.company } : {}),
    quote: doc.quote,
    ...(doc.rating ? { rating: doc.rating } : {}),
  };
}

/** Admin view of a testimonial: adds provenance and the (private) submitter email. */
export function toTestimonialAdmin(doc: Lean<TestimonialDoc>) {
  return {
    ...toTestimonial(doc),
    source: (doc.source ?? "admin") as "admin" | "public",
    ...(doc.submitter?.email ? { submitterEmail: doc.submitter.email } : {}),
    createdAt: iso(doc.createdAt),
  };
}

export function toLogo(doc: Lean<LogoDoc>): Logo {
  return {
    ...editable(doc),
    kind: doc.kind,
    name: doc.name,
    src: doc.src,
    ...(doc.url ? { url: doc.url } : {}),
  };
}

export function toLeader(doc: Lean<LeaderDoc>): Leader {
  return {
    ...editable(doc),
    name: doc.name,
    qualification: doc.qualification ?? "",
    role: doc.role,
    image: doc.image,
    ...(doc.bio ? { bio: doc.bio } : {}),
  };
}

/** Maps the settings document, filling any missing field from the seed defaults. */
export function toSettings(doc: Lean<SiteSettingsDoc> | null): SiteSettings {
  const seed = settingsSeed;
  const d = doc;

  return {
    companyName: d?.companyName ?? seed.companyName,
    legalName: d?.legalName ?? seed.legalName,
    tagline: d?.tagline ?? seed.tagline,
    description: d?.description ?? seed.description,
    foundedYear: d?.foundedYear ?? seed.foundedYear,
    teamSize: d?.teamSize ?? seed.teamSize,
    phones: d ? [...(d.phones ?? [])] : [...seed.phones],
    landline: d?.landline ?? seed.landline,
    whatsapp: d?.whatsapp ?? seed.whatsapp,
    emails: d ? [...(d.emails ?? [])] : [...seed.emails],
    address: {
      street: d?.address?.street ?? seed.address.street,
      locality: d?.address?.locality ?? seed.address.locality,
      city: d?.address?.city ?? seed.address.city,
      state: d?.address?.state ?? seed.address.state,
      country: d?.address?.country ?? seed.address.country,
      postalCode: d?.address?.postalCode ?? seed.address.postalCode,
    },
    mapsLink: d?.mapsLink ?? seed.mapsLink,
    mapEmbedSrc: d?.mapEmbedSrc ?? seed.mapEmbedSrc,
    social: {
      facebook: d?.social?.facebook ?? seed.social.facebook,
      instagram: d?.social?.instagram ?? seed.social.instagram,
      whatsapp: d?.social?.whatsapp ?? seed.social.whatsapp,
    },
    certificates: (d ? d.certificates : seed.certificates).map((c) => ({ label: c.label, value: c.value })),
    about: {
      intro: d?.about?.intro ?? seed.about.intro,
      network: d?.about?.network ?? seed.about.network,
    },
    home: {
      heroBadge: d?.home?.heroBadge ?? seed.home.heroBadge,
      heroTitle: d?.home?.heroTitle ?? seed.home.heroTitle,
      heroLead: d?.home?.heroLead ?? seed.home.heroLead,
    },
    valuePillars: (d ? d.valuePillars : seed.valuePillars).map((p) => ({
      title: p.title,
      icon: p.icon ?? "Sparkle",
      text: p.text ?? "",
    })),
    differentiators: (d ? d.differentiators : seed.differentiators).map((p) => ({
      title: p.title,
      icon: p.icon ?? "BadgeCheck",
    })),
    catalogue: {
      title: d?.catalogue?.title ?? seed.catalogue.title,
      url: d?.catalogue?.url ?? seed.catalogue.url,
    },
  };
}

export function toAdminSettings(doc: Lean<SiteSettingsDoc> | null): AdminSiteSettings {
  return {
    ...toSettings(doc),
    notifications: { salesEmails: [...(doc?.notifications?.salesEmails ?? [])] },
  };
}
