"use client";

import Link from "next/link";
import { ShoppingBag } from "../icons";
import { cx } from "../ui";
import { useBasket } from "./basket";

function label(count: number) {
  return count ? `Quote basket, ${count} product${count === 1 ? "" : "s"}` : "Quote basket, empty";
}

/** Header button: basket icon with a count of lines. */
export function BasketButton() {
  const count = useBasket().length;
  return (
    <Link
      href="/quote"
      aria-label={label(count)}
      className="relative inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-safety-500 hover:text-safety-500"
    >
      <ShoppingBag className="size-5" />
      {count ? (
        <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-safety-500 px-1 text-[0.68rem] font-bold text-white tabular-nums" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

/** Entry for the mobile quick-actions bar. */
export function BasketAction({ className }: { className: string }) {
  const count = useBasket().length;
  return (
    <Link href="/quote" data-track="quote" aria-label={label(count)} className={cx(className, "relative")}>
      <span className="relative">
        <ShoppingBag className="size-5" />
        {count ? (
          <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-safety-500 px-1 text-[0.6rem] font-bold text-white tabular-nums" aria-hidden>
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      Quote
    </Link>
  );
}
