import Image from "next/image";
import Link from "next/link";
import type { SiteSettings, SiteStats } from "@/lib/types";
import { ProductCard, SurveyCard, TrainingCard } from "@/components/cards";
import { EnquiryFormWithOptions } from "@/components/enquiry-section";
import { ArrowRight, Icon, ShieldCheck } from "@/components/icons";
import { LogoMarquee } from "@/components/marquee";
import { TestimonialRail } from "@/components/testimonials";
import { ButtonLink, Section, SectionHeading, buttonClass } from "@/components/ui";
import {
  getLogos,
  getProducts,
  getSiteSettings,
  getSiteStats,
  getSurveys,
  getTestimonials,
  getTrainingPrograms,
} from "@/server/data/public";

export default async function HomePage() {
  const [site, stats, products, allSurveys, trainingPrograms, clientLogos, brandLogos, testimonials] = await Promise.all([
    getSiteSettings(),
    getSiteStats(),
    getProducts(),
    getSurveys(),
    getTrainingPrograms(),
    getLogos("client"),
    getLogos("brand"),
    getTestimonials(),
  ]);

  const featuredCategories = products.filter((product) => product.featured).slice(0, 8);
  const featuredSurveys = allSurveys.filter((survey) => survey.featured).slice(0, 3);
  const aboutCopy = site.about;
  const differentiators = site.differentiators;

  return (
    <>
      <Hero site={site} />
      <TrustStrip stats={stats} />

      {/* Products */}
      <Section tone="surface">
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="What we supply"
            title="Industrial safety equipment, head to toe"
            lead="Personal protective equipment, gas detection, fire suppression and site safety — sourced, specified and delivered across India."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCategories.map((category, i) => (
              <div key={category.slug} className="reveal">
                <ProductCard category={category} priority={i < 4} />
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <ButtonLink href="/products" variant="outline" size="lg">
              Browse all {stats.products} categories
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* About */}
      <Section>
        <div className="shell shell-wide grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative reveal">
            <div className="relative overflow-hidden rounded-3xl border border-border">
              <Image
                src="/media/about/about-img.png"
                alt="Apex Care Technologies safety equipment range"
                width={900}
                height={700}
                sizes="(min-width: 1024px) 45vw, 92vw"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-2 hidden rounded-2xl border border-border bg-surface-raised p-5 shadow-xl sm:block lg:-right-6">
              <p className="font-display text-3xl font-semibold text-safety-500">
                {stats.yearsInBusiness}+
              </p>
              <p className="mt-1 text-sm text-muted">
                years serving
                <br />
                Indian industry
              </p>
            </div>
          </div>

          <div>
            <SectionHeading
              align="left"
              eyebrow="Who we are"
              title="Safety equipment, specified by people who know the plant floor"
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              <p>{aboutCopy.intro}</p>
              <p>{aboutCopy.network}</p>
            </div>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {differentiators.map((item) => (
                <li
                  key={item.title}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-800/10 text-brand-800 dark:bg-brand-400/15 dark:text-brand-300">
                    <Icon name={item.icon} className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                </li>
              ))}
            </ul>

            <ButtonLink href="/about" variant="brand" size="lg" className="mt-8">
              More about us
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* Surveys */}
      <Section tone="surface">
        <div className="shell shell-wide">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              align="left"
              eyebrow="On-site services"
              title="Surveys, calibration and servicing"
              lead="We assess the site before we specify the kit — then keep it certified and working."
            />
            <Link
              href="/survey"
              className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-safety-500 hover:underline sm:inline-flex"
            >
              All {allSurveys.length} services
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredSurveys.map((survey) => (
              <div key={survey.slug} className="reveal">
                <SurveyCard survey={survey} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center sm:hidden">
            <ButtonLink href="/survey" variant="outline">
              All {allSurveys.length} services
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* Training */}
      <Section tone="brand" className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 -right-24 size-96 rounded-full bg-safety-500/15 blur-3xl"
        />
        <div className="shell shell-wide relative">
          <SectionHeading
            tone="light"
            eyebrow="Training & demos"
            title="We train your people on the equipment we supply"
            lead="Hands-on sessions run at your site — drills, demonstrations and the practical detail that makes safety gear actually get used."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {trainingPrograms.slice(0, 10).map((program) => (
              <TrainingCard key={program.slug} program={program} />
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Link href="/training" className={buttonClass({ size: "lg" })}>
              See training & gallery
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* Clients + brands */}
      <Section>
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="Trusted by"
            title="Partners in safety"
            lead="Industrial clients across Tamil Nadu and beyond rely on us to keep their people protected."
          />
          <div className="mt-12">
            <LogoMarquee logos={clientLogos} duration={50} invertOnDark />
          </div>

          <p className="mt-16 text-center text-sm font-semibold tracking-wider text-muted uppercase">
            Brands we carry
          </p>
          <div className="mt-6">
            <LogoMarquee logos={brandLogos} duration={35} invertOnDark />
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      <Section tone="surface">
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="Testimonials"
            title="What our clients say"
          />
          <div className="mt-12">
            <TestimonialRail items={testimonials} />
          </div>
        </div>
      </Section>

      {/* Enquiry */}
      <Section id="enquiry">
        <div className="shell shell-wide grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              align="left"
              eyebrow="Get in touch"
              title="Your safety solutions await"
              lead="Send us the requirement and we'll respond with a specification, availability and pricing."
            />

            <div className="mt-8 overflow-hidden rounded-2xl border border-border">
              <Image
                src="/media/home/enquiry.jpg"
                alt="Apex Care Technologies team"
                width={900}
                height={600}
                sizes="(min-width: 1024px) 45vw, 92vw"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <EnquiryFormWithOptions />
        </div>
      </Section>
    </>
  );
}

function Hero({ site }: { site: SiteSettings }) {
  return (
    <section className="relative isolate flex min-h-[38rem] items-center overflow-hidden bg-brand-950 lg:min-h-[44rem]">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/media/about/about-img.png"
        className="absolute inset-0 -z-10 size-full object-cover opacity-45"
      >
        <source src="/media/video/banner.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-950 via-brand-950/85 to-brand-950/40"
      />

      <div className="shell shell-wide py-20 lg:py-28">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wider text-white/80 uppercase backdrop-blur-sm">
            <ShieldCheck className="size-4 text-safety-400" />
            {site.home.heroBadge}
          </span>

          <h1 className="font-display mt-6 text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl lg:leading-[1.05]">
            {site.home.heroTitle}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/70">
            {site.home.heroLead}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/products" size="lg">
              Explore products
              <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/contact" variant="ghostLight" size="lg">
              Request a quote
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip({ stats }: { stats: SiteStats }) {
  const items = [
    { value: `${stats.products}+`, label: "Product categories" },
    { value: `${stats.surveys}`, label: "On-site survey services" },
    { value: `${stats.training}`, label: "Training programmes" },
    { value: `${stats.team}`, label: "Safety professionals" },
  ];

  return (
    <div className="border-b border-border bg-surface">
      <div className="shell shell-wide grid grid-cols-2 gap-6 py-10 lg:grid-cols-4">
        {items.map((stat) => (
          <div key={stat.label} className="text-center lg:text-left">
            <p className="font-display text-3xl font-semibold text-brand-800 sm:text-4xl dark:text-brand-300">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
