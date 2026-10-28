"use client";

import { useCallback, useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Browser client for /api/admin. The session travels in the HttpOnly  */
/* cookie; same-origin fetches satisfy the API's CSRF check.           */
/* ------------------------------------------------------------------ */

export type Meta = { page?: number; limit?: number; total?: number; totalPages?: number; [key: string]: unknown };
export type FieldIssue = { path: string; message: string };

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }

  /** Field-level validation problems, when the API reported them. */
  get issues(): FieldIssue[] {
    return Array.isArray(this.details) ? (this.details as FieldIssue[]) : [];
  }
}

type RequestOptions = { method?: string; json?: unknown; form?: FormData; signal?: AbortSignal };

function toLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/admin/login?next=${encodeURIComponent(next)}`);
}

export async function adminRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: Meta }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }

  let response: Response;
  try {
    response = await fetch(path, { method: opts.method ?? "GET", headers, body, signal: opts.signal, credentials: "same-origin", cache: "no-store" });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new AdminApiError(0, "NETWORK", "Could not reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return { data: null as T };

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? {};
    if (response.status === 401 && !path.startsWith("/api/admin/auth/login")) toLogin();
    throw new AdminApiError(response.status, error.code ?? "ERROR", error.message ?? `Request failed (${response.status}).`, error.details);
  }
  return { data: payload?.data as T, meta: payload?.meta };
}

export const adminApi = {
  get: <T>(path: string, signal?: AbortSignal) => adminRequest<T>(path, { signal }).then((r) => r.data),
  post: <T>(path: string, json?: unknown) => adminRequest<T>(path, { method: "POST", json: json ?? {} }).then((r) => r.data),
  patch: <T>(path: string, json: unknown) => adminRequest<T>(path, { method: "PATCH", json }).then((r) => r.data),
  del: <T = null>(path: string) => adminRequest<T>(path, { method: "DELETE" }).then((r) => r.data),
  upload: <T>(path: string, form: FormData) => adminRequest<T>(path, { method: "POST", form }),
};

export const errorMessage = (error: unknown) =>
  error instanceof AdminApiError ? error.message : error instanceof Error ? error.message : "Something went wrong.";

/** Builds `path?query` from an object, dropping empty values. */
export function withQuery(path: string, query: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Mirrors list filters into the address bar (shareable URLs, sensible back button) without a
 * navigation, so it can never cancel a link the user just clicked. Ignored once the user has left
 * `pathname`.
 */
export function syncUrl(pathname: string, url: string) {
  if (window.location.pathname !== pathname) return;
  if (`${window.location.pathname}${window.location.search}` === url) return;
  window.history.replaceState(null, "", url);
}

/* ------------------------------------------------------------------ */

export interface Query<T> {
  data: T | undefined;
  meta: Meta | undefined;
  error: AdminApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (update: T | ((previous: T | undefined) => T)) => void;
}

/** Fetches `path` (null = don't fetch) and refetches when it changes. Keeps the last data while reloading. */
export function useAdminQuery<T>(path: string | null): Query<T> {
  const [tick, setTick] = useState(0);
  const key = path === null ? null : `${tick} ${path}`;
  const [state, setState] = useState<{ key: string | null; data?: T; meta?: Meta; error: AdminApiError | null }>({ key: null, error: null });

  useEffect(() => {
    if (path === null || key === null) return;
    const controller = new AbortController();
    adminRequest<T>(path, { signal: controller.signal })
      .then((result) => setState({ key, data: result.data, meta: result.meta, error: null }))
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        const apiError = error instanceof AdminApiError ? error : new AdminApiError(0, "ERROR", errorMessage(error));
        setState((s) => ({ ...s, key, error: apiError }));
      });
    return () => controller.abort();
  }, [path, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (update: T | ((previous: T | undefined) => T)) =>
      setState((s) => ({ ...s, data: typeof update === "function" ? (update as (p: T | undefined) => T)(s.data) : update })),
    [],
  );

  const settled = state.key === key;
  return { data: state.data, meta: state.meta, error: settled ? state.error : null, loading: key !== null && !settled, reload, setData };
}
