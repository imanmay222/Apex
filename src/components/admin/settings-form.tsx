"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- settings sections share one generic diff */

import { useState, type ReactNode } from "react";
import type { AdminSiteSettings } from "@/lib/types";
import { Download } from "../icons";
import { cx } from "../ui";
import { AdminApiError, adminApi, errorMessage, useAdminQuery } from "./api";
import { AssetInput, IconSelect, ListEditor, PairList, StringList } from "./fields";
import { Button, Card, ErrorNotice, Field, Loading, PageHeader, btn, inputClass, useToast } from "./ui";

type Settings = AdminSiteSettings;
type Key = keyof Settings;

const SECTIONS: { id: string; title: string; keys: Key[] }[] = [
  { id: "company", title: "Company", keys: ["companyName", "legalName", "tagline", "description", "foundedYear", "teamSize"] },
  { id: "contact", title: "Contact details", keys: ["phones", "landline", "whatsapp", "emails"] },
  { id: "address", title: "Address & map", keys: ["address", "mapsLink", "mapEmbedSrc"] },
  { id: "social", title: "Social links", keys: ["social"] },
  { id: "registrations", title: "Registrations", keys: ["certificates"] },
  { id: "home", title: "Home page banner", keys: ["home"] },
  { id: "about", title: "About text", keys: ["about"] },
  { id: "differentiators", title: "Why choose us", keys: ["differentiators"] },
  { id: "pillars", title: "Values (About page)", keys: ["valuePillars"] },
  { id: "catalogue", title: "Product catalogue", keys: ["catalogue"] },
  { id: "notifications", title: "Enquiry notifications", keys: ["notifications"] },
];

/** Normalises list values the way the API wants them (trimmed, empty rows dropped). */
function clean(key: Key, value: any): any {
  switch (key) {
    case "phones":
    case "emails":
      return (value as string[]).map((s) => s.trim()).filter(Boolean);
    case "certificates":
      return (value as { label: string; value: string }[]).map((c) => ({ label: c.label.trim(), value: c.value.trim() })).filter((c) => c.label && c.value);
    case "valuePillars":
      return (value as any[]).map((p) => ({ title: p.title.trim(), icon: p.icon, text: p.text.trim() })).filter((p) => p.title);
    case "differentiators":
      return (value as any[]).map((d) => ({ title: d.title.trim(), icon: d.icon })).filter((d) => d.title);
    case "notifications":
      return { salesEmails: (value.salesEmails as string[]).map((s) => s.trim()).filter(Boolean) };
    case "foundedYear":
    case "teamSize":
      return Number(value);
    default:
      return typeof value === "string" ? value.trim() : value;
  }
}

/** Only what changed: nested objects are diffed field by field, lists and scalars are sent whole. */
function sectionPatch(keys: Key[], values: Settings, original: Settings) {
  const patch: Record<string, any> = {};
  for (const key of keys) {
    const next = clean(key, values[key]);
    const before = clean(key, original[key]);
    if (next && typeof next === "object" && !Array.isArray(next)) {
      const sub: Record<string, any> = {};
      for (const [field, value] of Object.entries(next)) {
        const v = typeof value === "string" ? value.trim() : value;
        if (JSON.stringify(v) !== JSON.stringify(before?.[field])) sub[field] = v;
      }
      if (Object.keys(sub).length) patch[key] = sub;
    } else if (JSON.stringify(next) !== JSON.stringify(before)) {
      patch[key] = next;
    }
  }
  return patch;
}

export function SettingsForm({ canUseMedia }: { canUseMedia: boolean }) {
  const { data, error, loading, reload } = useAdminQuery<Settings>("/api/admin/settings");
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;
  return <Editor initial={data} canUseMedia={canUseMedia} />;
}

