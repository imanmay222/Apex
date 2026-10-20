import { z } from "zod";
import { ROLES } from "@/server/db/models";
import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent } from "@/server/lib/http";
import { line } from "@/server/validation/primitives";
import { deleteUser, getUser, updateUser } from "@/server/services/users";

const patch = z.object({ name: line(2, 100), role: z.enum(ROLES), active: z.boolean() }).partial().strict();

export const GET = adminApi<{ id: string }>({ name: "users.get", permission: "users:manage" }, async ({ params }) =>
  getUser(params.id),
);

export const PATCH = adminApi<{ id: string }>({ name: "users.update", permission: "users:manage" }, async (ctx) =>
  updateUser(ctx.params.id, await ctx.json(patch), actorOf(ctx.auth), ctx.ipHash),
);

export const DELETE = adminApi<{ id: string }>({ name: "users.delete", permission: "users:manage" }, async (ctx) => {
  await deleteUser(ctx.params.id, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
