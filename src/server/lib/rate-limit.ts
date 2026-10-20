import { connectDb } from "../db/connect";
import { RateLimitModel } from "../db/models";
import { isDuplicateKeyError, tooManyRequests } from "./errors";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSec: number;
}

/**
 * Fixed-window counter stored in MongoDB, so limits hold across instances and restarts.
 * `key` must be low-cardinality and server-chosen (never raw user input such as a URL).
 */
export async function consume(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  await connectDb();

  const windowMs = windowSec * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = `${key}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs + 60_000);

  const upsert = () =>
    RateLimitModel.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after", lean: true },
    );

  let doc;
  try {
    doc = await upsert();
  } catch (error) {
    // Two requests created the same window at once; the loser retries as a plain increment.
    if (!isDuplicateKeyError(error)) throw error;
    doc = await upsert();
  }

  const count = doc?.count ?? 1;
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000),
  };
}

/** Consumes one unit and throws a 429 ApiError when the budget is spent. */
export async function enforce(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const result = await consume(key, limit, windowSec);
  if (!result.allowed) throw tooManyRequests(result.retryAfterSec);
  return result;
}
