import { env } from "../config/env";
import { hmacHex } from "./crypto";

type HeaderReader = { headers: Headers };

const IP_PATTERN = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * Best-effort client IP. Next route handlers don't expose the socket address, so
 * this relies on proxy headers; set TRUST_PROXY=false if the app is exposed
 * directly (all clients then share the "unknown" bucket).
 */
export function clientIp(request: HeaderReader): string {
  if (!env().trustProxy) return "unknown";

  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && IP_PATTERN.test(value)) return value;
  }
  return "unknown";
}

/** Keyed hash so raw IPs are never stored (rate-limit keys, analytics, audit). */
export function hashIp(ip: string): string {
  return hmacHex(env().sessionSecret, `ip:${ip}`).slice(0, 24);
}

export function userAgent(request: HeaderReader): string {
  return (request.headers.get("user-agent") ?? "").slice(0, 300);
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|lighthouse|headless|python-requests|curl\/|wget|go-http|java\/|okhttp|axios|node-fetch|undici|postman/i;

export function isLikelyBot(ua: string): boolean {
  return ua.length === 0 || BOT_PATTERN.test(ua);
}

export function deviceClass(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|kindle|silk|playbook/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

/** Same-origin check for cookie-authenticated, state-changing requests (CSRF defence). */
export function isTrustedOrigin(request: HeaderReader): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  // Non-browser clients (curl, server-to-server) send neither header: not a CSRF vector.
  if (!origin && !fetchSite) return true;
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;

  const allowed = new Set<string>([new URL(env().publicSiteUrl).origin, ...env().allowedOrigins]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? (env().secureCookies ? "https" : "http");
    allowed.add(`${proto}://${host}`);
  }
  return allowed.has(origin);
}
