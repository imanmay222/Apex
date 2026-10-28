"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Mail, Phone, WhatsApp } from "../icons";
import { adminApi, errorMessage, useAdminQuery } from "./api";
import type { Assignee } from "./enquiries-list";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_TYPE_LABELS, formatDate, subjectUrl, timeAgo } from "./format";
import { ExternalLink, Trash } from "./icons";
import { ActivityCard, NotesCard, NotificationsCard, SpamCard } from "./record-parts";
import { Button, Card, ConfirmButton, ErrorNotice, Field, Loading, PageHeader, PriorityBadge, StatusBadge, btn, inputClass, useToast } from "./ui";

type Delivery = { status: string; attempts: number; lastAttemptAt: string | null; sentAt: string | null; lastError: string | null };

export type Enquiry = {
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
  notes: { id: string; authorId: string | null; authorName: string; body: string; createdAt: string }[];
  statusHistory: { status: string; at: string; by: string }[];
  firstResponseAt: string | null;
  source: Record<string, string | undefined>;
  spam: { score: number; reasons: string[] };
  notifications: Record<"sales" | "customer" | "webhook", Delivery>;
  createdAt: string;
  updatedAt: string;
};

const CHANNEL_LABELS = { sales: "Sales team email", customer: "Customer acknowledgement", webhook: "Webhook" } as const;

