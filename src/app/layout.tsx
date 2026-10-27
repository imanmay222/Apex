import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
