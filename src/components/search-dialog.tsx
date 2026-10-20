"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Close, Search } from "./icons";
import { cx } from "./ui";

type Hit = {
  type: "products" | "surveys" | "training";
  slug: string;
  title: string;
  summary: string;
  url: string;
};

const TYPE_LABEL: Record<Hit["type"], string> = {
  products: "Product",
  surveys: "Survey",
  training: "Training",
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; hits: Hit[] }
  | { status: "error" };

export function SearchDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;

    // Debounce, and abort in-flight requests so a slow old response can't overwrite a newer one.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search failed");
        const body = (await response.json()) as { data: Hit[] };
        setState({ status: "done", hits: body.data });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState({ status: "error" });
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  function open() {
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  const shown = trimmed.length < 2 ? ({ status: "idle" } as State) : state;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Search the site"
        className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-safety-500 hover:text-safety-500"
      >
        <Search className="size-5" />
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="mx-auto mt-[10vh] w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-brand-950/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, surveys, training…"
            aria-label="Search"
            autoComplete="off"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"
          >
            <Close className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2" aria-live="polite">
          {shown.status === "idle" ? (
            <p className="px-3 py-8 text-center text-sm text-muted">Type at least 2 characters to search.</p>
          ) : null}
          {shown.status === "loading" ? <p className="px-3 py-8 text-center text-sm text-muted">Searching…</p> : null}
          {shown.status === "error" ? (
            <p className="px-3 py-8 text-center text-sm text-safety-600">Search is unavailable right now.</p>
          ) : null}
          {shown.status === "done" && shown.hits.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">No results for “{trimmed}”.</p>
          ) : null}
          {shown.status === "done" && shown.hits.length > 0 ? (
            <ul>
              {shown.hits.map((hit) => (
                <li key={`${hit.type}-${hit.slug}`}>
                  <Link
                    href={hit.url}
                    onClick={close}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-3 transition-colors hover:bg-surface"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase",
                          hit.type === "products" && "bg-brand-800/10 text-brand-800 dark:text-brand-300",
                          hit.type === "surveys" && "bg-safety-500/10 text-safety-600",
                          hit.type === "training" && "bg-muted/15 text-muted",
                        )}
                      >
                        {TYPE_LABEL[hit.type]}
                      </span>
                      <span className="text-sm font-semibold">{hit.title}</span>
                    </span>
                    <span className="line-clamp-1 text-xs text-muted">{hit.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
