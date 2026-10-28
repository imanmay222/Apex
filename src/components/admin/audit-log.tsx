"use client";

import { useEffect, useState } from "react";
import { cx } from "../ui";
import { useAdminQuery, withQuery } from "./api";
import { capitalize, formatDate } from "./format";
import { Badge, Button, Card, Empty, ErrorNotice, Loading, PageHeader, Pagination, type Tone } from "./ui";
import { inlineInputClass } from "./styles";

type Entry = { id: string; at: string; actor: string | null; action: string; resource: string; resourceId: string | null; summary: string | null; fields: string[] };

const RESOURCES = ["orders", "enquiries", "products", "product-groups", "surveys", "training", "gallery", "testimonials", "logos", "leaders", "media", "settings", "subscribers", "users", "auth", "content", "cache"];
const ACTIONS = ["create", "update", "delete", "publish", "reorder", "bulk-delete", "status", "assign", "note", "note-delete", "resend", "upload", "export", "login", "logout", "change-password", "reset-password", "revalidate"];

const tone = (action: string): Tone =>
  action.includes("delete") ? "red" : action === "create" || action === "upload" ? "green" : action === "login" || action === "logout" ? "gray" : "blue";

export function AuditLog() {
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const [actorInput, setActorInput] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, error, loading, reload } = useAdminQuery<Entry[]>(withQuery("/api/admin/audit", { resource, action, actor, page, limit: 50 }));

  useEffect(() => {
    const timer = setTimeout(() => {
      const value = actorInput.trim();
      // The API matches the exact email; only query once it looks complete.
      if (value === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        setActor(value);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [actorInput]);

  return (
    <>
      <PageHeader title="Audit log" description="Who changed what, and when. Field names are recorded, not their values. Entries are kept for two years." />
      <Card padded={false}>
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <select aria-label="Area" value={resource} onChange={(e) => (setResource(e.target.value), setPage(1))} className={cx(inlineInputClass, "w-auto")}>
            <option value="">All areas</option>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {capitalize(r.replace("-", " "))}
              </option>
            ))}
          </select>
          <select aria-label="Action" value={action} onChange={(e) => (setAction(e.target.value), setPage(1))} className={cx(inlineInputClass, "w-auto")}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {capitalize(a.replace("-", " "))}
              </option>
            ))}
          </select>
          <input value={actorInput} onChange={(e) => setActorInput(e.target.value)} placeholder="Filter by user email" className={cx(inlineInputClass, "w-64 max-w-full")} type="search" aria-label="User email" />
          {resource || action || actor ? (
            <Button variant="ghost" onClick={() => (setResource(""), setAction(""), setActorInput(""), setActor(""), setPage(1))}>
              Clear
            </Button>
          ) : null}
        </div>
        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Empty title="No entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Who</th>
                  <th className="px-4 py-2.5 font-medium">What</th>
                  <th className="px-4 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-surface">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDate(e.at)}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.actor ?? <span className="text-muted">system</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={tone(e.action)}>{e.action.replace("-", " ")}</Badge>
                        <span className="text-foreground">{e.resource.replace("-", " ")}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {e.summary ? <span className="text-foreground">{e.summary}</span> : null}
                      {e.fields.length ? <span className="block text-xs">Fields: {e.fields.join(", ")}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && data?.length ? <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} noun="entries" onPage={setPage} /> : null}
      </Card>
    </>
  );
}
