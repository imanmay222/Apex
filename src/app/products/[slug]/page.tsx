import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/cards";
import { EnquiryFormWithOptions } from "@/components/enquiry-section";
import { ArrowRight, Check, Download, Phone } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { PageHero } from "@/components/page-hero";
import { ButtonLink, Section, SectionHeading } from "@/components/ui";
import {
  getProductBySlug,
  getProductGroups,
  getRelatedProducts,
  getSiteSettings,
} from "@/server/data/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [product, site] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!product) return {};

  const description = product.seo?.description ?? `${product.summary} Supplied by ${site.companyName} to industries across India.`;
  const title = product.seo?.title ?? product.title;
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: `${title} | ${site.companyName}`, description, images: [{ url: product.image.src }] },
  };
}

const PROMISES = [
  "Selection guidance matched to your actual hazard and site conditions",
  "Bulk supply through our all-India network of business associates",
  "On-site survey available before you commit to a specification",
  "Operator training and demonstrations on the equipment we supply",
  "Ongoing servicing, calibration and spares where applicable",
];

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [site, groups, related] = await Promise.all([
    getSiteSettings(),
    getProductGroups(),
    getRelatedProducts(product.slug, product.group, 4),
  ]);
  const group = groups.find((g) => g.key === product.group);
  const phone = site.phones[0] ?? "";

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? product.summary,
    image: product.image.src,
    category: group?.title,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : { brand: { "@type": "Brand", name: site.companyName } }),
  };

  return (
    <>
      <JsonLd data={productSchema} />

      <PageHero
        crumbs={[{ label: "Products", href: "/products" }, { label: product.title }]}
        eyebrow={group?.title}
        title={product.title}
        lead={product.summary}
      />

      <Section>
        <div className="shell shell-wide grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-border bg-white p-8">
              <Image
                src={product.image.src}
                alt={product.image.alt || product.title}
                width={800}
                height={600}
                priority
                sizes="(min-width: 1024px) 45vw, 92vw"
                className="h-auto w-full object-contain"
              />
            </div>

            {product.gallery.length > 0 ? (
              <ul className="mt-3 grid grid-cols-4 gap-3">
                {product.gallery.map((image) => (
                  <li key={image.src} className="overflow-hidden rounded-xl border border-border bg-white p-2">
                    <Image src={image.src} alt={image.alt || product.title} width={200} height={150} className="h-auto w-full object-contain" />
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="#enquiry" size="lg">
                Request a quote
                <ArrowRight className="size-4" />
              </ButtonLink>
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  data-track="call"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-safety-500 hover:text-safety-500"
                >
                  <Phone className="size-4" />
                  {phone}
                </a>
              ) : null}
            </div>
          </div>

          <div>
            <SectionHeading align="left" title={`About ${product.title.toLowerCase()}`} />
            <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted">
              {product.description ??
                `${product.summary} We supply this range in bulk to plants, contractors and facilities across India, and can advise on selection based on the hazard, duty cycle and site conditions you're working with.`}
            </p>

            {product.features.length > 0 ? (
              <>
                <h3 className="font-display mt-10 text-lg font-semibold text-foreground">Key features</h3>
                <ul className="mt-4 space-y-3">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <Tick />
                      <span className="text-sm leading-relaxed text-muted">{feature}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {product.specs.length > 0 ? (
              <>
                <h3 className="font-display mt-10 text-lg font-semibold text-foreground">Specifications</h3>
                <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {product.specs.map((spec) => (
                    <div key={spec.label} className="grid grid-cols-[1fr_1.4fr] gap-4 px-4 py-3 text-sm">
                      <dt className="text-muted">{spec.label}</dt>
                      <dd className="font-medium text-foreground">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            <h3 className="font-display mt-10 text-lg font-semibold text-foreground">What you get with Apex Care</h3>
            <ul className="mt-4 space-y-3">
              {PROMISES.map((point) => (
                <li key={point} className="flex gap-3">
                  <Tick />
                  <span className="text-sm leading-relaxed text-muted">{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-display text-base font-semibold text-foreground">Looking for exact models and specifications?</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Detailed specifications for this range are listed in our product catalogue. For make, model and
                standards guidance, talk to our team.
              </p>
              <a
                href={`/api/catalogue?from=/products/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-safety-500 hover:underline"
              >
                <Download className="size-4" />
                Download the catalogue (PDF)
              </a>
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section tone="surface">
          <div className="shell shell-wide">
            <SectionHeading align="left" eyebrow="Related" title={`More in ${group?.title.toLowerCase() ?? "this range"}`} />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.slug} category={item} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      <Section id="enquiry" className="scroll-mt-24">
        <div className="shell shell-wide grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow="Enquiry"
            title={`Request a quote for ${product.title.toLowerCase()}`}
            lead="Tell us quantities, site conditions and timelines — we'll come back with a specification and price."
          />
          <EnquiryFormWithOptions defaultType="products" defaultSubject={product.slug} />
        </div>
      </Section>
    </>
  );
}

function Tick() {
  return (
    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-safety-500/15 text-safety-500">
      <Check className="size-3.5" />
    </span>
  );
}
