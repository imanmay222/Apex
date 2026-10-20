import { connectDb } from "../db/connect";
import {
  AdminUserModel,
  EnquiryModel,
  GalleryModel,
  LogoModel,
  ProductModel,
  SurveyModel,
  TestimonialModel,
  TrainingModel,
} from "../db/models";

const DAY = 86_400_000;

export async function dashboardSnapshot() {
  await connectDb();
  const since = new Date(Date.now() - 14 * DAY);
  const notSpam = { status: { $ne: "spam" as const } };

  const [content, enquiryFacets, recent, users] = await Promise.all([
    Promise.all([
      ProductModel.countDocuments(),
      SurveyModel.countDocuments(),
      TrainingModel.countDocuments(),
      GalleryModel.countDocuments(),
      TestimonialModel.countDocuments(),
      LogoModel.countDocuments(),
    ]),
    EnquiryModel.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byType: [{ $match: notSpam }, { $group: { _id: "$type", count: { $sum: 1 } } }],
          byDay: [
            { $match: { ...notSpam, createdAt: { $gte: since } } },
            { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "day" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          // Time-to-first-response, for enquiries that have one.
          response: [
            { $match: { firstResponseAt: { $exists: true } } },
            { $group: { _id: null, avgMs: { $avg: { $subtract: ["$firstResponseAt", "$createdAt"] } }, count: { $sum: 1 } } },
          ],
          unassignedOpen: [{ $match: { status: { $in: ["new", "contacted"] }, assignedTo: { $exists: false } } }, { $count: "count" }],
          failedNotifications: [
            { $match: { $or: [{ "notifications.sales.status": "failed" }, { "notifications.customer.status": "failed" }, { "notifications.webhook.status": "failed" }] } },
            { $count: "count" },
          ],
        },
      },
    ]),
    EnquiryModel.find(notSpam).sort({ createdAt: -1 }).limit(5).select("reference name type subjectTitle status createdAt").lean(),
    AdminUserModel.countDocuments({ active: true }),
  ]);

  const f = enquiryFacets[0];
  const counts = (rows: { _id: string; count: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

  // Fill every day in the window, so charts get a continuous series.
  const byDay = new Map<string, number>(f.byDay.map((r: { _id: Date; count: number }) => [r._id.toISOString().slice(0, 10), r.count]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10);
    return { date, count: byDay.get(date) ?? 0 };
  });

  const [products, surveys, training, gallery, testimonials, logos] = content;
  const response = f.response[0];

  return {
    content: { products, surveys, training, gallery, testimonials, logos },
    enquiries: {
      byStatus: counts(f.byStatus),
      byType: counts(f.byType),
      last14Days: series,
      open: (counts(f.byStatus).new ?? 0) + (counts(f.byStatus).contacted ?? 0),
      unassignedOpen: f.unassignedOpen[0]?.count ?? 0,
      failedNotifications: f.failedNotifications[0]?.count ?? 0,
      avgFirstResponseHours: response ? Math.round((response.avgMs / 3_600_000) * 10) / 10 : null,
      recent: recent.map((r) => ({
        id: String(r._id),
        reference: r.reference,
        name: r.name,
        type: r.type,
        subject: r.subjectTitle ?? null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    activeUsers: users,
  };
}
