import { actorOf } from "@/server/lib/admin";
import { adminApi } from "@/server/lib/http";
import { settingsUpdate } from "@/server/validation/content";
import { getAdminSettings, updateSettings } from "@/server/services/settings";

/** Full settings including internal fields (e.g. sales notification recipients). */
export const GET = adminApi({ name: "settings.admin-get", permission: "settings:write" }, async () => getAdminSettings());

/** Partial update; nested objects merge field-by-field, arrays are replaced whole. */
export const PATCH = adminApi({ name: "settings.update", permission: "settings:write", maxBodyBytes: 64 * 1024 }, async (ctx) =>
  updateSettings(await ctx.json(settingsUpdate), actorOf(ctx.auth), ctx.ipHash),
);
