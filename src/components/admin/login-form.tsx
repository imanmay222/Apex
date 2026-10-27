"use client";

import { useState, type FormEvent } from "react";
import { AdminApiError, adminRequest, errorMessage } from "./api";
import { Button, Field, inputClass } from "./ui";

export function LoginForm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await adminRequest("/api/admin/auth/login", { method: "POST", json: { email, password } });
      // Full navigation so the server renders the panel with the new session cookie.
      window.location.replace(next);
    } catch (err) {
      setBusy(false);
      if (err instanceof AdminApiError && err.status === 429) {
        setError("Too many sign-in attempts. Please wait a few minutes and try again.");
      } else if (err instanceof AdminApiError && err.status === 422) {
        setError("Enter a valid email address.");
      } else {
        setError(errorMessage(err));
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-label="Sign in">
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" autoFocus required className={inputClass} placeholder="you@company.com" />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {error ? (
        <p className="rounded-lg bg-red-600/10 px-3 py-2 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" busy={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
