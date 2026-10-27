/* eslint-disable @typescript-eslint/no-explicit-any -- items are heterogeneous content records */

/**
 * Describes each editable content type for the generic list and editor screens. Field rules
 * mirror the API's zod schemas (src/server/validation/content.ts); the API stays the authority.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "slug"
  | "url"
  | "boolean"
  | "number"
  | "rating"
  | "select"
  | "group"
  | "icon"
  | "image"
  | "asset"
  | "gallery"
  | "list"
  | "pairs"
  | "seo";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
  max?: number;
  rows?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Laid out across both columns. */
  wide?: boolean;
}

export interface FilterDef {
  name: string;
  label: string;
  options: { value: string; label: string }[] | "groups";
}

export interface ResourceConfig {
  key: string;
  label: string;
  singular: string;
  description: string;
  fields: FieldDef[];
  filters: FilterDef[];
  defaults: Record<string, any>;
  title: (item: any) => string;
  subtitle?: (item: any) => string;
  thumb?: (item: any) => string | undefined;
  icon?: (item: any) => string | undefined;
  publicUrl?: (item: any) => string;
  featured?: boolean;
}

const featuredFilter: FilterDef = {
  name: "featured",
  label: "Featured",
  options: [
    { value: "true", label: "Featured only" },
    { value: "false", label: "Not featured" },
  ],
};

const seoField: FieldDef = { name: "seo", label: "Search engine listing", kind: "seo", wide: true, hint: "Optional overrides for the Google title (≤ 70 chars) and description (≤ 170 chars)." };
const publishedField: FieldDef = { name: "published", label: "Published on the website", kind: "boolean" };
const orderField: FieldDef = { name: "order", label: "Sort order", kind: "number", hint: "Lower numbers appear first. Use “Reorder” on the list to drag items instead." };

