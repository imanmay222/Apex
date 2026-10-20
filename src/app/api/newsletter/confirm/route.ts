import { HTML_PAGE_HEADERS, htmlPage } from "@/server/lib/html-page";
import { api } from "@/server/lib/http";
import { confirmSubscription, inspectToken } from "@/server/services/subscribers";

const ACTION_PATH = "/api/newsletter/confirm";
const INVALID = "This link is invalid or has expired.";

const page = (status: number, heading: string, message: string, form?: { token: string }) =>
  new Response(
    htmlPage({ title: heading, heading, message, form: form && { action: ACTION_PATH, token: form.token, button: "Confirm subscription" } }),
    { status, headers: HTML_PAGE_HEADERS },
  );

/**
 * The email link opens a page with a button instead of acting on GET, so mail scanners and link
 * previews that "click" every URL cannot change anyone's subscription.
 */
export const GET = api({ name: "newsletter.confirm.page", rateLimit: { limit: 30, windowSec: 60 } }, async ({ req }) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  return inspectToken(token, "confirm")
    ? page(200, "Confirm your subscription", "Press the button below to continue.", { token })
    : page(400, "Link problem", INVALID);
});

export const POST = api({ name: "newsletter.confirm.apply", rateLimit: { limit: 20, windowSec: 60 }, maxBodyBytes: 4 * 1024 }, async ({ req }) => {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");

  const outcome = await confirmSubscription(token);
  if (outcome === "ok") return page(200, "You're subscribed", "Thanks for confirming. You'll now receive updates from Apex Care Technologies.");
  if (outcome === "gone") return page(410, "Nothing to do", "This subscription is no longer active. Please sign up again from the website.");
  return page(400, "Link problem", INVALID);
});
