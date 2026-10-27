import { NextResponse, type NextRequest } from "next/server";

/** Kept in sync with SESSION_COOKIE (the proxy stays free of server-only imports). */
const SESSION_COOKIE = "apex_session";

/**
 * Optimistic gate for the admin panel: visitors without a session cookie are sent to the sign-in
 * page before any admin page renders. The real check (is the session valid, does the user have
 * the permission) happens on the server in the admin layout and pages, and again in every
 * /api/admin route.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  if (!isLogin && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Lets the admin layout send an expired session back to the page it was on.
  const headers = new Headers(request.headers);
  headers.set("x-admin-path", `${pathname}${search}`);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
