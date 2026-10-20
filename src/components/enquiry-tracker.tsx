"use client";

import { useState } from "react";
import { buttonClass, cx } from "./ui";

type Tracked = {
  reference: string;
  subject: string | null;
  status: string;
  step: number;
  receivedAt: string;
  updatedAt: string;
  history: { status: string; at: string }[];
};

const STEPS = ["Received", "In progress", "Quote sent", "Closed"];
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const input =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-800/40";

/** "Where is my enquiry?": reference number + the mobile number used. */
export function EnquiryTracker() {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Tracked | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("loading");
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/enquiries/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: String(data.get("reference") ?? "").trim(), mobile: String(data.get("mobile") ?? "").trim() }),
      });
      const body = (await response.json()) as { data?: Tracked; error?: { message?: string } };
      if (response.ok && body.data) setResult(body.data);
      else if (response.status === 404) setError("We couldn't find an enquiry with those details. Check the reference and the mobile number you used.");
      else if (response.status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (response.status === 422) setError("Enter a reference like ENQ-2026-000123 and a valid mobile number.");
      else setError(body.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    }
    setState("idle");
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
      <h3 className="font-display text-xl font-semibold text-foreground">Track your enquiry</h3>
      <p className="mt-1.5 text-sm text-muted">Enter the reference number we gave you and the mobile number you used.</p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" aria-label="Track your enquiry">
        <input name="reference" required placeholder="ENQ-2026-000123" aria-label="Reference number" autoComplete="off" className={input} />
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
          <p className="font-display mt-1 text-2xl font-semibold text-brand-800 dark:text-brand-300">{result.status}</p>

          <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className="text-center">
                <div className={cx("h-1.5 rounded-full", i < result.step ? "bg-safety-500" : "bg-border")} />
                <span className={cx("mt-1.5 block text-[0.7rem]", i < result.step ? "font-semibold text-foreground" : "text-muted")}>{label}</span>
              </li>
            ))}
          </ol>

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
