import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness + DB readiness probe for uptime monitoring.
 * Returns 200 only when the database is reachable, else 503.
 */
export async function GET() {
  try {
    const [{ sql }, { db }] = await Promise.all([
      import("drizzle-orm"),
      import("~/server/db"),
    ]);
    await db.execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      db: "up",
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const envInvalid = message.includes("Invalid environment variables");
    // Temporary diagnostic: list which required vars are absent/empty (names
    // only, never values) so a misconfigured deploy is debuggable without logs.
    const required = [
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_GOOGLE_CLIENT_ID",
      "BETTER_AUTH_GOOGLE_CLIENT_SECRET",
      "CORSAIR_KEK",
      "CORSAIR_WEBHOOK_TOKEN",
      "CRON_SECRET",
      "DATABASE_URL",
    ];
    const missing = required.filter((k) => !process.env[k]);
    return NextResponse.json(
      {
        status: "degraded",
        db: "down",
        reason: envInvalid ? "runtime_env_invalid" : "db_unreachable",
        ...(envInvalid ? { missing } : {}),
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
