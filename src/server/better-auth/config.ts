import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import { db } from "~/server/db";

const authBaseURL = env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL) : null;
const trustedOrigins = [
  authBaseURL?.origin,
  ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  // Falls back to a dev default when unset; required in production (see env.js).
  secret: env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL
    ? {
        allowedHosts: [authBaseURL.host],
        fallback: authBaseURL.origin,
        protocol: authBaseURL.protocol === "http:" ? "http" : "https",
      }
    : undefined,
  trustedOrigins,
  advanced: {
    trustedProxyHeaders: true,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    google: {
      clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
      // redirectURI is derived from baseURL/request -> `/api/auth/callback/google`.
      // Don't hardcode localhost; it breaks every non-local deploy.
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
