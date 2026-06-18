import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { listEvents } from "~/server/calendar";
import { listInboxCached, listThreads } from "~/server/gmail";
import { semanticSearchMail } from "~/server/triage";

function calendarWindow(query: string) {
  const q = query.toLowerCase();
  const now = new Date();
  if (q.includes("tomorrow")) {
    const day = addDays(now, 1);
    return { start: startOfDay(day), end: endOfDay(day) };
  }
  if (q.includes("next week")) {
    return { start: startOfDay(now), end: addDays(endOfDay(now), 14) };
  }
  if (q.includes("this week")) {
    return { start: startOfDay(now), end: addDays(endOfDay(now), 7) };
  }
  if (q.includes("last month")) {
    return { start: subDays(startOfDay(now), 45), end: endOfDay(now) };
  }
  return { start: subDays(startOfDay(now), 7), end: addDays(endOfDay(now), 30) };
}

function wantsCalendar(query: string) {
  return /\b(meeting|meetings|calendar|event|events|call|calls|schedule|investor|investors)\b/i.test(
    query,
  );
}

function wantsMail(query: string) {
  return !wantsCalendar(query) || /\b(email|emails|mail|thread|threads|reply|inbox|from|pricing|follow up|follow-up)\b/i.test(query);
}

function simpleGmailQuery(query: string) {
  const q = query.trim();
  const from = /\bfrom\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z][A-Za-z0-9._-]*)/i.exec(q)?.[1];
  const parts: string[] = [];
  if (from) parts.push(`from:${from}`);
  if (/last month/i.test(q)) parts.push("newer_than:45d");
  if (/last week/i.test(q)) parts.push("newer_than:14d");
  if (/yesterday/i.test(q)) parts.push("newer_than:2d");
  if (/today/i.test(q)) parts.push("newer_than:1d");
  if (/unread/i.test(q)) parts.push("is:unread");
  if (/attachment/i.test(q)) parts.push("has:attachment");
  return parts.length ? parts.join(" ") : q;
}

export const searchRouter = createTRPCRouter({
  unified: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(400),
        limit: z.number().int().min(3).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const query = input.query.trim();
      const limit = input.limit ?? 8;
      const partialErrors: string[] = [];
      const groups: Array<{
        type: "mail_threads" | "calendar_events" | "actions";
        items: unknown[];
      }> = [];

      if (wantsMail(query)) {
        try {
          let mail = await listThreads(tenantId, {
            q: simpleGmailQuery(query),
            maxResults: limit,
          });
          if (mail.length === 0) {
            const semantic = await semanticSearchMail(tenantId, query, limit);
            const cached =
              (await listInboxCached(tenantId, Math.max(limit * 3, 30))) ?? [];
            const byThread = new Map(cached.map((thread) => [thread.threadId, thread]));
            mail = semantic.results.map((result) => ({
              ...(byThread.get(result.threadId) ?? {}),
              id: result.gmailId,
              threadId: result.threadId,
              from: result.from ?? byThread.get(result.threadId)?.from ?? "",
              fromName:
                byThread.get(result.threadId)?.fromName ??
                result.from ??
                "Unknown sender",
              to: "",
              subject:
                result.subject ??
                byThread.get(result.threadId)?.subject ??
                "(no subject)",
              snippet: result.snippet ?? byThread.get(result.threadId)?.snippet ?? "",
              receivedAt:
                result.receivedAt?.getTime() ??
                byThread.get(result.threadId)?.receivedAt ??
                null,
              labelIds: byThread.get(result.threadId)?.labelIds ?? [],
              unread: byThread.get(result.threadId)?.unread ?? false,
              messageCount: byThread.get(result.threadId)?.messageCount ?? 1,
              hasUnread: byThread.get(result.threadId)?.hasUnread ?? false,
              hasAttachment: byThread.get(result.threadId)?.hasAttachment ?? false,
              priority: result.priority,
            }));
          }
          groups.push({
            type: "mail_threads",
            items: mail.slice(0, limit).map((thread) => ({
              id: thread.id,
              threadId: thread.threadId,
              title: thread.subject || "(no subject)",
              subtitle: thread.fromName || thread.from,
              snippet: thread.snippet,
              receivedAt: thread.receivedAt,
              priority: thread.priority ?? null,
              unread: thread.hasUnread,
              href: `/dashboard?thread=${encodeURIComponent(thread.threadId)}`,
            })),
          });
        } catch (err) {
          partialErrors.push(
            err instanceof Error ? err.message : "Mail search failed.",
          );
        }
      }

      if (wantsCalendar(query)) {
        try {
          const range = calendarWindow(query);
          const events = await listEvents(tenantId, {
            timeMin: range.start.toISOString(),
            timeMax: range.end.toISOString(),
          });
          const needle = query.toLowerCase();
          const filtered = events.filter((event) => {
            const text = `${event.summary} ${event.location ?? ""} ${event.attendees
              .map((a) => a.email)
              .join(" ")}`.toLowerCase();
            const words = needle
              .split(/\W+/)
              .filter((word) => word.length > 3 && !["meeting", "meetings", "calendar", "events", "next", "this", "week"].includes(word));
            return words.length === 0 || words.some((word) => text.includes(word));
          });
          groups.push({
            type: "calendar_events",
            items: filtered.slice(0, limit).map((event) => ({
              id: event.id,
              title: event.summary || "(untitled event)",
              start: event.start,
              end: event.end,
              location: event.location ?? "",
              attendees: event.attendees.map((a) => a.email),
              href: "/dashboard/calendar",
            })),
          });
        } catch (err) {
          partialErrors.push(
            err instanceof Error ? err.message : "Calendar search failed.",
          );
        }
      }

      groups.push({
        type: "actions",
        items: [
          { id: "ask-agent", label: "Ask Helm", href: "/dashboard/agent", prompt: query },
          {
            id: "new-workflow",
            label: "Create workflow from this",
            href: `/dashboard/workflows?prompt=${encodeURIComponent(query)}`,
            prompt: query,
          },
        ],
      });

      return {
        query,
        groups,
        partialErrors,
        provenance: ["Gmail search", "Semantic mail search", "Google Calendar"],
      };
    }),
});
