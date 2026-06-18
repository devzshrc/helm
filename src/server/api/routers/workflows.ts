import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  webhookSubscriptions,
  workflowRuns,
  workflows,
} from "~/server/db/schema";
import { listThreads } from "~/server/gmail";
import { buildEmailCtx, runAndRecord } from "~/server/workflows/run";
import {
  NODE_META,
  type NodeType,
  TEMPLATES,
  type WorkflowNode,
  type WorkflowTrigger,
} from "~/lib/workflows/types";
import {
  getWorkflowHealth,
  isNodeType,
  validateWorkflowSpec,
} from "~/lib/workflows/validation";
import { listEvents } from "~/server/calendar";
import { isMissingRelationError } from "~/server/db/errors";

const triggerSchema = z.object({
  type: z.enum(["email", "schedule", "calendar"]),
  config: z.record(z.string(), z.string()),
});
const nodeSchema = z.object({
  id: z.string(),
  type: z.string().refine(isNodeType, "Unknown step type"),
  config: z.record(z.string(), z.string()),
});

async function webhookStatusForTenant(tenantId: string) {
  try {
    const rows = await db
      .select({
        plugin: webhookSubscriptions.plugin,
        status: webhookSubscriptions.status,
      })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.tenantId, tenantId));
    return {
      gmail: rows.find((r) => r.plugin === "gmail")?.status ?? "unknown",
      googlecalendar:
        rows.find((r) => r.plugin === "googlecalendar")?.status ?? "unknown",
    };
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
    return { gmail: "unknown", googlecalendar: "unknown" };
  }
}

function webhookStatusForTrigger(
  trigger: WorkflowTrigger,
  webhooks: { gmail: string; googlecalendar: string },
) {
  if (trigger.type === "email") return webhooks.gmail;
  if (trigger.type === "calendar") return webhooks.googlecalendar;
  return "schedule";
}

function decorateWorkflow<T extends typeof workflows.$inferSelect>(
  wf: T,
  webhooks: { gmail: string; googlecalendar: string },
) {
  const trigger = wf.trigger as WorkflowTrigger;
  const nodes = (wf.nodes as WorkflowNode[]) ?? [];
  const validation = validateWorkflowSpec({ name: wf.name, trigger, nodes });
  const webhookStatus = webhookStatusForTrigger(trigger, webhooks);
  const health = getWorkflowHealth({
    validation,
    triggerType: trigger.type,
    enabled: wf.enabled,
    webhookStatus,
  });
  return { ...wf, validation, webhookStatus, health };
}

