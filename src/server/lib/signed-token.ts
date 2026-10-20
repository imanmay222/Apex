import { env } from "../config/env";
import { hmacHex, safeEqual } from "./crypto";

/**
 * Stateless, tamper-proof tokens for links in emails (confirm / unsubscribe).
 * Format: base64url(JSON payload) + "." + HMAC-SHA256. Optional expiry in seconds.
 */
export function signToken(payload: Record<string, unknown>, ttlSeconds?: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, ...(ttlSeconds ? { exp: Math.floor(Date.now() / 1000) + ttlSeconds } : {}) }),
  ).toString("base64url");
  return `${body}.${hmacHex(env().sessionSecret, `tok:${body}`)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, hmacHex(env().sessionSecret, `tok:${body}`))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (payload.exp !== undefined && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
