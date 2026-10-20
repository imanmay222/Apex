import { after } from "next/server";
import { assertFormToken } from "@/server/lib/form-guard";
import { api, created, ok, preflight } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { userAgent } from "@/server/lib/request";
import { enquiryCreate } from "@/server/validation/enquiry";
import { recordEvent } from "@/server/services/analytics";
import { createEnquiry } from "@/server/services/enquiries";
import { deliverNotifications } from "@/server/services/notifications";

export const OPTIONS = preflight();

/**
 * Public enquiry submission. Defences, in order: per-IP burst + daily limits, signed form token,
 * honeypot, spam scoring, duplicate collapsing. Anything classified as spam is stored (and
 * auto-purged) but answered with the same success response, so bots learn nothing.
 */
export const POST = api(
  { name: "enquiries.create", cors: true, rateLimit: { limit: 6, windowSec: 600 }, maxBodyBytes: 16 * 1024 },
  async (ctx) => {
    await enforce(`enquiries.daily:${ctx.ipHash}`, 25, 86_400);

    const input = await ctx.json(enquiryCreate);

    assertFormToken(input.token);

    const result = await createEnquiry(input, { ipHash: ctx.ipHash, userAgent: userAgent(ctx.req) });

    if (result.id) {
      const enquiryId = result.id;
      after(async () => {
        await deliverNotifications(enquiryId);
        await recordEvent(
          { type: "enquiry_submit", path: input.source?.path ?? "/", ref: input.subject ?? input.type },
          { ip: ctx.ip, userAgent: userAgent(ctx.req), host: ctx.req.headers.get("host") },
        ).catch(() => undefined);
      });
    }

    const body = {
      reference: result.reference,
      message: "Thank you. Our team will contact you shortly.",
      ...(result.duplicate ? { duplicate: true } : {}),
    };
    return result.duplicate ? ok(body) : created(body);
  },
);