export function EnquiryDetail({ id, viewer, canWrite, canDelete }: { id: string; viewer: { id: string; role: string }; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { data: enquiry, error, loading, reload, setData } = useAdminQuery<Enquiry>(`/api/admin/enquiries/${id}`);
  const assignees = useAdminQuery<Assignee[]>("/api/admin/assignees");
  const [saving, setSaving] = useState<string | null>(null);

  async function update(patch: Partial<{ status: string; priority: string; assignedTo: string | null; tags: string[] }>, message: string) {
    setSaving(Object.keys(patch)[0]);
    try {
      setData(await adminApi.patch<Enquiry>(`/api/admin/enquiries/${id}`, patch));
      toast(message);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(null);
    }
  }

  if (error) {
    return (
      <>
        <BackLink />
        <ErrorNotice error={error.status === 404 ? "This enquiry doesn't exist or was deleted." : error} onRetry={error.status === 404 ? undefined : reload} />
      </>
    );
  }
  if (loading || !enquiry) return <Loading />;

  const subjectHref = enquiry.subject ? subjectUrl(enquiry.type, enquiry.subject.slug) : null;
  const waNumber = enquiry.mobile.replace(/\D/g, "");
  const firstName = enquiry.name.split(" ")[0];
  const waText = encodeURIComponent(`Hello ${firstName}, this is Apex Care Technologies regarding your enquiry ${enquiry.reference}.`);
  const mailSubject = encodeURIComponent(`Your enquiry ${enquiry.reference} — Apex Care Technologies`);

  return (
    <>
      <PageHeader
        back={<BackLink />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {enquiry.name}
            <StatusBadge status={enquiry.status} />
            <PriorityBadge priority={enquiry.priority} />
          </span>
        }
        description={
          <>
            <span className="tabular-nums">{enquiry.reference}</span> · received {formatDate(enquiry.createdAt)} ({timeAgo(enquiry.createdAt)})
          </>
        }
        actions={
          <>
            <a href={`tel:${enquiry.mobile}`} className={btn("brand")}>
              <Phone className="size-4" /> Call
            </a>
            <a href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noopener noreferrer" className={btn("secondary")}>
              <WhatsApp className="size-4" /> WhatsApp
            </a>
            {enquiry.email ? (
              <a href={`mailto:${enquiry.email}?subject=${mailSubject}`} className={btn("secondary")}>
                <Mail className="size-4" /> Email
              </a>
            ) : null}
          </>
        }
      />

      {enquiry.status === "spam" ? (
        <div className="mb-6 rounded-xl border border-red-600/30 bg-red-600/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          This enquiry was filtered as spam (score {enquiry.spam.score}) and was not emailed to the team. Spam is deleted automatically after 30 days.
          {canWrite ? " If it's genuine, change its status to “New”." : ""}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card title="Message">
            <dl className="mb-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Enquiry for">
                {ENQUIRY_TYPE_LABELS[enquiry.type] ?? enquiry.type}
                {enquiry.subject ? (
                  <>
                    {" · "}
                    {subjectHref ? (
                      <a href={subjectHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-800 hover:underline dark:text-brand-300">
                        {enquiry.subject.title} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      enquiry.subject.title
                    )}
                  </>
                ) : null}
              </Detail>
              <Detail label="Mobile">
                <a href={`tel:${enquiry.mobile}`} className="tabular-nums hover:underline">
                  {enquiry.mobile}
                </a>
              </Detail>
              <Detail label="Email">
                {enquiry.email ? (
                  <a href={`mailto:${enquiry.email}`} className="hover:underline">
                    {enquiry.email}
                  </a>
                ) : (
                  <span className="text-muted">Not given</span>
                )}
              </Detail>
              <Detail label="Sent from">{enquiry.source.path ? <span className="break-all">{enquiry.source.path}</span> : <span className="text-muted">—</span>}</Detail>
            </dl>
            <p className="rounded-lg bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">{enquiry.message}</p>
            {enquiry.source.referrer || enquiry.source.utmSource ? (
              <p className="mt-3 text-xs text-muted">
                {enquiry.source.referrer ? <>Referrer: {enquiry.source.referrer}. </> : null}
                {enquiry.source.utmSource ? (
                  <>
                    Campaign: {[enquiry.source.utmSource, enquiry.source.utmMedium, enquiry.source.utmCampaign].filter(Boolean).join(" / ")}
                  </>
                ) : null}
              </p>
            ) : null}
          </Card>

          <NotesCard record={enquiry} apiBase={`/api/admin/enquiries/${enquiry.id}`} viewer={viewer} canWrite={canWrite} onChange={setData} placeholder="e.g. Called, sending quote for 200 helmets by Friday." />

          <ActivityCard history={enquiry.statusHistory} labels={ENQUIRY_STATUS_LABELS} createdAt={enquiry.createdAt} firstResponseAt={enquiry.firstResponseAt} />
        </div>

        <div className="space-y-6">
          <Card title="Handle this enquiry">
            <div className="space-y-4">
              <Field label="Status" htmlFor="status">
                <select
                  id="status"
                  value={enquiry.status}
                  disabled={!canWrite || saving !== null}
                  onChange={(e) => update({ status: e.target.value }, `Status set to “${ENQUIRY_STATUS_LABELS[e.target.value]}”.`)}
                  className={inputClass}
                >
                  {Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority" htmlFor="priority">
                <select
                  id="priority"
                  value={enquiry.priority}
                  disabled={!canWrite || saving !== null}
                  onChange={(e) => update({ priority: e.target.value }, "Priority updated.")}
                  className={inputClass}
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </Field>
              <Field label="Assigned to" htmlFor="assignee">
                <div className="flex gap-2">
                  <select
                    id="assignee"
                    value={enquiry.assignedTo?.id ?? ""}
                    disabled={!canWrite || saving !== null}
                    onChange={(e) => update({ assignedTo: e.target.value || null }, e.target.value ? "Assigned." : "Unassigned.")}
                    className={inputClass}
                  >
                    <option value="">Nobody</option>
                    {(assignees.data ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    {enquiry.assignedTo && !(assignees.data ?? []).some((a) => a.id === enquiry.assignedTo!.id) ? (
                      <option value={enquiry.assignedTo.id}>{enquiry.assignedTo.name}</option>
                    ) : null}
                  </select>
                  {canWrite && enquiry.assignedTo?.id !== viewer.id ? (
                    <Button size="md" onClick={() => update({ assignedTo: viewer.id }, "Assigned to you.")} disabled={saving !== null}>
                      Me
                    </Button>
                  ) : null}
                </div>
              </Field>
              <TagEditor tags={enquiry.tags} disabled={!canWrite} busy={saving === "tags"} onSave={(tags) => update({ tags }, "Tags saved.")} />
            </div>
          </Card>

          <NotificationsCard<Enquiry> notifications={enquiry.notifications} apiBase={`/api/admin/enquiries/${enquiry.id}`} canWrite={canWrite} onResent={setData} labels={CHANNEL_LABELS} />

          <SpamCard spam={enquiry.spam} />

          {canDelete ? (
            <Card title="Delete">
              <p className="mb-3 text-sm text-muted">Permanently removes this enquiry and its notes. Prefer “Archived” to keep a record.</p>
              <ConfirmButton
                onConfirm={async () => {
                  try {
                    await adminApi.del(`/api/admin/enquiries/${enquiry.id}`);
                    toast(`Deleted ${enquiry.reference}.`);
                    router.push("/admin/enquiries");
                  } catch (err) {
                    toast(errorMessage(err), "error");
                  }
                }}
              >
                <Trash className="size-3.5" /> Delete enquiry
              </ConfirmButton>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/admin/enquiries" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
      <ArrowLeft className="size-4" /> All enquiries
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function TagEditor({ tags, disabled, busy, onSave }: { tags: string[]; disabled: boolean; busy: boolean; onSave: (tags: string[]) => void }) {
  const [value, setValue] = useState(tags.join(", "));
  const parsed = [...new Set(value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const changed = parsed.join(",") !== tags.join(",");
  return (
    <Field label="Tags" htmlFor="tags" hint="Comma separated, e.g. bulk, repeat-customer">
      <div className="flex gap-2">
        <input id="tags" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} className={inputClass} placeholder="Add tags…" />
        {changed && !disabled ? (
          <Button onClick={() => onSave(parsed.slice(0, 10))} busy={busy}>
            Save
          </Button>
        ) : null}
      </div>
    </Field>
  );
}
