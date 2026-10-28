"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "../icons";
import { cx } from "../ui";
import { adminApi, errorMessage, syncUrl, useAdminQuery, withQuery } from "./api";
import type { Assignee } from "./enquiries-list";
import { ORDER_STATUS_LABELS, formatDate, timeAgo } from "./format";
import type { Order } from "./order-detail";
import { inlineInputClass } from "./styles";
import { Button, Card, ConfirmButton, Empty, ErrorNotice, Loading, OrderStatusBadge, PageHeader, Pagination, Tabs, btn, inputClass, useSelection, useToast } from "./ui";

export type OrderFilters = {
  status?: string;
  assignedTo?: string;
  product?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "quoted", label: "Quote sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "spam", label: "Spam" },
];

/** The API wants instants; the date inputs give local calendar days. */
function apiQuery(filters: OrderFilters) {
  return {
    status: filters.status,
    assignedTo: filters.assignedTo,
    product: filters.product,
    q: filters.q,
    sort: filters.sort,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  };
}

export function OrdersList({ initial, viewerId, canWrite, canDelete }: { initial: OrderFilters; viewerId: string; canWrite: boolean; canDelete: boolean }) {
  const toast = useToast();
  const [filters, setFilters] = useState<OrderFilters>(initial);
  const [search, setSearch] = useState(initial.q ?? "");
  const [busy, setBusy] = useState(false);
  const page = Number(filters.page ?? 1) || 1;

  const listPath = withQuery("/api/admin/orders", { ...apiQuery(filters), page, limit: 25 });
  const { data, meta, error, loading, reload } = useAdminQuery<Order[]>(listPath);
  const assignees = useAdminQuery<Assignee[]>("/api/admin/assignees");
  const products = useAdminQuery<{ slug: string; title: string }[]>("/api/products?limit=100&sort=title");
  const { selected, setSelected, toggle } = useSelection(listPath);

  useEffect(() => syncUrl("/admin/orders", withQuery("/admin/orders", filters)), [filters]);

  // Debounced free-text search. Kept in a ref so opening a row can flush it first: a late update
  // must never rewrite the URL while the router is navigating away.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const withSearch = (f: typeof filters) => ((f.q ?? "") === search.trim() ? f : { ...f, q: search.trim() || undefined, page: undefined });
  useEffect(() => {
    searchTimer.current = setTimeout(() => setFilters(withSearch), 350);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- withSearch only reads `search`
  }, [search]);
  const flushSearch = () => {
    clearTimeout(searchTimer.current);
    syncUrl("/admin/orders", withQuery("/admin/orders", withSearch(filters)));
  };

  const set = (patch: Partial<OrderFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? undefined }));
  const rows = useMemo(() => data ?? [], [data]);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const filtered = Boolean(filters.assignedTo || filters.product || filters.q || filters.from || filters.to);

  async function bulk(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const result = await adminApi.post<{ affected: number }>("/api/admin/orders/bulk", { ...body, ids: [...selected] });
      toast(`${done} ${result.affected} order${result.affected === 1 ? "" : "s"}.`);
      setSelected(new Set());
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description="Quote baskets sent from the website: products, quantities and where to deliver. No payment is taken online."
        actions={
          <a href={withQuery("/api/admin/orders/export", apiQuery(filters))} className={btn("secondary")} download>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      <Card padded={false}>
        <div className="space-y-3 border-b border-border p-4">
          <Tabs value={STATUS_TABS.some((t) => t.value === (filters.status ?? "")) ? (filters.status ?? "") : "__custom"} onChange={(value) => set({ status: value || undefined })} options={STATUS_TABS} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(3,1fr)]">
            <label className="relative">
              <span className="sr-only">Search orders</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company, mobile, reference, city…" className={cx(inputClass, "pl-9")} type="search" />
            </label>
            <select aria-label="Product" value={filters.product ?? ""} onChange={(e) => set({ product: e.target.value || undefined })} className={inputClass}>
              <option value="">Any product</option>
              {(products.data ?? []).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                </option>
              ))}
            </select>
            <select aria-label="Assigned to" value={filters.assignedTo ?? ""} onChange={(e) => set({ assignedTo: e.target.value || undefined })} className={inputClass}>
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              <option value={viewerId}>Assigned to me</option>
              {(assignees.data ?? [])
                .filter((a) => a.id !== viewerId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            <select aria-label="Sort" value={filters.sort ?? "newest"} onChange={(e) => set({ sort: e.target.value === "newest" ? undefined : e.target.value })} className={inputClass}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="status">By status</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Received</span>
            <input type="date" aria-label="From date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} className={cx(inlineInputClass, "w-auto py-1.5")} />
            <span className="text-muted">to</span>
            <input type="date" aria-label="To date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} className={cx(inlineInputClass, "w-auto py-1.5")} />
            {filtered ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setFilters({ status: filters.status });
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        {canWrite && selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-800/5 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
            <span className="font-medium text-foreground">{selected.size} selected</span>
            <select aria-label="Set status" disabled={busy} value="" onChange={(e) => e.target.value && bulk({ action: "status", status: e.target.value }, "Updated")} className={cx(inlineInputClass, "h-8 w-auto py-0")}>
              <option value="">Set status…</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Assign to"
              disabled={busy}
              value=""
              onChange={(e) => e.target.value && bulk({ action: "assign", assignedTo: e.target.value === "none" ? null : e.target.value }, "Reassigned")}
              className={cx(inlineInputClass, "h-8 w-auto py-0")}
            >
              <option value="">Assign to…</option>
              <option value="none">Nobody (unassign)</option>
              {(assignees.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {canDelete ? (
              <ConfirmButton onConfirm={() => bulk({ action: "delete" }, "Deleted")} prompt={`Delete ${selected.size}?`}>
                Delete
              </ConfirmButton>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={busy}>
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
          <Empty title={filters.status === "spam" ? "No spam caught" : "No orders match"}>
            {filtered || filters.status ? "Try clearing the filters." : "Orders sent from the website's quote basket will appear here."}
          </Empty>
        ) : (
          <div className={cx("overflow-x-auto", loading && "opacity-60")}>
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  {canWrite ? (
                    <th className="w-10 px-4 py-2.5">
                      <input type="checkbox" aria-label="Select all on this page" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-brand-800" />
                    </th>
                  ) : null}
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Products</th>
                  <th className="px-4 py-2.5 font-medium">Deliver to</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Assigned</th>
                  <th className="px-4 py-2.5 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className={cx("align-top transition-colors hover:bg-surface", row.status === "new" && "bg-safety-500/[0.03]")}>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <input type="checkbox" aria-label={`Select ${row.reference}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} className="size-4 accent-brand-800" />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${row.id}`} onClick={flushSearch} className={cx("text-foreground hover:text-safety-500 hover:underline", row.status === "new" ? "font-semibold" : "font-medium")}>
                        {row.name}
                      </Link>
                      {row.company ? <p className="max-w-48 truncate text-xs text-muted">{row.company}</p> : null}
                      <p className="text-xs text-muted tabular-nums">{row.mobile}</p>
                    </td>
                    <td className="max-w-sm px-4 py-3">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-foreground">
                          {row.items.length} product{row.items.length === 1 ? "" : "s"} · {row.totalUnits.toLocaleString("en-IN")} units
                        </span>{" "}
                        · <span className="tabular-nums">{row.reference}</span>
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-muted">
                        {row.items
                          .slice(0, 3)
                          .map((item) => `${item.product.title} × ${item.quantity}`)
                          .join(", ")}
                        {row.items.length > 3 ? `, +${row.items.length - 3} more` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.address.city}
                      <span className="block text-xs">{row.address.state}</span>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{row.assignedTo?.name ?? <span className="text-muted/70">—</span>}</td>
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-muted" title={formatDate(row.createdAt)}>
                      {timeAgo(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && rows.length ? <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} noun="orders" onPage={(p) => set({ page: String(p) })} /> : null}
      </Card>
    </>
  );
}
