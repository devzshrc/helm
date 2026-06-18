import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";

import { env } from "~/env";

/**
 * Embeddings for semantic search using Google Gemini text-embedding-004 (768 dims).
 * Free tier — no cost for hackathon scale. Returns null on missing key or error
 * so semantic search degrades cleanly to keyword search.
 */
export const EMBEDDINGS_ENABLED = !!env.GEMINI_API_KEY;

export async function embedText(text: string): Promise<number[] | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
    const { embedding } = await embed({
      model: google.textEmbeddingModel("text-embedding-004"),
      value: text.slice(0, 8000),
    });
    return embedding;
  } catch (e) {
    console.error("[embed] Gemini embedding failed:", e);
    return null;
  }
}
