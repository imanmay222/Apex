"use client";

import Link from "next/link";
import type { Permission } from "@/server/auth/permissions";
import { useAdminQuery } from "./api";
import { ColumnChart, RankedList, StatTile } from "./charts";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_TYPE_LABELS, formatNumber, timeAgo } from "./format";
import { ArrowRight } from "../icons";
import { Card, ErrorNotice, Loading, OrderStatusBadge, PageHeader, StatusBadge, btn } from "./ui";

type Snapshot = {
  content: Record<"products" | "surveys" | "training" | "gallery" | "testimonials" | "logos", number>;
  enquiries: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    last14Days: { date: string; count: number }[];
    open: number;
    unassignedOpen: number;
    failedNotifications: number;
    avgFirstResponseHours: number | null;
    recent: { id: string; reference: string; name: string; type: string; subject: string | null; status: string; createdAt: string }[];
  };
  orders: {
    byStatus: Record<string, number>;
    open: number;
    unassignedOpen: number;
    last14Days: { date: string; count: number }[];
    topProducts: { name: string; count: number }[];
    recent: { id: string; reference: string; name: string; company: string | null; items: number; units: number; status: string; createdAt: string }[];
  } | null;
  activeUsers: number;
};

const QUICK_LINKS: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin/orders?status=new", label: "Quote new orders", permission: "orders:read" },
  { href: "/admin/content/products/new", label: "Add a product", permission: "content:write" },
  { href: "/admin/content/testimonials?view=pending", label: "Review testimonials", permission: "content:write" },
  { href: "/admin/media", label: "Upload images or the catalogue PDF", permission: "media:write" },
  { href: "/admin/settings", label: "Edit contact details & home page", permission: "settings:write" },
  { href: "/admin/analytics", label: "See website traffic", permission: "analytics:read" },
  { href: "/admin/subscribers", label: "Newsletter subscribers", permission: "subscribers:read" },
];

