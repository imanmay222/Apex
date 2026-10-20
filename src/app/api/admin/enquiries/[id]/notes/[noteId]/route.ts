import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { deleteNote } from "@/server/services/enquiries";

export const DELETE = adminApi<{ id: string; noteId: string }>(
  { name: "enquiries.note-delete", permission: "enquiries:write" },
  async (ctx) => deleteNote(ctx.params.id, ctx.params.noteId, actorOf(ctx.auth), ctx.ipHash),
);
