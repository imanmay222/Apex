import type { Metadata } from "next";
import Image from "next/image";
import { TrainingCard } from "@/components/cards";
import { EnquiryFormWithOptions } from "@/components/enquiry-section";
import { Gallery } from "@/components/gallery";
import { PageHero } from "@/components/page-hero";
import { Section, SectionHeading } from "@/components/ui";
import { getGallery, getTrainingPrograms } from "@/server/data/public";

export const metadata: Metadata = {
  title: "Training & Demos",
  description:
    "Hands-on industrial safety training from Apex Care Technologies: PAPR and SCBA, lockout tagout, forklift and crane safety, first aid, fire and emergency response, mock drills and chemical safety.",
};

export default async function TrainingPage() {
  const [trainingPrograms, trainingGallery] = await Promise.all([getTrainingPrograms(), getGallery()]);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Training & Demos" }]}
        eyebrow="Skill development"
        title="Training & demos that make safety gear get used"
        lead="Classroom sessions and hands-on demonstrations run at your site — covering procedure, equipment handling and emergency preparedness."
        image={{ src: "/media/training/gallery-2.jpeg", alt: "" }}
      />

      <Section>
        <div className="shell shell-wide grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-3xl border border-border reveal">
            <Image
              src="/media/training/img-1.jpg"
              alt="Apex Care Technologies safety training in progress"
              width={900}
              height={650}
              priority
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <SectionHeading
              align="left"
              eyebrow="Our approach"
              title="Skill development & safety training"
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              <p>
                We run a range of programmes designed to improve workplace safety,
                operational readiness and compliance — covering safety procedures,
                emergency preparedness, equipment handling and the correct use of
                protective gear.
              </p>
              <p>
                Sessions combine practical insight with hands-on demonstrations, so
                participants leave knowing not just what the equipment is, but how to
                wear, check and rely on it when it matters.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="brand" className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -bottom-32 -left-24 size-96 rounded-full bg-safety-500/15 blur-3xl"
        />
        <div className="shell shell-wide relative">
          <SectionHeading
            tone="light"
            eyebrow={`${trainingPrograms.length} programmes`}
            title="Mastering safety & operational excellence"
            lead="Each programme can be run standalone or combined into a site-wide safety schedule."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trainingPrograms.map((program) => (
              <TrainingCard key={program.slug} program={program} />
            ))}
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="Gallery"
            title="Skills in action"
            lead="Moments from training sessions and demonstrations run on client sites."
          />
          <div className="mt-12">
            <Gallery images={trainingGallery} />
          </div>
        </div>
      </Section>

      <Section id="enquiry">
        <div className="shell shell-wide grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow="Book training"
            title="Schedule a session for your team"
            lead="Tell us the programme, headcount and preferred dates — we'll put together a plan."
          />
          <EnquiryFormWithOptions defaultType="training" />
        </div>
      </Section>
    </>
  );
}
