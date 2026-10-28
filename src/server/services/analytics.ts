import { env } from "../config/env";
import { connectDb } from "../db/connect";
import { AnalyticsModel, EnquiryModel, OrderModel, type EventType } from "../db/models";
import { hmacHex } from "../lib/crypto";
import { deviceClass, isLikelyBot } from "../lib/request";

/** Normalises a path for storage: no query/hash, must be a site path, never the API or admin. */
export function cleanPath(raw: string): string | null {
  const path = raw.split(/[?#]/)[0].trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 300) return null;
  if (path.startsWith("/api/") || path.startsWith("/admin") || path.startsWith("/_next")) return null;
  return path === "/" ? "/" : path.replace(/\/+$/, "");
}

function referrerHost(raw: string | undefined, ownHost: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return host === ownHost?.replace(/^www\./, "").split(":")[0] ? undefined : host.slice(0, 120);
  } catch {
    return undefined;
  }
}

export interface RecordInput {
  type: EventType;
  path: string;
  ref?: string;
  referrer?: string;
}

/**
 * Stores one event. Bots are dropped. The visitor id is a daily-rotating keyed hash of
 * ip + user-agent, so unique-visitor counts work without storing anything that identifies a person.
 */
export async function recordEvent(
  input: RecordInput,
  client: { ip: string; userAgent: string; host: string | null },
): Promise<boolean> {
  if (isLikelyBot(client.userAgent)) return false;
  const path = cleanPath(input.path);
  if (!path) return false;

  await connectDb();
  const day = new Date().toISOString().slice(0, 10);
  await AnalyticsModel.create({
    type: input.type,
    path,
    ref: input.ref?.slice(0, 120),
    referrerHost: referrerHost(input.referrer, client.host),
    device: deviceClass(client.userAgent),
    visitor: hmacHex(env().sessionSecret, `${day}|${client.ip}|${client.userAgent}`).slice(0, 16),
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

export async function analyticsSummary(from: Date, to: Date) {
  await connectDb();
  const range = { at: { $gte: from, $lte: to } };

  const [facets] = await AnalyticsModel.aggregate([
    { $match: range },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              pageViews: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
              catalogueDownloads: { $sum: { $cond: [{ $eq: ["$type", "catalogue_download"] }, 1, 0] } },
              ctaClicks: { $sum: { $cond: [{ $eq: ["$type", "cta_click"] }, 1, 0] } },
              searches: { $sum: { $cond: [{ $eq: ["$type", "search"] }, 1, 0] } },
            },
          },
        ],
        // Visitor ids rotate daily, so "visitors" = sum of distinct daily visitors.
        daily: [
          { $group: { _id: { day: { $dateTrunc: { date: "$at", unit: "day" } }, visitor: "$visitor" }, views: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } } } },
          { $group: { _id: "$_id.day", visitors: { $sum: 1 }, pageViews: { $sum: "$views" } } },
          { $sort: { _id: 1 } },
        ],
        topPages: [
          { $match: { type: "page_view" } },
          { $group: { _id: "$path", count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 10 },
        ],
        topProducts: [{ $match: { type: "product_view", ref: { $ne: null } } }, { $group: { _id: "$ref", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }],
        topSurveys: [{ $match: { type: "survey_view", ref: { $ne: null } } }, { $group: { _id: "$ref", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }],
        topSearches: [{ $match: { type: "search", ref: { $ne: null } } }, { $group: { _id: "$ref", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }],
        ctas: [{ $match: { type: "cta_click", ref: { $ne: null } } }, { $group: { _id: "$ref", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
        devices: [{ $group: { _id: "$device", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        referrers: [{ $match: { referrerHost: { $ne: null } } }, { $group: { _id: "$referrerHost", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 10 }],
      },
    },
  ]);

  const totals = facets.totals[0] ?? { events: 0, pageViews: 0, catalogueDownloads: 0, ctaClicks: 0, searches: 0 };
  const daily: { _id: Date; visitors: number; pageViews: number }[] = facets.daily;
  const visitors = daily.reduce((sum, d) => sum + d.visitors, 0);

  const [enquiries, orders] = await Promise.all([
    EnquiryModel.countDocuments({ createdAt: range.at, status: { $ne: "spam" } }),
    OrderModel.countDocuments({ createdAt: range.at, status: { $ne: "spam" } }),
  ]);

  const named = (rows: { _id: string; count: number }[]) => rows.map((r) => ({ name: r._id, count: r.count }));

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      pageViews: totals.pageViews,
      visitors,
      enquiries,
      orders,
      // Enquiries per 100 visitor-days; null rather than a misleading 0 when there's no traffic.
      conversionRate: visitors > 0 ? Math.round((enquiries / visitors) * 10_000) / 100 : null,
      catalogueDownloads: totals.catalogueDownloads,
      ctaClicks: totals.ctaClicks,
      searches: totals.searches,
    },
    timeseries: daily.map((d) => ({ date: d._id.toISOString().slice(0, 10), visitors: d.visitors, pageViews: d.pageViews })),
    topPages: named(facets.topPages),
    topProducts: named(facets.topProducts),
    topSurveys: named(facets.topSurveys),
    topSearches: named(facets.topSearches),
    ctaClicks: named(facets.ctas),
    devices: named(facets.devices),
    referrers: named(facets.referrers),
  };
}

