import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  inferWebhookPlugin,
  processTenantWebhook,
  recordWebhookDelivery,
  resolveWebhookTenant,
} from "~/server/webhooks";
import { verifyWebhookRequest } from "~/server/webhook-auth";
import { log } from "~/server/logger";

export async function POST(request: NextRequest) {
  // Authenticate: Google Pub/Sub OIDC bearer token + shared-secret query token.
  // Both enforced when configured; token is prod-required (see env.js).
  const authed = await verifyWebhookRequest(request);
  if (!authed.ok) {
    log.warn("webhook auth rejected", { reason: authed.reason });
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const contentType = request.headers.get("content-type");

  let body: string | Record<string, unknown>;
  if (contentType?.includes("application/json")) {
    body = (await request.json()) as Record<string, unknown>;
  } else {
    const text = await request.text();
    body = text?.trim() ? text : {};
  }

  const plugin = inferWebhookPlugin(body);
  if (!plugin) {
    return NextResponse.json(
      { success: false, message: "No matching webhook handler found" },
      { status: 404 },
    );
  }

  const tenantId = await resolveWebhookTenant(plugin, body);
  if (!tenantId) {
    log.error("webhook tenant resolution failed", { plugin });
    await recordWebhookDelivery({
      plugin,
      raw: {},
      status: "tenant_unresolved",
    });
    return NextResponse.json(
      { success: false, message: "Could not resolve webhook tenant" },
      { status: 202 },
    );
  }

  const result = await processTenantWebhook({
    plugin,
    tenantId,
    headers,
    body,
  });

  log.info("webhook processed", {
    plugin: result.plugin,
    action: result.action,
  });

  const nextHeaders = new Headers();
  if (result.responseHeaders) {
    for (const [key, value] of Object.entries(result.responseHeaders)) {
      nextHeaders.set(key, value);
    }
  }

  // No webhook matched
  if (result.plugin === null) {
    return NextResponse.json(
      { success: false, message: "No matching webhook handler found" },
      { status: 404, headers: nextHeaders },
    );
  }

  // Matched — return handler response body if present, else empty 200
  if (result.response !== undefined) {
    return NextResponse.json(result.response, { headers: nextHeaders });
  }

  return new NextResponse(null, { status: 200, headers: nextHeaders });
}

export function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
