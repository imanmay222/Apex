import { z } from "zod";
import { api, noContent, preflight } from "@/server/lib/http";
import { userAgent } from "@/server/lib/request";
import { recordEvent } from "@/server/services/analytics";

export const OPTIONS = preflight();

const body = z
  .object({
    // Server-side events (enquiry_submit, catalogue_download, search) can't be forged from here.
    type: z.enum(["page_view", "product_view", "survey_view", "cta_click"]),
    path: z.string().trim().min(1).max(300),
    ref: z.string().trim().max(120).optional(),
    referrer: z.string().trim().max(500).optional(),
  })
  .strict();

/** First-party, cookie-less analytics beacon. Always answers 204, even for dropped (bot) traffic. */
export const POST = api(
  { name: "analytics.event", cors: true, rateLimit: { limit: 120, windowSec: 60 }, maxBodyBytes: 4 * 1024 },
  async (ctx) => {
    const event = await ctx.json(body);
    await recordEvent(event, {
      ip: ctx.ip,
      userAgent: userAgent(ctx.req),
      host: ctx.req.headers.get("host"),
    });
    return noContent();
  },
);
