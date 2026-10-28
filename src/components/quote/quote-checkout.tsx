"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, Minus, Plus, ShoppingBag, Trash } from "../icons";
import { buttonClass, cx } from "../ui";
import { useFormToken } from "../use-form-token";
import { MAX_QUANTITY, basket, basketUnits, useBasket, type BasketItem } from "./basket";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const field =
  "w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-800/40";
const fieldClass = (error?: string) => cx(field, error ? "border-safety-500" : "border-border focus:border-brand-800");

type Status = "idle" | "submitting" | "success";

export function QuoteCheckout() {
  const items = useBasket();
  const pathname = usePathname();
  const { submit } = useFormToken();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (name: string) => String(data.get(name) ?? "").trim();
    const optional = (name: string) => (get(name) ? { [name]: get(name) } : {});

    const payload = {
      items: items.map((item) => ({ product: item.slug, quantity: item.quantity, ...(item.note.trim() ? { note: item.note.trim() } : {}) })),
      name: get("name"),
      mobile: get("mobile"),
      ...optional("email"),
      ...optional("company"),
      ...(get("gstin") ? { gstin: get("gstin").toUpperCase() } : {}),
      address: {
        line1: get("line1"),
        ...(get("line2") ? { line2: get("line2") } : {}),
        city: get("city"),
        state: get("state"),
        postalCode: get("postalCode"),
      },
      ...(get("notes") ? { notes: get("notes") } : {}),
      website: String(data.get("website") ?? ""),
      source: { path: pathname, ...(document.referrer ? { referrer: document.referrer.slice(0, 300) } : {}) },
    };

    // Quick checks for fast feedback; the server is the authority.
    const next: Record<string, string> = {};
    if (payload.name.length < 2) next.name = "Please enter your name.";
    const mobile = payload.mobile.replace(/[\s().-]/g, "");
    if (!/^(\+?91|0)?[6-9]\d{9}$/.test(mobile) && !/^\+\d{8,15}$/.test(mobile)) next.mobile = "Enter a valid mobile number.";
    if (get("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) next.email = "Enter a valid email address.";
    if (get("gstin") && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(get("gstin"))) next.gstin = "GSTIN has 15 characters, e.g. 33ABCDE1234F1Z5.";
    if (payload.address.line1.length < 3) next["address.line1"] = "Enter the delivery address.";
    if (payload.address.city.length < 2) next["address.city"] = "Enter the city.";
    if (!payload.address.state) next["address.state"] = "Choose the state.";
    if (!/^[1-9]\d{5}$/.test(payload.address.postalCode)) next["address.postalCode"] = "Enter a 6-digit PIN code.";

    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
      setFormError("Please check the highlighted fields.");
      return;
    }

    setStatus("submitting");
    const result = await submit("/api/orders", payload);
    if (result.ok && result.data?.reference) {
      setReference(String(result.data.reference));
      setStatus("success");
      basket.clear();
      window.scrollTo({ top: 0 });
      return;
    }

    setStatus("idle");
    setErrors(result.fieldErrors);
    const unavailable = Object.keys(result.fieldErrors).some((path) => path.startsWith("items."));
    setFormError(
      unavailable
        ? "Some products in your basket are no longer available. Remove the highlighted lines and try again."
        : (result.message ?? "Something went wrong. Please try again, or call us."),
    );
  }

  if (status === "success" && reference) return <Success reference={reference} />;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border bg-surface-raised px-6 py-14 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-brand-800/10 text-brand-800 dark:text-brand-300">
          <ShoppingBag className="size-7" />
        </span>
        <h2 className="font-display mt-5 text-2xl font-semibold text-foreground">Your quote basket is empty</h2>
        <p className="mt-2 text-muted">Open any product, choose a quantity and press “Add to quote basket”. Add as many as you need, then send them together.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/products" className={buttonClass()}>
            Browse products <ArrowRight className="size-4" />
          </Link>
          <Link href="/quote/track" className={buttonClass({ variant: "outline" })}>
            Track an order
          </Link>
        </div>
      </div>
    );
  }

  const units = basketUnits(items);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
      <section aria-label="Your quote basket" className="lg:sticky lg:top-28">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">Your basket</h2>
            <p className="mt-1 text-sm text-muted">
              {items.length} product{items.length === 1 ? "" : "s"} · {units.toLocaleString("en-IN")} unit{units === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={() => basket.clear()} className="text-sm text-muted hover:text-safety-500 hover:underline">
            Empty basket
          </button>
        </div>
        <ul className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface-raised">
          {items.map((item, index) => (
            <BasketLine key={`${item.slug}-${index}`} item={item} index={index} error={errors[`items.${index}.product`]} />
          ))}
        </ul>
        <Link href="/products" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-safety-500 hover:underline">
          <Plus className="size-4" /> Add more products
        </Link>
      </section>

      <form onSubmit={onSubmit} noValidate aria-label="Order details" className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-foreground">Delivery &amp; contact</h2>
        <p className="mt-1.5 text-sm text-muted">No payment now. We&apos;ll confirm availability and send you a quote, then deliver once you approve it.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="name" error={errors.name} autoComplete="name" />
          <Field label="Mobile number" name="mobile" error={errors.mobile} type="tel" autoComplete="tel" placeholder="+91 98765 43210" />
          <Field label="Email (optional)" name="email" error={errors.email} type="email" autoComplete="email" placeholder="For a copy of your order" wide />
          <Field label="Company (optional)" name="company" error={errors.company} autoComplete="organization" />
          <Field label="GSTIN (optional)" name="gstin" error={errors.gstin} placeholder="33ABCDE1234F1Z5" className="uppercase" />
          <Field label="Delivery address" name="line1" error={errors["address.line1"]} autoComplete="address-line1" placeholder="Building, street" wide />
          <Field label="Area / landmark (optional)" name="line2" error={errors["address.line2"]} autoComplete="address-line2" wide />
          <Field label="City" name="city" error={errors["address.city"]} autoComplete="address-level2" />
          <Field label="PIN code" name="postalCode" error={errors["address.postalCode"]} autoComplete="postal-code" inputMode="numeric" maxLength={6} />
          <Labelled label="State" htmlFor="state" error={errors["address.state"]} wide>
            <select id="state" name="state" defaultValue="Tamil Nadu" autoComplete="address-level1" className={fieldClass(errors["address.state"])}>
              <option value="">Choose…</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Notes for our team (optional)" htmlFor="notes" error={errors.notes} wide>
            <textarea id="notes" name="notes" rows={3} maxLength={2000} placeholder="Delivery timing, site contact, standards you need…" className={cx(fieldClass(errors.notes), "resize-y")} />
          </Labelled>
        </div>

        {/* Honeypot: hidden from people, irresistible to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="order-website">Leave this field empty</label>
          <input id="order-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {formError ? (
          <p role="alert" className="mt-5 rounded-xl bg-safety-500/10 px-4 py-3 text-sm font-medium text-safety-700 dark:text-safety-300">
            {formError}
          </p>
        ) : null}

        <button type="submit" disabled={status === "submitting"} className={cx(buttonClass({ size: "lg" }), "mt-6 w-full")}>
          {status === "submitting" ? "Sending…" : `Send order for quote (${items.length} product${items.length === 1 ? "" : "s"})`}
          <ArrowRight className="size-4" />
        </button>
        <p className="mt-3 text-center text-xs text-muted">We use these details only to quote and deliver this order.</p>
      </form>
    </div>
  );
}

function BasketLine({ item, index, error }: { item: BasketItem; index: number; error?: string }) {
  return (
    <li className={cx("flex gap-4 p-4", error && "bg-safety-500/5")}>
      <Link href={`/products/${item.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
        {item.image ? <Image src={item.image} alt="" fill sizes="64px" className="object-contain p-1.5" /> : null}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/products/${item.slug}`} className="font-medium text-foreground hover:text-safety-500">
            {item.title}
          </Link>
          <button type="button" onClick={() => basket.remove(index)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-safety-500" aria-label={`Remove ${item.title}`}>
            <Trash className="size-4" />
          </button>
        </div>
        {error ? (
          <p className="text-xs font-medium text-safety-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background">
            <button type="button" onClick={() => basket.setQuantity(index, item.quantity - 1)} disabled={item.quantity <= 1} className="inline-flex size-8 items-center justify-center text-muted hover:text-foreground disabled:opacity-40" aria-label={`Decrease ${item.title}`}>
              <Minus className="size-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={MAX_QUANTITY}
              value={item.quantity}
              onChange={(e) => basket.setQuantity(index, Number(e.target.value) || 1)}
              aria-label={`Quantity of ${item.title}`}
              className="w-14 bg-transparent text-center text-sm font-semibold tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => basket.setQuantity(index, item.quantity + 1)} className="inline-flex size-8 items-center justify-center text-muted hover:text-foreground" aria-label={`Increase ${item.title}`}>
              <Plus className="size-3.5" />
            </button>
          </div>
          <input
            value={item.note}
            onChange={(e) => basket.setNote(index, e.target.value)}
            maxLength={200}
            placeholder="Size, model, colour (optional)"
            aria-label={`Notes for ${item.title}`}
            className="min-w-40 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted/60 focus:border-brand-800 focus:outline-none"
          />
        </div>
      </div>
    </li>
  );
}

function Labelled({ label, htmlFor, error, wide, children }: { label: string; htmlFor: string; error?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-safety-600">{error}</p> : null}
    </div>
  );
}

function Field({
  label,
  name,
  error,
  wide,
  className,
  ...props
}: { label: string; name: string; error?: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Labelled label={label} htmlFor={`order-${name}`} error={error} wide={wide}>
      <input id={`order-${name}`} name={name} className={cx(fieldClass(error), className)} {...props} />
    </Labelled>
  );
}

function Success({ reference }: { reference: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface-raised px-6 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-safety-500/15 text-safety-500">
        <Check className="size-7" />
      </span>
      <h2 className="font-display mt-5 text-2xl font-semibold text-foreground">Order received</h2>
      <p className="mt-2 max-w-md text-muted">Thank you. Our team will confirm availability and send you a quote on the mobile number you gave us. Nothing is charged until you approve it.</p>
      <p className="mt-5 rounded-xl border border-border bg-surface px-5 py-3 text-sm text-muted">
        Your order reference
        <span className="font-display mt-0.5 block text-xl font-semibold tracking-wide text-brand-800 dark:text-brand-300">{reference}</span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={`/quote/track?ref=${encodeURIComponent(reference)}`} className={buttonClass({ variant: "brand" })}>
          Track this order
        </Link>
        <Link href="/products" className={buttonClass({ variant: "outline" })}>
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
