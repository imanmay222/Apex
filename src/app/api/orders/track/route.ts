import { api, preflight } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { trackOrder } from "@/server/services/orders";
import { trackOrderInput } from "@/server/validation/order";

export const OPTIONS = preflight();

/**
 * "Where is my order?" Needs the reference AND the mobile number used. Throttled per IP and per
 * reference so it cannot be used to guess references or numbers.
 */
export const POST = api(
  { name: "orders.track", cors: true, rateLimit: { limit: 10, windowSec: 600 }, maxBodyBytes: 2 * 1024 },
  async (ctx) => {
    const { reference, mobile } = await ctx.json(trackOrderInput);
    await enforce(`orders.track.ref:${reference}`, 8, 3600);
    return trackOrder(reference, mobile);
  },
);
