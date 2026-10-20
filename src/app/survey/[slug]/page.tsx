import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryFormWithOptions } from "@/components/enquiry-section";
import { JsonLd } from "@/components/json-ld";
import { ArrowRight, Phone } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { ButtonLink, Section, SectionHeading } from "@/components/ui";
import { getSiteSettings, getSurveyBySlug, getSurveys } from "@/server/data/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [survey, site] = await Promise.all([getSurveyBySlug(slug), getSiteSettings()]);
  if (!survey) return {};

  const description = survey.seo?.description ?? `${survey.description.slice(0, 155).trimEnd()}…`;
  const title = survey.seo?.title ?? survey.title;
  return {
    title,
    description,
    alternates: { canonical: `/survey/${survey.slug}` },
    openGraph: { title: `${title} | ${site.companyName}`, description, images: [{ url: survey.image.src }] },
  };
}

export default async function SurveyDetailPage({ params }: Params) {
  const { slug } = await params;
  const survey = await getSurveyBySlug(slug);
  if (!survey) notFound();

  const [site, surveys] = await Promise.all([getSiteSettings(), getSurveys()]);
  const others = surveys.filter((s) => s.slug !== survey.slug).slice(0, 4);
  const phone = site.phones[0] ?? "";

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: survey.title,
    description: survey.description,
    provider: { "@type": "Organization", name: site.companyName },
    areaServed: "IN",
  };

  return (
    <>
      <JsonLd data={serviceSchema} />

      <PageHero
        crumbs={[{ label: "Surveys", href: "/survey" }, { label: survey.shortTitle ?? survey.title }]}
        eyebrow="On-site service"
        title={survey.title}
        image={{ src: survey.image.src, alt: "" }}
      />

      <Section>
        <div className="shell shell-wide grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <article>
            <div className="overflow-hidden rounded-3xl border border-border">
              <Image
                src={survey.image.src}
                alt={survey.image.alt}
                width={1000}
                height={620}
                priority
                sizes="(min-width: 1024px) 58vw, 92vw"
                className="h-auto w-full object-cover"
              />
            </div>

            <p className="mt-8 text-lg leading-relaxed text-pretty text-muted">
              {survey.description}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="#enquiry" size="lg">
                Book this survey
                <ArrowRight className="size-4" />
              </ButtonLink>
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                data-track="call"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-safety-500 hover:text-safety-500"
              >
                <Phone className="size-4" />
                Talk to our team
              </a>
            </div>
          </article>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-display text-base font-semibold text-foreground">
                Other services
              </h2>
              <ul className="mt-4 space-y-1">
                {others.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/survey/${item.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-background hover:text-foreground"
                    >
                      {item.shortTitle ?? item.title}
                      <ArrowRight className="size-4 shrink-0 text-safety-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/survey"
                className="mt-4 inline-flex items-center gap-1.5 px-3 text-sm font-semibold text-safety-500 hover:underline"
              >
                All {surveys.length} services
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>
        </div>
      </Section>

      <Section tone="surface" id="enquiry" className="scroll-mt-24">
        <div className="shell shell-wide grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow="Enquiry"
            title={`Book a ${(survey.shortTitle ?? survey.title).toLowerCase()} survey`}
            lead="Tell us about the site and we'll arrange an assessment."
          />
          <EnquiryFormWithOptions defaultType="survey" defaultSubject={survey.slug} />
        </div>
      </Section>
    </>
  );
}
