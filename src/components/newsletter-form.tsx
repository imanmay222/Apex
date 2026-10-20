"use client";

import { useState } from "react";
import { cx } from "./ui";
import { useFormToken } from "./use-form-token";

/** Footer sign-up. Double opt-in: the visitor must click the link in the email we send. */
export function NewsletterForm() {
  const { submit } = useFormToken();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");

    setState("sending");
    setError(null);
    const result = await submit("/api/newsletter/subscribe", {
      email,
      path: window.location.pathname,
      website: String(data.get("website") ?? ""),
    });
    if (result.ok) return setState("done");
    setError(result.fieldErrors.email ?? result.message ?? "Something went wrong. Please try again.");
    setState("idle");
  }

  if (state === "done") {
    return (
      <p role="status" className="text-sm text-white/80">
        Almost done! Check your inbox and click the link to confirm your subscription.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Newsletter sign-up">
      <label htmlFor="newsletter-email" className="text-sm font-semibold tracking-wider text-white uppercase">
        Stay in the loop
      </label>
      <p className="mt-2 text-sm text-white/60">Safety tips and product news. No spam, unsubscribe any time.</p>
      <div className="mt-4 flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className={cx(
            "min-w-0 flex-1 rounded-full border bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-safety-500 focus:outline-none",
            error ? "border-safety-500" : "border-white/20",
          )}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="shrink-0 rounded-full bg-safety-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-safety-600 disabled:opacity-60"
        >
          {state === "sending" ? "…" : "Subscribe"}
        </button>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="nl-website">Leave this empty</label>
        <input id="nl-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-safety-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
