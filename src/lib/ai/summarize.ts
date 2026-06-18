import "server-only";

import { generateText } from "ai";

import { models } from "~/lib/ai/models";

/** Short TL;DR of email/thread text. */
export async function summarizeText(
  text: string,
  kind = "email",
): Promise<string> {
  const { text: out } = await generateText({
    model: models.agent,
    system: `Summarize the ${kind} in 1-3 tight sentences. Output only the summary.`,
    prompt: text.slice(0, 8000),
  });
  return out.trim();
}

/** Answers a yes/no question about text. Used by the Filter "Ask AI" mode. */
export async function askYesNo(
  question: string,
  text: string,
): Promise<boolean> {
  const { text: out } = await generateText({
    model: models.triage,
    system: 'Answer the question about the email with only "yes" or "no".',
    prompt: `Question: ${question}\n\nEmail:\n${text.slice(0, 4000)}`,
  });
  return /^\s*yes/i.test(out);
}
