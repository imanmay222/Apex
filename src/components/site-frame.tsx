import type { ReactNode } from "react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { JsonLd } from "@/components/json-ld";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteSettings } from "@/server/data/public";

const siteUrl = process.env.PUBLIC_SITE_URL ?? "https://apexcaretechnologies.com";

/**
 * The public website's chrome (header, footer, mobile action bar, analytics, Organization
 * JSON-LD). Shared by the `(site)` layout and the root 404 page; the admin panel has its own.
 */
export async function SiteFrame({ children }: { children: ReactNode }) {
  const site = await getSiteSettings();
  const { address } = site;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.companyName,
    url: siteUrl,
    logo: `${siteUrl}/media/navbrand.png`,
    description: site.description,
    foundingDate: String(site.foundedYear),
    telephone: site.phones,
    ...(site.emails.length ? { email: site.emails[0] } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: `${address.street}, ${address.locality}`,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.postalCode,
      addressCountry: "IN",
    },
    sameAs: [site.social.facebook, site.social.instagram].filter(Boolean),
  };

  return (
    <>
      <JsonLd data={organizationSchema} />
      <SiteHeader companyName={site.companyName} phone={site.phones[0] ?? ""} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <MobileActionBar />
      <AnalyticsBeacon />
    </>
  );
}
