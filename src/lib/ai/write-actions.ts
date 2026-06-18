import { z } from "zod";

/**
 * Pure, client-safe definitions for the agent's WRITE actions.
 * Shared by the frontend HITL approval cards and the server executor.
 *
 * NO server-only imports here — this module is bundled into the client.
 *
 * Schemas use REQUIRED fields with empty-string/array sentinels (not
 * `.optional()`) so Groq's strict tool-calling works identically to Anthropic.
 * `clean()` normalizes sentinels back to undefined before execution.
 */

export const WRITE_TOOLS = [
  "send_email",
  "create_event",
  "update_event",
  "delete_event",
  "archive_thread",
  "mark_thread_read",
  "star_thread",
  "label_thread",
] as const;
export type WriteTool = (typeof WRITE_TOOLS)[number];

const eventFields = {
  summary: z
    .string()
    .describe(
      "Event title. Use empty string when missing so the interactive event composer can collect it; do not ask in prose.",
    ),
  start: z
    .string()
    .describe(
      "ISO 8601 start datetime with offset. Use empty string when missing so the event composer can collect it.",
    ),
  end: z
    .string()
    .describe(
      "ISO 8601 end datetime with offset. Use empty string when missing so the event composer can collect it.",
    ),
  attendees: z.array(z.string()).describe("Attendee emails; [] if none"),
  location: z.string().describe("Location, or empty string"),
  description: z.string().describe("Description, or empty string"),
};

/** Subject field used in quick-action tools so the approval card can label itself. */
const threadFields = {
  threadId: z.string().describe("Thread id from search_email"),
  subject: z
    .string()
    .describe("Email subject (for display in the approval card)"),
};

export const writeSchemas = {
  send_email: z.object({
    to: z
      .string()
      .describe(
        "Recipient email. Use empty string when missing so the compact composer can collect it; do not ask in prose.",
      ),
    subject: z
      .string()
      .describe(
        "Subject line. Use empty string when missing so the compact composer can collect it; do not render markdown.",
      ),
    body: z
      .string()
      .describe(
        "Email body (plain text). Use empty string when missing so the compact composer can collect it.",
      ),
  }),
  create_event: z.object(eventFields),
  update_event: z.object({ id: z.string(), ...eventFields }),
  delete_event: z.object({ id: z.string().describe("Calendar event id") }),
  archive_thread: z.object(threadFields),
  mark_thread_read: z.object(threadFields),
  star_thread: z.object(threadFields),
  label_thread: z.object({
    ...threadFields,
    labelName: z
      .string()
      .describe("Label to apply (e.g. 'Follow-up', 'Urgent')"),
  }),
};

/** Human-readable summary shown on the approval card. */
export function describeAction(tool: WriteTool, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string => (typeof v === "string" ? v : "");
  switch (tool) {
    case "send_email":
      return `Email ${s(i.to)} — "${s(i.subject)}"`;
    case "create_event": {
      const attendees = Array.isArray(i.attendees)
        ? (i.attendees as string[])
        : [];
      return `Create event "${s(i.summary)}" (${s(i.start)})${
        attendees.length ? ` · invites ${attendees.join(", ")}` : ""
      }`;
    }
    case "update_event":
      return `Update event "${s(i.summary)}"`;
    case "delete_event":
      return `Cancel event ${s(i.id)}`;
    case "archive_thread":
      return `Archive "${s(i.subject)}"`;
    case "mark_thread_read":
      return `Mark as read — "${s(i.subject)}"`;
    case "star_thread":
      return `Star "${s(i.subject)}"`;
    case "label_thread":
      return `Label "${s(i.subject)}" → ${s(i.labelName)}`;
  }
}

/** Strip empty-string sentinels back to undefined before sending to the API. */
export function clean<T extends Record<string, unknown>>(o: T): T {
  const out = { ...o };
  for (const k of Object.keys(out)) {
    if (out[k] === "") delete out[k];
  }
  return out;
}
