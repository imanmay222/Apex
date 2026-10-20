import { after } from "next/server";
import { getTestimonials } from "@/server/data/public";
import { assertFormToken } from "@/server/lib/form-guard";
import { PUBLIC_CACHE, api, created, preflight } from "@/server/lib/http";
import { enforce } from "@/server/lib/rate-limit";
import { notifyTestimonialReview, submitTestimonial } from "@/server/services/testimonials";
import { testimonialSubmit } from "@/server/validation/engagement";


export const OPTIONS = preflight();

export const GET = api({ name: "testimonials.list", cors: true, cache: PUBLIC_CACHE }, async () => getTestimonials());

/**
 * Customer-submitted testimonial. Stored UNPUBLISHED for review; the team is emailed. Same
 * defences as the enquiry form (token, honeypot, spam scoring, per-IP limits) and the same
 * success response whatever was filtered.
 */
export const POST = api(
  { name: "testimonials.submit", cors: true, rateLimit: { limit: 4, windowSec: 600 }, maxBodyBytes: 8 * 1024 },
  async (ctx) => {
    await enforce(`testimonials.daily:${ctx.ipHash}`, 10, 86_400);
    const input = await ctx.json(testimonialSubmit);
    assertFormToken(input.token);

    const result = await submitTestimonial(input, { ipHash: ctx.ipHash });
    if (result.id) {
      const id = result.id;
      after(() => notifyTestimonialReview(id));
    }
    return created({ message: "Thank you! Your review will appear on the site once our team has approved it." });
  },
);
