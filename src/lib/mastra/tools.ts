import "server-only";

import { createTool } from "@mastra/core/tools";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { draftReply } from "~/lib/ai/draft";
import { listEvents } from "~/server/calendar";
import { db } from "~/server/db";
import {
  corsairAccounts,
  corsairIntegrations,
  workflows,
} from "~/server/db/schema";
import { getThread, listThreads } from "~/server/gmail";
import { semanticSearchMail } from "~/server/triage";
import {
  generativeSurfaceSchema,
  intentRouteSchema,
} from "~/lib/mastra/schemas";
import {
  isReconnectRequiredError,
  reconnectMessage,
} from "~/lib/integration-health";

function tenantFromContext(context: unknown): string {
  const requestContext = (
    context as {
      requestContext?: { get?: (key: string) => unknown };
    }
  )?.requestContext;
  const tenantId = requestContext?.get?.("tenantId");
  if (typeof tenantId !== "string" || !tenantId) {
    throw new Error("Missing tenant context for Mastra tool execution.");
  }
  return tenantId;
}

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

const readOnly = {
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const;

function readableToolError(
  plugin: "gmail" | "googlecalendar",
  fallback: string,
  error: unknown,
) {
  if (isReconnectRequiredError(error)) {
    return {
      error: reconnectMessage(plugin),
      reconnectRequired: true,
      plugin,
    };
  }
  return { error: `${fallback}: ${String(error)}` };
}

export const searchEmailTool = createTool({
  id: "search_email",
  description:
    "Search the user's Gmail and display matching threads. Use Gmail search syntax. For vague/conceptual queries, prefer semantic_search_email.",
  inputSchema: z.object({ query: z.string() }),
  mcp: readOnly,
  execute: async ({ query }, context) => {
    const tenantId = tenantFromContext(context);
    try {
      const threads = await listThreads(tenantId, { q: query, maxResults: 10 });
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
      return {
        query,
        ...readableToolError("gmail", "Could not search mail", e),
      };
    }
  },
});

export const semanticSearchEmailTool = createTool({
  id: "semantic_search_email",
  description:
    "Search email by natural language meaning. Use for vague, conceptual, or topic-based email queries.",
  inputSchema: z.object({ query: z.string() }),
  mcp: readOnly,
  execute: async ({ query }, context) => {
    const tenantId = tenantFromContext(context);
    try {
      const { enabled, results } = await semanticSearchMail(tenantId, query, 8);
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
      return {
        query,
        ...readableToolError("gmail", "Semantic search failed", e),
      };
    }
  },
});

export const getThreadTool = createTool({
  id: "get_thread",
  description:
    "Read and display the full content of one email thread by id. Only use ids returned by prior email tools.",
  inputSchema: z.object({ threadId: z.string() }),
  mcp: readOnly,
  execute: async ({ threadId }, context) => {
    const tenantId = tenantFromContext(context);
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
      return {
        threadId,
        ...readableToolError("gmail", "Could not load thread", e),
      };
    }
  },
});

export const draftEmailOnlyTool = createTool({
  id: "draft_email_only",
  description:
    "Generate and display a draft reply for an email thread before any send_email call.",
  inputSchema: z.object({
    threadId: z.string(),
    instructions: z.string(),
  }),
  mcp: readOnly,
  execute: async ({ threadId, instructions }, context) => {
    const tenantId = tenantFromContext(context);
    try {
      const thread = await getThread(tenantId, threadId);
      const threadText = thread.messages
        .map((m) => `From: ${m.fromName}\n${htmlToText(m.html).slice(0, 2000)}`)
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
      return {
        threadId,
        ...readableToolError("gmail", "Could not generate draft", e),
      };
    }
  },
});

export const listEventsTool = createTool({
  id: "list_events",
  description: "List and display calendar events in an ISO datetime range.",
  inputSchema: z.object({ timeMin: z.string(), timeMax: z.string() }),
  mcp: readOnly,
  execute: async ({ timeMin, timeMax }, context) => {
    const tenantId = tenantFromContext(context);
    try {
      const events = await listEvents(tenantId, { timeMin, timeMax });
      return { timeMin, timeMax, events };
    } catch (e) {
      return {
        timeMin,
        timeMax,
        ...readableToolError("googlecalendar", "Could not load events", e),
      };
    }
  },
});

