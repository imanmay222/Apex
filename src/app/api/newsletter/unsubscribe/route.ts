import { HTML_PAGE_HEADERS, htmlPage } from "@/server/lib/html-page";
import { api } from "@/server/lib/http";
import { unsubscribe, inspectToken } from "@/server/services/subscribers";

const ACTION_PATH = "/api/newsletter/unsubscribe";
const INVALID = "This link is invalid or has expired.";

const page = (status: number, heading: string, message: string, form?: { token: string }) =>
  new Response(
    htmlPage({ title: heading, heading, message, form: form && { action: ACTION_PATH, token: form.token, button: "Unsubscribe me" } }),
    { status, headers: HTML_PAGE_HEADERS },
  );

/**
 * The email link opens a page with a button instead of acting on GET, so mail scanners and link
 * previews that "click" every URL cannot change anyone's subscription.
 */
export const GET = api({ name: "newsletter.unsubscribe.page", rateLimit: { limit: 30, windowSec: 60 } }, async ({ req }) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  return inspectToken(token, "unsub")
    ? page(200, "Unsubscribe", "Press the button below to continue.", { token })
    : page(400, "Link problem", INVALID);
});

export const POST = api({ name: "newsletter.unsubscribe.apply", rateLimit: { limit: 20, windowSec: 60 }, maxBodyBytes: 4 * 1024 }, async ({ req }) => {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");

  const outcome = await unsubscribe(token);
  if (outcome === "ok") return page(200, "You've been unsubscribed", "You won't receive any more emails from us. Sorry to see you go.");
  if (outcome === "gone") return page(410, "Nothing to do", "We couldn't find that subscription. It may already have been removed.");
  return page(400, "Link problem", INVALID);
});