export const workflowsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.id;
    const webhooks = await webhookStatusForTenant(tenantId);
    const rows = await ctx.db
      .select()
      .from(workflows)
      .where(eq(workflows.tenantId, tenantId))
      .orderBy(desc(workflows.updatedAt));
    const runs = await ctx.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.tenantId, tenantId))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(100);
    return rows.map((wf) => {
      const recentRuns = runs.filter((run) => run.workflowId === wf.id);
      return {
        ...decorateWorkflow(wf, webhooks),
        lastRun: recentRuns[0] ?? null,
        runCount: recentRuns.length,
      };
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const [wf] = await ctx.db
        .select()
        .from(workflows)
        .where(
          and(eq(workflows.id, input.id), eq(workflows.tenantId, tenantId)),
        )
        .limit(1);
      if (!wf) return null;
      const webhooks = await webhookStatusForTenant(tenantId);
      return decorateWorkflow(wf, webhooks);
    }),

  create: protectedProcedure
    .input(z.object({ templateId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const tpl = input.templateId
        ? TEMPLATES.find((t) => t.id === input.templateId)
        : null;
      const nodes: WorkflowNode[] = tpl
        ? tpl.nodes.map((n, i) => ({ ...n, id: `${id}-${i}` }))
        : [];
      const trigger: WorkflowTrigger = tpl?.trigger ?? {
        type: "email",
        config: {},
      };
      await ctx.db.insert(workflows).values({
        id,
        tenantId: ctx.session.user.id,
        name: tpl?.name ?? "Untitled workflow",
        trigger,
        nodes,
        enabled: false,
      });
      return { id };
    }),

  /**
   * Create a workflow from a full spec the agent assembled in chat. Validates
   * trigger + node types against the catalog and assigns node ids. Returns the
   * new id so the chat can deep-link to the editor.
   */
  createFromSpec: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        enabled: z.boolean().optional(),
        trigger: z.object({
          type: z.enum(["email", "schedule", "calendar"]),
          config: z.record(z.string(), z.string()).optional(),
        }),
        nodes: z.array(
          z.object({
            type: z.string(),
            config: z.record(z.string(), z.string()).optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bad = input.nodes.find((n) => !isNodeType(n.type));
      if (bad) {
        return { ok: false as const, error: `Unknown step type: ${bad.type}` };
      }
      // Drop steps that aren't valid for the chosen trigger.
      const valid = input.nodes.filter((n) =>
        NODE_META[n.type as NodeType].triggers.includes(input.trigger.type),
      );
      const dropped = input.nodes.filter(
        (n) =>
          !NODE_META[n.type as NodeType].triggers.includes(input.trigger.type),
      );
      const id = crypto.randomUUID();
      const nodes: WorkflowNode[] = valid.map((n, i) => ({
        id: `${id}-${i}`,
        type: n.type as NodeType,
        config: n.config ?? {},
      }));
      const trigger: WorkflowTrigger = {
        type: input.trigger.type,
        config: input.trigger.config ?? {},
      };
      const validation = validateWorkflowSpec({
        name: input.name,
        trigger,
        nodes,
      });
      await ctx.db.insert(workflows).values({
        id,
        tenantId: ctx.session.user.id,
        name: input.name,
        trigger,
        nodes,
        enabled: false,
      });
      return {
        ok: true as const,
        id,
        warnings: [
          ...(input.enabled
            ? [
                "AI-created workflows are saved off until you review and enable them.",
              ]
            : []),
          ...validation.warnings.map((issue) => issue.message),
          ...dropped.map(
            (step) =>
              `${step.type} is not valid for this trigger and was not saved.`,
          ),
        ],
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        trigger: triggerSchema.optional(),
        nodes: z.array(nodeSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [existing] = await ctx.db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.id, id),
            eq(workflows.tenantId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!existing) return { ok: false as const, error: "Workflow not found" };
      const next = {
        name: rest.name ?? existing.name,
        trigger: (rest.trigger ?? existing.trigger) as WorkflowTrigger,
        nodes: ((rest.nodes ?? existing.nodes) as WorkflowNode[]) ?? [],
      };
      const validation = validateWorkflowSpec(next);
      const wantsEnabled = rest.enabled ?? existing.enabled;
      if (wantsEnabled && !validation.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.map((issue) => issue.message).join(" "),
        });
      }
      await ctx.db
        .update(workflows)
        .set({ ...rest, updatedAt: new Date() })
        .where(
          and(
            eq(workflows.id, id),
            eq(workflows.tenantId, ctx.session.user.id),
          ),
        );
      return { ok: true as const, validation };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(workflows)
        .where(
          and(
            eq(workflows.id, input.id),
            eq(workflows.tenantId, ctx.session.user.id),
          ),
        );
      return { ok: true };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const [wf] = await ctx.db
        .select()
        .from(workflows)
        .where(
          and(eq(workflows.id, input.id), eq(workflows.tenantId, tenantId)),
        )
        .limit(1);
      if (!wf) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }
      const id = crypto.randomUUID();
      const nodes = ((wf.nodes as WorkflowNode[]) ?? []).map((node, index) => ({
        ...node,
        id: `${id}-${index}`,
      }));
      await ctx.db.insert(workflows).values({
        id,
        tenantId,
        name: `${wf.name} copy`,
        trigger: wf.trigger,
        nodes,
        enabled: false,
      });
      return { id };
    }),

  runs: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.workflowId, input.workflowId),
            eq(workflowRuns.tenantId, ctx.session.user.id),
          ),
        )
        .orderBy(desc(workflowRuns.startedAt))
        .limit(20),
    ),

  // Run now against the latest matching email (or no email, for schedule).
  test: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      try {
        const [wf] = await ctx.db
          .select()
          .from(workflows)
          .where(
            and(eq(workflows.id, input.id), eq(workflows.tenantId, tenantId)),
          )
          .limit(1);
        if (!wf) return { ok: false as const, error: "Workflow not found" };

        const trigger = wf.trigger as WorkflowTrigger;
        const nodes = (wf.nodes as WorkflowNode[]) ?? [];
        const validation = validateWorkflowSpec({
          name: wf.name,
          trigger,
          nodes,
        });
        if (!validation.ok) {
          return {
            ok: false as const,
            error: validation.errors.map((issue) => issue.message).join(" "),
          };
        }

        if (trigger.type === "schedule") {
          return runAndRecord(wf, { source: "manual_test" });
        }

        if (trigger.type === "calendar") {
          const now = new Date();
          const events = await listEvents(tenantId, {
            timeMin: new Date(
              now.getTime() - 30 * 24 * 60 * 60_000,
            ).toISOString(),
            timeMax: new Date(
              now.getTime() + 90 * 24 * 60 * 60_000,
            ).toISOString(),
          });
          const picked = events.find((event) => {
            const title = trigger.config?.titleContains?.trim().toLowerCase();
            const attendee = trigger.config?.attendeeContains
              ?.trim()
              .toLowerCase();
            const location = trigger.config?.locationContains
              ?.trim()
              .toLowerCase();
            if (title && !event.summary.toLowerCase().includes(title))
              return false;
            if (
              attendee &&
              !event.attendees.some((a) =>
                a.email.toLowerCase().includes(attendee),
              )
            )
              return false;
            if (location && !event.location?.toLowerCase().includes(location))
              return false;
            return true;
          });
          const calendar = picked
            ? {
                eventId: picked.id,
                action:
                  trigger.config?.action === "deleted"
                    ? ("deleted" as const)
                    : trigger.config?.action === "updated"
                      ? ("updated" as const)
                      : ("created" as const),
                title: picked.summary,
                start: picked.start,
                end: picked.end,
                location: picked.location,
                attendees: picked.attendees.map((a) => a.email),
              }
            : {
                eventId: "sample-event",
                action: "created" as const,
                title: trigger.config?.titleContains ?? "Sample calendar event",
                start: new Date(now.getTime() + 60 * 60_000).toISOString(),
                end: new Date(now.getTime() + 90 * 60_000).toISOString(),
                location: trigger.config?.locationContains ?? "Zoom",
                attendees: trigger.config?.attendeeContains
                  ? [trigger.config.attendeeContains]
                  : [],
              };
          return runAndRecord(wf, { calendar, source: "manual_test" });
        }

        // email: grab the most recent matching thread
        const q = [
          trigger.config?.fromContains
            ? `from:${trigger.config.fromContains}`
            : "",
          trigger.config?.subjectContains
            ? `subject:${trigger.config.subjectContains}`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        const threads = await listThreads(tenantId, {
          q: q || undefined,
          maxResults: 1,
        });
        if (threads.length === 0)
          return {
            ok: false as const,
            error: "No matching email found to test on",
          };
        const email = await buildEmailCtx(tenantId, threads[0]!.threadId, {
          labelIds: threads[0]!.labelIds,
          hasAttachment: threads[0]!.hasAttachment,
          priority: threads[0]!.priority,
        });
        return runAndRecord(wf, { email, source: "manual_test" });
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "Test run failed",
        };
      }
    }),
});
