import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType, type z } from "zod";
import { SESSION_COOKIE, resolveSession, type AuthContext } from "../auth/sessions";
import { can, type Permission } from "../auth/permissions";
import { ConfigError, env } from "../config/env";
import {
  ApiError,
  badRequest,
  forbidden,
  payloadTooLarge,
  unauthorized,
  unsupportedMedia,
  validationFailed,
} from "./errors";
import { errorFields, logger } from "./logger";
import { enforce } from "./rate-limit";
import { clientIp, hashIp, isTrustedOrigin } from "./request";
import { formatIssues } from "../validation/primitives";

/* ------------------------------------------------------------------ */
/* Response helpers                                                    */
/* ------------------------------------------------------------------ */

type Init = { status?: number; headers?: Record<string, string> };

export function ok<T>(data: T, init: Init & { meta?: Record<string, unknown> } = {}) {
  const body = init.meta ? { data, meta: init.meta } : { data };
  return NextResponse.json(body, { status: init.status ?? 200, headers: init.headers });
}

export const created = <T>(data: T, headers?: Record<string, string>) => ok(data, { status: 201, headers });

export const noContent = (headers?: Record<string, string>) =>
  new NextResponse(null, { status: 204, headers });

export function paged<T>(items: T[], meta: { page: number; limit: number; total: number; totalPages: number }, headers?: Record<string, string>) {
  return ok(items, { meta, headers });
}

/** Cache header for public, read-only responses: edge-cacheable for a minute, stale-tolerant. */
export const PUBLIC_CACHE = { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" };

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface ApiContext<P> {
  req: NextRequest;
  params: P;
  ip: string;
  ipHash: string;
  requestId: string;
  /** Parses and validates the JSON body (size-capped). Throws 415/413/400/422. */
  json<S extends ZodType>(schema: S): Promise<z.infer<S>>;
  /** Validates the query string. Repeated keys keep the last value. */
  query<S extends ZodType>(schema: S): z.infer<S>;
}

export type PublicContext<P> = ApiContext<P> & { auth: AuthContext | null };
export type AdminContext<P> = ApiContext<P> & { auth: AuthContext };

interface BaseOptions {
  /** Stable, low-cardinality name; keys the rate-limit bucket. */
  name: string;
  /** Requests per IP per window. `false` disables limiting. Default 300/min. */
  rateLimit?: { limit: number; windowSec: number } | false;
  /** Allow origins listed in ALLOWED_ORIGINS to call this route from a browser. */
  cors?: boolean;
  /** JSON body cap in bytes. Default 256 KiB. */
  maxBodyBytes?: number;
}

export interface PublicOptions extends BaseOptions {
  /** Cache-Control for successful GET responses. */
  cache?: Record<string, string>;
}

export interface AdminOptions extends BaseOptions {
  /** Required permission, or "authenticated" for any signed-in admin user. */
  permission: Permission | "authenticated";
}

type RouteContext<P> = { params: Promise<P> };
type Handler<C> = (ctx: C) => Promise<Response | unknown>;

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_RATE = { limit: 300, windowSec: 60 };

function requestIdFrom(req: NextRequest): string {
  const supplied = req.headers.get("x-request-id");
  return supplied && /^[\w.-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID();
}

async function readBody(req: NextRequest, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw payloadTooLarge();
  if (!req.body) return "";

  // Stream with a hard cap so chunked uploads without Content-Length can't exhaust memory.
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw payloadTooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function parseJson(req: NextRequest, maxBytes: number): Promise<unknown> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw unsupportedMedia("Content-Type must be application/json.");
  }
  const raw = await readBody(req, maxBytes);
  if (!raw.trim()) throw badRequest("Request body is empty.");
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Request body is not valid JSON.");
  }
}

function validate<S extends ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationFailed(formatIssues(result.error));
  return result.data;
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = env().allowedOrigins;
  if (!origin || !allowed.includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

/** Export as `OPTIONS` from routes that set `cors: true`. */
export function preflight() {
  return async (req: NextRequest) => {
    const headers = corsHeaders(req);
    if (!headers["Access-Control-Allow-Origin"]) return new NextResponse(null, { status: 204 });
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  };
}

const DB_ERROR_NAMES = new Set([
  "MongooseServerSelectionError",
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoPoolClearedError",
]);

function toErrorResponse(error: unknown, requestId: string): NextResponse {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong on our side.";
  let details: unknown;
  let headers: Record<string, string> | undefined;

  if (error instanceof ApiError) {
    ({ status, code, message, details, headers } = error);
  } else if (error instanceof ZodError) {
    status = 422;
    code = "VALIDATION_FAILED";
    message = "Validation failed.";
    details = formatIssues(error);
  } else if (error instanceof ConfigError) {
    logger.error("server misconfigured", { requestId, ...errorFields(error) });
    code = "SERVER_MISCONFIGURED";
  } else if (error instanceof Error && (DB_ERROR_NAMES.has(error.name) || /buffering timed out|Client must be connected/i.test(error.message))) {
    logger.error("database unavailable", { requestId, ...errorFields(error) });
    status = 503;
    code = "DATABASE_UNAVAILABLE";
    message = "The database is temporarily unavailable. Please try again shortly.";
  } else {
    logger.error("unhandled error", { requestId, ...errorFields(error) });
  }

  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) }, requestId }, { status, headers });
}

