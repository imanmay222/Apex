"use client";

import { useState } from "react";
import { Check } from "./icons";
import { buttonClass, cx } from "./ui";
import { useFormToken } from "./use-form-token";

const input =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-800/40";

/** "Share your experience": lands in the moderation queue, never straight on the site. */
export function TestimonialForm() {
  const { submit } = useFormToken();
  const [rating, setRating] = useState(5);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();

    const next: Record<string, string> = {};
    if (text("name").length < 2) next.name = "Please enter your name.";
    if (text("quote").length < 20) next.quote = "Please write at least 20 characters.";
    setFields(next);
    setError(null);
    if (Object.keys(next).length) return;

    setState("sending");
    const result = await submit("/api/testimonials", {
      name: text("name"),
      ...(text("company") ? { company: text("company") } : {}),
      ...(text("email") ? { email: text("email") } : {}),
      quote: text("quote"),
      rating,
      website: text("website"),
    });

    if (result.ok) return setState("done");
    setFields(result.fieldErrors);
    setError(result.message ?? "Something went wrong. Please try again.");
    setState("idle");
  }

  if (state === "done") {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface-raised p-8 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-safety-500/15 text-safety-500">
          <Check className="size-6" />
        </span>
        <h3 className="font-display mt-4 text-xl font-semibold text-foreground">Thank you!</h3>
        <p className="mt-2 text-sm text-muted">Your review will appear on the site once our team has approved it.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8" aria-label="Share your experience">
      <h3 className="font-display text-xl font-semibold text-foreground">Worked with us? Share your experience</h3>
      <p className="mt-1.5 text-sm text-muted">Reviews are checked by our team before they are published.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">
          Name
          <input name="name" autoComplete="name" className={cx(input, "mt-2", fields.name && "border-safety-500")} />
          {fields.name ? <span className="mt-1 block text-xs text-safety-600">{fields.name}</span> : null}
        </label>
        <label className="text-sm font-medium text-foreground">
          Company (optional)
          <input name="company" autoComplete="organization" className={cx(input, "mt-2")} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-foreground">Rating</legend>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating out of 5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} out of 5`}
                onClick={() => setRating(value)}
                className={cx("text-2xl leading-none transition-colors", value <= rating ? "text-safety-500" : "text-border")}
              >
                ★
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-sm font-medium text-foreground sm:col-span-2">
          Your review
          <textarea name="quote" rows={4} className={cx(input, "mt-2 resize-y", fields.quote && "border-safety-500")} placeholder="What was it like working with Apex Care?" />
          {fields.quote ? <span className="mt-1 block text-xs text-safety-600">{fields.quote}</span> : null}
        </label>

        <label className="text-sm font-medium text-foreground sm:col-span-2">
          Email (optional, never shown publicly)
          <input name="email" type="email" autoComplete="email" className={cx(input, "mt-2")} />
        </label>

        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="t-website">Leave this empty</label>
          <input id="t-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-safety-600">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={state === "sending"} className={cx(buttonClass({ variant: "brand" }), "mt-6")}>
        {state === "sending" ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
