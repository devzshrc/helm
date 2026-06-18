import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { models } from "~/lib/ai/models";

export const PRIORITIES = ["Urgent", "Important", "Routine", "Noise"] as const;
export type Priority = (typeof PRIORITIES)[number];

const schema = z.object({ priority: z.enum(PRIORITIES) });

/** Cheap/fast priority classification from minimal signal. */
export async function classifyPriority(input: {
  from: string;
  subject: string;
  snippet: string;
}): Promise<Priority> {
  try {
    const { object } = await generateObject({
      model: models.triage,
      schema,
      system:
        "Classify the email's priority for a busy operator:\n" +
        "- Urgent: needs action today (deadlines, outages, time-sensitive asks).\n" +
        "- Important: matters but not same-day (client threads, decisions).\n" +
        "- Routine: FYI, receipts, notifications.\n" +
        "- Noise: newsletters, marketing, automated bulk.\nReturn only the label.",
      prompt: `From: ${input.from}\nSubject: ${input.subject}\nPreview: ${input.snippet.slice(0, 200)}`,
    });
    return object.priority;
  } catch {
    return "Routine";
  }
}
