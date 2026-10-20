"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EnquiryOptions } from "@/lib/types";
import { ArrowRight, Check } from "./icons";
import { buttonClass, cx } from "./ui";

type EnquiryType = "products" | "survey" | "training";
type Status = "idle" | "submitting" | "success" | "error";

const TYPE_LABEL: Record<EnquiryType, string> = { products: "Products", survey: "Survey", training: "Training" };
const SUBJECT_LABEL: Record<EnquiryType, string> = {
  products: "Which product?",
  survey: "Which survey?",
  training: "Which programme?",
};

type ApiError = { error?: { code?: string; message?: string; details?: { path: string; message: string }[] } };

export function EnquiryForm({
  options,
  defaultType = "products",
  defaultSubject,
}: {
  options: EnquiryOptions;
  defaultType?: EnquiryType;
  defaultSubject?: string;
}) {
  const pathname = usePathname();
  const [type, setType] = useState<EnquiryType>(defaultType);
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const token = useRef<string | null>(null);

  // A signed, time-stamped token proves the form was really loaded (and enforces a minimum fill time).
  const loadToken = useCallback(async () => {
    try {
      const response = await fetch("/api/enquiries/token", { cache: "no-store" });
      const body = (await response.json()) as { data?: { token: string } };
      token.current = body.data?.token ?? null;
    } catch {
      token.current = null;
    }
  }, []);

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  function changeType(next: EnquiryType) {
    setType(next);
    setSubject("");
  }

  async function post(payload: Record<string, unknown>) {
    return fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, token: token.current ?? "missing" }),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const payload = {
      name: String(data.get("name") ?? "").trim(),
      mobile: String(data.get("mobile") ?? "").trim(),
      ...(String(data.get("email") ?? "").trim() ? { email: String(data.get("email")).trim() } : {}),
      type,
      ...(subject ? { subject } : {}),
      message: String(data.get("message") ?? "").trim(),
      website: String(data.get("website") ?? ""),
      source: { path: pathname, ...(document.referrer ? { referrer: document.referrer.slice(0, 300) } : {}) },
    };

    // Quick client-side checks for fast feedback; the server is the authority.
    const nextErrors: Record<string, string> = {};
    if (payload.name.length < 2) nextErrors.name = "Please enter your name.";
    if (!/^(\+?91[\s-]?|0)?[6-9]\d{9}$/.test(payload.mobile.replace(/[\s().-]/g, "")) && !/^\+\d{8,15}$/.test(payload.mobile.replace(/[\s().-]/g, ""))) {
      nextErrors.mobile = "Enter a valid mobile number.";
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) nextErrors.email = "Enter a valid email address.";
    if (payload.message.length < 10) nextErrors.message = "Tell us a little more (10+ characters).";

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");
    try {
      let response = await post(payload);
      let body = (await response.json()) as { data?: { reference: string } } & ApiError;

      // The token may have expired while the page sat open: fetch a fresh one and retry once.
      if (!response.ok && ["INVALID_FORM_TOKEN", "FORM_EXPIRED"].includes(body.error?.code ?? "")) {
        await loadToken();
        await new Promise((resolve) => setTimeout(resolve, 2_100)); // server enforces a minimum fill time
        response = await post(payload);
        body = (await response.json()) as typeof body;
      }

      if (response.ok && body.data) {
        setReference(body.data.reference);
        setStatus("success");
        void loadToken();
        return;
      }

      if (response.status === 422 && body.error?.details) {
        const fieldErrors: Record<string, string> = {};
        for (const detail of body.error.details) fieldErrors[detail.path === "subject" ? "subject" : detail.path] = detail.message;
        setErrors(fieldErrors);
      }
      setFormError(
        response.status === 429
          ? "You've sent a few enquiries already. Please wait a few minutes, or call us directly."
          : (body.error?.message ?? "Something went wrong. Please try again or call us."),
      );
      setStatus("error");
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again, or call us.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-2xl border border-border bg-surface-raised p-8 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-safety-500/15 text-safety-500">
          <Check className="size-7" />
        </span>
        <h3 className="font-display mt-5 text-2xl font-semibold text-foreground">Enquiry received</h3>
        <p className="mt-2 max-w-sm text-muted">
          Thanks for reaching out. Our team will get back to you on the number you provided.
        </p>
        {reference ? (
          <p className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            Your reference number
            <span className="mt-0.5 block font-display text-lg font-semibold tracking-wide text-brand-800 dark:text-brand-300">
              {reference}
            </span>
          </p>
        ) : null}
        <button type="button" onClick={() => setStatus("idle")} className={cx(buttonClass({ variant: "outline" }), "mt-6")}>
          Send another enquiry
        </button>
      </div>
    );
  }

  const subjectOptions = options[type];

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Enquiry form" className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold text-foreground">Send an enquiry</h3>
      <p className="mt-1.5 text-sm text-muted">Fill this in and we&apos;ll come back with a specification and a price.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name} htmlFor="name">
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Your full name" className={inputClass(!!errors.name)} />
        </Field>

        <Field label="Mobile number" error={errors.mobile} htmlFor="mobile">
          <input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" className={inputClass(!!errors.mobile)} />
        </Field>

        <Field label="Email (optional)" error={errors.email} htmlFor="email" className="sm:col-span-2">
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com — for a copy of your enquiry" className={inputClass(!!errors.email)} />
        </Field>

        <Field label="Enquiry for" htmlFor="type" className="sm:col-span-2">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border p-1">
            {(Object.keys(TYPE_LABEL) as EnquiryType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => changeType(option)}
                aria-pressed={type === option}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  type === option ? "bg-brand-800 text-white" : "text-muted hover:text-foreground",
                )}
              >
                {TYPE_LABEL[option]}
              </button>
            ))}
          </div>
        </Field>

        <Field label={SUBJECT_LABEL[type]} error={errors.subject} htmlFor="subject" className="sm:col-span-2">
          <select id="subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass(!!errors.subject)}>
            <option value="">Not sure yet / general enquiry</option>
            {subjectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Message" error={errors.message} htmlFor="message" className="sm:col-span-2">
          <textarea
            id="message"
            name="message"
            rows={4}
            placeholder="Quantities, site conditions, timelines — anything that helps us quote accurately."
            className={cx(inputClass(!!errors.message), "resize-y")}
          />
        </Field>

        {/* Honeypot: invisible to people and assistive tech, irresistible to form-filling bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Leave this field empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-safety-600">
          {formError}
        </p>
      ) : null}

      <button type="submit" disabled={status === "submitting"} className={cx(buttonClass({ size: "lg" }), "mt-6 w-full")}>
        {status === "submitting" ? "Sending…" : "Send enquiry"}
        {status === "submitting" ? null : <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean) {
  return cx(
    "w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground transition-colors",
    "placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-800/40",
    hasError ? "border-safety-500" : "border-border focus:border-brand-800",
  );
}

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-safety-600">{error}</p> : null}
    </div>
  );
}
