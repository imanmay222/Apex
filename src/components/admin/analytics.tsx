"use client";

import { useMemo, useState } from "react";
import { cx } from "../ui";
import { useAdminQuery, withQuery } from "./api";
import { ColumnChart, RankedList, StatTile } from "./charts";
import { capitalize, dateInputValue, formatNumber } from "./format";
import { Card, ErrorNotice, Loading, PageHeader, Tabs } from "./ui";
import { inlineInputClass } from "./styles";

type Row = { name: string; count: number };
type Summary = {
  range: { from: string; to: string };
  totals: { pageViews: number; visitors: number; enquiries: number; orders: number; conversionRate: number | null; catalogueDownloads: number; ctaClicks: number; searches: number };
  timeseries: { date: string; visitors: number; pageViews: number }[];
  topPages: Row[];
  topProducts: Row[];
  topSurveys: Row[];
  topSearches: Row[];
  ctaClicks: Row[];
  devices: Row[];
  referrers: Row[];
};

const CTA_LABELS: Record<string, string> = { call: "Phone calls", whatsapp: "WhatsApp", email: "Email links", map: "Map / directions", products: "Products (mobile bar)", quote: "Quote basket (mobile bar)" };

/** Fills days with no events so the chart shows gaps as zero, not as missing bars. */
function fillDays(series: Summary["timeseries"], from: string, to: string) {
  const byDate = new Map(series.map((d) => [d.date, d]));
  const out: Summary["timeseries"] = [];
  const end = new Date(to);
  for (let d = new Date(from); d <= end && out.length < 400; d = new Date(d.getTime() + 86_400_000)) {
    const date = d.toISOString().slice(0, 10);
    out.push(byDate.get(date) ?? { date, visitors: 0, pageViews: 0 });
  }
  return out;
}

export function Analytics() {
  const [range, setRange] = useState<"7" | "30" | "90" | "custom">("30");
  const [from, setFrom] = useState(() => dateInputValue(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => dateInputValue(new Date()));

  const path =
    range === "custom"
      ? from && to && from < to
        ? withQuery("/api/admin/analytics", { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59.999`).toISOString() })
        : null
      : withQuery("/api/admin/analytics", { days: range });
  const { data, error, loading, reload } = useAdminQuery<Summary>(path);
  const series = useMemo(() => (data ? fillDays(data.timeseries, data.range.from, data.range.to) : []), [data]);

  return (
    <>
      <PageHeader
        title="Website analytics"
        description="First-party and cookie-free: no IP addresses are stored, and visitors with Do Not Track are not counted."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={range}
              onChange={setRange}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {range === "custom" ? (
              <span className="flex items-center gap-1.5 text-sm">
                <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className={cx(inlineInputClass, "w-auto py-1.5")} />
                –
                <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className={cx(inlineInputClass, "w-auto py-1.5")} />
              </span>
            ) : null}
          </div>
        }
      />

      {path === null ? (
        <ErrorNotice error="Choose a start date before the end date." />
      ) : error ? (
        <ErrorNotice error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={cx("space-y-6", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Visitors" value={formatNumber(data.totals.visitors)} hint="Unique per day, summed" />
            <StatTile label="Page views" value={formatNumber(data.totals.pageViews)} />
            <StatTile
              label="Enquiries"
              value={formatNumber(data.totals.enquiries)}
              hint={data.totals.conversionRate === null ? "No traffic yet" : `${data.totals.conversionRate}% of visitors`}
              href="/admin/enquiries"
            />
            <StatTile label="Quote orders" value={formatNumber(data.totals.orders)} hint="Baskets sent from the website" href="/admin/orders" />
            <StatTile label="Catalogue downloads" value={formatNumber(data.totals.catalogueDownloads)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Visitors per day">
              <ColumnChart label="Visitors per day" points={series.map((d) => ({ date: d.date, value: d.visitors }))} />
            </Card>
            <Card title="Page views per day">
              <ColumnChart label="Page views per day" points={series.map((d) => ({ date: d.date, value: d.pageViews }))} />
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card title="Top pages">
              <RankedList rows={data.topPages} />
            </Card>
            <Card title="Most viewed products">
              <RankedList rows={data.topProducts} format={(slug) => slug.replace(/-/g, " ")} hrefFor={(slug) => `/products/${slug}`} />
            </Card>
            <Card title="Most viewed surveys">
              <RankedList rows={data.topSurveys} format={(slug) => slug.replace(/-/g, " ")} hrefFor={(slug) => `/survey/${slug}`} />
            </Card>
            <Card title={`Contact clicks · ${formatNumber(data.totals.ctaClicks)}`}>
              <RankedList rows={data.ctaClicks} format={(name) => CTA_LABELS[name] ?? capitalize(name)} />
            </Card>
            <Card title={`Site searches · ${formatNumber(data.totals.searches)}`}>
              <RankedList rows={data.topSearches} empty="No searches yet." format={(term) => `“${term}”`} />
            </Card>
            <Card title="Where visitors come from">
              <RankedList rows={data.referrers} empty="Only direct visits so far." />
            </Card>
            <Card title="Devices">
              <RankedList rows={data.devices} format={(d) => capitalize(d || "unknown")} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
