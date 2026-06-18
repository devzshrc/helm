import "server-only";

import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "~/server/db";
import {
  agentActivityLog,
  chatSessions,
  webhookEvents,
  webhookSubscriptions,
  workflowRuns,
  workflows,
} from "~/server/db/schema";
import { getThread, listThreads } from "~/server/gmail";
import { type CalendarCtx, type EmailCtx } from "~/server/workflows/engine";
import { runHelmWorkflowViaMastra } from "~/lib/mastra/workflows";
import { handleInboundEmail } from "~/server/concierge";
import { log } from "~/server/logger";
import type { WorkflowNode, WorkflowTrigger } from "~/lib/workflows/types";
import { validateWorkflowSpec } from "~/lib/workflows/validation";

type WorkflowRow = typeof workflows.$inferSelect;

/** Builds the email context (subject + joined body) for a thread. */
export async function buildEmailCtx(
  tenantId: string,
  threadId: string,
  extras: Partial<
    Pick<EmailCtx, "labelIds" | "hasAttachment" | "priority">
  > = {},
): Promise<EmailCtx> {
  const thread = await getThread(tenantId, threadId);
  const body = thread.messages
    .map((m) => m.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "))
    .join("\n")
    .slice(0, 8000);
  const latest = thread.messages[thread.messages.length - 1];
  return {
    threadId,
    from: latest?.from ?? "",
    subject: thread.subject,
    body,
    labelIds: extras.labelIds,
    hasAttachment: extras.hasAttachment,
    priority: extras.priority,
  };
}

export function matchEmailTrigger(
  config: Record<string, string>,
  email: EmailCtx,
): boolean {
  const f = config.fromContains?.trim().toLowerCase();
  const s = config.subjectContains?.trim().toLowerCase();
  const b = config.bodyContains?.trim().toLowerCase();
  const label = config.labelIncludes?.trim().toLowerCase();
  const priority = config.priorityIs?.trim();
  const hasAttachment = config.hasAttachment?.trim();
  if (f && !email.from.toLowerCase().includes(f)) return false;
  if (s && !email.subject.toLowerCase().includes(s)) return false;
  if (b && !email.body.toLowerCase().includes(b)) return false;
  if (
    label &&
    !(email.labelIds ?? []).some((id) => id.toLowerCase().includes(label))
  )
    return false;
  if (priority && email.priority !== priority) return false;
  if (hasAttachment === "yes" && !email.hasAttachment) return false;
  if (hasAttachment === "no" && email.hasAttachment) return false;
  return true;
}

export function matchCalendarTrigger(
  config: Record<string, string>,
  calendar: CalendarCtx,
): boolean {
  const action = config.action?.trim();
  if (action && action !== "any" && action !== calendar.action) return false;
  const s = config.titleContains?.trim().toLowerCase();
  const attendee = config.attendeeContains?.trim().toLowerCase();
  const location = config.locationContains?.trim().toLowerCase();
  if (s && !calendar.title.toLowerCase().includes(s)) return false;
  if (
    attendee &&
    !(calendar.attendees ?? []).some((a) => a.toLowerCase().includes(attendee))
  )
    return false;
  if (location && !calendar.location?.toLowerCase().includes(location))
    return false;
  return true;
}

/** Which of these workflows already recorded a run for this dedupe key (one query). */
async function alreadyRanMany(
  workflowIds: string[],
  dedupeKey: string,
): Promise<Set<string>> {
  if (workflowIds.length === 0) return new Set();
  const rows = await db
    .select({ workflowId: workflowRuns.workflowId })
    .from(workflowRuns)
    .where(
      and(
        inArray(workflowRuns.workflowId, workflowIds),
        eq(workflowRuns.dedupeKey, dedupeKey),
      ),
    );
  return new Set(rows.map((r) => r.workflowId));
}

/** Runs one workflow and records the run. */
export async function runAndRecord(
  wf: WorkflowRow,
  opts: {
    email?: EmailCtx;
    calendar?: CalendarCtx;
    dedupeKey?: string;
    source?: "webhook" | "cron" | "manual_test" | "reconciliation";
    plugin?: "gmail" | "googlecalendar";
    action?: string;
    providerEventId?: string;
  },
) {
  const runId = crypto.randomUUID();
  const trigger = wf.trigger as WorkflowTrigger;
  const nodes = (wf.nodes as WorkflowNode[]) ?? [];
  const validation = validateWorkflowSpec({
    name: wf.name,
    trigger,
    nodes,
  });
  if (!validation.ok) {
    const message = validation.errors.map((issue) => issue.message).join(" ");
    const result = {
      status: "failed" as const,
      steps: [],
      error: message,
    };
    await db.insert(workflowRuns).values({
      id: runId,
      workflowId: wf.id,
      tenantId: wf.tenantId,
      status: result.status,
      input: {
        source: opts.source ?? "manual_test",
        validation: validation.errors,
      },
      steps: result.steps,
      error: result.error,
      dedupeKey: opts.dedupeKey ?? null,
      finishedAt: new Date(),
    });
    return { runId, ...result };
  }

  const result = await runHelmWorkflowViaMastra({
    tenantId: wf.tenantId,
    trigger,
    nodes,
    email: opts.email,
    calendar: opts.calendar,
  });

  await db.insert(workflowRuns).values({
    id: runId,
    workflowId: wf.id,
    tenantId: wf.tenantId,
    status: result.status,
    input: {
      source: opts.source ?? "manual_test",
      plugin: opts.plugin,
      action: opts.action,
      providerEventId: opts.providerEventId,
      dedupeKey: opts.dedupeKey,
      // Non-content only: subject/from/title omitted to keep email/event
      // content out of the run log (PII at rest).
      ...(opts.email
        ? {
            labels: opts.email.labelIds,
            hasAttachment: opts.email.hasAttachment,
            priority: opts.email.priority,
          }
        : opts.calendar
          ? {
              eventId: opts.calendar.eventId,
              calendarAction: opts.calendar.action,
            }
          : {}),
    },
    steps: result.steps,
    error: result.error ?? null,
    dedupeKey: opts.dedupeKey ?? null,
    finishedAt: new Date(),
  });
  await db
    .update(workflows)
    .set({ lastRunAt: new Date() })
    .where(eq(workflows.id, wf.id));

  return { runId, ...result };
}

export async function runCalendarWorkflows(
  tenantId: string,
  calendar: CalendarCtx,
) {
  const rows = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.tenantId, tenantId),
        eq(workflows.enabled, true),
        sql`${workflows.trigger}->>'type' = 'calendar'`,
      ),
    );
  if (rows.length === 0) return;

  const dedupeKey = [
    calendar.action,
    calendar.eventId,
    calendar.start ?? "",
    calendar.end ?? "",
    calendar.title,
  ].join(":");

  const ran = await alreadyRanMany(
    rows.map((r) => r.id),
    dedupeKey,
  );

  for (const wf of rows) {
    if (ran.has(wf.id)) continue;
    const trigger = wf.trigger as WorkflowTrigger;
    if (!matchCalendarTrigger(trigger.config ?? {}, calendar)) continue;
    try {
      await runAndRecord(wf, {
        calendar,
        dedupeKey,
        source: "webhook",
        plugin: "googlecalendar",
        action: calendar.action,
        providerEventId: calendar.eventId,
      });
    } catch (err) {
      log.error("calendar workflow run failed", {
        workflowId: wf.id,
        err: String(err),
      });
    }
  }
}

