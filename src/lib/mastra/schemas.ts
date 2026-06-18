import { z } from "zod";

export const agentTargetSchema = z.enum([
  "emailAgent",
  "calendarAgent",
  "workflowAgent",
  "connectionsAgent",
  "clarificationAgent",
]);

export const riskLevelSchema = z.enum(["none", "low", "medium", "high"]);

export const intentRouteSchema = z.object({
  intent: z.enum([
    "email_search",
    "email_read",
    "email_draft",
    "email_send",
    "inbox_cleanup",
    "calendar_lookup",
    "calendar_free_time",
    "calendar_schedule",
    "calendar_change",
    "calendar_cancel",
    "workflow_create",
    "workflow_edit",
    "workflow_list",
    "workflow_toggle",
    "connection_status",
    "ambiguous",
    "unsupported",
  ]),
  confidence: z.number().min(0).max(1),
  targetAgent: agentTargetSchema,
  missingFields: z.array(z.string()),
  riskLevel: riskLevelSchema,
  reasonCode: z.string(),
});

export const approvalRequestSchema = z.object({
  actionId: z.string(),
  toolName: z.string(),
  summary: z.string(),
  input: z.unknown(),
  riskLevel: riskLevelSchema,
  idempotencyKey: z.string(),
});

export const clarificationRequestSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(5),
  freeformAllowed: z.boolean(),
  blocksAction: z.boolean(),
});

export const agentEventSchema = z.object({
  type: z.enum([
    "router_decision",
    "delegated",
    "tool_progress",
    "workflow_step",
    "approval_pending",
    "approval_result",
    "final",
    "error",
  ]),
  agentId: z.string(),
  runId: z.string(),
  status: z.enum(["pending", "running", "suspended", "success", "failed"]),
  payload: z.unknown(),
});

export const generativeSurfaceActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
  variant: z.enum(["primary", "secondary", "destructive"]),
});

export const generativeSurfaceSchema = z.object({
  surfaceType: z.enum([
    "router_trace",
    "briefing",
    "choice",
    "status",
    "result",
    "error",
    "approval_context",
    "workflow_preview",
  ]),
  title: z.string(),
  status: z.enum([
    "pending",
    "running",
    "needs_input",
    "ready",
    "complete",
    "error",
  ]),
  summary: z
    .string()
    .describe(
      "ONE short sentence (max ~140 chars). Never a full report. Never raw markdown headers or bullet lists. Put every itemized detail in `data`, not here.",
    ),
  data: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .describe(
      "Itemized detail as label/value rows (e.g. each unread sender → its subject, each event → its time). Use this for lists instead of writing them into summary. [] if none.",
    ),
  actions: z
    .array(generativeSurfaceActionSchema)
    .describe("Action buttons. [] if none."),
  requiresInput: z.boolean(),
  riskLevel: riskLevelSchema,
  provenance: z
    .array(z.string())
    .describe("Source tool/result ids backing this surface. [] if none."),
});

export type IntentRoute = z.infer<typeof intentRouteSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ClarificationRequest = z.infer<typeof clarificationRequestSchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type GenerativeSurface = z.infer<typeof generativeSurfaceSchema>;
