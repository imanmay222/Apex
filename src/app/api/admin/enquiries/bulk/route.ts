import { actorOf } from "@/server/lib/admin";
import { forbidden } from "@/server/lib/errors";
import { adminApi } from "@/server/lib/http";
import { enquiryBulk } from "@/server/validation/enquiry";
import { bulkEnquiries } from "@/server/services/enquiries";

export const POST = adminApi({ name: "enquiries.bulk", permission: "enquiries:write" }, async (ctx) => {
  const input = await ctx.json(enquiryBulk);
  // Deleting is a stronger permission than triage.
  if (input.action === "delete" && ctx.auth.user.role !== "admin") {
    throw forbidden("Only administrators can delete enquiries.");
  }
  return bulkEnquiries(input, actorOf(ctx.auth), ctx.ipHash);
});
