import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { agentActivityLog, schedulingNegotiations } from "~/server/db/schema";
import { listThreads, replyToThread } from "~/server/gmail";
import { createEvent } from "~/server/calendar";
import { handleInboundEmail } from "~/server/concierge";

type Slot = { start: string; end: string };

const REALTIME_CHANNEL = "helm_events";
async function notify(tenantId: string) {
  try {
    await db.execute(
      sql`SELECT pg_notify(${REALTIME_CHANNEL}, ${JSON.stringify({ tenantId, plugin: "concierge" })})`,
    );
  } catch {
    /* notify is best-effort */
  }
}

async function log(
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

export const conciergeRouter = createTRPCRouter({
  /** Approval queue — proposals + confirmations awaiting a click. */
  pending: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(schedulingNegotiations)
      .where(
        and(
          eq(schedulingNegotiations.tenantId, ctx.session.user.id),
          inArray(schedulingNegotiations.status, [
            "awaiting_approval",
            "awaiting_confirm",
          ]),
        ),
      )
      .orderBy(desc(schedulingNegotiations.createdAt)),
  ),

  /** Active negotiations that render on the calendar (proposed/confirmed/review). */
  negotiations: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(schedulingNegotiations)
      .where(
        and(
          eq(schedulingNegotiations.tenantId, ctx.session.user.id),
          inArray(schedulingNegotiations.status, [
            "awaiting_response",
            "confirmed",
            "needs_review",
          ]),
        ),
      )
      .orderBy(desc(schedulingNegotiations.updatedAt)),
  ),

  activity: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(agentActivityLog)
      .where(eq(agentActivityLog.tenantId, ctx.session.user.id))
      .orderBy(desc(agentActivityLog.createdAt))
      .limit(30),
  ),

  /**
   * Manually scan recent inbox threads for scheduling requests. The concierge
   * is otherwise only triggered by the Gmail push webhook, which isn't
   * available in local dev / without an active Pub/Sub subscription — so this
   * gives users (and testing) a way to populate it on demand.
   */
  scanInbox: protectedProcedure.mutation(async ({ ctx }) => {
    const tenantId = ctx.session.user.id;
    const threads = await listThreads(tenantId, { maxResults: 12 });
    let found = 0;
    for (const t of threads) {
      try {
        const produced = await handleInboundEmail(tenantId, {
          threadId: t.threadId,
          from: t.from,
          subject: t.subject,
        });
        if (produced) found += 1;
      } catch (err) {
        console.error("[concierge.scanInbox] thread failed:", err);
      }
    }
    return { scanned: threads.length, found };
  }),

  /** Approve a proposal → send the reply, slots become "proposed" on calendar. */
  approveProposal: protectedProcedure
    .input(z.object({ id: z.string(), draftReply: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const [n] = await ctx.db
        .select()
        .from(schedulingNegotiations)
        .where(
          and(
            eq(schedulingNegotiations.id, input.id),
            eq(schedulingNegotiations.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (n?.status !== "awaiting_approval") {
        return { ok: false as const, error: "Not found or already handled" };
      }
      const reply = input.draftReply ?? n.draftReply ?? "";
      try {
        if (reply) await replyToThread(tenantId, n.threadId, reply);
      } catch (e) {
        return { ok: false as const, error: `Send failed: ${String(e)}` };
      }
      const next =
        (n.proposedSlots as Slot[]).length > 0
          ? "awaiting_response"
          : "no_slots";
      await ctx.db
        .update(schedulingNegotiations)
        .set({ status: next, draftReply: reply, updatedAt: new Date() })
        .where(eq(schedulingNegotiations.id, n.id));
      await log(
        tenantId,
        n.id,
        "proposed",
        `Proposed ${(n.proposedSlots as Slot[]).length} times to ${n.counterpartyEmail ?? "them"}`,
        { thread: n.threadId },
      );
      await notify(tenantId);
      return { ok: true as const };
    }),

  rejectProposal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      await ctx.db
        .update(schedulingNegotiations)
        .set({ status: "dismissed", updatedAt: new Date() })
        .where(
          and(
            eq(schedulingNegotiations.id, input.id),
            eq(schedulingNegotiations.tenantId, tenantId),
          ),
        );
      await notify(tenantId);
      return { ok: true as const };
    }),

  /** Confirm the chosen slot → create the event (+invite) and confirmation reply. */
  confirmEvent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const [n] = await ctx.db
        .select()
        .from(schedulingNegotiations)
        .where(
          and(
            eq(schedulingNegotiations.id, input.id),
            eq(schedulingNegotiations.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (n?.status !== "awaiting_confirm" || !n.chosenSlot) {
        return { ok: false as const, error: "Not ready to confirm" };
      }
      const slot = n.chosenSlot as Slot;
      try {
        const ev = await createEvent(tenantId, {
          summary: n.subject ?? "Meeting",
          start: slot.start,
          end: slot.end,
          attendees: n.counterpartyEmail ? [n.counterpartyEmail] : [],
        });
        await replyToThread(
          tenantId,
          n.threadId,
          "Great — I've sent a calendar invite. Talk soon!",
        );
        await ctx.db
          .update(schedulingNegotiations)
          .set({ status: "confirmed", eventId: ev.id, updatedAt: new Date() })
          .where(eq(schedulingNegotiations.id, n.id));
        await log(
          tenantId,
          n.id,
          "event_created",
          `Event created, invite sent`,
          {
            thread: n.threadId,
            event: ev.id,
          },
        );
        await notify(tenantId);
        return { ok: true as const, eventId: ev.id };
      } catch (e) {
        return {
          ok: false as const,
          error: `Could not create event: ${String(e)}`,
        };
      }
    }),
});
