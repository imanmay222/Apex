import { actorOf } from "@/server/lib/admin";
import { adminApi, created } from "@/server/lib/http";
import { enquiryNote } from "@/server/validation/enquiry";
import { addNote } from "@/server/services/enquiries";

export const POST = adminApi<{ id: string }>({ name: "enquiries.note", permission: "enquiries:write" }, async (ctx) => {
  const { body } = await ctx.json(enquiryNote);
  return created(await addNote(ctx.params.id, body, actorOf(ctx.auth), ctx.ipHash));
});
