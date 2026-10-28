import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { deleteOrderNote } from "@/server/services/orders";

export const DELETE = adminApi<{ id: string; noteId: string }>({ name: "orders.note-delete", permission: "orders:write" }, async (ctx) =>
  deleteOrderNote(ctx.params.id, ctx.params.noteId, actorOf(ctx.auth), ctx.ipHash),
);
