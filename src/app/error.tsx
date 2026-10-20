"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="shell flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-foreground sm:text-5xl">We hit a snag loading this page</h1>
      <p className="mt-4 max-w-lg text-muted">
        This is on our side, not yours. Please try again in a moment — if it keeps happening, call us and we&apos;ll
        help directly.
      </p>
      {error.digest ? <p className="mt-3 text-xs text-muted/70">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClass()}>
          Try again
        </button>
        <Link href="/" className={buttonClass({ variant: "outline" })}>
          Back to home
        </Link>
      </div>
    </section>
  );
}
