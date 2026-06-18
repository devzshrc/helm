import { z } from "zod";

import {
  NODE_META,
  TRIGGER_META,
  type NodeType,
  type WorkflowNode,
  type WorkflowTrigger,
} from "~/lib/workflows/types";
import { validateWorkflowSpec } from "~/lib/workflows/validation";

export const workflowAssistantDraftSchema = z.object({
  name: z.string().default("Untitled workflow"),
  trigger: z.object({
    type: z.enum(["email", "schedule", "calendar"]),
    config: z.record(z.string(), z.string()).default({}),
  }),
  nodes: z.array(
    z.object({
      type: z.enum(Object.keys(NODE_META) as [NodeType, ...NodeType[]]),
      config: z.record(z.string(), z.string()).default({}),
    }),
  ),
});

export const workflowAssistantSchema = z.object({
  draft: workflowAssistantDraftSchema,
  questions: z.array(z.string()).max(3).default([]),
  missingFields: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

/**
 * Groq-friendly generation schema. The model-facing schema must avoid
 * `z.record` (open-ended objects → empty-property json_schema that Groq's
 * structured output rejects) and `.default()` (unreliable under Groq tool/json
 * mode). Every field is required; configs are flat key/value pair arrays.
 * `fromGeneration` maps the result back to `workflowAssistantSchema`'s shape.
 */
const kvPair = z.object({ key: z.string(), value: z.string() });

export const workflowGenerationSchema = z.object({
  name: z.string(),
  trigger: z.object({
    type: z.enum(["email", "schedule", "calendar"]),
    config: z.array(kvPair),
  }),
  nodes: z.array(
    z.object({
      type: z.enum(Object.keys(NODE_META) as [NodeType, ...NodeType[]]),
      config: z.array(kvPair),
    }),
  ),
  questions: z.array(z.string()),
  missingFields: z.array(z.string()),
  confidence: z.number(),
});

function kvToRecord(pairs: { key: string; value: string }[]) {
  const out: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) out[key] = value;
  }
  return out;
}

export function fromGeneration(
  gen: z.infer<typeof workflowGenerationSchema>,
): z.infer<typeof workflowAssistantSchema> {
  return {
    draft: {
      name: gen.name.trim() || "Untitled workflow",
      trigger: {
        type: gen.trigger.type,
        config: kvToRecord(gen.trigger.config),
      },
      nodes: gen.nodes.map((node) => ({
        type: node.type,
        config: kvToRecord(node.config),
      })),
    },
    questions: gen.questions.slice(0, 3),
    missingFields: gen.missingFields,
    confidence: Number.isFinite(gen.confidence)
      ? Math.min(1, Math.max(0, gen.confidence))
      : 0.5,
  };
}

export type WorkflowAssistantDraft = z.infer<
  typeof workflowAssistantDraftSchema
>;
export type WorkflowAssistantResult = z.infer<
  typeof workflowAssistantSchema
> & {
  normalized: {
    trigger: WorkflowTrigger;
    nodes: WorkflowNode[];
  };
  validation: ReturnType<typeof validateWorkflowSpec>;
};

const UNSAFE_FIELDS: Record<NodeType, string[]> = {
  filter: [],
  ai_summarize: [],
  ai_draft: [],
  ai_classify: [],
  ai_digest: [],
  label: ["labelName"],
  archive: [],
  mark_read: [],
  star: [],
  reply: ["text"],
  forward: ["to"],
  send_email: ["to", "subject", "body"],
  move_to_label: ["labelName"],
  add_note: [],
  create_event: ["summary"],
};

function isFilled(value: string | undefined) {
  return !!value?.trim();
}

function requiredLabelsForDraft(draft: WorkflowAssistantDraft) {
  const labels: string[] = [];
  const triggerMeta = TRIGGER_META[draft.trigger.type];
  for (const field of triggerMeta.fields) {
    if (!field.optional && !isFilled(draft.trigger.config[field.key])) {
      labels.push(`${triggerMeta.label}: ${field.label}`);
    }
  }
  for (const node of draft.nodes) {
    const meta = NODE_META[node.type];
    for (const field of meta.fields) {
      if (!field.optional && !isFilled(node.config[field.key])) {
        labels.push(`${meta.label}: ${field.label}`);
      }
    }
  }
  return labels;
}

export function normalizeWorkflowAssistantResult(
  input: z.infer<typeof workflowAssistantSchema>,
): WorkflowAssistantResult {
  const trigger: WorkflowTrigger = {
    type: input.draft.trigger.type,
    config: input.draft.trigger.config ?? {},
  };
  const nodes: WorkflowNode[] = input.draft.nodes
    .filter((node) => NODE_META[node.type].triggers.includes(trigger.type))
    .map((node, index) => ({
      id: `draft-${index}`,
      type: node.type,
      config: node.config ?? {},
    }));
  const validation = validateWorkflowSpec({
    name: input.draft.name,
    trigger,
    nodes,
  });
  const missingFields = Array.from(
    new Set([...input.missingFields, ...requiredLabelsForDraft(input.draft)]),
  );

  return {
    ...input,
    missingFields,
    normalized: { trigger, nodes },
    validation,
  };
}

export function workflowAssistantCatalogPrompt() {
  const triggers = Object.entries(TRIGGER_META)
    .map(([type, meta]) => {
      const fields = meta.fields
        .map((field) => `${field.key}${field.optional ? "?" : ""}`)
        .join(", ");
      return `${type}: ${meta.label}${fields ? ` fields(${fields})` : ""}`;
    })
    .join("\n");
  const nodes = Object.entries(NODE_META)
    .map(([type, meta]) => {
      const fields = meta.fields
        .map((field) => `${field.key}${field.optional ? "?" : ""}`)
        .join(", ");
      const unsafe = UNSAFE_FIELDS[type as NodeType].join(", ");
      return `${type}: ${meta.label}; triggers(${meta.triggers.join(", ")}); fields(${fields || "none"}); do_not_invent(${unsafe || "none"})`;
    })
    .join("\n");
  return `Triggers:\n${triggers}\n\nSteps:\n${nodes}`;
}