export function Dashboard({ name, permissions }: { name: string; permissions: Permission[] }) {
  const canEnquiries = permissions.includes("enquiries:read");
  const { data, error, loading, reload } = useAdminQuery<Snapshot>(canEnquiries ? "/api/admin/dashboard" : null);
  const links = QUICK_LINKS.filter((link) => permissions.includes(link.permission));
  const firstName = name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Here's what's happening with the website and enquiries." />

      {canEnquiries ? (
        error ? (
          <ErrorNotice error={error} onRetry={reload} />
        ) : loading || !data ? (
          <Loading />
        ) : (
          <div className="space-y-10">
            {data.orders ? <OrdersOverview orders={data.orders} /> : null}
            <EnquiryOverview data={data} />
          </div>
        )
      ) : null}

      {links.length ? (
        <Card title="Quick actions" className="mt-6">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-safety-500 hover:text-safety-500">
                  {link.label}
                  <ArrowRight className="size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display mb-3 text-lg font-semibold text-foreground">{children}</h2>;
}

function OrdersOverview({ orders }: { orders: NonNullable<Snapshot["orders"]> }) {
  const total14 = orders.last14Days.reduce((sum, d) => sum + d.count, 0);
  return (
    <section aria-label="Orders">
      <SectionTitle>Orders</SectionTitle>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="New orders" value={formatNumber(orders.byStatus.new ?? 0)} hint="Waiting for a quote" href="/admin/orders?status=new" />
          <StatTile label="Open orders" value={formatNumber(orders.open)} hint={`${orders.unassignedOpen} not assigned yet`} href="/admin/orders?status=new,quoted,confirmed,dispatched" />
          <StatTile label="Ready to dispatch" value={formatNumber(orders.byStatus.confirmed ?? 0)} hint="Quote accepted" href="/admin/orders?status=confirmed" />
          <StatTile label="Delivered" value={formatNumber(orders.byStatus.delivered ?? 0)} hint="All time" href="/admin/orders?status=delivered" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={`Orders, last 14 days · ${total14} total`} className="lg:col-span-2">
            <ColumnChart label="Orders per day" points={orders.last14Days.map((d) => ({ date: d.date, value: d.count }))} />
          </Card>
          <Card title="Most ordered (units)">
            <RankedList rows={orders.topProducts} empty="No orders yet." />
          </Card>
        </div>
        <Card
          title="Latest orders"
          padded={false}
          actions={
            <Link href="/admin/orders" className={btn("ghost", "sm")}>
              View all <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {orders.recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No orders yet. They appear here when a customer sends their quote basket.</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.recent.map((item) => (
                <li key={item.id}>
                  <Link href={`/admin/orders/${item.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                        {item.company ? <span className="font-normal text-muted"> · {item.company}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {item.items} product{item.items === 1 ? "" : "s"} · {formatNumber(item.units)} units · {item.reference}
                      </p>
                    </div>
                    <OrderStatusBadge status={item.status} />
                    <span className="hidden w-20 text-right text-xs text-muted sm:block">{timeAgo(item.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function EnquiryOverview({ data }: { data: Snapshot }) {
  const e = data.enquiries;
  const total14 = e.last14Days.reduce((sum, d) => sum + d.count, 0);
  const statusRows = Object.entries(e.byStatus)
    .filter(([status]) => status !== "spam")
    .map(([status, count]) => ({ name: status, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <section aria-label="Enquiries" className="space-y-6">
      {data.orders ? <SectionTitle>Enquiries</SectionTitle> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="New enquiries" value={formatNumber(e.byStatus.new ?? 0)} hint="Waiting for first contact" href="/admin/enquiries?status=new" />
        <StatTile label="Open enquiries" value={formatNumber(e.open)} hint={`${e.unassignedOpen} not assigned yet`} href="/admin/enquiries?status=new,contacted" />
        <StatTile
          label="Avg. first response"
          value={e.avgFirstResponseHours === null ? "—" : `${e.avgFirstResponseHours} h`}
          hint="From enquiry to first status change"
        />
        <StatTile
          label="Failed notifications"
          value={formatNumber(e.failedNotifications)}
          hint={e.failedNotifications ? "Open an enquiry to resend" : "All emails delivered"}
          tone={e.failedNotifications ? "alert" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Enquiries, last 14 days · ${total14} total`} className="lg:col-span-2">
          <ColumnChart label="Enquiries per day" points={e.last14Days.map((d) => ({ date: d.date, value: d.count }))} />
        </Card>
        <Card title="By status">
          <RankedList
            rows={statusRows}
            empty="No enquiries yet."
            format={(status) => ENQUIRY_STATUS_LABELS[status] ?? status}
            hrefFor={(status) => `/admin/enquiries?status=${status}`}
          />
          {e.byStatus.spam ? (
            <Link href="/admin/enquiries?status=spam" className="mt-4 block text-xs text-muted hover:text-foreground">
              {e.byStatus.spam} filtered as spam →
            </Link>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Latest enquiries"
          className="lg:col-span-2"
          padded={false}
          actions={
            <Link href="/admin/enquiries" className={btn("ghost", "sm")}>
              View all <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {e.recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No enquiries yet. They appear here the moment a customer submits the form.</p>
          ) : (
            <ul className="divide-y divide-border">
              {e.recent.map((item) => (
                <li key={item.id}>
                  <Link href={`/admin/enquiries/${item.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-xs text-muted">
                        {ENQUIRY_TYPE_LABELS[item.type] ?? item.type}
                        {item.subject ? ` · ${item.subject}` : ""} · {item.reference}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                    <span className="hidden w-20 text-right text-xs text-muted sm:block">{timeAgo(item.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="By type">
          <RankedList
            rows={Object.entries(e.byType).map(([type, count]) => ({ name: type, count })).sort((a, b) => b.count - a.count)}
            empty="No enquiries yet."
            format={(type) => ENQUIRY_TYPE_LABELS[type] ?? type}
            hrefFor={(type) => `/admin/enquiries?type=${type}`}
          />
          <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            {(
              [
                ["Products", data.content.products],
                ["Surveys", data.content.surveys],
                ["Training", data.content.training],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-display text-lg font-semibold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </section>
  );
}
