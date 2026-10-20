import { escapeHtml } from "./text";

/**
 * Minimal self-contained HTML page for token links opened from an email (confirm / unsubscribe).
 * No scripts; inline styles only; sent with a locked-down CSP by the route.
 */
export function htmlPage(opts: { title: string; heading: string; message: string; form?: { action: string; token: string; button: string } }): string {
  const form = opts.form
    ? `<form method="post" action="${escapeHtml(opts.form.action)}"><input type="hidden" name="token" value="${escapeHtml(opts.form.token)}"><button type="submit">${escapeHtml(opts.form.button)}</button></form>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(opts.title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fa;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0d1526}main{max-width:28rem;margin:1rem;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 8px 30px rgba(10,33,80,.12);text-align:center}h1{font-size:1.4rem;margin:0 0 .75rem}p{color:#5b6880;line-height:1.55;margin:0 0 1.25rem}button,a.btn{display:inline-block;background:#ee4a24;color:#fff;border:0;border-radius:999px;padding:.8rem 1.6rem;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}</style></head>
<body><main><h1>${escapeHtml(opts.heading)}</h1><p>${escapeHtml(opts.message)}</p>${form}${form ? "" : `<a class="btn" href="/">Back to the website</a>`}</main></body></html>`;
}

export const HTML_PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};
