"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Mail, MapPin, Phone, WhatsApp } from "../icons";
import { adminApi, errorMessage, useAdminQuery } from "./api";
import type { Assignee } from "./enquiries-list";
import { ORDER_STATUS_LABELS, formatDate, timeAgo } from "./format";
import { Copy, ExternalLink, FileText, Trash } from "./icons";
import { ActivityCard, NotesCard, NotificationsCard, SpamCard } from "./record-parts";
import { Button, Card, ConfirmButton, ErrorNotice, Field, Loading, OrderStatusBadge, PageHeader, btn, inputClass, useToast } from "./ui";

type Delivery = { status: string; attempts: number; lastAttemptAt: string | null; sentAt: string | null; lastError: string | null };

export type Order = {
  id: string;
  reference: string;
  items: { product: { slug: string; title: string }; quantity: number; note: string | null }[];
  totalUnits: number;
  name: string;
  mobile: string;
  email: string | null;
  company: string | null;
  gstin: string | null;
  address: { line1: string; line2: string | null; city: string; state: string; postalCode: string };
  customerNotes: string | null;
  status: string;
  assignedTo: { id: string; name: string } | null;
  notes: { id: string; authorId: string | null; authorName: string; body: string; createdAt: string }[];
  statusHistory: { status: string; at: string; by: string }[];
  firstResponseAt: string | null;
  source: Record<string, string | undefined>;
  spam: { score: number; reasons: string[] };
  notifications: Record<"sales" | "customer" | "webhook", Delivery>;
  createdAt: string;
  updatedAt: string;
};

const CHANNEL_LABELS = { sales: "Sales team email", customer: "Customer confirmation", webhook: "Webhook" } as const;

/** The usual next step from each status, offered as a one-click button. */
const NEXT_STEP: Record<string, { status: string; label: string }> = {
  new: { status: "quoted", label: "Mark quote sent" },
  quoted: { status: "confirmed", label: "Mark confirmed" },
  confirmed: { status: "dispatched", label: "Mark dispatched" },
  dispatched: { status: "delivered", label: "Mark delivered" },
};

const STATUS_HELP: Record<string, string> = {
  new: "Just arrived. Check availability and send the customer a quote.",
  quoted: "Quote sent. Waiting for the customer to approve it.",
  confirmed: "Customer approved the quote. Prepare the goods.",
  dispatched: "On its way to the customer.",
  delivered: "Delivered. Nothing more to do.",
  cancelled: "Cancelled by the customer or the team.",
  spam: "Filtered as spam: not emailed to the team, deleted after 30 days.",
};

