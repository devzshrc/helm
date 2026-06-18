import { addDays, endOfDay, startOfDay } from "date-fns";
import { desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { listEvents } from "~/server/calendar";
import { listInboxCached, listThreads } from "~/server/gmail";
import { workflowRuns, workflows } from "~/server/db/schema";
import type { WorkflowNode, WorkflowTrigger } from "~/lib/workflows/types";
import { validateWorkflowSpec, getWorkflowHealth } from "~/lib/workflows/validation";

function looksNeedsReply(text: string) {
  return /\b(question|can you|could you|please|need|reply|respond|confirm|thoughts)\b/i.test(
    text,
  );
}

function looksCanArchive(text: string) {
  return /\b(unsubscribe|newsletter|digest|promotion|receipt|invoice|order|notification)\b/i.test(
    text,
  );
}

export const dashboardRouter = createTRPCRouter({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.id;
    const now = new Date();
    const [threads, events, wfRows, recentRuns] = await Promise.all([
      (async () =>
        (await listInboxCached(tenantId, 40)) ??
        (await listThreads(tenantId, { maxResults: 40 })))(),
      listEvents(tenantId, {
        timeMin: startOfDay(now).toISOString(),
        timeMax: addDays(endOfDay(now), 7).toISOString(),
      }),
      ctx.db
        .select()
        .from(workflows)
        .where(eq(workflows.tenantId, tenantId))
        .orderBy(desc(workflows.updatedAt))
        .limit(20),
      ctx.db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.tenantId, tenantId))
        .orderBy(desc(workflowRuns.startedAt))
        .limit(20),
    ]);

    const priorityEmails = threads
      .filter((thread) =>
        ["Urgent", "Important"].includes(String(thread.priority ?? "")),
      )
      .slice(0, 5);
    const repliesOwed = threads
      .filter((thread) =>
        looksNeedsReply(`${thread.fromName} ${thread.subject} ${thread.snippet}`),
      )
      .slice(0, 5);
    const cleanup = threads
      .filter((thread) =>
        looksCanArchive(`${thread.fromName} ${thread.subject} ${thread.snippet}`),
      )
      .slice(0, 6);
    const workflowHealth = wfRows.map((workflow) => {
      const trigger = workflow.trigger as WorkflowTrigger;
      const nodes = (workflow.nodes as WorkflowNode[]) ?? [];
      const validation = validateWorkflowSpec({
        name: workflow.name,
        trigger,
        nodes,
      });
      return {
        id: workflow.id,
        name: workflow.name,
        enabled: workflow.enabled,
        triggerType: trigger.type,
        health: getWorkflowHealth({
          validation,
          triggerType: trigger.type,
          enabled: workflow.enabled,
        }),
        lastRun: recentRuns.find((run) => run.workflowId === workflow.id) ?? null,
      };
    });

    return {
      generatedAt: now.toISOString(),
      counts: {
        unread: threads.filter((thread) => thread.hasUnread).length,
        priority: priorityEmails.length,
        replies: repliesOwed.length,
        meetings: events.length,
        workflowAttention: workflowHealth.filter(
          (workflow) =>
            workflow.health.status !== "valid" ||
            workflow.lastRun?.status === "failed",
        ).length,
        cleanup: cleanup.length,
      },
      priorityEmails: priorityEmails.map((thread) => ({
        id: thread.id,
        threadId: thread.threadId,
        from: thread.fromName || thread.from,
        subject: thread.subject || "(no subject)",
        snippet: thread.snippet,
        priority: thread.priority ?? null,
        receivedAt: thread.receivedAt,
      })),
      repliesOwed: repliesOwed.map((thread) => ({
        id: thread.id,
        threadId: thread.threadId,
        from: thread.fromName || thread.from,
        subject: thread.subject || "(no subject)",
        snippet: thread.snippet,
      })),
      upcomingEvents: events.slice(0, 6).map((event) => ({
        id: event.id,
        summary: event.summary || "(untitled event)",
        start: event.start,
        end: event.end,
        location: event.location ?? "",
        attendees: event.attendees.map((a) => a.email),
      })),
      cleanup: cleanup.map((thread) => ({
        id: thread.id,
        threadId: thread.threadId,
        subject: thread.subject || "(no subject)",
        from: thread.fromName || thread.from,
        reason: looksCanArchive(`${thread.subject} ${thread.snippet}`)
          ? "Likely low-risk cleanup"
          : "Review suggested",
      })),
      workflowHealth,
      suggestedActions: [
        {
          id: "review-priority",
          label: "Review priority inbox",
          href: "/dashboard?mode=priority",
        },
        {
          id: "draft-replies",
          label: "Draft replies owed",
          href: "/dashboard?mode=needs-reply",
        },
        {
          id: "workflow-health",
          label: "Check workflow health",
          href: "/dashboard/workflows?filter=attention",
        },
      ],
    };
  }),
});
