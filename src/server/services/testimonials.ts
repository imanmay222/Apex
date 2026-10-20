import { connectDb } from "../db/connect";
import { TestimonialModel } from "../db/models";
import { errorFields, logger } from "../lib/logger";
import { mailConfigured, sendMail } from "../mail/mailer";
import { testimonialReview } from "../mail/templates";
import type { TestimonialSubmit } from "../validation/engagement";
import { scoreSpam } from "./enquiries";
import { salesRecipients } from "./notifications";

export interface SubmitResult {
  /** Set when a new document was stored (used to trigger the review email). */
  id?: string;
}

/**
 * Stores a customer-submitted testimonial as UNPUBLISHED (source "public"). It only appears on the
 * site once an editor publishes it. Spam and repeats are dropped silently, and the caller always
 * answers success, so bots can't tell what was filtered.
 */
export async function submitTestimonial(input: TestimonialSubmit, meta: { ipHash: string }): Promise<SubmitResult> {
  await connectDb();
  const email = input.email || undefined;

  const spam = scoreSpam({ name: input.name, message: input.quote, email, honeypot: input.website });
  if (spam.isSpam) return {};

  const repeat = await TestimonialModel.exists({
    name: input.name,
    quote: input.quote,
    createdAt: { $gt: new Date(Date.now() - 24 * 3_600_000) },
  });
  if (repeat) return {};

  // Queue behind existing items so approving it later doesn't reshuffle the live order.
  const last = await TestimonialModel.findOne().sort({ order: -1 }).select("order").lean<{ order?: number }>();

  const doc = await TestimonialModel.create({
    name: input.name,
    role: input.role || undefined,
    company: input.company || undefined,
    quote: input.quote,
    rating: input.rating,
    source: "public",
    published: false,
    order: (last?.order ?? 0) + 10,
    submitter: { email, ipHash: meta.ipHash },
  });
  return { id: String(doc._id) };
}

/** Tells the sales team a testimonial is waiting. Best-effort: never throws. */
export async function notifyTestimonialReview(id: string): Promise<void> {
  try {
    if (!mailConfigured()) return;
    await connectDb();
    const doc = await TestimonialModel.findById(id).lean();
    const to = await salesRecipients();
    if (!doc || to.length === 0) return;
    await sendMail({ to, ...testimonialReview({ name: doc.name, company: doc.company ?? undefined, rating: doc.rating ?? undefined, quote: doc.quote }) });
  } catch (error) {
    logger.warn("testimonial review email failed", errorFields(error));
  }
}
