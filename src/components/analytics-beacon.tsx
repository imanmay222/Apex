"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type EventBody = {
  type: "page_view" | "product_view" | "survey_view" | "cta_click";
  path: string;
  ref?: string;
  referrer?: string;
};

function send(body: EventBody) {
  const payload = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/analytics/events", new Blob([payload], { type: "application/json" }))) return;
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

/** Respect browser privacy signals: no events at all when Do Not Track / GPC is on. */
function trackingAllowed() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack !== "1" && !nav.globalPrivacyControl;
}

/**
 * First-party, cookie-less analytics. Sends one page view per navigation, plus product / survey
 * views, and counts clicks on anything marked `data-track="<name>"` (call, WhatsApp, …).
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!trackingAllowed() || lastPath.current === pathname) return; // StrictMode runs effects twice
    const first = lastPath.current === null;
    lastPath.current = pathname;

    send({ type: "page_view", path: pathname, ...(first && document.referrer ? { referrer: document.referrer } : {}) });

    const product = pathname.match(/^\/products\/([^/]+)$/);
    if (product) send({ type: "product_view", path: pathname, ref: product[1] });
    const survey = pathname.match(/^\/survey\/([^/]+)$/);
    if (survey) send({ type: "survey_view", path: pathname, ref: survey[1] });
  }, [pathname]);

  useEffect(() => {
    if (!trackingAllowed()) return;
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.("[data-track]");
      const name = target?.getAttribute("data-track");
      if (name) send({ type: "cta_click", path: window.location.pathname, ref: name });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
