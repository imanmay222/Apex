import { adminApi, paged } from "@/server/lib/http";
import { enquiryListQuery } from "@/server/validation/enquiry";
import { listEnquiries } from "@/server/services/enquiries";

export const GET = adminApi({ name: "enquiries.list", permission: "enquiries:read" }, async (ctx) => {
  const { items, meta } = await listEnquiries(ctx.query(enquiryListQuery));
  return paged(items, meta);
});
