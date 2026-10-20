import Image from "next/image";
import Link from "next/link";
import { getProducts, getSiteSettings } from "@/server/data/public";
import { ArrowRight, Facebook, Instagram, Mail, MapPin, Phone, WhatsApp } from "./icons";
import { NewsletterForm } from "./newsletter-form";
import { buttonClass } from "./ui";

const companyLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/products", label: "Products" },
  { href: "/survey", label: "Surveys" },
  { href: "/training", label: "Training & Demos" },
  { href: "/contact", label: "Contact us" },
];

export async function SiteFooter() {
  const [site, productCategories] = await Promise.all([getSiteSettings(), getProducts()]);
  const year = new Date().getFullYear();
  const footerCategories = productCategories.slice(0, 8);
  const { address } = site;

  return (
    <footer className="bg-brand-950 text-white/70">
      {/* CTA band */}
      <div className="border-b border-white/10">
        <div className="shell shell-wide flex flex-col items-start gap-6 py-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold text-white text-balance sm:text-3xl">
              Need the right safety equipment for your site?
            </h2>
            <p className="mt-2 text-white/60">
              Tell us the hazard and the headcount — we&apos;ll specify what fits and quote it.
            </p>
          </div>
          <Link href="/contact" className={buttonClass({ size: "lg" })}>
            Request a quote
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="shell shell-wide grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:py-16">
        <div className="lg:col-span-1">
          <Image
            src="/media/navbrand.png"
            alt={site.companyName}
            width={190}
            height={48}
            className="h-11 w-auto brightness-0 invert"
          />
          <p className="mt-5 text-sm leading-relaxed">{site.tagline}.</p>

          <address className="mt-5 space-y-3 text-sm not-italic">
            <a
              href={site.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 transition-colors hover:text-white"
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-safety-500" />
              <span>
                {address.street}, {address.locality},<br />
                {address.city}, {address.state} — {address.postalCode}
              </span>
            </a>
            {site.phones.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 transition-colors hover:text-white"
              >
                <Phone className="size-4 shrink-0 text-safety-500" />
                {phone}
              </a>
            ))}
            {site.emails.slice(0, 2).map((emailAddress) => (
              <a
                key={emailAddress}
                href={`mailto:${emailAddress}`}
                className="flex items-center gap-3 break-all transition-colors hover:text-white"
              >
                <Mail className="size-4 shrink-0 text-safety-500" />
                {emailAddress}
              </a>
            ))}
          </address>

          <div className="mt-6 flex gap-2">
            <SocialLink href={site.social.whatsapp} label="WhatsApp">
              <WhatsApp className="size-4" />
            </SocialLink>
            <SocialLink href={site.social.facebook} label="Facebook">
              <Facebook className="size-4" />
            </SocialLink>
            <SocialLink href={site.social.instagram} label="Instagram">
              <Instagram className="size-4" />
            </SocialLink>
            <SocialLink href={site.mapsLink} label="Find us on Google Maps">
              <MapPin className="size-4" />
            </SocialLink>
          </div>
        </div>

        <FooterColumn title="Company">
          {companyLinks.map((link) => (
            <FooterLink key={link.href} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Products">
          {footerCategories.map((category) => (
            <FooterLink key={category.slug} href={`/products/${category.slug}`}>
              {category.title}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Registrations">
          {site.certificates.map((cert) => (
            <li key={cert.label} className="text-sm">
              <span className="block text-xs tracking-wide text-white/40 uppercase">
                {cert.label}
              </span>
              <span className="font-medium text-white/80">{cert.value}</span>
            </li>
          ))}
          <li className="pt-2 text-sm">
            <span className="block text-xs tracking-wide text-white/40 uppercase">
              Established
            </span>
            <span className="font-medium text-white/80">{site.foundedYear}</span>
          </li>
        </FooterColumn>
      </div>

      <div className="border-t border-white/10">
        <div className="shell shell-wide relative py-8">
          <div className="max-w-md">
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell shell-wide flex flex-col gap-2 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.companyName}. All rights reserved.
          </p>
          <p className="text-white/40">
            {address.city}, {address.state}, {address.country}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-wider text-white uppercase">{title}</h3>
      <ul className="mt-5 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm transition-colors hover:text-safety-500">
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 transition-all hover:-translate-y-0.5 hover:border-safety-500 hover:bg-safety-500 hover:text-white"
    >
      {children}
    </a>
  );
}
