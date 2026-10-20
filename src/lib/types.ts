/**
 * Public data shapes. These are what the API returns and what React components consume.
 * All values are JSON-safe (dates are ISO strings, ids are strings).
 */

export type Img = {
  src: string;
  alt: string;
};

type Editable = {
  id: string;
  order: number;
  published: boolean;
};

export type ProductGroup = Editable & {
  /** Stable key referenced by Product.group and used as the page anchor. */
  key: string;
  title: string;
  blurb: string;
};

export type Product = Editable & {
  slug: string;
  title: string;
  /** Short line used on cards and headers. */
  summary: string;
  description?: string;
  image: Img;
  gallery: Img[];
  group: string;
  brand?: string;
  features: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  featured: boolean;
  seo?: { title?: string; description?: string };
  updatedAt: string;
};

export type SurveyService = Editable & {
  slug: string;
  title: string;
  /** Compact label for cards where the full title is too long. */
  shortTitle?: string;
  image: Img;
  description: string;
  featured: boolean;
  seo?: { title?: string; description?: string };
  updatedAt: string;
};

export type TrainingProgram = Editable & {
  slug: string;
  title: string;
  /** Icon name resolved by the front-end icon set. */
  icon: string;
  summary: string;
};

export type GalleryImage = Editable & {
  src: string;
  alt: string;
  caption?: string;
};

export type Testimonial = Editable & {
  name: string;
  role?: string;
  company?: string;
  quote: string;
  rating?: number;
};

export type Logo = Editable & {
  kind: "client" | "brand";
  name: string;
  src: string;
  url?: string;
};

export type Leader = Editable & {
  name: string;
  qualification: string;
  role: string;
  image: string;
  bio?: string;
};

export type ValuePillar = {
  title: string;
  icon: string;
  text: string;
};

export type Differentiator = {
  title: string;
  icon: string;
};

export type SiteSettings = {
  companyName: string;
  legalName: string;
  tagline: string;
  description: string;
  foundedYear: number;
  teamSize: number;
  phones: string[];
  landline: string;
  whatsapp: string;
  emails: string[];
  address: {
    street: string;
    locality: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  mapsLink: string;
  mapEmbedSrc: string;
  social: {
    facebook: string;
    instagram: string;
    whatsapp: string;
  };
  certificates: { label: string; value: string }[];
  about: { intro: string; network: string };
  home: { heroBadge: string; heroTitle: string; heroLead: string };
  valuePillars: ValuePillar[];
  differentiators: Differentiator[];
  catalogue: { title: string; url: string };
};

/** Admin-only extension of the settings (never sent to public endpoints). */
export type AdminSiteSettings = SiteSettings & {
  notifications: { salesEmails: string[] };
};

export type SiteStats = {
  products: number;
  surveys: number;
  training: number;
  team: number;
  yearsInBusiness: number;
};

export type EnquiryOptions = {
  products: { value: string; label: string }[];
  survey: { value: string; label: string }[];
  training: { value: string; label: string }[];
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
