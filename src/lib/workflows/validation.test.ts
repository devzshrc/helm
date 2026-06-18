import { describe, expect, it } from "vitest";

import {
  getWorkflowHealth,
  isNodeType,
  validateWorkflowSpec,
} from "~/lib/workflows/validation";

const emailTrigger = { type: "email" as const, config: {} };

describe("isNodeType", () => {
  it("recognizes a real node type", () => {
    expect(isNodeType("mark_read")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isNodeType("definitely_not_a_node")).toBe(false);
  });
});

describe("validateWorkflowSpec", () => {
  it("requires a name", () => {
    const r = validateWorkflowSpec({
      name: "",
      trigger: emailTrigger,
      nodes: [{ id: "1", type: "mark_read", config: {} }],
    });
    expect(
      r.errors.some((e) => e.message === "Workflow name is required."),
    ).toBe(true);
  });

  it("requires at least one step", () => {
    const r = validateWorkflowSpec({
      name: "X",
      trigger: emailTrigger,
      nodes: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message === "Add at least one step.")).toBe(
      true,
    );
  });

  it("flags unknown node types", () => {
    const r = validateWorkflowSpec({
      name: "X",
      trigger: emailTrigger,
      nodes: [{ id: "1", type: "bogus" as never, config: {} }],
    });
    expect(r.errors.some((e) => e.message.includes("Unknown step type"))).toBe(
      true,
    );
  });

  it("rejects a node that cannot run for the trigger", () => {
    const r = validateWorkflowSpec({
      name: "X",
      trigger: { type: "calendar", config: {} },
      nodes: [{ id: "1", type: "ai_summarize", config: {} }],
    });
    expect(r.errors.some((e) => e.message.includes("cannot run"))).toBe(true);
  });

  it("does not raise a 'cannot run' error for a compatible node", () => {
    const r = validateWorkflowSpec({
      name: "X",
      trigger: emailTrigger,
      nodes: [{ id: "1", type: "mark_read", config: {} }],
    });
    expect(r.errors.some((e) => e.message.includes("cannot run"))).toBe(false);
  });
});

describe("getWorkflowHealth", () => {
  it("reports no_steps when steps are missing", () => {
    const validation = validateWorkflowSpec({
      name: "X",
      trigger: emailTrigger,
      nodes: [],
    });
    const health = getWorkflowHealth({
      validation,
      triggerType: "email",
      enabled: false,
    });
    expect(health.status).toBe("no_steps");
  });
});