function Editor({ initial, canUseMedia }: { initial: Settings; canUseMedia: boolean }) {
  const toast = useToast();
  const [original, setOriginal] = useState(initial);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const set = <K extends Key>(key: K, value: Settings[K]) => setValues((v) => ({ ...v, [key]: value }));
  const setIn = <K extends Key>(key: K, field: string, value: unknown) => setValues((v) => ({ ...v, [key]: { ...(v[key] as object), [field]: value } }));

  async function save(section: (typeof SECTIONS)[number]) {
    const patch = sectionPatch(section.keys, values, original);
    if (!Object.keys(patch).length) {
      toast("No changes to save.");
      return;
    }
    setSaving(section.id);
    setErrors((e) => ({ ...e, [section.id]: [] }));
    try {
      const updated = await adminApi.patch<Settings>("/api/admin/settings", patch);
      setOriginal(updated);
      // Keep unsaved edits in other sections; take the server's version of this one.
      setValues((v) => {
        const next = { ...v };
        for (const key of section.keys) (next as any)[key] = updated[key];
        return next;
      });
      toast(`${section.title} saved — the website is updated.`);
    } catch (err) {
      const messages = err instanceof AdminApiError && err.issues.length ? err.issues.map((i) => `${i.path}: ${i.message}`) : [errorMessage(err)];
      setErrors((e) => ({ ...e, [section.id]: messages }));
    } finally {
      setSaving(null);
    }
  }

  const dirty = (id: string) => Object.keys(sectionPatch(SECTIONS.find((s) => s.id === id)!.keys, values, original)).length > 0;

  const section = (id: string, children: ReactNode, description?: ReactNode) => {
    const def = SECTIONS.find((s) => s.id === id)!;
    const isDirty = dirty(id);
    return (
      <Card
        key={id}
        title={
          <span id={`settings-${id}`} className="scroll-mt-24">
            {def.title}
            {isDirty ? <span className="ml-2 text-xs font-normal text-safety-500">Unsaved changes</span> : null}
          </span>
        }
        actions={
          <Button size="sm" variant={isDirty ? "primary" : "secondary"} busy={saving === id} disabled={!isDirty} onClick={() => save(def)}>
            Save
          </Button>
        }
      >
        {description ? <p className="-mt-1 mb-4 text-sm text-muted">{description}</p> : null}
        {errors[id]?.length ? (
          <div className="mb-4">
            <ErrorNotice error={errors[id].join(" · ")} />
          </div>
        ) : null}
        {children}
      </Card>
    );
  };

  const text = (key: Key, label: string, opts: { hint?: string; max?: number; className?: string; type?: string } = {}) => (
    <Field label={label} htmlFor={`s-${key}`} hint={opts.hint} className={opts.className}>
      <input id={`s-${key}`} type={opts.type ?? "text"} value={String(values[key] ?? "")} maxLength={opts.max} onChange={(e) => set(key, e.target.value as never)} className={inputClass} />
    </Field>
  );

  const nested = (key: Key, field: string, label: string, opts: { hint?: string; max?: number; textarea?: boolean; className?: string; placeholder?: string } = {}) => {
    const value = String((values[key] as any)?.[field] ?? "");
    return (
      <Field label={label} htmlFor={`s-${key}-${field}`} hint={opts.hint} className={opts.className}>
        {opts.textarea ? (
          <textarea id={`s-${key}-${field}`} rows={4} value={value} maxLength={opts.max} onChange={(e) => setIn(key, field, e.target.value)} className={cx(inputClass, "resize-y")} />
        ) : (
          <input id={`s-${key}-${field}`} value={value} maxLength={opts.max} placeholder={opts.placeholder} onChange={(e) => setIn(key, field, e.target.value)} className={inputClass} />
        )}
      </Field>
    );
  };

  return (
    <>
      <PageHeader title="Site settings" description="Company details, contact information and page text used across the website. Each section saves on its own." />

      <nav aria-label="Settings sections" className="mb-6 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#settings-${s.id}`} className={cx(btn("secondary", "sm"), dirty(s.id) && "border-safety-500 text-safety-500")}>
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {section(
          "company",
          <div className="grid gap-4 sm:grid-cols-2">
            {text("companyName", "Company name", { max: 120 })}
            {text("legalName", "Legal name", { max: 160 })}
            {text("tagline", "Tagline", { max: 200, className: "sm:col-span-2", hint: "Shown in the browser tab and search results after the company name." })}
            <Field label="Description" htmlFor="s-description" hint="Used for search engines and link previews (≤ 500 characters)." className="sm:col-span-2">
              <textarea id="s-description" rows={3} maxLength={500} value={values.description} onChange={(e) => set("description", e.target.value)} className={cx(inputClass, "resize-y")} />
            </Field>
            <Field label="Founded (year)" htmlFor="s-foundedYear" hint="Years in business on the home page are counted from this.">
              <input id="s-foundedYear" type="number" min={1900} max={2100} value={values.foundedYear} onChange={(e) => set("foundedYear", Number(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Team size" htmlFor="s-teamSize" hint="“Safety professionals” figure on the home page.">
              <input id="s-teamSize" type="number" min={0} value={values.teamSize} onChange={(e) => set("teamSize", Number(e.target.value))} className={inputClass} />
            </Field>
          </div>,
        )}

        {section(
          "contact",
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone numbers" hint="The first one is used in the header, call buttons and the mobile bar.">
              <StringList items={values.phones} onChange={(v) => set("phones", v)} placeholder="+91 98765 43210" addLabel="Add phone" max={10} />
            </Field>
            <Field label="Public email addresses" hint="Shown on the Contact page.">
              <StringList items={values.emails} onChange={(v) => set("emails", v)} placeholder="name@company.com" addLabel="Add email" max={10} />
            </Field>
            {text("landline", "Landline", { max: 30 })}
            {text("whatsapp", "WhatsApp number", { hint: "Digits only, with country code — e.g. 919876543210.", max: 15 })}
          </div>,
        )}

        {section(
          "address",
          <div className="grid gap-4 sm:grid-cols-2">
            {nested("address", "street", "Street", { max: 200, className: "sm:col-span-2" })}
            {nested("address", "locality", "Locality / area", { max: 120 })}
            {nested("address", "city", "City", { max: 100 })}
            {nested("address", "state", "State", { max: 100 })}
            {nested("address", "postalCode", "PIN code", { max: 20 })}
            {nested("address", "country", "Country", { max: 100 })}
            {text("mapsLink", "Google Maps link", { className: "sm:col-span-2", hint: "Opened by “Locate” and “Find us on Google Maps”. Must start with https://." })}
            {text("mapEmbedSrc", "Map embed URL", { className: "sm:col-span-2", hint: "In Google Maps: Share → Embed a map → copy only the src=\"…\" address (starts with https://www.google.com/maps/embed)." })}
          </div>,
        )}

        {section(
          "social",
          <div className="grid gap-4 sm:grid-cols-3">
            {nested("social", "facebook", "Facebook", { placeholder: "https://facebook.com/…" })}
            {nested("social", "instagram", "Instagram", { placeholder: "https://instagram.com/…" })}
            {nested("social", "whatsapp", "WhatsApp chat link", { placeholder: "https://wa.me/91…" })}
          </div>,
        )}

        {section(
          "registrations",
          <PairList items={values.certificates} onChange={(v) => set("certificates", v)} labels={["Name (e.g. GSTIN)", "Number"]} addLabel="Add registration" max={12} />,
          "Shown in the footer and on the Contact page.",
        )}

        {section(
          "home",
          <div className="grid gap-4">
            {nested("home", "heroBadge", "Badge", { max: 80 })}
            {nested("home", "heroTitle", "Headline", { max: 160 })}
            {nested("home", "heroLead", "Intro", { max: 400, textarea: true })}
          </div>,
          "The banner at the top of the home page.",
        )}

        {section(
          "about",
          <div className="grid gap-4">
            {nested("about", "intro", "Introduction", { max: 2000, textarea: true })}
            {nested("about", "network", "Network & reach", { max: 2000, textarea: true })}
          </div>,
          "Used on the home page (“Who we are”) and the About page.",
        )}

        {section(
          "differentiators",
          <ListEditor
            items={values.differentiators}
            onChange={(v) => set("differentiators", v)}
            blank={() => ({ title: "", icon: "ShieldCheck" })}
            addLabel="Add point"
            max={12}
            render={(item, update, index) => (
              <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
                <input aria-label={`Point ${index + 1}`} value={item.title} maxLength={80} onChange={(e) => update({ ...item, title: e.target.value })} className={inputClass} placeholder="e.g. Pan-India supply" />
                <IconSelect value={item.icon} onChange={(icon) => update({ ...item, icon })} />
              </div>
            )}
          />,
          "The checklist next to “Who we are” on the home page.",
        )}

        {section(
          "pillars",
          <ListEditor
            items={values.valuePillars}
            onChange={(v) => set("valuePillars", v)}
            blank={() => ({ title: "", icon: "ShieldCheck", text: "" })}
            addLabel="Add value"
            max={12}
            render={(item, update, index) => (
              <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_14rem]">
                <input aria-label={`Value ${index + 1} title`} value={item.title} maxLength={100} onChange={(e) => update({ ...item, title: e.target.value })} className={inputClass} placeholder="Title" />
                <IconSelect value={item.icon} onChange={(icon) => update({ ...item, icon })} />
                <textarea aria-label={`Value ${index + 1} text`} value={item.text} maxLength={600} rows={2} onChange={(e) => update({ ...item, text: e.target.value })} className={cx(inputClass, "resize-y sm:col-span-2")} placeholder="Text" />
              </div>
            )}
          />,
          "“What drives us” on the About page.",
        )}

        {section(
          "catalogue",
          <div className="grid gap-4">
            {nested("catalogue", "title", "Title", { max: 120 })}
            <Field label="PDF file" hint={canUseMedia ? "Upload a new PDF or pick one from the media library. Every “Download catalogue” button on the site serves this file." : "A site path (/media/…) or https link to the PDF."}>
              {canUseMedia ? (
                <AssetInput kind="pdf" value={values.catalogue.url} onChange={(url) => setIn("catalogue", "url", url)} />
              ) : (
                <input value={values.catalogue.url} onChange={(e) => setIn("catalogue", "url", e.target.value)} className={inputClass} />
              )}
            </Field>
            <div>
              <a href="/api/catalogue?from=/admin" target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>
                <Download className="size-3.5" /> Test the download
              </a>
              <span className="ml-2 text-xs text-muted">Uses the saved file, exactly as visitors get it.</span>
            </div>
          </div>,
        )}

        {section(
          "notifications",
          <Field label="Send new-enquiry emails to" hint="If the server's SALES_EMAIL setting is configured, it takes precedence over this list.">
            <StringList
              items={values.notifications.salesEmails}
              onChange={(v) => setValues((s) => ({ ...s, notifications: { salesEmails: v } }))}
              placeholder="sales@company.com"
              addLabel="Add recipient"
              max={10}
            />
          </Field>,
          "Who is emailed when a customer sends an enquiry or a testimonial.",
        )}
      </div>
    </>
  );
}
