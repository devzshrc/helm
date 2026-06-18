import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { models } from "~/lib/ai/models";

const eventSchema = z.object({
  summary: z.string().describe("Concise event title"),
  start: z.string().describe("ISO 8601 datetime with timezone offset"),
  end: z
    .string()
    .describe("ISO 8601 datetime; default 30min after start if unknown"),
  attendees: z
    .array(z.string())
    .describe("Attendee email addresses (may be empty)"),
  location: z.string().describe("Location or empty string"),
  description: z.string().describe("Short description or empty string"),
});

export type ExtractedEvent = z.infer<typeof eventSchema>;

function ctx(nowISO: string, tz: string) {
  return `Current datetime: ${nowISO} (timezone ${tz}). Resolve all relative times ("next Thursday", "tomorrow 3pm") against this. Always return ISO 8601 with offset.`;
}

/** Extract a calendar event draft from an email thread. */
export async function extractEventFromThread(
  threadText: string,
  nowISO: string,
  tz: string,
): Promise<ExtractedEvent> {
  const { object } = await generateObject({
    model: models.draft,
    schema: eventSchema,
    system:
      "Extract a single calendar event from the email. Infer title, time, and any attendee emails mentioned. " +
      ctx(nowISO, tz),
    prompt: threadText,
  });
  return object;
}

/** Parse a natural-language quick-create string into an event draft. */
export async function parseQuickEvent(
  text: string,
  nowISO: string,
  tz: string,
): Promise<ExtractedEvent> {
  const { object } = await generateObject({
    model: models.draft,
    schema: eventSchema,
    system: "Parse the user's phrase into a calendar event. " + ctx(nowISO, tz),
    prompt: text,
  });
  return object;
}
