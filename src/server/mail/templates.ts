import { env } from "../config/env";
import { escapeHtml, singleLine } from "../lib/text";

export interface EnquiryMailData {
  reference: string;
  name: string;
  mobile: string;
  email?: string;
  type: string;
  subjectTitle?: string;
  message: string;
  createdAt: Date;
}

const TYPE_LABEL: Record<string, string> = {
  products: "Product quote",
  survey: "Survey booking",
  training: "Training booking",
  general: "General enquiry",
};

const shell = (title: string, body: string) => `<!doctype html>
<html><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0d1526">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0a2150;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">${escapeHtml(title)}</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:16px 28px;background:#f4f6fa;color:#5b6880;font-size:12px">Apex Care Technologies &middot; ${escapeHtml(env().publicSiteUrl)}</td></tr>
</table></td></tr></table></body></html>`;

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#5b6880;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px">${value}</td></tr>`;

/** Internal notification for the sales team. */
export function salesNotification(data: EnquiryMailData) {
  const typeLabel = TYPE_LABEL[data.type] ?? data.type;
  const subject = `[${data.reference}] ${typeLabel}${data.subjectTitle ? `: ${data.subjectTitle}` : ""} - ${singleLine(data.name)}`;

  const text = [
    `New enquiry ${data.reference}`,
    `Type:    ${typeLabel}`,
    data.subjectTitle ? `About:   ${data.subjectTitle}` : null,
    `Name:    ${data.name}`,
    `Mobile:  ${data.mobile}`,
    data.email ? `Email:   ${data.email}` : null,
    `Received: ${data.createdAt.toISOString()}`,
    "",
    data.message,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = shell(
    `New enquiry ${data.reference}`,
    `<table role="presentation" cellpadding="0" cellspacing="0">
      ${row("Type", escapeHtml(typeLabel))}
      ${data.subjectTitle ? row("About", escapeHtml(data.subjectTitle)) : ""}
      ${row("Name", escapeHtml(data.name))}
      ${row("Mobile", `<a href="tel:${escapeHtml(data.mobile)}" style="color:#0b4ba2">${escapeHtml(data.mobile)}</a>`)}
      ${data.email ? row("Email", `<a href="mailto:${escapeHtml(data.email)}" style="color:#0b4ba2">${escapeHtml(data.email)}</a>`) : ""}
      ${row("Received", escapeHtml(data.createdAt.toUTCString()))}
    </table>
    <p style="margin:20px 0 6px;color:#5b6880;font-size:13px">Message</p>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;border-left:3px solid #ee4a24;padding-left:14px">${escapeHtml(data.message)}</div>`,
  );

  return { subject, text, html };
}

/** Acknowledgement sent to the customer when they left an email address. */
export function customerAcknowledgement(data: EnquiryMailData) {
  const subject = `We received your enquiry (${data.reference})`;

  const text = [
    `Hello ${data.name},`,
    "",
    `Thank you for contacting Apex Care Technologies. Your reference number is ${data.reference}.`,
    "Our team will get back to you shortly on the mobile number you provided.",
    "",
    "Your message:",
    data.message,
    "",
    "Apex Care Technologies",
  ].join("\n");

  const html = shell(
    "Thanks, we received your enquiry",
    `<p style="margin:0 0 14px;font-size:15px">Hello ${escapeHtml(data.name)},</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55">Thank you for contacting Apex Care Technologies. Our team will get back to you shortly on <strong>${escapeHtml(data.mobile)}</strong>.</p>
    <p style="margin:0 0 6px;color:#5b6880;font-size:13px">Your reference number</p>
    <p style="margin:0 0 18px;font-size:20px;font-weight:bold;color:#0b4ba2">${escapeHtml(data.reference)}</p>
    <p style="margin:0 0 6px;color:#5b6880;font-size:13px">Your message</p>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;border-left:3px solid #ee4a24;padding-left:14px">${escapeHtml(data.message)}</div>`,
  );

  return { subject, text, html };
}

/** Double opt-in email for the newsletter. */
export function subscriptionConfirmation(data: { name?: string; confirmUrl: string; unsubscribeUrl: string }) {
  const subject = "Please confirm your subscription";
  const text = [
    data.name ? `Hello ${data.name},` : "Hello,",
    "",
    "Thanks for subscribing to updates from Apex Care Technologies.",
    "Please confirm your email address by opening this link:",
    data.confirmUrl,
    "",
    "If you didn't request this, ignore this email and you won't be subscribed.",
    `Unsubscribe: ${data.unsubscribeUrl}`,
  ].join("\n");

  const html = shell(
    "Confirm your subscription",
    `<p style="margin:0 0 14px;font-size:15px">${data.name ? `Hello ${escapeHtml(data.name)},` : "Hello,"}</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55">Thanks for subscribing to updates from Apex Care Technologies. Please confirm your email address:</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(data.confirmUrl)}" style="background:#ee4a24;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px;display:inline-block">Confirm subscription</a></p>
    <p style="margin:0;color:#5b6880;font-size:12px;line-height:1.5">If you didn't request this, just ignore this email and you won't be subscribed.<br><a href="${escapeHtml(data.unsubscribeUrl)}" style="color:#5b6880">Unsubscribe</a></p>`,
  );

  return { subject, text, html };
}

/** Internal heads-up that a customer-submitted testimonial is waiting for review. */
export function testimonialReview(data: { name: string; company?: string; rating?: number; quote: string }) {
  const who = data.company ? `${data.name} (${data.company})` : data.name;
  const subject = `New testimonial awaiting review - ${singleLine(who)}`;
  const text = [`${who} submitted a testimonial${data.rating ? ` (${data.rating}/5)` : ""}:`, "", data.quote, "", "Review it through the admin API: PATCH /api/admin/content/testimonials/<id> {\"published\": true} to approve, or DELETE to reject."].join("\n");
  const html = shell(
    "Testimonial awaiting review",
    `<p style="margin:0 0 6px;color:#5b6880;font-size:13px">From</p><p style="margin:0 0 14px;font-size:15px;font-weight:bold">${escapeHtml(who)}${data.rating ? ` &middot; ${data.rating}/5` : ""}</p>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;border-left:3px solid #ee4a24;padding-left:14px">${escapeHtml(data.quote)}</div>
    <p style="margin:20px 0 0;color:#5b6880;font-size:12px">It is not public until you approve it.</p>`,
  );
  return { subject, text, html };
}
