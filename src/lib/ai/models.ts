import "server-only";

import { createGroq } from "@ai-sdk/groq";

import { env } from "~/env";

/**
 * Provider = Groq only. Feature code references models by ROLE
 * (`models.triage` / `models.agent` / `models.draft`), never the provider.
 */
if (!env.GROQ_API_KEY) {
  // Surfaced lazily so build/CI without a key still passes; throws on first use.
  console.warn("GROQ_API_KEY is not set — AI features will fail until it is.");
}

/**
 * @ai-sdk/groq's own error schema (groqErrorDataSchema) only declares
 * `{ error: { message, type } }` and zod strips unknown keys by default —
 * so Groq's `failed_generation` diagnostic field never survives the SDK's
 * own parsing, in *either* the non-streaming error handler or the
 * streaming chunk schema. Tee the raw response here, before the SDK
 * touches it, so the real payload is visible in server logs.
 */
const groq = createGroq({
  apiKey: env.GROQ_API_KEY ?? "",
  fetch: async (url, init) => {
    const res = await fetch(url, init);
    if (res.body) {
      void res
        .clone()
        .text()
        .then((text) => {
          if (text.includes("failed_generation") || text.includes('"error"')) {
            console.error("[groq:raw-error-response]", text.slice(0, 6000));
          }
        })
        .catch(() => {
          return undefined;
        });
    }
    return res;
  },
});

export const models = {
  /** Cheap/fast: triage, classify, smart-reply chips. */
  triage: groq("openai/gpt-oss-20b"),
  /**
   * Agentic tool-use. gpt-oss-120b emits proper JSON tool calls on Groq —
   * llama-3.3-70b-versatile intermittently produced malformed `<function=…>`
   * pseudo-XML that Groq rejects with `tool_use_failed`, breaking the agent.
   */
  agent: groq("openai/gpt-oss-120b"),
  /** Drafting / structured extraction — same reliable model. */
  draft: groq("openai/gpt-oss-120b"),
};
