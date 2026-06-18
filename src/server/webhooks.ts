import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { withCorsair } from "~/server/corsair";
import {
  calendarEvents,
  corsairAccounts,
  corsairIntegrations,
  emailBodies,
  emailMeta,
  user,
  webhookEvents,
  webhookSubscriptions,
} from "~/server/db/schema";
import { isMissingRelationError } from "~/server/db/errors";
import { log } from "~/server/logger";
import { bodyHtml, summarize, type GmailMessage } from "~/server/gmail-parse";
import { handleInboundEmail } from "~/server/concierge";
import { ensureTriaged } from "~/server/triage";
import {
  runCalendarWorkflows,
  runEmailWorkflows,
} from "~/server/workflows/run";
import type { CalendarCtx } from "~/server/workflows/engine";

let warnedMissingWebhookSubscriptions = false;

type Plugin = "gmail" | "googlecalendar";

type WebhookEnvelope = Record<string, unknown>;

function asRecord(value: unknown): WebhookEnvelope | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as WebhookEnvelope)
    : null;
}

function decodePubSubData(body: unknown): WebhookEnvelope | null {
  const msg = asRecord(asRecord(body)?.message);
  const data = msg?.data;
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(
      Buffer.from(data, "base64").toString("utf8"),
    ) as WebhookEnvelope;
  } catch {
    return null;
  }
}

/**
 * Distil a webhook body to non-content identifiers safe to persist for audit.
 * Deliberately excludes message bodies, subjects, the provider response, and
 * the account email address — only routing/debug ids survive.
 */
function safeWebhookRaw(body: unknown): WebhookEnvelope {
  const decoded = decodePubSubData(body);
  if (!decoded) return {};
  const out: WebhookEnvelope = {};
  for (const key of [
    "type",
    "historyId",
    "channelId",
    "resourceId",
    "resourceState",
    "messageId",
    "eventId",
  ]) {
    const v = decoded[key];
    if (typeof v === "string" || typeof v === "number") out[key] = v;
  }
  return out;
}

export function inferWebhookPlugin(rawBody: unknown): Plugin | null {
  const decoded = decodePubSubData(rawBody);
  if (
    typeof decoded?.emailAddress === "string" &&
    typeof decoded?.historyId === "string"
  ) {
    return "gmail";
  }
  if (
    typeof decoded?.resourceUri === "string" ||
    typeof decoded?.channelId === "string" ||
    typeof decoded?.resourceId === "string"
  ) {
    return "googlecalendar";
  }
  return null;
}

function externalIds(config: unknown): string[] {
  const c = asRecord(config);
  if (!c) return [];
  return [
    c.emailAddress,
    c.externalEmail,
    c.externalAccountId,
    c.accountEmail,
    c.calendarId,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
}

async function findTenantByExternalAccount(
  plugin: Plugin,
  externalId: string | null,
) {
  if (!externalId) return null;
  const needle = externalId.toLowerCase();
  const rows = await db
    .select({
      tenantId: corsairAccounts.tenantId,
      config: corsairAccounts.config,
      userEmail: user.email,
    })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .leftJoin(user, eq(corsairAccounts.tenantId, user.id))
    .where(eq(corsairIntegrations.name, plugin));

  const match = rows.find((row) => {
    const ids = externalIds(row.config);
    if (row.userEmail) ids.push(row.userEmail);
    return ids.some((id) => id.toLowerCase() === needle);
  });
  return match?.tenantId ?? null;
}

async function findTenantByCalendarNotification(
  decoded: WebhookEnvelope | null,
) {
  const channelId =
    typeof decoded?.channelId === "string" ? decoded.channelId : null;
  const resourceId =
    typeof decoded?.resourceId === "string" ? decoded.resourceId : null;
  const token =
    typeof decoded?.channelToken === "string" ? decoded.channelToken : null;
  if (token?.startsWith("tenant:")) return token.slice("tenant:".length);

  if (channelId || resourceId) {
    try {
      const detailed = await db
        .select({
          tenantId: webhookSubscriptions.tenantId,
          channelId: webhookSubscriptions.channelId,
          resourceId: webhookSubscriptions.resourceId,
        })
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.plugin, "googlecalendar"));
      const match = detailed.find(
        (row) =>
          (channelId !== null && row.channelId === channelId) ||
          (resourceId !== null && row.resourceId === resourceId),
      );
      if (match?.tenantId) return match.tenantId;
      // No "lone tenant" fallback: attributing an unmatched channel to the only
      // subscription present is a cross-tenant misroute. Fall through to the
      // resourceUri/calendarId match below, else return unresolved (202).
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
      if (!warnedMissingWebhookSubscriptions) {
        warnedMissingWebhookSubscriptions = true;
        log.warn(
          "webhook_subscriptions table is missing; run `bun run db:migrate` to enable calendar webhook channel resolution.",
        );
      }
    }
  }

  const resourceUri =
    typeof decoded?.resourceUri === "string" ? decoded.resourceUri : "";
  const calendarId = /\/calendars\/([^/?]+)/.exec(resourceUri)?.[1];
  return findTenantByExternalAccount(
    "googlecalendar",
    calendarId ? decodeURIComponent(calendarId) : null,
  );
}

