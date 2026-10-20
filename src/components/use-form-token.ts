"use client";

import { useCallback, useEffect, useRef } from "react";

type ApiBody = { data?: Record<string, unknown>; error?: { code?: string; message?: string; details?: { path: string; message: string }[] } };

export interface FormResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  message?: string;
  fieldErrors: Record<string, string>;
}

/**
 * Public forms must send a signed token proving the page was loaded (see GET /api/enquiries/token).
 * `submit` attaches it, transparently refreshing once if it expired while the page sat open.
 */
export function useFormToken() {
  const token = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const body = (await (await fetch("/api/enquiries/token", { cache: "no-store" })).json()) as ApiBody;
      token.current = (body.data?.token as string | undefined) ?? null;
    } catch {
      token.current = null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = (url: string, payload: Record<string, unknown>) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, token: token.current ?? "missing" }) });

  const submit = useCallback(
    async (url: string, payload: Record<string, unknown>, opts: { needsToken?: boolean } = {}): Promise<FormResult> => {
      const needsToken = opts.needsToken ?? true;
      try {
        const post = () => (needsToken ? send(url, payload) : fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
        let response = await post();
        let body = (await response.json().catch(() => ({}))) as ApiBody;

        if (needsToken && !response.ok && ["INVALID_FORM_TOKEN", "FORM_EXPIRED"].includes(body.error?.code ?? "")) {
          await load();
          await new Promise((resolve) => setTimeout(resolve, 2_100)); // the server enforces a minimum fill time
          response = await post();
          body = (await response.json().catch(() => ({}))) as ApiBody;
        }

        const fieldErrors: Record<string, string> = {};
        for (const detail of body.error?.details ?? []) fieldErrors[detail.path] = detail.message;

        if (response.ok && needsToken) void load();
        return {
          ok: response.ok,
          status: response.status,
          data: body.data,
          fieldErrors,
          message:
            response.status === 429
              ? "Too many attempts. Please wait a few minutes and try again."
              : body.error?.message,
        };
      } catch {
        return { ok: false, status: 0, fieldErrors: {}, message: "We couldn't reach the server. Check your connection and try again." };
      }
    },
    [load],
  );

  return { submit };
}
