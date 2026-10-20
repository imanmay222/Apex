import { z } from "zod";
import { actorOf } from "@/server/lib/admin";
import { validationFailed } from "@/server/lib/errors";
import { adminApi } from "@/server/lib/http";
import { importContent } from "@/server/services/import";
import { importQuery } from "@/server/validation/engagement";

/**
 * Restore content from a snapshot made by GET /api/admin/export.
 *   ?mode=merge (default)             add new items, update existing ones (matched by slug/key/name)
 *   ?mode=replace&confirm=true        first delete every collection present in the file
 * The whole file is validated first; any problem rejects it and nothing is written.
 */
export const POST = adminApi(
  { name: "content.import", permission: "system:manage", maxBodyBytes: 5 * 1024 * 1024, rateLimit: { limit: 30, windowSec: 60 } },
  async (ctx) => {
    const { mode = "merge", confirm } = ctx.query(importQuery);
    if (mode === "replace" && confirm !== "true") {
      throw validationFailed([{ path: "confirm", message: "replace deletes existing content; add confirm=true to proceed" }]);
    }
    const snapshot = await ctx.json(z.unknown());
    return importContent(snapshot, mode, actorOf(ctx.auth), ctx.ipHash);
  },
);