export const RESOURCES: ResourceConfig[] = [
  {
    key: "products",
    label: "Products",
    singular: "product",
    description: "Product categories shown on the Products page, each with its own detail page.",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, max: 120 },
      { name: "slug", label: "URL slug", kind: "slug", hint: "Used in /products/<slug>. Leave blank to generate from the title." },
      { name: "group", label: "Product group", kind: "group", required: true },
      { name: "brand", label: "Brand", kind: "text", max: 80, placeholder: "e.g. Dräger" },
      { name: "summary", label: "Summary", kind: "text", required: true, max: 300, wide: true, hint: "One line shown on cards and at the top of the product page." },
      { name: "description", label: "Description", kind: "textarea", rows: 6, max: 5000, wide: true },
      { name: "image", label: "Main image", kind: "image", required: true, wide: true },
      { name: "gallery", label: "Extra images", kind: "gallery", wide: true },
      { name: "features", label: "Key features", kind: "list", wide: true, max: 20 },
      { name: "specs", label: "Specifications", kind: "pairs", wide: true, max: 30 },
      { name: "tags", label: "Search tags", kind: "list", wide: true, max: 20, hint: "Extra words people might search for, lowercase." },
      { name: "featured", label: "Feature on the home page", kind: "boolean" },
      publishedField,
      orderField,
      seoField,
    ],
    filters: [{ name: "group", label: "Group", options: "groups" }, featuredFilter],
    defaults: { title: "", slug: "", group: "", brand: "", summary: "", description: "", image: { src: "", alt: "" }, gallery: [], features: [], specs: [], tags: [], featured: false, published: true, seo: { title: "", description: "" } },
    title: (p) => p.title,
    subtitle: (p) => [p.group, p.brand].filter(Boolean).join(" · "),
    thumb: (p) => p.image?.src,
    publicUrl: (p) => `/products/${p.slug}`,
    featured: true,
  },
  {
    key: "product-groups",
    label: "Product groups",
    singular: "product group",
    description: "The sections the Products page is divided into.",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, max: 120 },
      { name: "key", label: "Key", kind: "slug", required: true, hint: "Short id used by products and as the page anchor, e.g. personal-protection." },
      { name: "blurb", label: "Intro text", kind: "text", max: 300, wide: true },
      publishedField,
      orderField,
    ],
    filters: [],
    defaults: { title: "", key: "", blurb: "", published: true },
    title: (g) => g.title,
    subtitle: (g) => g.key,
    publicUrl: (g) => `/products#${g.key}`,
  },
  {
    key: "surveys",
    label: "Surveys",
    singular: "survey",
    description: "On-site survey and servicing offers, each with a booking page.",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, max: 140 },
      { name: "shortTitle", label: "Short title", kind: "text", max: 80, hint: "Used on cards where the full title is too long." },
      { name: "slug", label: "URL slug", kind: "slug", hint: "Used in /survey/<slug>. Leave blank to generate from the title." },
      { name: "description", label: "Description", kind: "textarea", required: true, rows: 6, max: 5000, wide: true },
      { name: "image", label: "Image", kind: "image", required: true, wide: true },
      { name: "featured", label: "Feature on the home page", kind: "boolean" },
      publishedField,
      orderField,
      seoField,
    ],
    filters: [featuredFilter],
    defaults: { title: "", shortTitle: "", slug: "", description: "", image: { src: "", alt: "" }, featured: false, published: true, seo: { title: "", description: "" } },
    title: (s) => s.title,
    subtitle: (s) => s.shortTitle ?? "",
    thumb: (s) => s.image?.src,
    publicUrl: (s) => `/survey/${s.slug}`,
    featured: true,
  },
  {
    key: "training",
    label: "Training programmes",
    singular: "training programme",
    description: "Programmes listed on the Training & Demos page and the home page.",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, max: 120 },
      { name: "slug", label: "URL slug", kind: "slug", hint: "Leave blank to generate from the title." },
      { name: "icon", label: "Icon", kind: "icon" },
      { name: "summary", label: "Summary", kind: "text", required: true, max: 300, wide: true },
      publishedField,
      orderField,
    ],
    filters: [],
    defaults: { title: "", slug: "", icon: "ShieldCheck", summary: "", published: true },
    title: (t) => t.title,
    subtitle: (t) => t.summary,
    icon: (t) => t.icon,
    publicUrl: () => "/training",
  },
  {
    key: "gallery",
    label: "Training gallery",
    singular: "gallery image",
    description: "Photos in the “Skills in action” gallery on the Training page.",
    fields: [
      { name: "src", label: "Image", kind: "asset", required: true, wide: true },
      { name: "alt", label: "Description (alt text)", kind: "text", max: 200, wide: true },
      { name: "caption", label: "Caption", kind: "text", max: 200, wide: true },
      publishedField,
      orderField,
    ],
    filters: [],
    defaults: { src: "", alt: "", caption: "", published: true },
    title: (g) => g.caption || g.alt || "Untitled image",
    subtitle: (g) => (g.caption && g.alt ? g.alt : ""),
    thumb: (g) => g.src,
    publicUrl: () => "/training",
  },
  {
    key: "testimonials",
    label: "Testimonials",
    singular: "testimonial",
    description: "Client quotes on the Home and About pages, including ones submitted through the website.",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 100 },
      { name: "role", label: "Role", kind: "text", max: 100 },
      { name: "company", label: "Company", kind: "text", max: 100 },
      { name: "rating", label: "Rating", kind: "rating" },
      { name: "quote", label: "Quote", kind: "textarea", required: true, rows: 4, max: 600, wide: true },
      publishedField,
      orderField,
    ],
    filters: [
      {
        name: "source",
        label: "Source",
        options: [
          { value: "public", label: "Submitted on the website" },
          { value: "admin", label: "Added by the team" },
        ],
      },
    ],
    defaults: { name: "", role: "", company: "", rating: 5, quote: "", published: true },
    title: (t) => t.name,
    subtitle: (t) => [t.role, t.company].filter(Boolean).join(", "),
    publicUrl: () => "/about",
  },
  {
    key: "logos",
    label: "Logos",
    singular: "logo",
    description: "Client logos (“Trusted by”) and brand logos (“Brands we carry”).",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 100 },
      {
        name: "kind",
        label: "Shown as",
        kind: "select",
        required: true,
        options: [
          { value: "client", label: "Client (Trusted by)" },
          { value: "brand", label: "Brand (Brands we carry)" },
        ],
      },
      { name: "src", label: "Logo image", kind: "asset", required: true, wide: true },
      { name: "url", label: "Website", kind: "url", placeholder: "https://…", wide: true },
      publishedField,
      orderField,
    ],
    filters: [
      {
        name: "kind",
        label: "Kind",
        options: [
          { value: "client", label: "Clients" },
          { value: "brand", label: "Brands" },
        ],
      },
    ],
    defaults: { name: "", kind: "client", src: "", url: "", published: true },
    title: (l) => l.name,
    subtitle: (l) => (l.kind === "brand" ? "Brand" : "Client"),
    thumb: (l) => l.src,
    publicUrl: () => "/",
  },
  {
    key: "leaders",
    label: "Leadership",
    singular: "leader",
    description: "The leadership team on the About page.",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, max: 100 },
      { name: "role", label: "Role", kind: "text", required: true, max: 100 },
      { name: "qualification", label: "Qualification", kind: "text", max: 120 },
      { name: "image", label: "Photo", kind: "asset", required: true, wide: true },
      { name: "bio", label: "Short bio", kind: "textarea", rows: 4, max: 1000, wide: true },
      publishedField,
      orderField,
    ],
    filters: [],
    defaults: { name: "", role: "", qualification: "", image: "", bio: "", published: true },
    title: (l) => l.name,
    subtitle: (l) => l.role,
    thumb: (l) => l.image,
    publicUrl: () => "/about",
  },
];

