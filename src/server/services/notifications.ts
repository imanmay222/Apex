import { env } from "../config/env";
import { connectDb } from "../db/connect";
import {
  EnquiryModel,
  NOTIFICATION_CHANNELS,
  SiteSettingsModel,
  type EnquiryDoc,
  type NotificationChannel,
} from "../db/models";
import { hmacHex } from "../lib/crypto";
import { errorFields, logger } from "../lib/logger";
import { customerAcknowledgement, salesNotification, type EnquiryMailData } from "../mail/templates";
import { mailConfigured, sendMail } from "../mail/mailer";
import type { Lean } from "./mappers";

export const MAX_NOTIFICATION_ATTEMPTS = 5;

type Outcome = { status: "sent" } | { status: "skipped"; reason: string };

function mailData(doc: Lean<EnquiryDoc>): EnquiryMailData {
  return {
    reference: doc.reference,
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email ?? undefined,
    type: doc.type,
    subjectTitle: doc.subjectTitle ?? undefined,
    message: doc.message,
    createdAt: doc.createdAt ?? new Date(),
  };
}

export async function salesRecipients(): Promise<string[]> {
  const fromEnv = env().mail.salesRecipients;
  if (fromEnv.length > 0) return fromEnv;
  const settings = await SiteSettingsModel.findOne({ key: "site" }).select("notifications").lean();
  return settings?.notifications?.salesEmails ?? [];
}

async function deliverSales(doc: Lean<EnquiryDoc>): Promise<Outcome> {
  if (!mailConfigured()) return { status: "skipped", reason: "SMTP is not configured" };
  const to = await salesRecipients();
  if (to.length === 0) return { status: "skipped", reason: "No sales recipients configured" };

  const mail = salesNotification(mailData(doc));
  await sendMail({ to, ...mail, replyTo: doc.email ?? undefined });
  return { status: "sent" };
}

async function deliverCustomer(doc: Lean<EnquiryDoc>): Promise<Outcome> {
  if (!doc.email) return { status: "skipped", reason: "Customer gave no email address" };
  if (!env().mail.autoReply) return { status: "skipped", reason: "Auto-reply is disabled" };
  if (!mailConfigured()) return { status: "skipped", reason: "SMTP is not configured" };

  await sendMail({ to: [doc.email], ...customerAcknowledgement(mailData(doc)) });
  return { status: "sent" };
}

async function deliverWebhook(doc: Lean<EnquiryDoc>): Promise<Outcome> {
  const { url, secret } = env().webhook;
  if (!url) return { status: "skipped", reason: "No webhook configured" };

  const body = JSON.stringify({
    event: "enquiry.created",
    reference: doc.reference,
    type: doc.type,
    subject: doc.subjectSlug ? { slug: doc.subjectSlug, title: doc.subjectTitle } : null,
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email ?? null,
    message: doc.message,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ApexCare-Webhook/1.0",
    "X-Apex-Timestamp": timestamp,
  };
  if (secret) headers["X-Apex-Signature"] = `sha256=${hmacHex(secret, `${timestamp}.${body}`)}`;

  const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Webhook responded with HTTP ${response.status}`);
  return { status: "sent" };
}

const DELIVERERS: Record<NotificationChannel, (doc: Lean<EnquiryDoc>) => Promise<Outcome>> = {
  sales: deliverSales,
  customer: deliverCustomer,
  webhook: deliverWebhook,
};

async function attempt(doc: Lean<EnquiryDoc>, channel: NotificationChannel): Promise<void> {
  const now = new Date();
  const set: Record<string, unknown> = { [`notifications.${channel}.lastAttemptAt`]: now };
  const unset: Record<string, ""> = {};

  try {
    const outcome = await DELIVERERS[channel](doc);
    set[`notifications.${channel}.status`] = outcome.status;
    if (outcome.status === "sent") {
      set[`notifications.${channel}.sentAt`] = now;
      unset[`notifications.${channel}.lastError`] = "";
    } else {
      set[`notifications.${channel}.lastError`] = outcome.reason;
    }
  } catch (error) {
    logger.warn("notification failed", { reference: doc.reference, channel, ...errorFields(error) });
    set[`notifications.${channel}.status`] = "failed";
    set[`notifications.${channel}.lastError`] = (error instanceof Error ? error.message : "Unknown error").slice(0, 300);
  }

  await EnquiryModel.updateOne(
    { _id: doc._id },
    { $set: set, $inc: { [`notifications.${channel}.attempts`]: 1 }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
  );
}

/**
 * Runs notification channels for one enquiry.
 * - default: every channel still `pending` (first delivery)
 * - `channels`: force exactly these (admin "resend")
 */
export async function deliverNotifications(enquiryId: string, channels?: NotificationChannel[]): Promise<void> {
  await connectDb();
  const doc = await EnquiryModel.findById(enquiryId).lean();
  if (!doc) return;

  if (doc.status === "spam" && !channels) {
    await EnquiryModel.updateOne(
      { _id: doc._id },
      { $set: Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [`notifications.${c}.status`, "skipped"])) },
    );
    return;
  }

  const targets = channels ?? NOTIFICATION_CHANNELS.filter((channel) => doc.notifications?.[channel]?.status === "pending");
  // Independent channels: one failing must not block the others.
  await Promise.all(targets.map((channel) => attempt(doc, channel)));
}

/** Retries channels that failed and still have attempts left. Called by the cron endpoint. */
export async function retryFailedNotifications(limit = 50): Promise<{ examined: number; retried: number }> {
  await connectDb();
  const failed = NOTIFICATION_CHANNELS.map((channel) => ({
    [`notifications.${channel}.status`]: "failed",
    [`notifications.${channel}.attempts`]: { $lt: MAX_NOTIFICATION_ATTEMPTS },
  }));

  const docs = await EnquiryModel.find({ status: { $ne: "spam" }, $or: failed }).sort({ createdAt: 1 }).limit(limit).lean();

  let retried = 0;
  for (const doc of docs) {
    const channels = NOTIFICATION_CHANNELS.filter((channel) => {
      const state = doc.notifications?.[channel];
      return state?.status === "failed" && (state.attempts ?? 0) < MAX_NOTIFICATION_ATTEMPTS;
    });
    if (channels.length === 0) continue;
    await deliverNotifications(String(doc._id), channels);
    retried += 1;
  }
  return { examined: docs.length, retried };
}
