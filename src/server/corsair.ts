import "dotenv/config";

import { Pool } from "@neondatabase/serverless";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";

import { env } from "~/env";

/** Base URL used to build the OAuth connect redirect URI. */
export const APP_BASE_URL = env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** Where Google redirects back after a Corsair plugin OAuth connect. */
export const CORSAIR_REDIRECT_URI = `${APP_BASE_URL}/api/corsair/callback`;

/**
 * Build a fresh Corsair client backed by a brand-new Neon `Pool`.
 *
 * The pool opens a WebSocket (via Kysely's PostgresDialect `pool.connect()`).
 * To keep connections from leaking across serverless invocations of a reused
 * instance, we never cache this at module scope — one pool per request, closed
 * when the request's work is done. See `withCorsair`.
 */
export function createCorsairClient() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL ?? "postgresql://localhost/placeholder",
  });
  const corsair = createCorsair({
    plugins: [gmail(), googlecalendar()],
    database: pool,
    kek: env.CORSAIR_KEK,
    multiTenancy: true,
    connect: {
      baseUrl: APP_BASE_URL,
      redirectUri: CORSAIR_REDIRECT_URI,
    },
  });
  return { corsair, pool };
}

export type CorsairClient = ReturnType<typeof createCorsairClient>["corsair"];

/**
 * Run `fn` against a request-scoped Corsair client, then close the underlying
 * pool. Closing in `finally` releases the WebSocket inside the same request
 * that opened it — nothing carries over to the next request in the isolate,
 * which is what prevents "Cannot perform I/O on behalf of a different request".
 */
export async function withCorsair<T>(
  fn: (corsair: CorsairClient) => Promise<T>,
): Promise<T> {
  const { corsair, pool } = createCorsairClient();
  try {
    return await fn(corsair);
  } finally {
    await pool.end();
  }
}
