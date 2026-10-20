import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent } from "@/server/lib/http";
import { enquiryUpdate } from "@/server/validation/enquiry";
import { deleteEnquiry, getEnquiry, updateEnquiry } from "@/server/services/enquiries";

export const GET = adminApi<{ id: string }>({ name: "enquiries.get", permission: "enquiries:read" }, async ({ params }) =>
  getEnquiry(params.id),
);

export const PATCH = adminApi<{ id: string }>({ name: "enquiries.update", permission: "enquiries:write" }, async (ctx) =>
  updateEnquiry(ctx.params.id, await ctx.json(enquiryUpdate), actorOf(ctx.auth), ctx.ipHash),
);

export const DELETE = adminApi<{ id: string }>({ name: "enquiries.delete", permission: "enquiries:delete" }, async (ctx) => {
  await deleteEnquiry(ctx.params.id, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