/** Webhook entry: run all enabled email workflows for a new message. */
export async function runEmailWorkflows(
  tenantId: string,
  msg: {
    threadId: string;
    messageId: string;
    from: string;
    subject: string;
    labelIds?: string[];
    hasAttachment?: boolean;
    priority?: string | null;
  },
) {
  const rows = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.tenantId, tenantId),
        eq(workflows.enabled, true),
        sql`${workflows.trigger}->>'type' = 'email'`,
      ),
    );
  if (rows.length === 0) return;

  const ran = await alreadyRanMany(
    rows.map((r) => r.id),
    msg.messageId,
  );
  const pending = rows.filter((wf) => !ran.has(wf.id));
  if (pending.length === 0) return;

  // Fetch the thread body once for all matching workflows (was N+1 per workflow).
  let email: EmailCtx;
  try {
    email = await buildEmailCtx(tenantId, msg.threadId, {
      labelIds: msg.labelIds,
      hasAttachment: msg.hasAttachment,
      priority: msg.priority,
    });
  } catch (err) {
    log.error("buildEmailCtx failed", {
      tenantId,
      threadId: msg.threadId,
      err: String(err),
    });
    return;
  }

  for (const wf of pending) {
    const trigger = wf.trigger as WorkflowTrigger;
    if (!matchEmailTrigger(trigger.config ?? {}, email)) continue;
    try {
      await runAndRecord(wf, {
        email,
        dedupeKey: msg.messageId,
        source: "webhook",
        plugin: "gmail",
        action: "messageReceived",
        providerEventId: msg.messageId,
      });
    } catch (err) {
      log.error("workflow run failed", { workflowId: wf.id, err: String(err) });
    }
  }
}

/**
 * Poll recent inbox mail for one tenant and run matching email workflows.
 * `runEmailWorkflows` dedupes by messageId, so repeated polls won't re-run a
 * message. This remains as a reconciliation helper; the live path is webhooks.
 */
