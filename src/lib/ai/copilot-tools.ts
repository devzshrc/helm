import "server-only";

import { defineTool } from "@copilotkit/runtime/v2";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { listThreads, getThread } from "~/server/gmail";
import { listEvents } from "~/server/calendar";
import { semanticSearchMail } from "~/server/triage";
import { draftReply } from "~/lib/ai/draft";
import { db } from "~/server/db";
import {
  corsairAccounts,
  corsairIntegrations,
  workflows,
} from "~/server/db/schema";

/** Decode the handful of HTML entities that survive tag-stripping. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, " ");
}

/**
 * Convert an email HTML body to clean readable text. Critically removes the
 * CONTENTS of <style>/<script>/<head> (tag-stripping alone leaves their CSS/JS
 * text behind) and decodes entities.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim();
}

/**
 * Server-side READ tools for the CopilotKit agent. Each returns *typed data*
 * (not prose) so the frontend renderers in `tool-renderers.tsx` can paint a
 * purpose-built component for every tool call (generative UI).
 *
 * Write tools are NOT here — they run client-side as Human-in-the-Loop
 * approval cards (`useHumanInTheLoop`) and call the existing
 * `executeWriteAction` via the `agent.execute` tRPC mutation.
 *
 * `execute` never throws: a thrown error kills the AG-UI run. On failure we
 * return `{ error }` and let the renderer show an inline error + the LLM retry.
 */
