"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "../icons";
import { cx } from "../ui";
import { adminApi, errorMessage, useAdminQuery, withQuery } from "./api";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_TYPE_LABELS, timeAgo, formatDate } from "./format";
import { Badge, Button, Card, ConfirmButton, Empty, ErrorNotice, Loading, PageHeader, Pagination, PriorityBadge, StatusBadge, Tabs, btn, inputClass, useSelection, useToast } from "./ui";
import { inlineInputClass } from "./styles";

export type EnquiryFilters = {
  status?: string;
  type?: string;
  priority?: string;
  assignedTo?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
};

export type Assignee = { id: string; name: string; role: string };

type EnquiryRow = {
  id: string;
  reference: string;
  type: string;
  subject: { slug: string; title: string } | null;
  name: string;
  mobile: string;
  email: string | null;
  message: string;
  status: string;
  priority: string;
  assignedTo: { id: string; name: string } | null;
  tags: string[];
  notes: unknown[];
  createdAt: string;
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quote sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
  { value: "spam", label: "Spam" },
];

/** The API wants instants; the date inputs give local calendar days. */
function apiQuery(filters: EnquiryFilters) {
  return {
    status: filters.status,
    type: filters.type,
    priority: filters.priority,
    assignedTo: filters.assignedTo,
    q: filters.q,
    sort: filters.sort,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  };
}

export function EnquiriesList({ initial, viewerId, canWrite, canDelete }: { initial: EnquiryFilters; viewerId: string; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [filters, setFilters] = useState<EnquiryFilters>(initial);
  const [search, setSearch] = useState(initial.q ?? "");
  const [busy, setBusy] = useState(false);
  const page = Number(filters.page ?? 1) || 1;

  const listPath = withQuery("/api/admin/enquiries", { ...apiQuery(filters), page, limit: 25 });
  const { data, meta, error, loading, reload } = useAdminQuery<EnquiryRow[]>(listPath);
  const assignees = useAdminQuery<Assignee[]>("/api/admin/assignees");

  // Keep the URL shareable and the back button meaningful.
  useEffect(() => {
    router.replace(withQuery("/admin/enquiries", filters), { scroll: false });
  }, [filters, router]);

  // Debounced free-text search.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.q ?? "") === search.trim() ? f : { ...f, q: search.trim() || undefined, page: undefined }), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { selected, setSelected, toggle } = useSelection(listPath);

  const set = (patch: Partial<EnquiryFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? undefined }));
  const exportHref = withQuery("/api/admin/enquiries/export", apiQuery(filters));
  const rows = useMemo(() => data ?? [], [data]);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const filtered = Boolean(filters.type || filters.priority || filters.assignedTo || filters.q || filters.from || filters.to);

  async function bulk(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const result = await adminApi.post<{ affected: number }>("/api/admin/enquiries/bulk", { ...body, ids: [...selected] });
      toast(`${done} ${result.affected} enquir${result.affected === 1 ? "y" : "ies"}.`);
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
        title="Enquiries"
        description="Every quote request, survey booking and training enquiry sent from the website."
        actions={
          <a href={exportHref} className={btn("secondary")} download>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      <Card padded={false}>
        <div className="space-y-3 border-b border-border p-4">
          <Tabs value={STATUS_TABS.some((t) => t.value === (filters.status ?? "")) ? filters.status ?? "" : "__custom"} onChange={(value) => set({ status: value || undefined })} options={STATUS_TABS} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)]">
            <label className="relative">
              <span className="sr-only">Search enquiries</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, mobile, email, reference, message…"
                className={cx(inputClass, "pl-9")}
                type="search"
              />
            </label>
            <select aria-label="Type" value={filters.type ?? ""} onChange={(e) => set({ type: e.target.value || undefined })} className={inputClass}>
              <option value="">All types</option>
              {Object.entries(ENQUIRY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select aria-label="Priority" value={filters.priority ?? ""} onChange={(e) => set({ priority: e.target.value || undefined })} className={inputClass}>
              <option value="">Any priority</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
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
          <BulkBar count={selected.size} busy={busy} assignees={assignees.data ?? []} canDelete={canDelete} onAction={bulk} onClear={() => setSelected(new Set())} />
        ) : null}

        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty title={filters.status === "spam" ? "No spam caught" : "No enquiries match"}>
            {filtered || filters.status ? "Try clearing the filters." : "New enquiries from the website will appear here."}
          </Empty>
        ) : (
          <div className={cx("overflow-x-auto", loading && "opacity-60")}>
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  {canWrite ? (
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allChecked}
                        onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                        className="size-4 accent-brand-800"
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Enquiry</th>
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
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.reference}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          className="size-4 accent-brand-800"
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <Link href={`/admin/enquiries/${row.id}`} className={cx("text-foreground hover:text-safety-500 hover:underline", row.status === "new" ? "font-semibold" : "font-medium")}>
                        {row.name}
                      </Link>
                      <p className="text-xs text-muted tabular-nums">{row.mobile}</p>
                      {row.email ? <p className="max-w-48 truncate text-xs text-muted">{row.email}</p> : null}
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-foreground">{ENQUIRY_TYPE_LABELS[row.type] ?? row.type}</span>
                        {row.subject ? ` · ${row.subject.title}` : ""} · <span className="tabular-nums">{row.reference}</span>
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-muted">{row.message}</p>
                      {row.tags.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.tags.map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={row.status} />
                        <PriorityBadge priority={row.priority} />
                      </div>
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
        {meta && rows.length ? (
          <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} noun="enquiries" onPage={(p) => set({ page: String(p) })} />
        ) : null}
      </Card>
    </>
  );
}

function BulkBar({
  count,
  busy,
  assignees,
  canDelete,
  onAction,
  onClear,
}: {
  count: number;
  busy: boolean;
  assignees: Assignee[];
  canDelete: boolean;
  onAction: (body: Record<string, unknown>, done: string) => Promise<void>;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-800/5 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
      <span className="font-medium text-foreground">{count} selected</span>
      <select
        aria-label="Set status"
        disabled={busy}
        value=""
        onChange={(e) => e.target.value && onAction({ action: "status", status: e.target.value }, "Updated")}
        className={cx(inlineInputClass, "h-8 w-auto py-0")}
      >
        <option value="">Set status…</option>
        {Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Assign to"
        disabled={busy}
        value=""
        onChange={(e) => e.target.value && onAction({ action: "assign", assignedTo: e.target.value === "none" ? null : e.target.value }, "Reassigned")}
        className={cx(inlineInputClass, "h-8 w-auto py-0")}
      >
        <option value="">Assign to…</option>
        <option value="none">Nobody (unassign)</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {canDelete ? (
        <ConfirmButton onConfirm={() => onAction({ action: "delete" }, "Deleted")} prompt={`Delete ${count}?`}>
          Delete
        </ConfirmButton>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
        Clear selection
      </Button>
    </div>
  );
}
