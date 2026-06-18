import "server-only";

import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

import { env } from "~/env";
import { createHelmAgents } from "~/lib/mastra/agents";
import { helmStoredWorkflow } from "~/lib/mastra/workflows";

declare global {
  var __helmMastraStore: PostgresStore | undefined;
}

function getMastraStore() {
  globalThis.__helmMastraStore ??= new PostgresStore({
    id: "helm-mastra-postgres",
    connectionString: env.DATABASE_URL,
  });
  return globalThis.__helmMastraStore;
}

/**
 * Build a fresh Mastra instance backed by a shared `PostgresStore`.
 *
 * Mastra/CopilotKit can keep storage work alive after the HTTP stream has
 * drained, so treating the store pool as request-scoped leads to "Cannot use a
 * pool after calling end on the pool" during follow-up writes. We keep the
 * PostgresStore alive for the lifetime of the server process and only rebuild
 * the agent graph per request.
 */
export function createMastra() {
  const mastra = new Mastra({
    agents: createHelmAgents(),
    workflows: { helmStoredWorkflow },
    storage: getMastraStore(),
  });
  return { mastra };
}

/**
 * Run `fn` against a request-scoped Mastra instance backed by the shared store.
 */
export async function withMastra<T>(
  fn: (mastra: Mastra) => Promise<T>,
): Promise<T> {
  const { mastra } = createMastra();
  return await fn(mastra);
}
