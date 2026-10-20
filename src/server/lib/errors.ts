export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Authentication required.") =>
  new ApiError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You do not have permission to do that.") =>
  new ApiError(403, "FORBIDDEN", message);

export const notFound = (what = "Resource") =>
  new ApiError(404, "NOT_FOUND", `${what} not found.`);

export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "CONFLICT", message, details);

export const payloadTooLarge = (message = "Request body is too large.") =>
  new ApiError(413, "PAYLOAD_TOO_LARGE", message);

export const unsupportedMedia = (message: string) =>
  new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", message);

export const validationFailed = (details: unknown, message = "Validation failed.") =>
  new ApiError(422, "VALIDATION_FAILED", message, details);

export const tooManyRequests = (retryAfterSec: number, message = "Too many requests. Please slow down.") =>
  new ApiError(429, "RATE_LIMITED", message, { retryAfterSec }, {
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterSec))),
  });

export const unavailable = (message = "Service temporarily unavailable.") =>
  new ApiError(503, "SERVICE_UNAVAILABLE", message);

/** MongoDB duplicate key (E11000). */
export function isDuplicateKeyError(error: unknown): error is { code: 11000; keyPattern?: Record<string, unknown> } {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}
