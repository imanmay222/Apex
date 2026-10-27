"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "../icons";
import { adminRequest } from "./api";
import { RESOURCES } from "./content-config";
import { Count, PageHeader } from "./ui";

type Counts = Record<string, { total: number; hidden: number }>;

export function ContentIndex() {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    const controller = new AbortController();
    const total = (path: string) => adminRequest(path, { signal: controller.signal }).then((r) => Number(r.meta?.total ?? 0));
    Promise.all(
      RESOURCES.map(async (r) => {
        const [all, hidden] = await Promise.all([total(`/api/admin/content/${r.key}?limit=1`), total(`/api/admin/content/${r.key}?limit=1&published=false`)]);
        return [r.key, { total: all, hidden }] as const;
      }),
    )
      .then((entries) => setCounts(Object.fromEntries(entries)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <>
      <PageHeader title="Website content" description="Everything visitors see on the website. Changes go live as soon as you save." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {RESOURCES.map((r) => {
          const c = counts[r.key];
          return (
            <li key={r.key}>
              <Link href={`/admin/content/${r.key}`} className="group flex h-full flex-col rounded-xl border border-border bg-surface-raised p-5 transition-colors hover:border-safety-500">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-foreground">{r.label}</h2>
                  <Count value={c?.total} />
                </div>
                <p className="mt-1 flex-1 text-sm text-muted">{r.description}</p>
                <p className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>{c ? (c.hidden ? `${c.hidden} hidden` : "All published") : " "}</span>
                  <ArrowRight className="size-4 text-safety-500 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
