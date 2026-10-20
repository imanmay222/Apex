import type { Metadata } from "next";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { LogoMarquee } from "@/components/marquee";
import { PageHero } from "@/components/page-hero";
import { TestimonialForm } from "@/components/testimonial-form";
import { TestimonialRail } from "@/components/testimonials";
import { ButtonLink, Section, SectionHeading } from "@/components/ui";
import { ArrowRight } from "@/components/icons";
import {
  getLeaders,
  getLogos,
  getSiteSettings,
  getTestimonials,
} from "@/server/data/public";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Apex Care Technologies is a Cuddalore-based manufacturer and supplier of fire, safety, welding and hardware equipment, serving industries across India since 2022.",
};

export default async function AboutPage() {
  const [site, leadership, brandLogos, clientLogos, testimonials] = await Promise.all([
    getSiteSettings(),
    getLeaders(),
    getLogos("brand"),
    getLogos("client"),
    getTestimonials(),
  ]);
  const aboutCopy = site.about;
  const valuePillars = site.valuePillars;

  return (
    <>
      <PageHero
        crumbs={[{ label: "About" }]}
        eyebrow="Who we are"
        title="Leading the way in safety and innovation"
        lead={`Founded in ${site.foundedYear} in ${site.address.city}, Tamil Nadu — supplying, surveying and servicing industrial safety equipment across India.`}
        image={{ src: "/media/about/fire-fighters.png", alt: "" }}
      />

      <Section>
        <div className="shell shell-wide grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-3xl border border-border reveal">
            <Image
              src="/media/about/about-img.png"
              alt="Apex Care Technologies product range"
              width={900}
              height={700}
              priority
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <SectionHeading
              align="left"
              eyebrow="Our story"
              title="Explore the best safety products"
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              <p>{aboutCopy.intro}</p>
              <p>{aboutCopy.network}</p>
            </div>
            <ButtonLink href="/products" variant="brand" size="lg" className="mt-8">
              See our products
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* Leadership */}
      <Section tone="surface">
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="Leadership"
            title="The people behind Apex Care"
            lead="Technical depth in safety engineering, paired with a hands-on approach to quality."
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {leadership.map((person) => (
              <div
                key={person.id}
                className="reveal overflow-hidden rounded-2xl border border-border bg-surface-raised text-center"
              >
                <div className="relative aspect-square bg-brand-950/5">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    sizes="(min-width: 640px) 30vw, 90vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {person.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">{person.qualification}</p>
                  <p className="mt-2 text-sm font-semibold text-safety-500">{person.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section tone="brand" className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-24 -left-24 size-96 rounded-full bg-safety-500/15 blur-3xl"
        />
        <div className="shell shell-wide relative">
          <SectionHeading
            tone="light"
            eyebrow="What drives us"
            title="Safety, excellence and innovation"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {valuePillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-safety-500/40 hover:bg-white/[0.07]"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-xl bg-safety-500/15 text-safety-400">
                  <Icon name={pillar.icon} className="size-6" />
                </span>
                <h3 className="font-display mt-4 text-lg font-semibold text-white">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{pillar.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Brands + clients */}
      <Section>
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="Our partners"
            title="Brands we carry"
            lead="We supply equipment from established manufacturers in the safety industry."
          />
          <div className="mt-12">
            <LogoMarquee logos={brandLogos} duration={35} invertOnDark />
          </div>

          <p className="mt-16 text-center text-sm font-semibold tracking-wider text-muted uppercase">
            Trusted by
          </p>
          <div className="mt-6">
            <LogoMarquee logos={clientLogos} duration={50} invertOnDark />
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <div className="shell shell-wide">
          <SectionHeading eyebrow="Testimonials" title="What our clients say" />
          <div className="mt-12">
            <TestimonialRail items={testimonials} />
          </div>
        </div>
      </Section>

      <Section>
        <div className="shell mx-auto max-w-2xl">
          <TestimonialForm />
        </div>
      </Section>
    </>
  );
}
