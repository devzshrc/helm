import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { generateText } from "ai";

import { db } from "~/server/db";
import {
  agentActivityLog,
  schedulingNegotiations,
  userPreferences,
} from "~/server/db/schema";
import { models } from "~/lib/ai/models";
import { getThread } from "~/server/gmail";
import { listEvents, type CalEvent } from "~/server/calendar";

export type Slot = { start: string; end: string };

const ACTIVE_STATUSES = [
  "awaiting_approval",
  "awaiting_response",
  "awaiting_confirm",
  "needs_review",
  "no_slots",
] as const;

async function logActivity(
  tenantId: string,
  negotiationId: string,
  eventType: string,
  description: string,
  links: { thread?: string; event?: string } = {},
) {
  await db.insert(agentActivityLog).values({
    id: crypto.randomUUID(),
    tenantId,
    negotiationId,
    eventType,
    description,
    linkThreadId: links.thread ?? null,
    linkEventId: links.event ?? null,
  });
}

/** The tenant's IANA timezone (persisted from the browser), defaulting to UTC. */
async function getTenantTz(tenantId: string): Promise<string> {
  try {
    const [row] = await db
      .select({ tz: userPreferences.timezone })
      .from(userPreferences)
      .where(eq(userPreferences.tenantId, tenantId))
      .limit(1);
    return row?.tz ?? "UTC";
  } catch {
    return "UTC";
  }
}

/** Hour-of-day (0–23) and weekday (0=Sun) of an instant in a given timezone. */
function zonedParts(
  date: Date,
  timeZone: string,
): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const hour =
    parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hour, weekday: map[wd] ?? 0 };
}

/** Cheap classifier: is this email a scheduling request / confirmation / neither. */
async function classifyIntent(
  subject: string,
  body: string,
): Promise<{
  kind: "request" | "confirmation" | "decline" | "none";
  phrase: string;
}> {
  try {
    const { text } = await generateText({
      model: models.triage,
      system:
        "Classify an inbound email for a scheduling assistant. Reply with ONE line: " +
        "`request` (asking to find/meet a time), `confirmation` (agreeing to a proposed time), " +
        "`decline` (rejecting), or `none`. If confirmation, append ` | <the time phrase>`.",
      prompt: `Subject: ${subject}\n\n${body.slice(0, 600)}`,
    });
    const line = text.trim().toLowerCase();
    const [kindRaw, phrase] = line.split("|").map((s) => s.trim());
    const kind = (["request", "confirmation", "decline"] as const).find((k) =>
      kindRaw?.includes(k),
    );
    return { kind: kind ?? "none", phrase: phrase ?? "" };
  } catch {
    return { kind: "none", phrase: "" };
  }
}

function overlaps(s: Slot, ev: CalEvent): boolean {
  if (!ev.start || !ev.end) return false;
  const a1 = new Date(s.start).getTime();
  const a2 = new Date(s.end).getTime();
  const b1 = new Date(ev.start).getTime();
  const b2 = new Date(ev.end).getTime();
  return a1 < b2 && b1 < a2;
}

/**
 * Rule-based free slots: next 5 business days, 9–17h **in the user's timezone**,
 * first 3 open windows. Business hours are evaluated in `tz` (not the server's
 * UTC), so slots land in the user's actual working day.
 */
async function generateSlots(
  tenantId: string,
  durationMin: number,
  tz: string,
): Promise<Slot[]> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);
  let events: CalEvent[] = [];
  try {
    events = await listEvents(tenantId, {
      timeMin: now.toISOString(),
      timeMax: horizon.toISOString(),
    });
  } catch {
    events = [];
  }

  const slots: Slot[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);

  for (let i = 0; i < 7 * 24 && slots.length < 3; i++) {
    const { hour, weekday } = zonedParts(cursor, tz);
    const isBusinessDay = weekday >= 1 && weekday <= 5;
    const isWorkHour = hour >= 9 && hour <= 16;
    if (isBusinessDay && isWorkHour) {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + durationMin * 60_000);
      const slot = { start: start.toISOString(), end: end.toISOString() };
      const clash = events.some((ev) => overlaps(slot, ev));
      if (!clash) slots.push(slot);
    }
    cursor.setHours(cursor.getHours() + 1);
  }
  return slots;
}