export function OrderDetail({ id, viewer, canWrite, canDelete }: { id: string; viewer: { id: string; role: string }; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { data: order, error, loading, reload, setData } = useAdminQuery<Order>(`/api/admin/orders/${id}`);
  const assignees = useAdminQuery<Assignee[]>("/api/admin/assignees");
  const [saving, setSaving] = useState(false);

  async function update(patch: { status?: string; assignedTo?: string | null }, message: string) {
    setSaving(true);
    try {
      setData(await adminApi.patch<Order>(`/api/admin/orders/${id}`, patch));
      toast(message);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <>
        <BackLink />
        <ErrorNotice error={error.status === 404 ? "This order doesn't exist or was deleted." : error} onRetry={error.status === 404 ? undefined : reload} />
      </>
    );
  }
  if (loading || !order) return <Loading />;

  const apiBase = `/api/admin/orders/${order.id}`;
  const firstName = order.name.split(" ")[0];
  const waText = encodeURIComponent(`Hello ${firstName}, this is Apex Care Technologies regarding your order ${order.reference}.`);
  const mailSubject = encodeURIComponent(`Your order ${order.reference} — Apex Care Technologies`);
  const addressLines = [order.address.line1, order.address.line2, `${order.address.city}, ${order.address.state} ${order.address.postalCode}`].filter(Boolean) as string[];
  const next = NEXT_STEP[order.status];

  return (
    <>
      <PageHeader
        back={<BackLink />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.name}
            <OrderStatusBadge status={order.status} />
          </span>
        }
        description={
          <>
            Order <span className="tabular-nums">{order.reference}</span> · received {formatDate(order.createdAt)} ({timeAgo(order.createdAt)})
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <a href={`tel:${order.mobile}`} className={btn("brand")}>
              <Phone className="size-4" /> Call
            </a>
            <a href={`https://wa.me/${order.mobile.replace(/\D/g, "")}?text=${waText}`} target="_blank" rel="noopener noreferrer" className={btn("secondary")}>
              <WhatsApp className="size-4" /> WhatsApp
            </a>
            {order.email ? (
              <a href={`mailto:${order.email}?subject=${mailSubject}`} className={btn("secondary")}>
                <Mail className="size-4" /> Email
              </a>
            ) : null}
            <Button onClick={() => window.print()}>
              <FileText className="size-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] print:block">
        <div className="space-y-6">
          <Card title={`Products · ${order.items.length} line${order.items.length === 1 ? "" : "s"}, ${order.totalUnits.toLocaleString("en-IN")} units`} padded={false}>
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  <th className="w-10 px-5 py-2.5 font-medium">#</th>
                  <th className="px-2 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 text-right font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item, i) => (
                  <tr key={`${item.product.slug}-${i}`} className="align-top">
                    <td className="px-5 py-3 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-2 py-3">
                      <a href={`/products/${item.product.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-safety-500 hover:underline">
                        {item.product.title}
                        <ExternalLink className="size-3 print:hidden" />
                      </a>
                      {item.note ? <p className="mt-0.5 text-xs text-muted">{item.note}</p> : null}
                    </td>
                    <td className="px-5 py-3 text-right text-base font-semibold text-foreground tabular-nums">{item.quantity.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {order.customerNotes ? (
              <div className="border-t border-border px-5 py-4">
                <p className="text-xs text-muted">Customer&apos;s notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{order.customerNotes}</p>
              </div>
            ) : null}
          </Card>

          <Card title="Customer & delivery">
            <div className="grid gap-6 sm:grid-cols-2">
              <dl className="space-y-3 text-sm">
                <Detail label="Name">{order.name}</Detail>
                {order.company ? <Detail label="Company">{order.company}</Detail> : null}
                {order.gstin ? (
                  <Detail label="GSTIN">
                    <span className="font-mono">{order.gstin}</span>
                  </Detail>
                ) : null}
                <Detail label="Mobile">
                  <a href={`tel:${order.mobile}`} className="tabular-nums hover:underline">
                    {order.mobile}
                  </a>
                </Detail>
                <Detail label="Email">
                  {order.email ? (
                    <a href={`mailto:${order.email}`} className="hover:underline">
                      {order.email}
                    </a>
                  ) : (
                    <span className="text-muted">Not given</span>
                  )}
                </Detail>
              </dl>
              <div className="text-sm">
                <p className="text-xs text-muted">Deliver to</p>
                <address className="mt-0.5 leading-relaxed text-foreground not-italic">
                  {order.company ? (
                    <>
                      {order.company}
                      <br />
                    </>
                  ) : null}
                  {addressLines.map((addressLine) => (
                    <span key={addressLine} className="block">
                      {addressLine}
                    </span>
                  ))}
                </address>
                <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                  <Button
                    size="sm"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText([order.name, order.company, ...addressLines, order.mobile].filter(Boolean).join("\n"))
                        .then(() => toast("Address copied."), () => toast("Couldn't copy — select the address instead.", "error"))
                    }
                  >
                    <Copy className="size-3.5" /> Copy address
                  </Button>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(", "))}`} target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>
                    <MapPin className="size-3.5" /> Open in Maps
                  </a>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-6 print:hidden">
            <NotesCard record={order} apiBase={apiBase} viewer={viewer} canWrite={canWrite} onChange={setData} placeholder="e.g. Quoted ₹1,24,000 + GST by email; dispatch from Cuddalore warehouse." audience="customers tracking their order" />
            <ActivityCard history={order.statusHistory} labels={ORDER_STATUS_LABELS} createdAt={order.createdAt} firstResponseAt={order.firstResponseAt} />
          </div>
        </div>

        <div className="space-y-6 print:hidden">
          <Card title="Handle this order">
            <div className="space-y-4">
              <Field label="Status" htmlFor="status" hint={STATUS_HELP[order.status]}>
                <select
                  id="status"
                  value={order.status}
                  disabled={!canWrite || saving}
                  onChange={(e) => update({ status: e.target.value }, `Status set to “${ORDER_STATUS_LABELS[e.target.value]}”.`)}
                  className={inputClass}
                >
                  {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {canWrite && next ? (
                <Button variant="primary" className="w-full" busy={saving} onClick={() => update({ status: next.status }, `Status set to “${ORDER_STATUS_LABELS[next.status]}”.`)}>
                  {next.label}
                </Button>
              ) : null}
              <Field label="Assigned to" htmlFor="assignee">
                <div className="flex gap-2">
                  <select id="assignee" value={order.assignedTo?.id ?? ""} disabled={!canWrite || saving} onChange={(e) => update({ assignedTo: e.target.value || null }, e.target.value ? "Assigned." : "Unassigned.")} className={inputClass}>
                    <option value="">Nobody</option>
                    {(assignees.data ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    {order.assignedTo && !(assignees.data ?? []).some((a) => a.id === order.assignedTo!.id) ? <option value={order.assignedTo.id}>{order.assignedTo.name}</option> : null}
                  </select>
                  {canWrite && order.assignedTo?.id !== viewer.id ? (
                    <Button onClick={() => update({ assignedTo: viewer.id }, "Assigned to you.")} disabled={saving}>
                      Me
                    </Button>
                  ) : null}
                </div>
              </Field>
              <p className="text-xs text-muted">The customer sees “{ORDER_STATUS_LABELS[order.status]}” when they track this order. Notes and the assignee stay internal.</p>
            </div>
          </Card>

          <NotificationsCard<Order> notifications={order.notifications} apiBase={apiBase} canWrite={canWrite} onResent={setData} labels={CHANNEL_LABELS} />
          <SpamCard spam={order.spam} />

          {canDelete ? (
            <Card title="Delete">
              <p className="mb-3 text-sm text-muted">Permanently removes this order and its notes. Prefer “Cancelled” to keep a record.</p>
              <ConfirmButton
                onConfirm={async () => {
                  try {
                    await adminApi.del(apiBase);
                    toast(`Deleted ${order.reference}.`);
                    router.push("/admin/orders");
                  } catch (err) {
                    toast(errorMessage(err), "error");
                  }
                }}
              >
                <Trash className="size-3.5" /> Delete order
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
    <Link href="/admin/orders" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground print:hidden">
      <ArrowLeft className="size-4" /> All orders
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}