export async function resolveWebhookTenant(
  plugin: Plugin,
  rawBody: unknown,
): Promise<string | null> {
  const decoded = decodePubSubData(rawBody);
  if (plugin === "gmail") {
    const emailAddress =
      typeof decoded?.emailAddress === "string" ? decoded.emailAddress : null;
    return findTenantByExternalAccount("gmail", emailAddress);
  }
  return findTenantByCalendarNotification(decoded);
}

function webhookStatus(response: unknown): string {
  const r = asRecord(response);
  if (!r) return "processed";
  if (r.success === false) return "failed";
  if (typeof r.status === "string") return r.status;
  return "processed";
}

function webhookData(response: unknown): WebhookEnvelope | null {
  const r = asRecord(response);
  if (!r) return null;
  return asRecord(r.data) ?? asRecord(r.eventData) ?? r;
}

async function recordWebhookEvent(input: {
  tenantId: string | null;
  plugin: string | null;
  action: string | null;
  raw: unknown;
  status: string;
}) {
  await db.insert(webhookEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    plugin: input.plugin,
    action: input.action,
    status: input.status,
    raw: input.raw ?? {},
  });
}

export async function recordWebhookDelivery(input: {
  tenantId?: string | null;
  plugin?: string | null;
  action?: string | null;
  raw: unknown;
  status: string;
}) {
  await recordWebhookEvent({
    tenantId: input.tenantId ?? null,
    plugin: input.plugin ?? null,
    action: input.action ?? null,
    raw: input.raw,
    status: input.status,
  });
}

async function handleGmailEvent(
  tenantId: string,
  data: WebhookEnvelope | null,
): Promise<{ threadId?: string; action?: string }> {
  const type = typeof data?.type === "string" ? data.type : "";
  const message = asRecord(data?.message) as GmailMessage | null;
  const messageId = message?.id;
  if (!messageId) return {};

  if (type === "messageDeleted") {
    await db
      .delete(emailMeta)
      .where(
        and(eq(emailMeta.tenantId, tenantId), eq(emailMeta.gmailId, messageId)),
      );
    return { action: type };
  }

  const summary = summarize(message);
  if (!summary.id || !summary.threadId) return {};
  const priorities = await ensureTriaged(tenantId, [
    {
      ...summary,
      threadId: summary.threadId,
      messageCount: 1,
      hasUnread: summary.unread,
      hasAttachment: false,
    },
  ]);

  // Cache email body so getThread can serve from DB on next open
  const html = bodyHtml(message);
  if (html) {
    await db
      .insert(emailBodies)
      .values({ tenantId, gmailId: messageId, html })
      .onConflictDoUpdate({
        target: [emailBodies.tenantId, emailBodies.gmailId],
        set: { html, cachedAt: new Date() },
      });
  }

  if (type === "messageReceived") {
    await runEmailWorkflows(tenantId, {
      threadId: summary.threadId,
      messageId: summary.id,
      from: summary.from,
      subject: summary.subject,
      labelIds: summary.labelIds,
      hasAttachment: false,
      priority: priorities.get(summary.id) ?? null,
    });
    await handleInboundEmail(tenantId, {
      threadId: summary.threadId,
      from: summary.from,
      subject: summary.subject,
    });
  }
  return { threadId: summary.threadId, action: type };
}

