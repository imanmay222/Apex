import type { Metadata } from "next";
import { EnquiryFormWithOptions } from "@/components/enquiry-section";
import { EnquiryTracker } from "@/components/enquiry-tracker";
import { Clock, Mail, MapPin, Phone, WhatsApp } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { Section, SectionHeading } from "@/components/ui";
import { getSiteSettings } from "@/server/data/public";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: "Contact Us",
    description: `Contact ${site.companyName} in ${site.address.city}, ${site.address.state} — call ${site.phones[0]} or send an enquiry for industrial safety equipment, surveys and training.`,
  };
}

export default async function ContactPage() {
  const site = await getSiteSettings();
  const { address } = site;
  const fullAddress = `${address.street}, ${address.locality}, ${address.city}, ${address.state}, ${address.country} — ${address.postalCode}`;

  return (
    <>
      <PageHero
        crumbs={[{ label: "Contact" }]}
        eyebrow="Get in touch"
        title="Talk to our safety team"
        lead="Call us, message us on WhatsApp, or send an enquiry — we'll respond with a specification and a price."
      />

      <Section>
        <div className="shell shell-wide grid items-start gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading align="left" eyebrow="Reach us" title="Contact details" />

            <div className="mt-8 space-y-4">
              <ContactCard icon={<Phone className="size-5" />} title="Call us">
                <div className="space-y-1.5">
                  {site.phones.map((phone) => (
                    <a
                      key={phone}
                      data-track="call"
                      href={`tel:${phone.replace(/\s/g, "")}`}
                      className="block font-medium text-foreground transition-colors hover:text-safety-500"
                    >
                      {phone}
                    </a>
                  ))}
                  <a
                    href={`tel:${site.landline.replace(/[\s-]/g, "")}`}
                    className="block text-sm text-muted transition-colors hover:text-safety-500"
                  >
                    Landline: {site.landline}
                  </a>
                </div>
              </ContactCard>

              {site.emails.length > 0 ? (
                <ContactCard icon={<Mail className="size-5" />} title="Email us">
                  <div className="space-y-1.5">
                    {site.emails.map((address) => (
                      <a
                        key={address}
                        href={`mailto:${address}`}
                        data-track="email"
                        className="block break-all font-medium text-foreground transition-colors hover:text-safety-500"
                      >
                        {address}
                      </a>
                    ))}
                  </div>
                </ContactCard>
              ) : null}

              <ContactCard icon={<WhatsApp className="size-5" />} title="WhatsApp">
                <a
                  href={site.social.whatsapp}
                  data-track="whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground transition-colors hover:text-safety-500"
                >
                  Message us on WhatsApp
                </a>
                <p className="mt-1 text-sm text-muted">
                  Fastest way to reach the team during working hours.
                </p>
              </ContactCard>

              <ContactCard icon={<MapPin className="size-5" />} title="Visit us">
                <a
                  href={site.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm leading-relaxed text-muted transition-colors hover:text-safety-500"
                >
                  {fullAddress}
                </a>
              </ContactCard>

              <ContactCard icon={<Clock className="size-5" />} title="Registrations">
                <dl className="space-y-2">
                  {site.certificates.map((cert) => (
                    <div key={cert.label} className="flex justify-between gap-4 text-sm">
                      <dt className="text-muted">{cert.label}</dt>
                      <dd className="font-medium text-foreground">{cert.value}</dd>
                    </div>
                  ))}
                </dl>
              </ContactCard>
            </div>
          </div>

          <EnquiryFormWithOptions />
        </div>
      </Section>

      <Section tone="surface" id="track" className="scroll-mt-24">
        <div className="shell mx-auto max-w-3xl">
          <EnquiryTracker />
        </div>
      </Section>

      <Section tone="surface" className="!pb-0">
        <div className="shell shell-wide">
          <SectionHeading
            eyebrow="Find us"
            title={`${address.city}, ${address.state}`}
            lead="Our warehouse and office, serving clients across India."
          />
        </div>
        <div className="mt-12 h-[26rem] w-full overflow-hidden border-t border-border">
          <iframe
            src={site.mapEmbedSrc}
            title={`Map showing ${site.companyName} in ${address.city}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="size-full grayscale-25"
          />
        </div>
      </Section>
    </>
  );
}

function ContactCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-surface-raised p-5">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-safety-500/10 text-safety-500">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
          {title}
        </h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
