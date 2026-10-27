import type { Metadata } from "next";
import { ProductCard } from "@/components/cards";
import { ArrowRight, Download } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { ButtonLink, Section, SectionHeading } from "@/components/ui";
import { getCatalogue } from "@/server/data/public";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse Apex Care Technologies' industrial safety range: PPE, Dräger gas detection and respiratory systems, fire suppression, chemical protection and site safety equipment.",
};

const CATALOGUE_HREF = "/api/catalogue?from=/products";

export default async function ProductsPage() {
  const catalogue = await getCatalogue();
  const total = catalogue.reduce((sum, entry) => sum + entry.products.length, 0);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Products" }]}
        eyebrow="Our range"
        title="Premium industrial safety products"
        lead={`${total} categories across personal protection, detection, fire suppression and site safety — supplied in bulk to industries nationwide.`}
        image={{ src: "/media/products/head-production.png", alt: "" }}
      />

      {/* Category jump nav */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur-xl lg:top-20">
        <div className="shell shell-wide flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {catalogue.map(({ group }) => (
            <a
              key={group.key}
              href={`#${group.key}`}
              className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-safety-500 hover:text-safety-500"
            >
              {group.title}
            </a>
          ))}
          <a
            href={CATALOGUE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto hidden shrink-0 items-center gap-2 rounded-full bg-brand-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-900 sm:inline-flex"
          >
            <Download className="size-4" />
            Full catalogue
          </a>
        </div>
      </div>

      {catalogue.map(({ group, products }, index) => (
        <Section key={group.key} id={group.key} tone={index % 2 === 0 ? "base" : "surface"} className="scroll-mt-32">
          <div className="shell shell-wide">
            <SectionHeading
              align="left"
              eyebrow={`${products.length} ${products.length === 1 ? "category" : "categories"}`}
              title={group.title}
              lead={group.blurb}
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product, i) => (
                <div key={product.slug} className="reveal">
                  <ProductCard category={product} priority={index === 0 && i < 4} />
                </div>
              ))}
            </div>
          </div>
        </Section>
      ))}

      {/* Catalogue CTA */}
      <Section tone="brand">
        <div className="shell shell-wide flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <SectionHeading
              align="left"
              tone="light"
              eyebrow="Full catalogue"
              title="Need the complete product catalogue?"
              lead="Download the full range as a PDF, or send us your requirement and we'll shortlist what fits your site."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={CATALOGUE_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-safety-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-safety-500/25 transition-all hover:-translate-y-0.5 hover:bg-safety-600"
            >
              <Download className="size-4" />
              Download PDF
            </a>
            <ButtonLink href="/contact" variant="ghostLight" size="lg">
              Request a quote
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
