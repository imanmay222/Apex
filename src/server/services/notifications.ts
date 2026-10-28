import { env } from "../config/env";
import { connectDb } from "../db/connect";
import type { Model } from "mongoose";
import {
  EnquiryModel,
  NOTIFICATION_CHANNELS,
  OrderModel,
  SiteSettingsModel,
  type EnquiryDoc,
  type NotificationChannel,
  type OrderDoc,
} from "../db/models";
import { hmacHex } from "../lib/crypto";
import { errorFields, logger } from "../lib/logger";
import {
  customerAcknowledgement,
  orderAcknowledgement,
  orderSalesNotification,
  salesNotification,
  type EnquiryMailData,
  type OrderMailData,
} from "../mail/templates";
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

/** Signed POST to the configured webhook; the receiver verifies `sha256=HMAC(timestamp.body)`. */
async function postWebhook(payload: Record<string, unknown>): Promise<Outcome> {
  const { url, secret } = env().webhook;
  if (!url) return { status: "skipped", reason: "No webhook configured" };

  const body = JSON.stringify(payload);
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

const deliverWebhook = (doc: Lean<EnquiryDoc>) =>
  postWebhook({
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

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

function orderMailData(doc: Lean<OrderDoc>): OrderMailData {
  const address = doc.address ?? { line1: "", line2: undefined, city: "", state: "", postalCode: "" };
  return {
    reference: doc.reference,
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email ?? undefined,
    company: doc.company ?? undefined,
    gstin: doc.gstin ?? undefined,
    address: {
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    },
    items: doc.items.map((item) => ({ title: item.productTitle, quantity: item.quantity, note: item.note ?? undefined })),
    notes: doc.customerNotes ?? undefined,
    createdAt: doc.createdAt ?? new Date(),
  };
}

async function deliverOrderSales(doc: Lean<OrderDoc>): Promise<Outcome> {
  if (!mailConfigured()) return { status: "skipped", reason: "SMTP is not configured" };
  const to = await salesRecipients();
  if (to.length === 0) return { status: "skipped", reason: "No sales recipients configured" };
  await sendMail({ to, ...orderSalesNotification(orderMailData(doc)), replyTo: doc.email ?? undefined });
  return { status: "sent" };
}

async function deliverOrderCustomer(doc: Lean<OrderDoc>): Promise<Outcome> {
  if (!doc.email) return { status: "skipped", reason: "Customer gave no email address" };
  if (!env().mail.autoReply) return { status: "skipped", reason: "Auto-reply is disabled" };
  if (!mailConfigured()) return { status: "skipped", reason: "SMTP is not configured" };
  await sendMail({ to: [doc.email], ...orderAcknowledgement(orderMailData(doc)) });
  return { status: "sent" };
}

const deliverOrderWebhook = (doc: Lean<OrderDoc>) =>
  postWebhook({
    event: "order.created",
    reference: doc.reference,
    items: doc.items.map((item) => ({ product: item.productSlug, title: item.productTitle, quantity: item.quantity, note: item.note ?? null })),
    name: doc.name,
    mobile: doc.mobile,
    email: doc.email ?? null,
    company: doc.company ?? null,
    gstin: doc.gstin ?? null,
    address: doc.address,
    notes: doc.customerNotes ?? null,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  });

/* ------------------------------------------------------------------ */
/* Delivery engine, shared by enquiries and orders                     */
/* ------------------------------------------------------------------ */

type Notifiable = { _id: unknown; reference: string; status: string; notifications?: Partial<Record<NotificationChannel, { status?: string | null; attempts?: number | null } | null>> | null };

interface Kind<D extends Notifiable> {
  // Updates use dynamic `notifications.<channel>.*` paths, which Mongoose's typed updates can't express.
  model: Model<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  deliverers: Record<NotificationChannel, (doc: D) => Promise<Outcome>>;
}

const ENQUIRIES: Kind<Lean<EnquiryDoc>> = {
  model: EnquiryModel,
  deliverers: { sales: deliverSales, customer: deliverCustomer, webhook: deliverWebhook },
};

const ORDERS: Kind<Lean<OrderDoc>> = {
  model: OrderModel,
  deliverers: { sales: deliverOrderSales, customer: deliverOrderCustomer, webhook: deliverOrderWebhook },
};

async function attempt<D extends Notifiable>(kind: Kind<D>, doc: D, channel: NotificationChannel): Promise<void> {
  const now = new Date();
  const set: Record<string, unknown> = { [`notifications.${channel}.lastAttemptAt`]: now };
  const unset: Record<string, ""> = {};

  try {
    const outcome = await kind.deliverers[channel](doc);
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

  await kind.model.updateOne(
    { _id: doc._id },
    { $set: set, $inc: { [`notifications.${channel}.attempts`]: 1 }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
  );
}

/**
 * Runs notification channels for one enquiry or order.
 * - default: every channel still `pending` (first delivery)
 * - `channels`: force exactly these (admin "resend")
 */
async function deliver<D extends Notifiable>(kind: Kind<D>, id: string, channels?: NotificationChannel[]): Promise<void> {
  await connectDb();
  const doc = (await kind.model.findById(id).lean()) as D | null;
  if (!doc) return;

  if (doc.status === "spam" && !channels) {
    await kind.model.updateOne(
      { _id: doc._id },
      { $set: Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [`notifications.${c}.status`, "skipped"])) },
    );
    return;
  }

  const targets = channels ?? NOTIFICATION_CHANNELS.filter((channel) => doc.notifications?.[channel]?.status === "pending");
  // Independent channels: one failing must not block the others.
  await Promise.all(targets.map((channel) => attempt(kind, doc, channel)));
}

export const deliverNotifications = (enquiryId: string, channels?: NotificationChannel[]) => deliver(ENQUIRIES, enquiryId, channels);
export const deliverOrderNotifications = (orderId: string, channels?: NotificationChannel[]) => deliver(ORDERS, orderId, channels);

async function retryKind<D extends Notifiable>(kind: Kind<D>, limit: number): Promise<{ examined: number; retried: number }> {
  const failed = NOTIFICATION_CHANNELS.map((channel) => ({
    [`notifications.${channel}.status`]: "failed",
    [`notifications.${channel}.attempts`]: { $lt: MAX_NOTIFICATION_ATTEMPTS },
  }));

  const docs = (await kind.model.find({ status: { $ne: "spam" }, $or: failed }).sort({ createdAt: 1 }).limit(limit).lean()) as D[];

  let retried = 0;
  for (const doc of docs) {
    const channels = NOTIFICATION_CHANNELS.filter((channel) => {
      const state = doc.notifications?.[channel];
      return state?.status === "failed" && (state.attempts ?? 0) < MAX_NOTIFICATION_ATTEMPTS;
    });
    if (channels.length === 0) continue;
    await deliver(kind, String(doc._id), channels);
    retried += 1;
  }
  return { examined: docs.length, retried };
}

/** Retries channels that failed and still have attempts left, for enquiries and orders. Called by the cron endpoint. */
export async function retryFailedNotifications(limit = 50): Promise<{ examined: number; retried: number }> {
  await connectDb();
  const enquiries = await retryKind(ENQUIRIES, limit);
  const orders = await retryKind(ORDERS, limit);
  return { examined: enquiries.examined + orders.examined, retried: enquiries.retried + orders.retried };
}