export const findFreeTimeTool = createTool({
  id: "find_free_time",
  description:
    "Find open calendar slots within business hours. The UI card renders clickable slots.",
  inputSchema: z.object({
    timeMin: z.string(),
    timeMax: z.string(),
    durationMinutes: z.number(),
  }),
  mcp: readOnly,
  execute: async ({ timeMin, timeMax, durationMinutes }, context) => {
    const tenantId = tenantFromContext(context);
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
      const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(timeMin);
      const offsetMin = offsetMatch
        ? (offsetMatch[1] === "+" ? 1 : -1) *
          (parseInt(offsetMatch[2]!) * 60 + parseInt(offsetMatch[3]!))
        : 0;
      const businessStart = 9 * 60;
      const businessEnd = 18 * 60;
      const localMinutesOfDay = (ms: number) => {
        const d = new Date(ms);
        const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
        return (((utcMinutes + offsetMin) % 1440) + 1440) % 1440;
      };

      const gaps: { start: number; end: number }[] = [];
      let cursor = windowStart;
      for (const block of busy) {
        if (block.start > cursor)
          gaps.push({ start: cursor, end: block.start });
        cursor = Math.max(cursor, block.end);
      }
      if (windowEnd > cursor) gaps.push({ start: cursor, end: windowEnd });

      const freeSlots: {
        start: string;
        end: string;
        durationMinutes: number;
      }[] = [];
      for (const gap of gaps) {
        let t = gap.start;
        while (t + minMs <= gap.end && freeSlots.length < 15) {
          const localStart = localMinutesOfDay(t);
          const localEnd = localMinutesOfDay(t + minMs);
          if (
            localEnd >= localStart &&
            localStart >= businessStart &&
            localEnd <= businessEnd
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
        ...readableToolError("googlecalendar", "Could not check calendar", e),
      };
    }
  },
});

export const listWorkflowsTool = createTool({
  id: "list_workflows",
  description: "List the user's Helm workflow automations.",
  inputSchema: z.object({}),
  mcp: readOnly,
  execute: async (_input, context) => {
    const tenantId = tenantFromContext(context);
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
      return { workflows: [], error: `Could not load workflows: ${String(e)}` };
    }
  },
});

export const getConnectionStatusTool = createTool({
  id: "get_connection_status",
  description: "Check which Google services are connected to Helm.",
  inputSchema: z.object({}),
  mcp: readOnly,
  execute: async (_input, context) => {
    const tenantId = tenantFromContext(context);
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
});

export const showMarkdownTool = createTool({
  id: "show_markdown",
  description:
    "Display formatted information as markdown only when no interactive UI tool applies. Never use this to compose an email, schedule a calendar event, create a workflow, or collect missing fields; call the matching composer tool so the UI renders.",
  inputSchema: z.object({ title: z.string(), markdown: z.string() }),
  mcp: readOnly,
  execute: async (input) => input,
});

export const createDocumentTool = createTool({
  id: "create_document",
  description: "Display a long-form markdown artifact.",
  inputSchema: z.object({ title: z.string(), content: z.string() }),
  mcp: readOnly,
  execute: async (input) => input,
});

export const showRouterTraceTool = createTool({
  id: "show_router_trace",
  description:
    "Render a compact interactive UI card showing the router's understood intent, confidence, target agent, missing fields, risk level, and reason code. Call this early for non-trivial requests.",
  inputSchema: intentRouteSchema,
  mcp: readOnly,
  execute: async (input) => input,
});

export const renderSurfaceTool = createTool({
  id: "render_surface",
  description:
    "Render a functional generative UI surface instead of replying in prose. Use for status, summaries, choices, next actions, errors, and final results that are not already covered by a domain-specific tool card. Never use this for composing a new email, scheduling a calendar event, or creating a workflow; call the matching compact composer.",
  inputSchema: generativeSurfaceSchema,
  mcp: readOnly,
  execute: async (input) => input,
});

export const emailTools = {
  search_email: searchEmailTool,
  semantic_search_email: semanticSearchEmailTool,
  get_thread: getThreadTool,
  draft_email_only: draftEmailOnlyTool,
  show_markdown: showMarkdownTool,
  create_document: createDocumentTool,
  show_router_trace: showRouterTraceTool,
  render_surface: renderSurfaceTool,
};

export const calendarTools = {
  list_events: listEventsTool,
  find_free_time: findFreeTimeTool,
  show_markdown: showMarkdownTool,
  create_document: createDocumentTool,
  show_router_trace: showRouterTraceTool,
  render_surface: renderSurfaceTool,
};

export const workflowTools = {
  list_workflows: listWorkflowsTool,
  show_markdown: showMarkdownTool,
  show_router_trace: showRouterTraceTool,
  render_surface: renderSurfaceTool,
};

export const connectionsTools = {
  get_connection_status: getConnectionStatusTool,
  show_markdown: showMarkdownTool,
  show_router_trace: showRouterTraceTool,
  render_surface: renderSurfaceTool,
};

export const allMastraTools = {
  ...emailTools,
  ...calendarTools,
  ...workflowTools,
  ...connectionsTools,
};