/* ------------------------------------------------------------------ */
/* Wrapper                                                             */
/* ------------------------------------------------------------------ */

async function run<P, C extends ApiContext<P>>(
  req: NextRequest,
  routeCtx: RouteContext<P> | undefined,
  opts: BaseOptions & { cache?: Record<string, string> },
  authorize: ((req: NextRequest) => Promise<AuthContext | null>) | null,
  handler: Handler<C>,
  extra: (base: ApiContext<P>, auth: AuthContext | null) => C,
): Promise<Response> {
  const requestId = requestIdFrom(req);
  const started = Date.now();
  let response: Response;
  let rateHeaders: Record<string, string> = {};

  try {
    const params = (routeCtx ? await routeCtx.params : {}) as P;
    const ip = clientIp(req);
    const ipHash = hashIp(ip);

    if (opts.rateLimit !== false) {
      const spec = opts.rateLimit ?? DEFAULT_RATE;
      const result = await enforce(`${opts.name}:${ipHash}`, spec.limit, spec.windowSec);
      rateHeaders = {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.retryAfterSec),
      };
    }

    const auth = authorize ? await authorize(req) : null;

    const maxBytes = opts.maxBodyBytes ?? 256 * 1024;
    const base: ApiContext<P> = {
      req,
      params,
      ip,
      ipHash,
      requestId,
      json: (schema) => parseJson(req, maxBytes).then((body) => validate(schema, body)),
      query: (schema) => validate(schema, Object.fromEntries(req.nextUrl.searchParams)),
    };

    const result = await handler(extra(base, auth));
    response = result instanceof Response ? result : ok(result);

    if (req.method === "GET" && opts.cache && response.status === 200 && !response.headers.has("Cache-Control")) {
      for (const [key, value] of Object.entries(opts.cache)) response.headers.set(key, value);
    }
  } catch (error) {
    response = toErrorResponse(error, requestId);
  }

  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  for (const [key, value] of Object.entries(rateHeaders)) response.headers.set(key, value);
  if (opts.cors) for (const [key, value] of Object.entries(corsHeaders(req))) response.headers.set(key, value);
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");

  logger.debug("request", {
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
    status: response.status,
    ms: Date.now() - started,
  });
  return response;
}

/** Public route: optional auth is never consulted. Rate-limited per IP. */
export function api<P = Record<string, never>>(opts: PublicOptions, handler: Handler<PublicContext<P>>) {
  return (req: NextRequest, routeCtx?: RouteContext<P>) =>
    run<P, PublicContext<P>>(req, routeCtx, opts, null, handler, (base) => ({ ...base, auth: null }));
}

/** Admin route: requires a valid session (cookie or Bearer) holding `permission`. */
export function adminApi<P = Record<string, never>>(opts: AdminOptions, handler: Handler<AdminContext<P>>) {
  const authorize = async (req: NextRequest): Promise<AuthContext | null> => {
    const header = req.headers.get("authorization");
    const bearer = header && /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : null;
    const token = bearer ?? req.cookies.get(SESSION_COOKIE)?.value ?? null;

    // Cookies are sent automatically by browsers, so cookie-authenticated writes must be same-origin.
    if (!bearer && !SAFE_METHODS.has(req.method) && !isTrustedOrigin(req)) {
      throw forbidden("Cross-origin requests are not allowed.");
    }

    if (!token) throw unauthorized();
    const auth = await resolveSession(token);
    if (!auth) throw unauthorized("Your session has expired. Please sign in again.");

    if (opts.permission !== "authenticated" && !can(auth.user.role, opts.permission)) throw forbidden();
    return auth;
  };

  return (req: NextRequest, routeCtx?: RouteContext<P>) =>
    run<P, AdminContext<P>>(req, routeCtx, opts, authorize, handler, (base, auth) => ({ ...base, auth: auth as AuthContext }));
}

/**
 * Same as `adminApi` but for the sign-in route: no session exists yet, so it only applies the
 * same-origin check for cookie-bearing browsers.
 */
export function authApi<P = Record<string, never>>(opts: BaseOptions, handler: Handler<PublicContext<P>>) {
  return (req: NextRequest, routeCtx?: RouteContext<P>) => {
    const guarded = async (): Promise<AuthContext | null> => {
      if (!SAFE_METHODS.has(req.method) && !isTrustedOrigin(req)) {
        throw forbidden("Cross-origin requests are not allowed.");
      }
      return null;
    };
    return run<P, PublicContext<P>>(req, routeCtx, opts, guarded, handler, (base) => ({ ...base, auth: null }));
  };
}
