import { api, preflight } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { trackEnquiry } from "@/server/services/enquiries";
import { trackInput } from "@/server/validation/engagement";

export const OPTIONS = preflight();

/**
 * "Where is my enquiry?" Needs the reference AND the mobile number used. Throttled per IP and per
 * reference so it cannot be used to guess references or numbers.
 */
export const POST = api(
  { name: "enquiries.track", cors: true, rateLimit: { limit: 10, windowSec: 600 }, maxBodyBytes: 2 * 1024 },
  async (ctx) => {
    const { reference, mobile } = await ctx.json(trackInput);
    await enforce(`enquiries.track.ref:${reference}`, 8, 3600);
    return trackEnquiry(reference, mobile);
  },
);
