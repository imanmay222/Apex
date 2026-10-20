import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { singleLine } from "../lib/text";

declare global {
  var __apexMailer: Transporter | undefined;
}

export function mailConfigured(): boolean {
  return Boolean(env().mail.host);
}

function transport(): Transporter {
  if (!globalThis.__apexMailer) {
    const { host, port, secure, user, pass } = env().mail;
    globalThis.__apexMailer = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
    });
  }
  return globalThis.__apexMailer;
}

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!mailConfigured()) throw new Error("SMTP is not configured");
  await transport().sendMail({
    from: env().mail.from,
    to: message.to,
    subject: singleLine(message.subject).slice(0, 200),
    text: message.text,
    html: message.html,
    replyTo: message.replyTo,
  });
}

/** Connectivity probe for the health endpoint. */
export async function verifyMail(): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    await transport().verify();
    return true;
  } catch {
    return false;
  }
}
