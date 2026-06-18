import {
  NODE_META,
  TRIGGER_META,
  type NodeType,
  type WorkflowNode,
  type WorkflowTrigger,
} from "~/lib/workflows/types";

export type WorkflowValidationIssue = {
  target: "workflow" | "trigger" | "node";
  nodeId?: string;
  fieldKey?: string;
  message: string;
};

export type WorkflowValidationResult = {
  ok: boolean;
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
};

export type WorkflowHealthStatus =
  | "valid"
  | "needs_config"
  | "webhook_unhealthy"
  | "no_steps"
  | "action_requires_approval";

export type WorkflowHealth = {
  status: WorkflowHealthStatus;
  reasons: string[];
};

const NODE_TYPES = Object.keys(NODE_META) as NodeType[];
const EXTERNAL_ACTIONS = new Set<NodeType>([
  "reply",
  "forward",
  "send_email",
  "archive",
  "create_event",
  "move_to_label",
]);

export function isNodeType(type: string): type is NodeType {
  return (NODE_TYPES as string[]).includes(type);
}

function hasValue(value: string | undefined) {
  return !!value?.trim();
}

function validateFields(
  fields: { key: string; label: string; optional?: boolean }[],
  values: Record<string, string>,
  target: "trigger" | "node",
  nodeId?: string,
): WorkflowValidationIssue[] {
  return fields
    .filter((field) => !field.optional && !hasValue(values[field.key]))
    .map((field) => ({
      target,
      nodeId,
      fieldKey: field.key,
      message: `${field.label} is required.`,
    }));
}

export function validateWorkflowSpec(input: {
  name?: string | null;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
}): WorkflowValidationResult {
  const errors: WorkflowValidationIssue[] = [];
  const warnings: WorkflowValidationIssue[] = [];

  if (!hasValue(input.name ?? undefined)) {
    errors.push({ target: "workflow", message: "Workflow name is required." });
  }

  const triggerMeta = TRIGGER_META[input.trigger.type];
  if (!triggerMeta) {
    errors.push({ target: "trigger", message: "Unknown trigger type." });
  } else {
    errors.push(
      ...validateFields(
        triggerMeta.fields,
        input.trigger.config ?? {},
        "trigger",
      ),
    );
  }

  if (input.nodes.length === 0) {
    errors.push({ target: "workflow", message: "Add at least one step." });
  }

  for (const node of input.nodes) {
    const type = node.type as string;
    if (!isNodeType(type)) {
      errors.push({
        target: "node",
        nodeId: node.id,
        message: `Unknown step type: ${type}`,
      });
      continue;
    }
    const meta = NODE_META[type];
    if (!meta.triggers.includes(input.trigger.type)) {
      const triggerLabel =
        TRIGGER_META[input.trigger.type]?.label ?? String(input.trigger.type);
      errors.push({
        target: "node",
        nodeId: node.id,
        message: `${meta.label} cannot run for ${triggerLabel}.`,
      });
    }
    errors.push(
      ...validateFields(meta.fields, node.config ?? {}, "node", node.id),
    );
    if (EXTERNAL_ACTIONS.has(node.type)) {
      warnings.push({
        target: "node",
        nodeId: node.id,
        message: `${meta.label} changes mail, calendar, or sends externally.`,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function getWorkflowHealth(input: {
  validation: WorkflowValidationResult;
  triggerType: WorkflowTrigger["type"];
  enabled: boolean;
  webhookStatus?: string | null;
}): WorkflowHealth {
  const reasons = input.validation.errors.map((issue) => issue.message);
  if (reasons.some((reason) => reason === "Add at least one step.")) {
    return { status: "no_steps", reasons };
  }
  if (input.validation.errors.length > 0) {
    return { status: "needs_config", reasons };
  }
  if (
    input.enabled &&
    input.triggerType !== "schedule" &&
    input.webhookStatus &&
    !["active", "ok", "processed", "healthy"].includes(input.webhookStatus)
  ) {
    return {
      status: "webhook_unhealthy",
      reasons: [`Realtime trigger is ${input.webhookStatus}.`],
    };
  }
  const externalWarning = input.validation.warnings.find((issue) =>
    issue.message.includes("changes mail"),
  );
  if (externalWarning) {
    return {
      status: "action_requires_approval",
      reasons: [
        "Contains actions that change mail, calendar, or send externally.",
      ],
    };
  }
  return { status: "valid", reasons: ["Ready"] };
}