export function readTools(tenantId: string) {
  return [
    /* ── Email: keyword/Gmail search ── */
    defineTool({
      name: "search_email",
      description:
        "Search the user's Gmail and display the matching threads as a list. " +
        "Use Gmail search syntax, e.g. 'is:unread', 'from:bob is:unread'. " +
        "For vague/conceptual queries, prefer semantic_search_email instead.",
      parameters: z.object({
        query: z
          .string()
          .describe("Gmail search syntax, e.g. 'from:bob is:unread'"),
      }),
      execute: async ({ query }) => {
        try {
          const threads = await listThreads(tenantId, {
            q: query,
            maxResults: 10,
          });
          return {
            query,
            threads: threads.map((t) => ({
              threadId: t.threadId,
              from: decodeEntities(t.fromName),
              subject: decodeEntities(t.subject) || "(no subject)",
              snippet: decodeEntities(t.snippet),
              unread: t.hasUnread,
              priority: t.priority,
            })),
          };
        } catch (e) {
          return { query, error: `Could not search mail: ${String(e)}` };
        }
      },
    }),

    /* ── Email: semantic / natural-language search ── */
    defineTool({
      name: "semantic_search_email",
      description:
        "Search the user's email using natural language meaning rather than exact keywords. " +
        "Better than search_email for vague, conceptual, or topic-based queries like " +
        "'invoices I should reply to', 'messages about the product launch', or 'anything urgent from last week'.",
      parameters: z.object({
        query: z
          .string()
          .describe("Natural language description of what to find"),
      }),
      execute: async ({ query }) => {
        try {
          const { enabled, results } = await semanticSearchMail(
            tenantId,
            query,
            8,
          );
          if (!enabled) {
            return {
              query,
              error:
                "Semantic search is not available — falling back to regular search.",
            };
          }
          return {
            query,
            threads: results.map((r) => ({
              threadId: r.threadId,
              from: r.from ?? "",
              subject: r.subject ?? "(no subject)",
              snippet: r.snippet ?? "",
              priority: r.priority,
              score: Math.round((r.score ?? 0) * 100) / 100,
              unread: false,
            })),
          };
        } catch (e) {
          return { query, error: `Semantic search failed: ${String(e)}` };
        }
      },
    }),

    /* ── Email thread reader ── */
    defineTool({
      name: "get_thread",
      description:
        "Read and display the full content of one email thread by id. " +
        "Call after search_email when the user wants to read a specific thread.",
      parameters: z.object({
        threadId: z.string().describe("The thread id from search_email"),
      }),
      execute: async ({ threadId }) => {
        try {
          const t = await getThread(tenantId, threadId);
          return {
            threadId,
            subject: decodeEntities(t.subject) || "(no subject)",
            messages: t.messages.map((m) => ({
              from: decodeEntities(m.fromName),
              text: htmlToText(m.html).slice(0, 4000) || "(no text content)",
            })),
          };
        } catch (e) {
          return { threadId, error: `Could not load thread: ${String(e)}` };
        }
      },
    }),

    /* ── Draft reply generator (shows draft before send) ── */
    defineTool({
      name: "draft_email_only",
      description:
        "Generate a draft reply for an email thread and display it to the user. " +
        "Use this BEFORE send_email to generate the body when the user hasn't dictated exact text. " +
        "After showing the draft, the user or agent can call send_email with the confirmed text.",
      parameters: z.object({
        threadId: z
          .string()
          .describe("Thread id from search_email or get_thread"),
        instructions: z
          .string()
          .describe("What the reply should say or accomplish"),
      }),
      execute: async ({ threadId, instructions }) => {
        try {
          const thread = await getThread(tenantId, threadId);
          const threadText = thread.messages
            .map(
              (m) =>
                `From: ${m.fromName}\n${htmlToText(m.html).slice(0, 2000)}`,
            )
            .join("\n\n---\n\n");
          const draftBody = await draftReply(threadText, instructions);
          const lastMsg = thread.messages[thread.messages.length - 1];
          return {
            threadId,
            toEmail: lastMsg?.fromName ?? "",
            subject: thread.subject ? `Re: ${thread.subject}` : "",
            draftBody,
          };
        } catch (e) {
          return { threadId, error: `Could not generate draft: ${String(e)}` };
        }
      },
    }),

    /* ── Calendar: list events ── */
    defineTool({
      name: "list_events",
      description:
        "List and display the user's calendar events in an ISO datetime range.",
      parameters: z.object({
        timeMin: z.string().describe("ISO 8601 start of range"),
        timeMax: z.string().describe("ISO 8601 end of range"),
      }),
      execute: async ({ timeMin, timeMax }) => {
        try {
          const events = await listEvents(tenantId, { timeMin, timeMax });
          return { timeMin, timeMax, events };
        } catch (e) {
          return {
            timeMin,
            timeMax,
            error: `Could not load events: ${String(e)}`,
          };
        }
      },
    }),

    /* ── Calendar: find free slots ── */
    defineTool({
      name: "find_free_time",
      description:
        "Find open (free) time slots in the user's calendar. " +
        "Returns a list of discrete available slots, each exactly durationMinutes long, " +
        "within business hours (9 AM – 6 PM local time). " +
        "Use this when the user wants to schedule something and needs to know when they're free. " +
        "The card shows clickable slots — DO NOT call show_markdown after this tool.",
      parameters: z.object({
        timeMin: z.string().describe("ISO 8601 start of search window"),
        timeMax: z.string().describe("ISO 8601 end of search window"),
        durationMinutes: z
          .number()
          .describe("Exact slot length in minutes (e.g. 30, 60, 90)"),
      }),
      execute: async ({ timeMin, timeMax, durationMinutes }) => {
        try {
          const events = await listEvents(tenantId, { timeMin, timeMax });
          const busy = events
            .filter((e) => !e.allDay && e.start && e.end)
            .map((e) => ({
              start: new Date(e.start!).getTime(),
              end: new Date(e.end!).getTime(),
            }))
            .sort((a, b) => a.start - b.start);

          const minMs = durationMinutes * 60_000;
          const windowStart = new Date(timeMin).getTime();
          const windowEnd = new Date(timeMax).getTime();

          // Parse UTC offset from timeMin (e.g. "+05:30" → 330 min) so we can
          // approximate business hours in the user's local timezone.
          const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(timeMin);
          const offsetMin = offsetMatch
            ? (offsetMatch[1] === "+" ? 1 : -1) *
              (parseInt(offsetMatch[2]!) * 60 + parseInt(offsetMatch[3]!))
            : 0;
          const BUSI_START = 9 * 60; // 9:00 AM in local minutes-since-midnight
          const BUSI_END = 18 * 60; // 6:00 PM in local minutes-since-midnight

          function localMinutesOfDay(ms: number): number {
            const utcMinutes =
              new Date(ms).getUTCHours() * 60 + new Date(ms).getUTCMinutes();
            return (((utcMinutes + offsetMin) % 1440) + 1440) % 1440;
          }

          // Collect free gaps between busy blocks.
          const gaps: { start: number; end: number }[] = [];
          let cursor = windowStart;
          for (const block of busy) {
            if (block.start > cursor)
              gaps.push({ start: cursor, end: block.start });
            cursor = Math.max(cursor, block.end);
          }
          if (windowEnd > cursor) gaps.push({ start: cursor, end: windowEnd });

          // Break each gap into discrete slots of exactly durationMinutes,
          // keeping only those that fall fully within business hours.
          const freeSlots: {
            start: string;
            end: string;
            durationMinutes: number;
          }[] = [];
          for (const gap of gaps) {
            // Snap start to next durationMinutes boundary within the gap.
            let t = gap.start;
            while (t + minMs <= gap.end && freeSlots.length < 15) {
              const localStart = localMinutesOfDay(t);
              const localEnd = localMinutesOfDay(t + minMs);
              // Accept only slots whose start AND end are within business hours.
              // If end wraps past midnight that slot is definitely outside hours.
              const endWraps = localEnd < localStart;
              if (
                !endWraps &&
                localStart >= BUSI_START &&
                localEnd <= BUSI_END
              ) {
                freeSlots.push({
                  start: new Date(t).toISOString(),
                  end: new Date(t + minMs).toISOString(),
                  durationMinutes,
                });
              }
              t += minMs;
            }
            if (freeSlots.length >= 15) break;
          }

          return {
            timeMin,
            timeMax,
            durationMinutes,
            freeSlots,
            busyCount: busy.length,
          };
        } catch (e) {
          return {
            timeMin,
            timeMax,
            durationMinutes,
            error: `Could not check calendar: ${String(e)}`,
          };
        }
      },
    }),

    /* ── Workflows list ── */
    defineTool({
      name: "list_workflows",
      description:
        "List the user's Helm workflow automations (active and inactive). " +
        "Use this when the user asks what automations they have, or before editing/disabling one.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const rows = await db
            .select({
              id: workflows.id,
              name: workflows.name,
              enabled: workflows.enabled,
              trigger: workflows.trigger,
              lastRunAt: workflows.lastRunAt,
            })
            .from(workflows)
            .where(eq(workflows.tenantId, tenantId))
            .orderBy(desc(workflows.updatedAt))
            .limit(20);
          return {
            workflows: rows.map((r) => ({
              id: r.id,
              name: r.name,
              enabled: r.enabled,
              triggerType:
                (r.trigger as { type?: string } | null)?.type ?? "unknown",
              lastRunAt: r.lastRunAt?.toISOString() ?? null,
            })),
          };
        } catch (e) {
          return {
            workflows: [],
            error: `Could not load workflows: ${String(e)}`,
          };
        }
      },
    }),

    /* ── Connection status ── */
    defineTool({
      name: "get_connection_status",
      description:
        "Check which Google services (Gmail, Google Calendar) are connected to Helm. " +
        "Use when the user asks about their connections or before calling email/calendar tools.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const rows = await db
            .select({ name: corsairIntegrations.name })
            .from(corsairAccounts)
            .innerJoin(
              corsairIntegrations,
              eq(corsairAccounts.integrationId, corsairIntegrations.id),
            )
            .where(eq(corsairAccounts.tenantId, tenantId));
          const connected = new Set(rows.map((r) => r.name));
          return {
            gmail: connected.has("gmail"),
            googleCalendar: connected.has("googlecalendar"),
            connectedServices: [...connected],
          };
        } catch (e) {
          return {
            gmail: false,
            googleCalendar: false,
            error: `Could not check connections: ${String(e)}`,
          };
        }
      },
    }),

    /* ── Display tools ── */
    defineTool({
      name: "show_markdown",
      description:
        "Display formatted information to the user as a rich markdown document. " +
        "Use for summaries, briefings, explanations, or any longer-form answer " +
        "that benefits from headings, lists, or emphasis.",
      parameters: z.object({
        title: z
          .string()
          .describe("Short title for the document, or empty string"),
        markdown: z.string().describe("The body, in GitHub-flavored markdown"),
      }),
      execute: async ({ title, markdown }) => ({ title, markdown }),
    }),

    defineTool({
      name: "create_document",
      description:
        "Produce a long-form deliverable (letter, draft, report, proposal) and display it " +
        "as a titled artifact the user can copy or download. `content` is GitHub-flavored " +
        "markdown. Prefer this over show_markdown for anything document-length.",
      parameters: z.object({
        title: z.string().describe("Document title"),
        content: z
          .string()
          .describe("The full document body, in GitHub-flavored markdown"),
      }),
      execute: async ({ title, content }) => ({ title, content }),
    }),
  ];
}
