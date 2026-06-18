import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { env } from "~/env";
import {
  checkExpiringSubscriptions,
  runDueSchedules,
  runRetention,
} from "~/server/workflows/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drains due scheduled workflows. Email/calendar automations are webhook-driven.
 * Invoked every 15 min by a GitHub Actions cron (.github/workflows/cron-tick.yml)
 * since Vercel Hobby caps crons at once/day. The workflow sends `Authorization:
 * Bearer <CRON_SECRET>`, which this route requires when CRON_SECRET is set (or
 * `?secret=`). On Vercel Pro this can move back to a vercel.json cron.
 */
export async function GET(request: NextRequest) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    const qp = request.nextUrl.searchParams.get("secret");
    const ok = auth === `Bearer ${env.CRON_SECRET}` || qp === env.CRON_SECRET;
    if (!ok)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await runDueSchedules();
  const expiring = await checkExpiringSubscriptions();
  await runRetention();
  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    expiringSubscriptions: expiring,
  });
}
