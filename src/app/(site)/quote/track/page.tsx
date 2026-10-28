import type { Metadata } from "next";
import { EnquiryTracker } from "@/components/enquiry-tracker";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the progress of an Apex Care Technologies order or enquiry with its reference number.",
  alternates: { canonical: "/quote/track" },
};

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const raw = (await searchParams).ref;
  const ref = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return (
    <>
      <PageHero
        crumbs={[{ label: "Quote basket", href: "/quote" }, { label: "Track your order" }]}
        eyebrow="Order status"
        title="Track your order"
        lead="Enter the reference from your confirmation and the mobile number you ordered with."
      />
      <Section>
        <div className="shell max-w-3xl">
          <EnquiryTracker title="Track your order" initialReference={/^(ORD|ENQ)-\d{4}-\d{6}$/i.test(ref) ? ref.toUpperCase() : ""} />
        </div>
      </Section>
    </>
  );
}
