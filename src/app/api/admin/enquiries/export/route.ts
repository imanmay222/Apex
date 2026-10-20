import { adminApi } from "@/server/lib/http";
import { actorOf } from "@/server/lib/admin";
import { audit } from "@/server/services/audit";
import { enquiryListQuery } from "@/server/validation/enquiry";
import { exportEnquiriesCsv } from "@/server/services/enquiries";

/** CSV download honouring the same filters as the list endpoint (page/limit ignored). */
export const GET = adminApi({ name: "enquiries.export", permission: "enquiries:read", rateLimit: { limit: 20, windowSec: 60 } }, async (ctx) => {
  const filters = { ...ctx.query(enquiryListQuery), page: undefined, limit: undefined };
  const csv = await exportEnquiriesCsv(filters);
  await audit({ actor: actorOf(ctx.auth), action: "export", resource: "enquiries", ipHash: ctx.ipHash });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
