import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "~/env";

/**
 * Authenticates inbound Corsair/Google webhook pushes.
 *
 * Two independent guards, both must pass when configured:
 *  1. Query shared-secret (`?token=`) — cheap, prod-required (see env.js).
 *  2. Google Pub/Sub OIDC bearer token — the real authenticity check. Google
 *     attaches `Authorization: Bearer <JWT>` to every push, signed with Google's
 *     keys; we verify the signature, issuer, and the service-account `email`
 *     claim against GOOGLE_PUBSUB_SA_EMAIL.
 *
 * If neither guard is configured (local dev), the request is allowed so the
 * tunnel flow still works — env.js makes the token required in production.
 */

// Google's OIDC signing keys (rotated; jose caches + refreshes the JWKS).
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type WebhookAuthResult = { ok: true } | { ok: false; reason: string };

function checkToken(req: Request): WebhookAuthResult | null {
  if (!env.CORSAIR_WEBHOOK_TOKEN) return null;
  const token = new URL(req.url).searchParams.get("token");
  if (token !== env.CORSAIR_WEBHOOK_TOKEN) {
    return { ok: false, reason: "bad_token" };
  }
  return { ok: true };
}

async function checkOidc(req: Request): Promise<WebhookAuthResult | null> {
  if (!env.GOOGLE_PUBSUB_SA_EMAIL) return null;
  const header = req.headers.get("authorization") ?? "";
  const jwt = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!jwt) return { ok: false, reason: "missing_oidc_token" };

  try {
    const { payload } = await jwtVerify(jwt, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    const verified = payload.email_verified === true;
    if (!verified || email !== env.GOOGLE_PUBSUB_SA_EMAIL) {
      return { ok: false, reason: "oidc_email_mismatch" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "oidc_verify_failed" };
  }
}

/**
 * Returns ok=true only if every *configured* guard passes. A guard that isn't
 * configured returns null (skipped). If no guard is configured at all, the
 * request is allowed (dev only — prod requires the token via env.js).
 */
export async function verifyWebhookRequest(
  req: Request,
): Promise<WebhookAuthResult> {
  const token = checkToken(req);
  if (token && !token.ok) return token;

  const oidc = await checkOidc(req);
  if (oidc && !oidc.ok) return oidc;

  return { ok: true };
}
