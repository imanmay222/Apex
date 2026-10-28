"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's quote basket. Lives in localStorage (no account, no cookie) and stays in sync
 * across tabs. The server re-checks every product when the order is sent.
 */

export type BasketItem = {
  slug: string;
  title: string;
  image: string;
  quantity: number;
  /** Size, model, colour… */
  note: string;
};

const KEY = "apex-quote-basket";
export const MAX_LINES = 50;
export const MAX_QUANTITY = 100_000;
const EMPTY: BasketItem[] = [];

const listeners = new Set<() => void>();
let cache: BasketItem[] | null = null;

const clampQuantity = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));

function isItem(value: unknown): value is BasketItem {
  const v = value as Partial<BasketItem> | null;
  return Boolean(v && typeof v.slug === "string" && typeof v.title === "string" && typeof v.quantity === "number");
}

function read(): BasketItem[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed)
      ? parsed
          .filter(isItem)
          .slice(0, MAX_LINES)
          .map((item) => ({ slug: item.slug, title: item.title, image: typeof item.image === "string" ? item.image : "", quantity: clampQuantity(item.quantity), note: typeof item.note === "string" ? item.note.slice(0, 200) : "" }))
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: BasketItem[]) {
  cache = items;
  try {
    if (items.length) window.localStorage.setItem(KEY, JSON.stringify(items));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode or storage full: the basket still works for this page view */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current basket lines; empty during server rendering. */
export function useBasket(): BasketItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const basketUnits = (items: BasketItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);

export const basket = {
  /** Adds a line, or tops up an existing line for the same product and note. Returns false when the basket is full. */
  add(product: { slug: string; title: string; image: string }, quantity: number, note = ""): boolean {
    const items = read();
    const cleanNote = note.trim().slice(0, 200);
    const index = items.findIndex((item) => item.slug === product.slug && item.note.toLowerCase() === cleanNote.toLowerCase());
    if (index >= 0) {
      write(items.map((item, i) => (i === index ? { ...item, quantity: clampQuantity(item.quantity + quantity) } : item)));
      return true;
    }
    if (items.length >= MAX_LINES) return false;
    write([...items, { ...product, quantity: clampQuantity(quantity), note: cleanNote }]);
    return true;
  },
  setQuantity(index: number, quantity: number) {
    write(read().map((item, i) => (i === index ? { ...item, quantity: clampQuantity(quantity) } : item)));
  },
  setNote(index: number, note: string) {
    write(read().map((item, i) => (i === index ? { ...item, note: note.slice(0, 200) } : item)));
  },
  remove(index: number) {
    write(read().filter((_, i) => i !== index));
  },
  clear() {
    write([]);
  },
};
