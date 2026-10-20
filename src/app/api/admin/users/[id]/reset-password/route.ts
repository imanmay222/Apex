import { z } from "zod";
import { actorOf } from "@/server/lib/admin";
import { adminApi, noContent } from "@/server/lib/http";
import { resetUserPassword } from "@/server/services/users";

const body = z.object({ password: z.string().min(1).max(200) }).strict();

/** Sets a new password and signs the user out everywhere. */
export const POST = adminApi<{ id: string }>({ name: "users.reset-password", permission: "users:manage", maxBodyBytes: 4 * 1024 }, async (ctx) => {
  const { password } = await ctx.json(body);
  await resetUserPassword(ctx.params.id, password, actorOf(ctx.auth), ctx.ipHash);
  return noContent();
});