function calendarCtx(data: WebhookEnvelope | null): CalendarCtx | null {
  const type = typeof data?.type === "string" ? data.type : "";
  if (!["eventCreated", "eventUpdated", "eventDeleted"].includes(type))
    return null;
  if (type === "eventDeleted") {
    const eventId = typeof data?.eventId === "string" ? data.eventId : "";
    if (!eventId) return null;
    return { eventId, action: "deleted", title: eventId };
  }
  const event = asRecord(data?.event);
  const eventId = typeof event?.id === "string" ? event.id : "";
  if (!eventId) return null;
  const attendees = Array.isArray(event?.attendees)
    ? event.attendees
        .map((a) => asRecord(a)?.email)
        .filter((email): email is string => typeof email === "string")
    : [];
  const start = asRecord(event?.start);
  const end = asRecord(event?.end);
  return {
    eventId,
    action: type === "eventCreated" ? "created" : "updated",
    title: typeof event?.summary === "string" ? event.summary : "(no title)",
    start:
      typeof start?.dateTime === "string"
        ? start.dateTime
        : typeof start?.date === "string"
          ? start.date
          : null,
    end:
      typeof end?.dateTime === "string"
        ? end.dateTime
        : typeof end?.date === "string"
          ? end.date
          : null,
    location: typeof event?.location === "string" ? event.location : null,
    attendees,
  };
}

async function handleCalendarEvent(
  tenantId: string,
  data: WebhookEnvelope | null,
): Promise<{ eventId?: string; action?: string }> {
  const ctx = calendarCtx(data);
  if (!ctx) return {};

  if (ctx.action === "deleted") {
    await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.tenantId, tenantId),
          eq(calendarEvents.eventId, ctx.eventId),
        ),
      );
  } else {
    await db
      .insert(calendarEvents)
      .values({
        tenantId,
        eventId: ctx.eventId,
        title: ctx.title,
        start: ctx.start ?? null,
        end: ctx.end ?? null,
        allDay: ctx.start ? !ctx.start.includes("T") : false,
        location: ctx.location ?? null,
        attendees: ctx.attendees,
      })
      .onConflictDoUpdate({
        target: [calendarEvents.tenantId, calendarEvents.eventId],
        set: {
          title: ctx.title,
          start: ctx.start ?? null,
          end: ctx.end ?? null,
          location: ctx.location ?? null,
          attendees: ctx.attendees,
          updatedAt: new Date(),
        },
      });
  }

  await runCalendarWorkflows(tenantId, ctx);
  return { eventId: ctx.eventId, action: ctx.action };
}

export async function handleCorsairWebhookEvent(input: {
  tenantId: string;
  plugin: Plugin;
  action: string;
  data: WebhookEnvelope | null;
  raw: unknown;
}): Promise<Record<string, string> | undefined> {
  if (input.plugin === "gmail") {
    const gmailMeta = await handleGmailEvent(input.tenantId, input.data);
    return gmailMeta.threadId ? gmailMeta : undefined;
  }
  if (input.plugin === "googlecalendar") {
    const meta = await handleCalendarEvent(input.tenantId, input.data);
    return meta.eventId ? meta : undefined;
  }
  return undefined;
}

export async function processTenantWebhook(input: {
  plugin: Plugin;
  tenantId: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | string;
}) {
  const { processWebhook } = await import("corsair");
  const result = await withCorsair((c) =>
    processWebhook(c.withTenant(input.tenantId), input.headers, input.body, {
      tenantId: input.tenantId,
    }),
  );
  const status = webhookStatus(result.response);
  const data = webhookData(result.response);
  await recordWebhookEvent({
    tenantId: input.tenantId,
    plugin: result.plugin,
    action: result.action,
    // Only non-content identifiers — never message bodies / responses (PII at rest).
    raw: safeWebhookRaw(input.body),
    status,
  });
  if (result.plugin && result.action && status !== "failed") {
    await handleCorsairWebhookEvent({
      tenantId: input.tenantId,
      plugin: result.plugin as Plugin,
      action: result.action,
      data,
      raw: input.body,
    });
  }
  return result;
}
