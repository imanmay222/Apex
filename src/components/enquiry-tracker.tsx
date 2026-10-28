"use client";

import { useState } from "react";
import { buttonClass, cx } from "./ui";

type Tracked = {
  reference: string;
  kind: "enquiry" | "order";
  subject: string | null;
  items?: { title: string; quantity: number }[];
  status: string;
  step: number;
  steps?: string[];
  cancelled?: boolean;
  receivedAt: string;
  updatedAt: string;
  history: { status: string; at: string }[];
};

const ENQUIRY_STEPS = ["Received", "In progress", "Quote sent", "Closed"];
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const input =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-800/40";

/**
 * "Where is my enquiry / order?": reference number + the mobile number used. ENQ- references are
 * looked up as enquiries, ORD- references as quote orders.
 */
export function EnquiryTracker({
  title = "Track your enquiry or order",
  description = "Enter the reference number we gave you and the mobile number you used.",
  initialReference = "",
}: {
  title?: string;
  description?: string;
  initialReference?: string;
}) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Tracked | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reference = String(data.get("reference") ?? "").trim().toUpperCase();
    const isOrder = reference.startsWith("ORD");
    setState("loading");
    setError(null);
    setResult(null);

    try {
      const response = await fetch(isOrder ? "/api/orders/track" : "/api/enquiries/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, mobile: String(data.get("mobile") ?? "").trim() }),
      });
      const body = (await response.json()) as { data?: Tracked; error?: { message?: string } };
      const noun = isOrder ? "an order" : "an enquiry";
      if (response.ok && body.data) setResult(body.data);
      else if (response.status === 404) setError(`We couldn't find ${noun} with those details. Check the reference and the mobile number you used.`);
      else if (response.status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (response.status === 422) setError("Enter a reference like ORD-2026-000123 or ENQ-2026-000123 and a valid mobile number.");
      else setError(body.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    }
    setState("idle");
  }

  const steps = result?.steps ?? ENQUIRY_STEPS;

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
      <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{description}</p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" aria-label={title}>
        <input name="reference" required defaultValue={initialReference} placeholder="ORD-2026-000123" aria-label="Reference number" autoComplete="off" className={input} />
        <input name="mobile" required type="tel" placeholder="Mobile number" aria-label="Mobile number" autoComplete="tel" className={input} />
        <button type="submit" disabled={state === "loading"} className={buttonClass({ variant: "brand" })}>
          {state === "loading" ? "Checking…" : "Track"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-safety-600">
          {error}
        </p>
      ) : null}

      {result ? (
        <div role="status" className="mt-6">
          <p className="text-sm text-muted">
            {result.reference}
            {result.subject ? ` · ${result.subject}` : ""}
          </p>
          <p className={cx("font-display mt-1 text-2xl font-semibold", result.cancelled ? "text-safety-600" : "text-brand-800 dark:text-brand-300")}>{result.status}</p>

          {!result.cancelled ? (
            <ol className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Progress">
              {steps.map((label, i) => (
                <li key={label} className="text-center">
                  <div className={cx("h-1.5 rounded-full", i < result.step ? "bg-safety-500" : "bg-border")} />
                  <span className={cx("mt-1.5 block text-[0.7rem]", i < result.step ? "font-semibold text-foreground" : "text-muted")}>{label}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {result.items?.length ? (
            <ul className="mt-5 divide-y divide-border rounded-xl border border-border text-sm">
              {result.items.map((item, i) => (
                <li key={`${item.title}-${i}`} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-foreground">{item.title}</span>
                  <span className="font-medium text-muted tabular-nums">× {item.quantity.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="mt-5 space-y-1 text-xs text-muted">
            {result.history.map((entry) => (
              <li key={`${entry.status}-${entry.at}`}>
                {fmt(entry.at)} — {entry.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
