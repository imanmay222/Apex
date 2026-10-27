"use client";

import { useState } from "react";
import { Download, Search } from "../icons";
import { cx } from "../ui";
import { adminApi, errorMessage, useAdminQuery, withQuery } from "./api";
import { formatDate, timeAgo } from "./format";
import { Badge, Card, ConfirmButton, Count, Empty, ErrorNotice, Loading, PageHeader, Pagination, Tabs, btn, inputClass, useToast, type Tone } from "./ui";
import { inlineInputClass } from "./styles";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: "pending" | "subscribed" | "unsubscribed";
  sourcePath: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
};

const STATUS: Record<Subscriber["status"], { label: string; tone: Tone }> = {
  subscribed: { label: "Subscribed", tone: "green" },
  pending: { label: "Awaiting confirmation", tone: "amber" },
  unsubscribed: { label: "Unsubscribed", tone: "gray" },
};

export function Subscribers({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<"" | Subscriber["status"]>("subscribed");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const { data, meta, error, loading, reload } = useAdminQuery<Subscriber[]>(withQuery("/api/admin/subscribers", { status, q, sort, page, limit: 25 }));
  const byStatus = (meta?.byStatus ?? {}) as Record<string, number>;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  async function erase(subscriber: Subscriber) {
    try {
      await adminApi.del(`/api/admin/subscribers/${subscriber.id}`);
      toast(`Erased ${subscriber.email}.`);
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Newsletter subscribers"
        description="People who signed up in the website footer. They're only counted as subscribed after confirming by email (double opt-in)."
        actions={
          <a href={withQuery("/api/admin/subscribers/export", { status: status || undefined, q })} className={btn("secondary")} download>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Tabs
            value={status}
            onChange={(v) => (setStatus(v), setPage(1))}
            options={[
              { value: "subscribed", label: <>Subscribed <Count value={byStatus.subscribed ?? 0} /></> },
              { value: "pending", label: <>Awaiting confirmation <Count value={byStatus.pending ?? 0} /></> },
              { value: "unsubscribed", label: <>Unsubscribed <Count value={byStatus.unsubscribed ?? 0} /></> },
              { value: "", label: <>All <Count value={total} /></> },
            ]}
          />
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search by email</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Search by email" className={cx(inputClass, "pl-9")} type="search" />
          </label>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className={cx(inlineInputClass, "w-auto")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="email">Email A–Z</option>
          </select>
        </div>
        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Empty title="No subscribers here yet">Sign-ups from the website footer appear here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Signed up</th>
                  <th className="px-4 py-2.5 font-medium">From page</th>
                  {canManage ? <th className="px-4 py-2.5" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((s) => (
                  <tr key={s.id} className="hover:bg-surface">
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{s.email}</span>
                      {s.name ? <span className="block text-xs text-muted">{s.name}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                      {s.confirmedAt && s.status === "subscribed" ? <span className="block pt-0.5 text-xs text-muted">Confirmed {formatDate(s.confirmedAt, false)}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-muted" title={formatDate(s.createdAt)}>
                      {timeAgo(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-muted">{s.sourcePath ?? "—"}</td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <ConfirmButton onConfirm={() => erase(s)} confirmLabel="Erase" prompt="Erase permanently?">
                          Erase
                        </ConfirmButton>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && data?.length ? <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} noun="subscribers" onPage={setPage} /> : null}
      </Card>
      <p className="mt-4 text-xs text-muted">The export contains confirmed subscribers by default — import it into your mailing tool. Erasing removes the address for good (for data-protection requests).</p>
    </>
  );
}
