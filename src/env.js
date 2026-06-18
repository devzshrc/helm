import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    BETTER_AUTH_GOOGLE_CLIENT_ID: z.string(),
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string(),
    // Key-encryption-key for Corsair's at-rest token encryption. Required:
    // without it Corsair cannot decrypt stored OAuth tokens.
    CORSAIR_KEK: z.string().min(1),
    // Shared secret on the webhook push URL (?token=). Defense-in-depth on top
    // of the Pub/Sub OIDC check. Required in production so the endpoint is never
    // left fully open if the OIDC service-account email is misconfigured.
    CORSAIR_WEBHOOK_TOKEN:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    // Service-account email Google signs Pub/Sub push OIDC tokens with. When set,
    // inbound webhooks must carry a valid Google-signed OIDC bearer token whose
    // `email` claim matches this. Strongly recommended in production.
    GOOGLE_PUBSUB_SA_EMAIL: z.string().email().optional(),
    // AI provider = Groq only.
    GROQ_API_KEY: z.string().optional(),
    // Secret guarding the scheduled-workflow tick endpoint (/api/cron/tick).
    // Required in production so the cron drain can't be triggered by anyone.
    CRON_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    // Embeddings provider — Gemini text-embedding-004 (768 dims).
    GEMINI_API_KEY: z.string().optional(),
    // Shared rate-limit store (Upstash Redis REST). When both are set the
    // limiter is durable across serverless instances; otherwise it falls back
    // to a per-instance in-memory limiter (fine for local dev only).
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    BETTER_AUTH_GOOGLE_CLIENT_ID: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID,
    BETTER_AUTH_GOOGLE_CLIENT_SECRET:
      process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
    CORSAIR_KEK: process.env.CORSAIR_KEK,
    CORSAIR_WEBHOOK_TOKEN: process.env.CORSAIR_WEBHOOK_TOKEN,
    GOOGLE_PUBSUB_SA_EMAIL: process.env.GOOGLE_PUBSUB_SA_EMAIL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
