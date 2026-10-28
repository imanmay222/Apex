"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Minus, Plus, ShoppingBag } from "../icons";
import { buttonClass, cx } from "../ui";
import { MAX_QUANTITY, basket, useBasket } from "./basket";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-800/40";

/** Quantity + optional note + "Add to quote basket", shown on each product page. */
export function AddToQuote({ product }: { product: { slug: string; title: string; image: string } }) {
  const items = useBasket();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const inBasket = items.filter((item) => item.slug === product.slug).reduce((sum, item) => sum + item.quantity, 0);

  function add() {
    const ok = basket.add(product, quantity, note);
    setFull(!ok);
    if (!ok) return;
    setAdded(quantity);
    setQuantity(1);
    setNote("");
  }

  const step = (delta: number) => setQuantity((q) => Math.min(MAX_QUANTITY, Math.max(1, q + delta)));

  return (
    <div className="rounded-2xl border border-border bg-surface p-5" aria-label="Add to quote basket" role="group">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quote-qty" className="mb-1.5 block text-sm font-medium text-foreground">
            Quantity
          </label>
          <div className="flex items-center rounded-xl border border-border bg-background">
            <button type="button" onClick={() => step(-1)} disabled={quantity <= 1} className="inline-flex size-10 items-center justify-center text-muted hover:text-foreground disabled:opacity-40" aria-label="Decrease quantity">
              <Minus className="size-4" />
            </button>
            <input
              id="quote-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUANTITY}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(MAX_QUANTITY, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              className="w-16 bg-transparent text-center text-sm font-semibold text-foreground tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => step(1)} className="inline-flex size-10 items-center justify-center text-muted hover:text-foreground" aria-label="Increase quantity">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="quote-note" className="mb-1.5 block text-sm font-medium text-foreground">
            Size, model or colour <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="quote-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Size L, ISI marked, white" className={field} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} className={buttonClass({ size: "lg" })}>
          <ShoppingBag className="size-4" />
          Add to quote basket
        </button>
        {inBasket > 0 ? (
          <Link href="/quote" className={cx(buttonClass({ variant: "outline" }))}>
            View basket
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      <p className="mt-3 min-h-5 text-sm" role="status" aria-live="polite">
        {full ? (
          <span className="text-safety-600">Your basket is full (50 lines). Send this order first, then start another.</span>
        ) : added !== null ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" /> Added {added} to your quote basket{inBasket > added ? ` (${inBasket} in total)` : ""}.
          </span>
        ) : inBasket > 0 ? (
          <span className="text-muted">{inBasket} already in your quote basket.</span>
        ) : (
          <span className="text-muted">No payment online. We reply with a quote and availability.</span>
        )}
      </p>
    </div>
  );
}
