import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { QuoteCheckout } from "@/components/quote/quote-checkout";
import { Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Quote basket",
  description: "Send the products and quantities you need; Apex Care Technologies replies with a quote and availability.",
  robots: { index: false, follow: true },
};

export default function QuotePage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Products", href: "/products" }, { label: "Quote basket" }]}
        eyebrow="Order for quote"
        title="Your quote basket"
        lead="Collect the products you need, tell us where to deliver, and we'll reply with prices and availability. No payment online."
      />
      <Section>
        <div className="shell shell-wide">
          <QuoteCheckout />
        </div>
      </Section>
    </>
  );
}
