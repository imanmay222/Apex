import type { Metadata } from "next";
import { SurveyCard } from "@/components/cards";
import { EnquiryFormWithOptions } from "@/components/enquiry-section";
import { PageHero } from "@/components/page-hero";
import { Section, SectionHeading } from "@/components/ui";
import { getSurveys } from "@/server/data/public";

export const metadata: Metadata = {
  title: "Safety Surveys & Services",
  description:
    "On-site safety surveys from Apex Care Technologies: gas detection system design, SCBA servicing, calibration, respirator fit testing, height safety, LOTO and safety shower maintenance.",
};

export default async function SurveyPage() {
  const surveys = await getSurveys();

  return (
    <>
      <PageHero
        crumbs={[{ label: "Surveys" }]}
        eyebrow="On-site services"
        title="Custom safety survey solutions for every industry"
        lead="No two sites carry the same risk. We assess yours first — then specify, install, certify and maintain what actually fits."
        image={{ src: "/media/survey/survey-1.jpg", alt: "" }}
      />

      <Section>
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow={`${surveys.length} services`}
            title="What we survey and service"
            lead="Each engagement starts with a consultation and a walk of the site."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {surveys.map((survey) => (
              <div key={survey.slug} className="reveal">
                <SurveyCard survey={survey} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="surface" id="enquiry">
        <div className="shell shell-wide grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            align="left"
            eyebrow="Book a survey"
            title="Get in touch — your safety solutions await"
            lead="Tell us the site and the concern. We'll arrange a survey and come back with findings and recommendations."
          />
          <EnquiryFormWithOptions defaultType="survey" />
        </div>
      </Section>
    </>
  );
}
