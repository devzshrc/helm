import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { setupCorsair } from "corsair";
import { generateOAuthUrl } from "corsair/oauth";

import { withCorsair, CORSAIR_REDIRECT_URI } from "~/server/corsair";
import { getSession } from "~/server/better-auth/server";

const SUPPORTED = new Set(["gmail", "googlecalendar"]);

/**
 * Starts a per-user Corsair OAuth connect.
 * GET /api/corsair/connect?plugin=gmail|googlecalendar -> redirect to Google.
 */
export async function GET(request: NextRequest) {
  const plugin = request.nextUrl.searchParams.get("plugin");
  if (!plugin || !SUPPORTED.has(plugin)) {
    return NextResponse.json(
      {
        error: "Unknown or missing ?plugin (gmail|googlecalendar)",
      },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { url } = await withCorsair((corsair) =>
    (async () => {
      // Keep first-connect resilient on fresh environments by seeding missing
      // integration/account rows before starting OAuth.
      await setupCorsair(corsair, { tenantId: session.user.id });
      return generateOAuthUrl(corsair, plugin, {
        tenantId: session.user.id,
        redirectUri: CORSAIR_REDIRECT_URI,
      });
    })(),
  );

  return NextResponse.redirect(url);
}
