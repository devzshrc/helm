import { describe, expect, it } from "vitest";

import {
  normalizeWorkflowAssistantResult,
  workflowAssistantSchema,
} from "~/lib/workflows/assistant";

describe("workflow assistant", () => {
  it("normalizes drafts and keeps generated workflows disabled at the caller", () => {
    const parsed = workflowAssistantSchema.parse({
      draft: {
        name: "Tidy newsletters",
        trigger: { type: "email", config: {} },
        nodes: [
          { type: "label", config: { labelName: "Newsletters" } },
          { type: "archive", config: {} },
        ],
      },
      questions: [],
      missingFields: [],
      confidence: 0.9,
    });

    const result = normalizeWorkflowAssistantResult(parsed);

    expect(result.normalized.trigger.type).toBe("email");
    expect(result.normalized.nodes).toHaveLength(2);
    expect(result.normalized.nodes[0]?.id).toBe("draft-0");
    expect(result.validation.ok).toBe(true);
  });

  it("drops incompatible steps instead of allowing invalid trigger pairings", () => {
    const parsed = workflowAssistantSchema.parse({
      draft: {
        name: "Daily digest",
        trigger: { type: "schedule", config: { frequency: "daily" } },
        nodes: [
          { type: "ai_digest", config: {} },
          { type: "archive", config: {} },
        ],
      },
      questions: [],
      missingFields: [],
      confidence: 0.7,
    });

    const result = normalizeWorkflowAssistantResult(parsed);

    expect(result.normalized.nodes.map((node) => node.type)).toEqual([
      "ai_digest",
    ]);
  });

  it("reports missing required fields for review", () => {
    const parsed = workflowAssistantSchema.parse({
      draft: {
        name: "Daily digest",
        trigger: { type: "schedule", config: {} },
        nodes: [{ type: "send_email", config: { subject: "Digest" } }],
      },
      questions: ["Who should receive the digest?"],
      missingFields: [],
      confidence: 0.5,
    });

    const result = normalizeWorkflowAssistantResult(parsed);

    expect(result.validation.ok).toBe(false);
    expect(result.missingFields).toContain("On a schedule: Frequency");
    expect(result.missingFields).toContain("Send email: To");
    expect(result.missingFields).toContain("Send email: Body");
  });
});
