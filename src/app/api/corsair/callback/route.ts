import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { processOAuthCallback } from "corsair/oauth";

import {
  withCorsair,
  CORSAIR_REDIRECT_URI,
  APP_BASE_URL,
} from "~/server/corsair";
import { getSession } from "~/server/better-auth/server";
import { recordConnectedAccountIdentity } from "~/server/connections";
import { log } from "~/server/logger";

/**
 * OAuth redirect target for Corsair plugin connects.
 * Exchanges code -> tokens and stores the account for the tenant in `state`.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${APP_BASE_URL}/dashboard?connect=error`);
  }

  try {
    const { plugin } = await withCorsair((corsair) =>
      processOAuthCallback(corsair, {
        code,
        state,
        redirectUri: CORSAIR_REDIRECT_URI,
      }),
    );
    const session = await getSession();
    if (
      session?.user?.id &&
      (plugin === "gmail" || plugin === "googlecalendar")
    ) {
      await recordConnectedAccountIdentity({
        plugin,
        tenantId: session.user.id,
        fallbackEmail: session.user.email,
      });
    }
    return NextResponse.redirect(
      `${APP_BASE_URL}/dashboard?connected=${plugin}`,
    );
  } catch (err) {
    log.error("corsair oauth callback failed", { err: String(err) });
    return NextResponse.redirect(`${APP_BASE_URL}/dashboard?connect=error`);
  }
}
