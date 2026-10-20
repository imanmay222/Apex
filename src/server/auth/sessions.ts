import { Types } from "mongoose";
import { env } from "../config/env";
import { connectDb } from "../db/connect";
import { AdminUserModel, SessionModel, type Role } from "../db/models";
import { randomToken, sha256 } from "../lib/crypto";

export const SESSION_COOKIE = "apex_session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthContext {
  user: AuthUser;
  sessionId: string;
  tokenHash: string;
}

const DAY_MS = 86_400_000;

function ttlMs() {
  return env().sessionTtlDays * DAY_MS;
}

export async function createSession(
  userId: string,
  meta: { ipHash?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  await connectDb();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlMs());

  await SessionModel.create({
    tokenHash: sha256(token),
    userId: new Types.ObjectId(userId),
    expiresAt,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent?.slice(0, 300),
  });

  return { token, expiresAt };
}

/** Resolves a raw session token to its user, extending the session when it's past half-life. */
export async function resolveSession(token: string): Promise<AuthContext | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  await connectDb();

  const tokenHash = sha256(token);
  const session = await SessionModel.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;

  const user = await AdminUserModel.findById(session.userId).lean();
  if (!user || !user.active) return null;

  // Sliding expiry, written at most once per half TTL to keep reads cheap.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < ttlMs() / 2) {
    await SessionModel.updateOne(
      { _id: session._id },
      { $set: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + ttlMs()) } },
    );
  }

  return {
    user: { id: String(user._id), email: user.email, name: user.name, role: user.role as Role },
    sessionId: String(session._id),
    tokenHash,
  };
}

export async function destroySession(token: string): Promise<void> {
  await connectDb();
  await SessionModel.deleteOne({ tokenHash: sha256(token) });
}

/** Revokes every session for a user, optionally sparing the current one. */
export async function destroyUserSessions(userId: string, exceptTokenHash?: string): Promise<number> {
  await connectDb();
  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (exceptTokenHash) filter.tokenHash = { $ne: exceptTokenHash };
  const result = await SessionModel.deleteMany(filter);
  return result.deletedCount ?? 0;
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`,
  ];
  if (env().secureCookies) parts.push("Secure");
  return parts.join("; ");
}

export function clearedSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"];
  if (env().secureCookies) parts.push("Secure");
  return parts.join("; ");
}