export async function pollEmailWorkflows(tenantId: string) {
  const threads = await listThreads(tenantId, {
    q: "newer_than:1d",
    maxResults: 25,
  });
  for (const th of threads) {
    try {
      await runEmailWorkflows(tenantId, {
        threadId: th.threadId,
        messageId: th.id,
        from: th.from,
        subject: th.subject,
        labelIds: th.labelIds,
        hasAttachment: th.hasAttachment,
        priority: th.priority,
      });
      // Scheduling Concierge (dedupes per thread, so re-polling is safe).
      await handleInboundEmail(tenantId, {
        threadId: th.threadId,
        from: th.from,
        subject: th.subject,
      });
    } catch (err) {
      log.error("poll email workflow failed", {
        tenantId,
        threadId: th.threadId,
        err: String(err),
      });
    }
  }
}

/** Reconciliation entry: poll mail for every tenant that has an enabled email workflow. */
export async function runEmailPolls() {
  const rows = await db
    .select({ tenantId: workflows.tenantId })
    .from(workflows)
    .where(
      and(
        eq(workflows.enabled, true),
        sql`${workflows.trigger}->>'type' = 'email'`,
      ),
    );
  const tenants = new Set<string>();
  for (const wf of rows) tenants.add(wf.tenantId);
  for (const tenantId of tenants) {
    try {
      await pollEmailWorkflows(tenantId);
    } catch (err) {
      log.error("email poll failed for tenant", { tenantId, err: String(err) });
    }
  }
}

/**
 * Cron entry: log a warning for Google Calendar push subscriptions that are
 * expiring within the next 3 days. Corsair manages the actual subscription
 * lifecycle, but early warnings allow manual intervention if needed.
 */
export async function checkExpiringSubscriptions() {
  const threshold = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({
        id: webhookSubscriptions.id,
        tenantId: webhookSubscriptions.tenantId,
        plugin: webhookSubscriptions.plugin,
        expiresAt: webhookSubscriptions.expiresAt,
        status: webhookSubscriptions.status,
      })
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.plugin, "googlecalendar"),
          lt(webhookSubscriptions.expiresAt, sql`${threshold}`),
        ),
      );

    for (const row of rows) {
      log.warn("[cron] googlecalendar subscription expiring soon", {
        tenantId: row.tenantId,
        subscriptionId: row.id,
        expiresAt: row.expiresAt,
        status: row.status,
      });
    }

    return rows.length;
  } catch (err) {
    // Table may not exist in older deployments
    log.warn("[cron] checkExpiringSubscriptions failed", { err: String(err) });
    return 0;
  }
}

/**
 * Cron entry: purge high-churn rows so the tables don't grow unbounded.
 * webhook_events only feeds the sync cursor (max(created_at)), so it can be
 * trimmed aggressively; runs/activity keep a longer window for debugging.
 */
export async function runRetention() {
  const day = 24 * 60 * 60 * 1000;
  const webhookCutoff = new Date(Date.now() - 7 * day);
  const historyCutoff = new Date(Date.now() - 30 * day);
  const result = { webhookEvents: 0, workflowRuns: 0, activity: 0 };
  try {
    await db
      .delete(webhookEvents)
      .where(lt(webhookEvents.createdAt, webhookCutoff));
    await db
      .delete(workflowRuns)
      .where(lt(workflowRuns.startedAt, historyCutoff));
    await db
      .delete(agentActivityLog)
      .where(lt(agentActivityLog.createdAt, historyCutoff));
    // Old chat history holds (redacted) tool results — prune stale threads.
    await db
      .delete(chatSessions)
      .where(lt(chatSessions.updatedAt, historyCutoff));
  } catch (err) {
    log.warn("[cron] retention purge failed", { err: String(err) });
  }
  return result;
}

/** Cron entry: run schedule workflows that are due. */
export async function runDueSchedules() {
  const rows = await db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.enabled, true),
        sql`${workflows.trigger}->>'type' = 'schedule'`,
      ),
    );
  const now = new Date();

  for (const wf of rows) {
    const trigger = wf.trigger as WorkflowTrigger;
    const freq = trigger.config?.frequency ?? "daily";
    const last = wf.lastRunAt ? new Date(wf.lastRunAt) : null;

    let due = false;
    if (freq === "hourly") {
      due = !last || now.getTime() - last.getTime() >= 55 * 60_000;
    } else {
      // daily at 08:00 — due if not run yet today and it's >= 08:00
      const ranToday = last?.toDateString() === now.toDateString();
      due = now.getHours() >= 8 && !ranToday;
    }
    if (!due) continue;
    try {
      await runAndRecord(wf, {
        dedupeKey: now.toISOString().slice(0, 13),
        source: "cron",
      });
    } catch (err) {
      log.error("scheduled workflow failed", {
        workflowId: wf.id,
        err: String(err),
      });
    }
  }
}
