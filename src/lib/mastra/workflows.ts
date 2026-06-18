import "server-only";

import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { runWorkflow, type RunResult } from "~/server/workflows/engine";
import type { WorkflowNode } from "~/lib/workflows/types";

const workflowTriggerSchema = z.object({
  type: z.enum(["email", "schedule", "calendar"]),
  config: z.record(z.string(), z.string()),
});

const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.string()),
});

const emailCtxSchema = z
  .object({
    threadId: z.string(),
    from: z.string(),
    subject: z.string(),
    body: z.string(),
    labelIds: z.array(z.string()).optional(),
    hasAttachment: z.boolean().optional(),
    priority: z.string().nullable().optional(),
  })
  .optional();

const calendarCtxSchema = z
  .object({
    eventId: z.string(),
    action: z.enum(["created", "updated", "deleted"]),
    title: z.string(),
    start: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    attendees: z.array(z.string()).optional(),
  })
  .optional();

export const helmWorkflowInputSchema = z.object({
  tenantId: z.string(),
  trigger: workflowTriggerSchema,
  nodes: z.array(workflowNodeSchema),
  email: emailCtxSchema,
  calendar: calendarCtxSchema,
});

const helmWorkflowOutputSchema = z.object({
  status: z.enum(["success", "stopped", "failed"]),
  steps: z.array(
    z.object({
      type: z.string(),
      status: z.enum(["ok", "stopped", "failed", "skipped"]),
      detail: z.string().optional(),
    }),
  ),
  error: z.string().optional(),
});

export const executeStoredWorkflowStep = createStep({
  id: "executeStoredWorkflow",
  inputSchema: helmWorkflowInputSchema,
  outputSchema: helmWorkflowOutputSchema,
  execute: async ({ inputData, writer }) => {
    await writer?.write({
      type: "workflow_step",
      status: "running",
      step: "executeStoredWorkflow",
    });

    const result = await runWorkflow(
      inputData.trigger,
      inputData.nodes as WorkflowNode[],
      {
        tenantId: inputData.tenantId,
        trigger: inputData.trigger,
        email: inputData.email,
        calendar: inputData.calendar,
        vars: {},
      },
    );

    await writer?.write({
      type: "workflow_step",
      status: result.status,
      step: "executeStoredWorkflow",
      steps: result.steps,
      error: result.error,
    });

    return result;
  },
});

export const helmStoredWorkflow = createWorkflow({
  id: "helmStoredWorkflow",
  description:
    "Executes a tenant-scoped stored Helm automation through Mastra.",
  inputSchema: helmWorkflowInputSchema,
  outputSchema: helmWorkflowOutputSchema,
})
  .then(executeStoredWorkflowStep)
  .commit();

export async function runHelmWorkflowViaMastra(
  input: z.infer<typeof helmWorkflowInputSchema>,
): Promise<RunResult> {
  const run = await helmStoredWorkflow.createRun({
    resourceId: input.tenantId,
  });
  const result = await run.start({ inputData: input });
  if (result.status === "success" && result.result) {
    return result.result as RunResult;
  }
  return {
    status: "failed" as const,
    steps: [],
    error:
      result.status === "failed"
        ? String(result.error ?? "Mastra workflow failed")
        : `Mastra workflow ended with status ${result.status}`,
  };
}
