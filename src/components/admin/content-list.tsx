"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- items are heterogeneous content records */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Icon, Search } from "../icons";
import { cx } from "../ui";
import { adminApi, errorMessage, syncUrl, useAdminQuery, withQuery } from "./api";
import { resourceConfig, type ResourceConfig } from "./content-config";
import { Thumb } from "./fields";
import { formatDate, timeAgo } from "./format";
import { ChevronUp, ExternalLink, Pencil, Plus, Star } from "./icons";
import { Badge, Button, Card, ConfirmButton, Count, Empty, ErrorNotice, Loading, PageHeader, Pagination, Tabs, btn, inputClass, useSelection, useToast } from "./ui";
import { inlineInputClass } from "./styles";

type Group = { key: string; title: string };

export function ContentList({ resource, initialView }: { resource: string; initialView?: string }) {
  const config = resourceConfig(resource)!;
  const toast = useToast();
  const isTestimonials = resource === "testimonials";

  const [view, setView] = useState<"all" | "pending">(isTestimonials && initialView === "pending" ? "pending" : "all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [published, setPublished] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("order");
  const [page, setPage] = useState(1);
  const [reordering, setReordering] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => (setQ(search.trim()), setPage(1)), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = view === "pending" ? { source: "public", published: "false", sort: "newest" } : { ...filters, q, published, sort };
  const path = withQuery(`/api/admin/content/${resource}`, reordering ? { ...filters, sort: "order", limit: 100 } : { ...query, page, limit: 25 });
  const { data, meta, error, loading, reload, setData } = useAdminQuery<any[]>(path);
  const pendingCount = useAdminQuery<any[]>(isTestimonials ? `/api/admin/content/testimonials?source=public&published=false&limit=1` : null);
  const groups = useAdminQuery<Group[]>(config.filters.some((f) => f.options === "groups") || resource === "products" ? "/api/admin/content/product-groups?limit=100&sort=order" : null);
  const groupTitle = useMemo(() => new Map((groups.data ?? []).map((g) => [g.key, g.title])), [groups.data]);

  const { selected, setSelected, toggle } = useSelection(path);
  useEffect(() => {
    if (isTestimonials) syncUrl("/admin/content/testimonials", view === "pending" ? "/admin/content/testimonials?view=pending" : "/admin/content/testimonials");
  }, [view, isTestimonials]);

  const rows = data ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const refreshAll = () => {
    reload();
    pendingCount.reload();
  };

  async function bulk(action: "publish" | "unpublish" | "delete", ids = [...selected]) {
    setBusy(true);
    try {
      const result = await adminApi.post<{ affected: number }>(`/api/admin/content/${resource}/bulk`, { action, ids });
      const verb = action === "delete" ? "Deleted" : action === "publish" ? "Published" : "Hid";
      toast(`${verb} ${result.affected} ${result.affected === 1 ? config.singular : config.label.toLowerCase()}.`);
      setSelected(new Set());
      refreshAll();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(item: any) {
    try {
      const updated = await adminApi.patch<any>(`/api/admin/content/${resource}/${item.id}`, { published: !item.published });
      if (view === "pending") reload();
      else setData((list) => (list ?? []).map((row) => (row.id === item.id ? updated : row)));
      toast(updated.published ? "Published — it's live on the website." : "Hidden from the website.");
      pendingCount.reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function saveOrder() {
    setBusy(true);
    try {
      await adminApi.post(`/api/admin/content/${resource}/reorder`, { ids: rows.map((r) => r.id) });
      toast("New order saved.");
      setReordering(false);
      setSort("order");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    setData((list) => {
      const next = [...(list ?? [])];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const subtitle = (item: any) => {
    if (resource === "products") return [groupTitle.get(item.group) ?? item.group, item.brand].filter(Boolean).join(" · ");
    return config.subtitle?.(item) ?? "";
  };

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/content" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ArrowLeft className="size-4" /> All content
          </Link>
        }
        title={config.label}
        description={config.description}
        actions={
          reordering ? (
            <>
              <Button variant="ghost" onClick={() => (setReordering(false), reload())} disabled={busy}>
                Cancel
              </Button>
              <Button variant="brand" onClick={saveOrder} busy={busy}>
                Save order
              </Button>
            </>
          ) : (
            <>
              {view === "all" ? (
                <Button onClick={() => setReordering(true)} disabled={Number(meta?.total ?? 0) > 100}>
                  Reorder
                </Button>
              ) : null}
              <Link href={`/admin/content/${resource}/new`} className={btn("primary")}>
                <Plus className="size-4" /> New {config.singular}
              </Link>
            </>
          )
        }
      />

      <Card padded={false}>
        {reordering ? (
          <p className="border-b border-border bg-brand-800/5 px-4 py-3 text-sm text-foreground">
            Use the arrows to move items, then <strong>Save order</strong>. The website shows them in this order.
          </p>
        ) : (
          <div className="space-y-3 border-b border-border p-4">
            {isTestimonials ? (
              <Tabs
                value={view}
                onChange={(v) => (setView(v), setPage(1))}
                options={[
                  { value: "all", label: "All testimonials" },
                  { value: "pending", label: <>Pending review <Count value={Number(pendingCount.meta?.total ?? 0) || undefined} tone="accent" /></> },
                ]}
              />
            ) : null}
            {view === "all" ? (
              <div className="flex flex-wrap gap-2">
                <label className="relative min-w-56 flex-1">
                  <span className="sr-only">Search</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${config.label.toLowerCase()}…`} className={cx(inputClass, "pl-9")} type="search" />
                </label>
                <select aria-label="Visibility" value={published} onChange={(e) => (setPublished(e.target.value), setPage(1))} className={cx(inlineInputClass, "w-auto")}>
                  <option value="">Published &amp; hidden</option>
                  <option value="true">Published only</option>
                  <option value="false">Hidden only</option>
                </select>
                {config.filters.map((filter) => {
                  const options = filter.options === "groups" ? (groups.data ?? []).map((g) => ({ value: g.key, label: g.title })) : filter.options;
                  return (
                    <select
                      key={filter.name}
                      aria-label={filter.label}
                      value={filters[filter.name] ?? ""}
                      onChange={(e) => {
                        setFilters((f) => ({ ...f, [filter.name]: e.target.value }));
                        setPage(1);
                      }}
                      className={cx(inlineInputClass, "w-auto")}
                    >
                      <option value="">{filter.name === "group" ? "All groups" : `Any ${filter.label.toLowerCase()}`}</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  );
                })}
                <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className={cx(inlineInputClass, "w-auto")}>
                  <option value="order">Website order</option>
                  <option value="title">A–Z</option>
                  <option value="updated">Recently edited</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            ) : (
              <p className="text-sm text-muted">Submitted through “Share your experience” on the About page. Approving publishes the quote on the website; rejecting deletes it.</p>
            )}
          </div>
        )}

        {!reordering && selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-800/5 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
            <span className="font-medium text-foreground">{selected.size} selected</span>
            <Button size="sm" onClick={() => bulk("publish")} disabled={busy}>
              Publish
            </Button>
            <Button size="sm" onClick={() => bulk("unpublish")} disabled={busy}>
              Hide
            </Button>
            <ConfirmButton onConfirm={() => bulk("delete")} prompt={`Delete ${selected.size}?`}>
              Delete
            </ConfirmButton>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          view === "pending" ? (
            <Empty title="Nothing waiting for review">New submissions from the website will appear here.</Empty>
          ) : (
            <Empty title={`No ${config.label.toLowerCase()} found`}>{q || published || Object.values(filters).some(Boolean) ? "Try clearing the filters." : `Create the first ${config.singular}.`}</Empty>
          )
        ) : (
          <ul className={cx("divide-y divide-border", loading && "opacity-60")}>
            {!reordering ? (
              <li className="flex items-center gap-3 bg-surface px-4 py-2 text-xs text-muted">
                <input type="checkbox" aria-label="Select all" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-brand-800" />
                <span>Select all on this page</span>
              </li>
            ) : null}
            {rows.map((item, index) => (
              <Row
                key={item.id}
                item={item}
                config={config}
                subtitle={subtitle(item)}
                pending={view === "pending"}
                reordering={reordering}
                checked={selected.has(item.id)}
                onCheck={() => toggle(item.id)}
                onToggle={() => togglePublished(item)}
                onReject={() => bulk("delete", [item.id])}
                onMove={(delta) => move(index, delta)}
                first={index === 0}
                last={index === rows.length - 1}
              />
            ))}
          </ul>
        )}
        {!reordering && meta && rows.length ? (
          <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} noun={config.label.toLowerCase()} onPage={setPage} />
        ) : null}
      </Card>
    </>
  );
}

function Row({
  item,
  config,
  subtitle,
  pending,
  reordering,
  checked,
  onCheck,
  onToggle,
  onReject,
  onMove,
  first,
  last,
}: {
  item: any;
  config: ResourceConfig;
  subtitle: string;
  pending: boolean;
  reordering: boolean;
  checked: boolean;
  onCheck: () => void;
  onToggle: () => void;
  onReject: () => void;
  onMove: (delta: -1 | 1) => void;
  first: boolean;
  last: boolean;
}) {
  const editHref = `/admin/content/${config.key}/${item.id}`;
  const thumb = config.thumb?.(item);
  const icon = config.icon?.(item);
  const isPublicSubmission = item.source === "public";

  return (
    <li className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface sm:items-center">
      {reordering ? (
        <div className="flex shrink-0 flex-col">
          <Button size="xs" variant="ghost" onClick={() => onMove(-1)} disabled={first} aria-label={`Move ${config.title(item)} up`}>
            <ChevronUp className="size-4" />
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onMove(1)} disabled={last} aria-label={`Move ${config.title(item)} down`}>
            <ChevronUp className="size-4 rotate-180" />
          </Button>
        </div>
      ) : (
        <input type="checkbox" aria-label={`Select ${config.title(item)}`} checked={checked} onChange={onCheck} className="mt-1 size-4 shrink-0 accent-brand-800 sm:mt-0" />
      )}
      {config.thumb ? (
        <Thumb src={thumb} alt="" className="size-12 shrink-0 rounded-lg border border-border" contain={config.key === "logos" || config.key === "products"} />
      ) : icon ? (
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-800/10 text-brand-800 dark:text-brand-300">
          <Icon name={icon} className="size-5" />
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={editHref} className="font-medium text-foreground hover:text-safety-500 hover:underline">
            {config.title(item)}
          </Link>
          {config.featured && item.featured ? (
            <Badge tone="amber">
              <Star className="size-3" /> Featured
            </Badge>
          ) : null}
          {item.published ? <Badge tone="green">Published</Badge> : isPublicSubmission ? <Badge tone="orange">Awaiting review</Badge> : <Badge>Hidden</Badge>}
          {config.key === "testimonials" && item.rating ? <span className="text-xs text-safety-500" aria-label={`${item.rating} out of 5`}>{"★".repeat(item.rating)}</span> : null}
        </div>
        {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        {config.key === "testimonials" ? <p className="mt-1 line-clamp-2 text-sm text-muted">“{item.quote}”</p> : null}
        {pending ? (
          <p className="mt-1 text-xs text-muted">
            Submitted {timeAgo(item.createdAt)}
            {item.submitterEmail ? (
              <>
                {" "}
                by <a href={`mailto:${item.submitterEmail}`} className="hover:underline">{item.submitterEmail}</a>
              </>
            ) : null}
            <span className="sr-only"> on {formatDate(item.createdAt)}</span>
          </p>
        ) : null}
      </div>

      {!reordering ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {pending ? (
            <>
              <Button size="sm" variant="brand" onClick={onToggle}>
                Approve
              </Button>
              <ConfirmButton onConfirm={onReject} confirmLabel="Reject" prompt="Delete it?">
                Reject
              </ConfirmButton>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={onToggle} className="hidden sm:inline-flex">
                {item.published ? "Hide" : "Publish"}
              </Button>
              {config.publicUrl && item.published ? (
                <a href={config.publicUrl(item)} target="_blank" rel="noopener noreferrer" className={btn("ghost", "sm")} aria-label="View on website" title="View on website">
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
              <Link href={editHref} className={btn("secondary", "sm")}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
