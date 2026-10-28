import { after } from "next/server";
import { assertFormToken } from "@/server/lib/form-guard";
import { api, created, ok, preflight } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { userAgent } from "@/server/lib/request";
import { orderCreate } from "@/server/validation/order";
import { recordEvent } from "@/server/services/analytics";
import { deliverOrderNotifications } from "@/server/services/notifications";
import { createOrder } from "@/server/services/orders";

export const OPTIONS = preflight();

/**
 * Quote-basket checkout: products + quantities + delivery details, no prices or payment. Same
 * defences as enquiries (per-IP limits, signed form token, honeypot, spam scoring, duplicate
 * collapsing); spam is stored and auto-purged but answered like a success.
 */
export const POST = api(
  { name: "orders.create", cors: true, rateLimit: { limit: 6, windowSec: 600 }, maxBodyBytes: 32 * 1024 },
  async (ctx) => {
    await enforce(`orders.daily:${ctx.ipHash}`, 20, 86_400);

    const input = await ctx.json(orderCreate);
    assertFormToken(input.token);

    const result = await createOrder(input, { ipHash: ctx.ipHash, userAgent: userAgent(ctx.req) });

    if (result.id) {
      const orderId = result.id;
      after(async () => {
        await deliverOrderNotifications(orderId);
        await recordEvent(
          { type: "order_submit", path: input.source?.path ?? "/quote", ref: `${input.items.length} items` },
          { ip: ctx.ip, userAgent: userAgent(ctx.req), host: ctx.req.headers.get("host") },
        ).catch(() => undefined);
      });
    }

    const body = {
      reference: result.reference,
      message: "Thank you. We'll send you a quote shortly.",
      ...(result.duplicate ? { duplicate: true } : {}),
    };
    return result.duplicate ? ok(body) : created(body);
  },
);
