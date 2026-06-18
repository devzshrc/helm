import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  // Optimistic guard only: redirect to /login when no session cookie is present.
  // Cookie presence != validity, so the real check lives in the page's
  // server-side getSession(). The reverse (authed -> dashboard) is handled in
  // the /login page with a real session check to avoid redirect loops when a
  // stale/invalid cookie exists.
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
