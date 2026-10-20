/**
 * Environment configuration. Parsed lazily on first use (never at import time)
 * so `next build` works without a database or secrets present.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function required(name: string, minLength = 1): string {
  const value = read(name);
  if (!value) throw new ConfigError(`Missing required environment variable ${name}`);
  if (value.length < minLength) {
    throw new ConfigError(`${name} must be at least ${minLength} characters long`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = read(name);
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(name: string, fallback: number): number {
  const value = read(name);
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new ConfigError(`${name} must be an integer`);
  return parsed;
}

function list(name: string): string[] {
  return (read(name) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface Env {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  logLevel: "debug" | "info" | "warn" | "error";

  mongodbUri: string;
  /** Build autoIndex on connect. Off in production: run `npm run db:indexes` on deploy. */
  mongoAutoIndex: boolean;

  /** Signs form tokens and keys the IP/visitor hashes. */
  sessionSecret: string;
  cronSecret: string | undefined;
  publicSiteUrl: string;
  /** Extra origins allowed to call the public API cross-origin / make admin writes. */
  allowedOrigins: string[];
  /** Trust X-Forwarded-For / CF-Connecting-IP. Leave on when behind a reverse proxy. */
  trustProxy: boolean;
  /** Cookie `Secure` flag; derived from the public URL being https. */
  secureCookies: boolean;

  sessionTtlDays: number;
  uploadMaxBytes: number;

  mail: {
    host: string | undefined;
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    from: string;
    salesRecipients: string[];
    autoReply: boolean;
  };

  webhook: { url: string | undefined; secret: string | undefined };

  /** Used by the seed script to create the first admin. */
  seedAdmin: { email: string | undefined; password: string | undefined; name: string };

  retention: { analyticsDays: number; auditDays: number; spamDays: number };
}

let cache: Env | undefined;

export function env(): Env {
  if (cache) return cache;

  const nodeEnv = (read("NODE_ENV") ?? "development") as Env["nodeEnv"];
  const publicSiteUrl = (read("PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");

  cache = {
    nodeEnv,
    isProduction: nodeEnv === "production",
    logLevel: (read("LOG_LEVEL") ?? "info") as Env["logLevel"],

    mongodbUri: required("MONGODB_URI"),
    mongoAutoIndex: bool("MONGO_AUTO_INDEX", nodeEnv !== "production"),

    sessionSecret: required("SESSION_SECRET", 32),
    cronSecret: read("CRON_SECRET"),
    publicSiteUrl,
    allowedOrigins: list("ALLOWED_ORIGINS"),
    trustProxy: bool("TRUST_PROXY", true),
    secureCookies: publicSiteUrl.startsWith("https://"),

    sessionTtlDays: int("SESSION_TTL_DAYS", 7),
    uploadMaxBytes: int("UPLOAD_MAX_MB", 8) * 1024 * 1024,

    mail: {
      host: read("SMTP_HOST"),
      port: int("SMTP_PORT", 587),
      secure: bool("SMTP_SECURE", false),
      user: read("SMTP_USER"),
      pass: read("SMTP_PASS"),
      from: read("MAIL_FROM") ?? "Apex Care Technologies <no-reply@localhost>",
      salesRecipients: list("SALES_EMAIL"),
      autoReply: bool("AUTO_REPLY", true),
    },

    webhook: { url: read("ENQUIRY_WEBHOOK_URL"), secret: read("ENQUIRY_WEBHOOK_SECRET") },

    seedAdmin: {
      email: read("ADMIN_EMAIL"),
      password: read("ADMIN_PASSWORD"),
      name: read("ADMIN_NAME") ?? "Site Administrator",
    },

    retention: {
      analyticsDays: int("ANALYTICS_RETENTION_DAYS", 400),
      auditDays: int("AUDIT_RETENTION_DAYS", 730),
      spamDays: int("SPAM_RETENTION_DAYS", 30),
    },
  };

  return cache;
}
