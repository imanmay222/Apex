import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { JsonLd } from "@/components/json-ld";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteSettings } from "@/server/data/public";
import "./globals.css";

// Pages read live content from MongoDB (cached + tag-invalidated), so they render per request.
// This also keeps `next build` independent of a running database.
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

const siteUrl = process.env.PUBLIC_SITE_URL ?? "https://apexcaretechnologies.com";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const title = `${site.companyName} — ${site.tagline}`;

  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s | ${site.companyName}` },
    description: site.description,
    openGraph: { type: "website", siteName: site.companyName, locale: "en_IN", title, description: site.description },
    twitter: { card: "summary_large_image", title, description: site.description },
    icons: { icon: "/media/favicon-bg.png" },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <JsonLd data={organizationSchema} />
        <SiteHeader companyName={site.companyName} phone={site.phones[0] ?? ""} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <MobileActionBar />
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
