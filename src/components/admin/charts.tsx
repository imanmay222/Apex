"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cx } from "../ui";
import { formatNumber } from "./format";

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

export function StatTile({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "alert" }) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("font-display mt-1.5 text-2xl font-semibold tabular-nums sm:text-3xl", tone === "alert" ? "text-red-600 dark:text-red-400" : "text-foreground")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const className = "block rounded-xl border border-border bg-surface-raised p-4 sm:p-5";
  return href ? (
    <Link href={href} className={cx(className, "transition-colors hover:border-brand-800/40")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Single-series column chart with a per-bar hover tooltip             */
/* ------------------------------------------------------------------ */

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function ColumnChart({ points, label, height = 160 }: { points: { date: string; value: number }[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  // A "nice" top gridline so the axis reads in round numbers.
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step).filter((_, i, all) => all.length <= 6 || i % 2 === 0 || i === all.length - 1);
  const labelEvery = Math.ceil(points.length / 7);
  const total = points.reduce((sum, p) => sum + p.value, 0);

  if (points.length === 0) return <p className="py-10 text-center text-sm text-muted">No data for this period.</p>;

  return (
    <figure className="m-0">
      <div className="relative flex gap-2" style={{ height }}>
        {/* y-axis */}
        <div className="relative w-7 shrink-0 text-right text-[0.68rem] text-muted tabular-nums" aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((tick) => (
            <div key={tick} aria-hidden className={cx("absolute inset-x-0 border-t", tick === 0 ? "border-border" : "border-dashed border-border/70")} style={{ bottom: `${(tick / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="img" aria-label={`${label}: ${formatNumber(total)} in total over ${points.length} days`}>
            {points.map((point, i) => (
              <div
                key={point.date}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${shortDate(point.date)}: ${point.value}`}
              >
                <div
                  className={cx("w-full max-w-7 rounded-t-[4px] transition-colors", hover === i ? "bg-brand-900 dark:bg-brand-300" : "bg-brand-800 dark:bg-brand-400")}
                  style={{ height: point.value === 0 ? 0 : `max(2px, ${(point.value / top) * 100}%)` }}
                />
                {hover === i ? (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                    <span className="text-muted">{shortDate(point.date)}</span> · <span className="font-semibold text-foreground tabular-nums">{formatNumber(point.value)}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* x-axis labels */}
      <div className="mt-1.5 flex gap-[2px] pl-9 text-[0.68rem] text-muted" aria-hidden>
        {points.map((point, i) => (
          <span key={point.date} className="flex-1 text-center whitespace-nowrap">
            {i % labelEvery === 0 ? shortDate(point.date) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked list with inline magnitude bars                              */
/* ------------------------------------------------------------------ */

export function RankedList({
  rows,
  empty = "Nothing recorded yet.",
  format,
  hrefFor,
}: {
  rows: { name: string; count: number }[];
  empty?: string;
  format?: (name: string) => ReactNode;
  hrefFor?: (name: string) => string | null;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ol className="space-y-2.5">
      {rows.map((row) => {
        const label = format ? format(row.name) : row.name;
        const href = hrefFor?.(row.name);
        return (
          <li key={row.name} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-foreground" title={row.name}>
                {href ? (
                  <Link href={href} className="hover:text-safety-500 hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </span>
              <span className="shrink-0 font-medium text-foreground tabular-nums">{formatNumber(row.count)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface" aria-hidden>
              <div className="h-full rounded-full bg-brand-800/70 dark:bg-brand-400/80" style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
