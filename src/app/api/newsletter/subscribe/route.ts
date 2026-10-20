import { after } from "next/server";
import { assertFormToken } from "@/server/lib/form-guard";
import { api, created, preflight } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { deliverConfirmation, subscribe } from "@/server/services/subscribers";
import { scoreSpam } from "@/server/services/enquiries";
import { subscribeInput } from "@/server/validation/engagement";

export const OPTIONS = preflight();

/**
 * Double opt-in sign-up. The response is identical whether the address is new, pending or
 * already subscribed, so the form cannot be used to discover who is on the list.
 */
export const POST = api(
  { name: "newsletter.subscribe", cors: true, rateLimit: { limit: 5, windowSec: 600 }, maxBodyBytes: 4 * 1024 },
  async (ctx) => {
    await enforce(`newsletter.daily:${ctx.ipHash}`, 15, 86_400);
    const input = await ctx.json(subscribeInput);
    assertFormToken(input.token);

    const spam = scoreSpam({ name: input.name ?? "", message: input.name ?? "", email: input.email, honeypot: input.website });
    if (!spam.isSpam) {
      const result = await subscribe(input, { ipHash: ctx.ipHash });
      if (result?.send) {
        const id = result.id;
        after(() => deliverConfirmation(id));
      }
    }
    return created({ message: "Almost done! Check your inbox and click the link to confirm your subscription." });
  },
);
