import { z } from "zod";
import { ROLES } from "@/server/db/models";
import { actorOf } from "@/server/lib/admin";
import { adminApi, created } from "@/server/lib/http";
import { email, line } from "@/server/validation/primitives";
import { createUser, listUsers } from "@/server/services/users";

const body = z
  .object({ email, name: line(2, 100), role: z.enum(ROLES), password: z.string().min(1).max(200) })
  .strict();

export const GET = adminApi({ name: "users.list", permission: "users:manage" }, async () => listUsers());

export const POST = adminApi({ name: "users.create", permission: "users:manage", maxBodyBytes: 4 * 1024 }, async (ctx) => {
  const input = await ctx.json(body);
  return created(await createUser(input, actorOf(ctx.auth), ctx.ipHash));
});
