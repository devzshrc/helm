import type { NodeType, WorkflowTrigger } from "~/lib/workflows/types";

export type AssistantNode = { type: NodeType; config: Record<string, string> };
export type AssistantDraft = {
  name: string;
  enabled?: boolean;
  trigger: WorkflowTrigger;
  nodes: AssistantNode[];
};
export type AssistantResponse = {
  status: "collecting" | "ready";
  explanation?: string;
  questions?: string[];
  missingFields?: string[];
  confidence?: number;
  patch?: { fields?: Partial<AssistantDraft> };
};

/**
 * Calls the workflow compose-assist endpoint and returns a structured draft.
 * Hardened against empty / non-JSON bodies (a thrown generateObject would
 * otherwise reach the client as a cryptic "Unexpected end of JSON input").
 * Shared by the workflows list and the in-builder AI helper.
 */
export async function requestWorkflowDraft(args: {
  prompt: string;
  fields?: Partial<AssistantDraft>;
}): Promise<AssistantResponse> {
  const res = await fetch("/api/agent/compose-assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "workflow",
      prompt: args.prompt,
      fields: args.fields ?? {},
    }),
  });

  const raw = await res.text();
  let json: AssistantResponse | { error?: string };
  try {
    json = (raw ? JSON.parse(raw) : {}) as
      | AssistantResponse
      | { error?: string };
  } catch {
    throw new Error(
      res.ok
        ? "The assistant returned an unexpected response. Try again."
        : `Request failed (${res.status}).`,
    );
  }
  if (!res.ok || "error" in json) {
    throw new Error(
      "error" in json && json.error ? json.error : "Couldn't create draft.",
    );
  }
  if (!("status" in json)) {
    throw new Error("Couldn't create draft.");
  }
  return json;
}