export const resourceConfig = (key: string) => RESOURCES.find((r) => r.key === key);

/* ------------------------------------------------------------------ */
/* Form value <-> API payload                                          */
/* ------------------------------------------------------------------ */

/** Turns the editor's value for one field into what the API accepts; `undefined` = leave it out. */
export function toPayloadValue(field: FieldDef, value: any): any {
  switch (field.kind) {
    case "text":
    case "textarea": {
      const text = String(value ?? "").trim();
      return text === "" && field.required ? undefined : text;
    }
    case "slug":
    case "url": {
      const text = String(value ?? "").trim();
      return text === "" ? undefined : field.kind === "slug" ? text.toLowerCase() : text;
    }
    case "select":
    case "group":
    case "icon":
    case "asset":
      return String(value ?? "").trim() || undefined;
    case "boolean":
      return Boolean(value);
    case "number": {
      if (value === "" || value === null || value === undefined) return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
    }
    case "rating":
      return value ? Number(value) : undefined;
    case "image":
      return { src: String(value?.src ?? "").trim(), alt: String(value?.alt ?? "").trim() };
    case "gallery":
      return (value ?? []).map((img: any) => ({ src: String(img.src ?? "").trim(), alt: String(img.alt ?? "").trim() })).filter((img: any) => img.src);
    case "list":
      return (value ?? []).map((s: string) => String(s).trim()).filter(Boolean);
    case "pairs":
      return (value ?? [])
        .map((p: any) => ({ label: String(p.label ?? "").trim(), value: String(p.value ?? "").trim() }))
        .filter((p: any) => p.label && p.value);
    case "seo": {
      const seo = { title: String(value?.title ?? "").trim(), description: String(value?.description ?? "").trim() };
      return seo;
    }
  }
}

/** Editor state for an item (or the defaults for a new one). */
export function toFormValues(config: ResourceConfig, item: any | null): Record<string, any> {
  const values: Record<string, any> = { ...config.defaults };
  if (!item) return values;
  for (const field of config.fields) {
    const raw = item[field.name];
    if (raw === undefined || raw === null) continue;
    values[field.name] = field.kind === "seo" ? { title: raw.title ?? "", description: raw.description ?? "" } : raw;
  }
  return values;
}

/** Full payload for create, or only the changed fields for an update. */
export function buildPayload(config: ResourceConfig, values: Record<string, any>, original: Record<string, any> | null) {
  const payload: Record<string, any> = {};
  for (const field of config.fields) {
    const next = toPayloadValue(field, values[field.name]);
    if (next === undefined) continue;
    if (original) {
      const before = toPayloadValue(field, original[field.name]);
      if (JSON.stringify(before) === JSON.stringify(next)) continue;
    } else if (field.kind === "seo" && !next.title && !next.description) {
      continue;
    }
    payload[field.name] = next;
  }
  return payload;
}

/** Client-side required-field check, so obvious gaps don't need a round trip. */
export function missingRequired(config: ResourceConfig, values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of config.fields) {
    if (!field.required) continue;
    const value = values[field.name];
    const empty = field.kind === "image" ? !String(value?.src ?? "").trim() : !String(value ?? "").trim();
    if (empty) errors[field.name] = `${field.label} is required.`;
  }
  return errors;
}
