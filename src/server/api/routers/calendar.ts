import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
} from "~/server/calendar";
import { getThread } from "~/server/gmail";
import { extractEventFromThread, parseQuickEvent } from "~/lib/ai/events";
import { env } from "~/env";
import {
  isReconnectRequiredError,
  reconnectMessage,
} from "~/lib/integration-health";

/**
 * A usable fallback draft when AI extraction fails or returns nothing — seeded
 * with whatever title we have and a sensible default time (next full hour, 30
 * min long) so the composer always opens pre-filled instead of blank (which
 * read as "couldn't fetch anything").
 */
function seededDraft(summary: string, nowISO: string) {
  const base = new Date(nowISO);
  const start = isNaN(base.getTime()) ? new Date() : base;
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    summary: summary.trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    attendees: [] as string[],
    location: "",
    description: "",
  };
}

const draftInput = z.object({
  summary: z.string(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean().optional(),
  attendees: z.array(z.string()).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const calendarRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ timeMin: z.string(), timeMax: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await listEvents(ctx.session.user.id, input);
      } catch (error) {
        if (isReconnectRequiredError(error)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: reconnectMessage("googlecalendar"),
            cause: error,
          });
        }
        throw error;
      }
    }),

  create: protectedProcedure
    .input(draftInput)
    .mutation(({ ctx, input }) => createEvent(ctx.session.user.id, input)),

  update: protectedProcedure
    .input(draftInput.extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...draft } = input;
      return updateEvent(ctx.session.user.id, id, draft);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => deleteEvent(ctx.session.user.id, input.id)),

  // Returns a draft for the user to confirm; does NOT create.
  parse: protectedProcedure
    .input(z.object({ text: z.string(), nowISO: z.string(), tz: z.string() }))
    .mutation(async ({ input }) => {
      // Always return a usable draft: AI when it works, otherwise a seeded
      // fallback (the typed text as title + default time) so the composer is
      // never blank. Empty AI fields are backfilled rather than discarded.
      const fallback = seededDraft(input.text, input.nowISO);
      try {
        if (!env.GROQ_API_KEY) return fallback;
        const ev = await parseQuickEvent(input.text, input.nowISO, input.tz);
        return {
          ...ev,
          summary: ev.summary?.trim() || fallback.summary,
          start: ev.start?.trim() || fallback.start,
          end: ev.end?.trim() || fallback.end,
        };
      } catch (err) {
        console.error("[calendar.parse] extract failed:", err);
        return fallback;
      }
    }),

  extractFromEmail: protectedProcedure
    .input(
      z.object({ threadId: z.string(), nowISO: z.string(), tz: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      let subject = "";
      try {
        const thread = await getThread(ctx.session.user.id, input.threadId);
        subject = thread.messages[0]?.subject ?? "";
        const text = thread.messages
          .map(
            (m) =>
              `From: ${m.fromName}\nSubject: ${m.subject}\n${stripHtml(m.html)}`,
          )
          .join("\n\n");
        const fallback = seededDraft(subject, input.nowISO);
        if (!env.GROQ_API_KEY) return fallback;
        const ev = await extractEventFromThread(text, input.nowISO, input.tz);
        // Backfill anything the model left blank so the composer is usable.
        return {
          ...ev,
          summary: ev.summary?.trim() || fallback.summary,
          start: ev.start?.trim() || fallback.start,
          end: ev.end?.trim() || fallback.end,
        };
      } catch (err) {
        console.error("[calendar.extractFromEmail] extract failed:", err);
        return seededDraft(subject, input.nowISO);
      }
    }),
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}
