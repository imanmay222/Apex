import { z } from "zod";
import { adminApi, noContent } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { changeOwnPassword } from "@/server/services/users";

const body = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) })
  .strict();

export const POST = adminApi({ name: "auth.change-password", permission: "authenticated", maxBodyBytes: 4 * 1024 }, async (ctx) => {
  await enforce(`auth.change-password:${ctx.auth.user.id}`, 5, 900);
  const input = await ctx.json(body);
  await changeOwnPassword(ctx.auth.user, ctx.auth.tokenHash, input.currentPassword, input.newPassword, ctx.ipHash);
  return noContent();
});