function fmtSlot(s: Slot, tz?: string): string {
  const d = new Date(s.start);
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

async function draftProposal(
  subject: string,
  body: string,
  slots: Slot[],
  tz: string,
): Promise<string> {
  const times = slots.map((s, i) => `${i + 1}. ${fmtSlot(s, tz)}`).join("\n");
  try {
    const { text } = await generateText({
      model: models.draft,
      system:
        "Write a short, warm email reply proposing meeting times. Plain text, no subject line, " +
        "no placeholders. Offer the listed times naturally and ask them to pick one.",
      prompt: `They wrote (subject "${subject}"):\n${body.slice(0, 400)}\n\nPropose these times:\n${times}`,
    });
    return text.trim();
  } catch {
    return `Happy to find a time! Any of these work for me:\n${times}\n\nLet me know which suits you.`;
  }
}

/** Match a confirmation phrase to a proposed slot index, or -1. */
async function matchSlot(
  phrase: string,
  slots: Slot[],
  tz: string,
): Promise<number> {
  if (slots.length === 0) return -1;
  const list = slots.map((s, i) => `${i}: ${fmtSlot(s, tz)}`).join("\n");
  try {
    const { text } = await generateText({
      model: models.triage,
      system:
        "Given a person's reply and a numbered list of proposed times, return ONLY the index " +
        "number of the time they chose, or `none` if unclear.",
      prompt: `Reply: "${phrase}"\n\nTimes:\n${list}`,
    });
    const n = parseInt(/\d+/.exec(text.trim())?.[0] ?? "", 10);
    return Number.isInteger(n) && n >= 0 && n < slots.length ? n : -1;
  } catch {
    return -1;
  }
}

/** Latest message text + sender for a thread. */
async function threadContext(tenantId: string, threadId: string) {
  const t = await getThread(tenantId, threadId);
  const latest = t.messages[t.messages.length - 1];
  const body = (latest?.html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { subject: t.subject, body, from: latest?.from ?? "" };
}

/**
 * Process one inbound email through the concierge. Creates/advances a
 * negotiation; never sends or creates anything (that's approval-gated in the
 * router). Returns true if it produced something worth surfacing.
 */
export async function handleInboundEmail(
  tenantId: string,
  msg: { threadId: string; from: string; subject: string },
): Promise<boolean> {
  const ctx = await threadContext(tenantId, msg.threadId);
  const tz = await getTenantTz(tenantId);
  const { kind, phrase } = await classifyIntent(
    msg.subject,
    ctx.body || msg.subject,
  );

  // Existing active negotiation for this thread (dedupe).
  const [existing] = await db
    .select()
    .from(schedulingNegotiations)
    .where(
      and(
        eq(schedulingNegotiations.tenantId, tenantId),
        eq(schedulingNegotiations.threadId, msg.threadId),
        inArray(
          schedulingNegotiations.status,
          ACTIVE_STATUSES as unknown as string[],
        ),
      ),
    )
    .orderBy(desc(schedulingNegotiations.createdAt))
    .limit(1);

  if (kind === "request") {
    if (existing) return false; // already handling this thread
    const dur = /\bhour\b|\bhr\b/i.test(ctx.body) ? 60 : 30;
    const slots = await generateSlots(tenantId, dur, tz);
    const id = crypto.randomUUID();
    if (slots.length === 0) {
      await db.insert(schedulingNegotiations).values({
        id,
        tenantId,
        threadId: msg.threadId,
        counterpartyEmail: msg.from,
        subject: msg.subject,
        status: "awaiting_approval",
        intent: "request",
        proposedSlots: [],
        draftReply:
          "None of my usual times work this week — could you suggest a couple that work for you?",
        proposalGroupId: id,
      });
      await logActivity(
        tenantId,
        id,
        "no_slots",
        `No open slots for ${msg.from}`,
        {
          thread: msg.threadId,
        },
      );
      return true;
    }
    const draft = await draftProposal(msg.subject, ctx.body, slots, tz);
    await db.insert(schedulingNegotiations).values({
      id,
      tenantId,
      threadId: msg.threadId,
      counterpartyEmail: msg.from,
      subject: msg.subject,
      status: "awaiting_approval",
      intent: "request",
      proposedSlots: slots,
      draftReply: draft,
      proposalGroupId: id,
    });
    await logActivity(
      tenantId,
      id,
      "detected",
      `Scheduling request from ${msg.from} — drafted ${slots.length} times`,
      { thread: msg.threadId },
    );
    return true;
  }

  if (kind === "confirmation" && existing?.status === "awaiting_response") {
    const slots = (existing.proposedSlots as Slot[]) ?? [];
    const idx = await matchSlot(phrase || ctx.body, slots, tz);
    if (idx < 0) {
      await db
        .update(schedulingNegotiations)
        .set({ status: "needs_review", updatedAt: new Date() })
        .where(eq(schedulingNegotiations.id, existing.id));
      await logActivity(
        tenantId,
        existing.id,
        "needs_review",
        `${msg.from} replied but I couldn't match a time — take a look`,
        { thread: msg.threadId },
      );
      return true;
    }
    await db
      .update(schedulingNegotiations)
      .set({
        status: "awaiting_confirm",
        chosenSlot: slots[idx],
        updatedAt: new Date(),
      })
      .where(eq(schedulingNegotiations.id, existing.id));
    await logActivity(
      tenantId,
      existing.id,
      "confirmed",
      `${msg.from} chose ${fmtSlot(slots[idx]!, tz)} — confirm to create the event`,
      { thread: msg.threadId },
    );
    return true;
  }

  return false;
}

export { fmtSlot };
