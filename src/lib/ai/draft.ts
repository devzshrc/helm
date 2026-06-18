import "server-only";

import { generateText } from "ai";

import { models } from "~/lib/ai/models";

/** Drafts a reply to an email thread. User edits before sending. */
export async function draftReply(
  threadText: string,
  instruction?: string,
): Promise<string> {
  const { text } = await generateText({
    model: models.draft,
    system:
      "You draft concise, professional email replies. Output ONLY the reply body — " +
      "no subject line, no 'Subject:', no surrounding quotes, no signature unless asked. " +
      "Match the sender's tone. Keep it short.",
    prompt:
      (instruction ? `Instruction: ${instruction}\n\n` : "") +
      `Email thread (most recent last):\n\n${threadText}`,
  });
  return text.trim();
}
