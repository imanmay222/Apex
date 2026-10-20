import * as source from "./content";

/**
 * Database-ready seed documents, derived from the content transcribed off the original site.
 * `order` is spaced by 10 so editors can slot items in between without renumbering.
 */

const step = (index: number) => (index + 1) * 10;

export const productGroupSeed = source.productGroups.map((group, index) => ({
  key: group.id,
  title: group.title,
  blurb: group.blurb,
  order: step(index),
  published: true,
}));

export const productSeed = source.productCategories.map((product, index) => ({
  slug: product.slug,
  title: product.title,
  summary: product.summary,
  image: product.image,
  group: product.group,
  // The original catalogue lists these under a "Draeger" section heading.
  ...(product.group === "draeger" ? { brand: "Dräger" } : {}),
  featured: source.featuredCategorySlugs.includes(product.slug),
  order: step(index),
  published: true,
}));

export const surveySeed = source.surveys.map((survey, index) => ({
  slug: survey.slug,
  title: survey.title,
  ...(survey.shortTitle ? { shortTitle: survey.shortTitle } : {}),
  image: survey.image,
  description: survey.description,
  featured: source.featuredSurveySlugs.includes(survey.slug),
  order: step(index),
  published: true,
}));

export const trainingSeed = source.trainingPrograms.map((program, index) => ({
  slug: program.slug,
  title: program.title,
  icon: program.icon,
  summary: program.summary,
  order: step(index),
  published: true,
}));

export const gallerySeed = source.trainingGallery.map((image, index) => ({
  src: image.src,
  alt: image.alt,
  order: step(index),
  published: true,
}));

export const testimonialSeed = source.testimonials.map((item, index) => ({
  name: item.name,
  quote: item.quote,
  order: step(index),
  published: true,
}));

export const logoSeed = [
  ...source.clientLogos.map((logo, index) => ({
    kind: "client" as const,
    name: logo.name,
    src: logo.src,
    order: step(index),
    published: true,
  })),
  ...source.brandLogos.map((logo, index) => ({
    kind: "brand" as const,
    name: logo.name,
    src: logo.src,
    order: step(index),
    published: true,
  })),
];

export const leaderSeed = source.leadership.map((leader, index) => ({
  name: leader.name,
  qualification: leader.qualification,
  role: leader.role,
  image: leader.image,
  order: step(index),
  published: true,
}));

export const settingsSeed = {
  key: "site" as const,
  companyName: source.site.companyName,
  legalName: source.site.legalName,
  tagline: source.site.tagline,
  description: source.site.description,
  foundedYear: source.site.foundedYear,
  teamSize: source.site.teamSize,
  phones: source.site.phones,
  landline: source.site.landline,
  whatsapp: source.site.whatsapp,
  emails: source.site.emails,
  address: source.site.address,
  mapsLink: source.site.mapsLink,
  mapEmbedSrc: source.site.mapEmbedSrc,
  social: source.site.social,
  certificates: source.site.certificates,
  about: { intro: source.aboutCopy.intro, network: source.aboutCopy.network },
  home: {
    heroBadge: "Fire · Safety · Welding · Hardware",
    heroTitle: "Industrial safety equipment that actually gets worn",
    heroLead: `${source.site.companyName} supplies, surveys and services protective equipment for industry across India — from PPE and gas detection to fire suppression, backed by on-site training.`,
  },
  valuePillars: source.valuePillars,
  differentiators: source.differentiators,
  catalogue: { title: "Product catalogue", url: "/media/pdf/apexcare-technologies.pdf" },
  // The address the original site labels "Enquiry Mail". SALES_EMAIL in the environment overrides it.
  notifications: { salesEmails: ["enquiry@apexcaretechnologies.com"] },
};
