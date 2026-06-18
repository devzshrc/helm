import { generateObject } from "ai";
import { z } from "zod";

import { models } from "~/lib/ai/models";
import { auth } from "~/server/better-auth";
import { rateLimit, tooMany } from "~/server/ratelimit";
import {
  fromGeneration,
  normalizeWorkflowAssistantResult,
  workflowAssistantCatalogPrompt,
  workflowGenerationSchema,
} from "~/lib/workflows/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const baseSchema = z.object({
  surfaceId: z.string().optional().default(""),
  prompt: z.string().trim().max(1200).optional().default(""),
  tone: z
    .enum(["concise", "friendly", "professional", "warm"])
    .optional()
    .default("professional"),
});

const requestSchema = z.discriminatedUnion("kind", [
  baseSchema.extend({
    kind: z.literal("email"),
    fields: z
      .object({
        to: z.string().optional().default(""),
        subject: z.string().optional().default(""),
        body: z.string().optional().default(""),
      })
      .optional(),
    to: z.string().trim().max(320).optional().default(""),
    subject: z.string().trim().max(300).optional().default(""),
    body: z.string().trim().max(5000).optional().default(""),
  }),
  baseSchema.extend({
    kind: z.literal("event"),
    fields: z
      .object({
        summary: z.string().optional().default(""),
        start: z.string().optional().default(""),
        end: z.string().optional().default(""),
        location: z.string().optional().default(""),
        attendees: z.array(z.string()).optional().default([]),
        description: z.string().optional().default(""),
      })
      .optional(),
    summary: z.string().trim().max(300).optional().default(""),
    start: z.string().trim().max(120).optional().default(""),
    end: z.string().trim().max(120).optional().default(""),
    location: z.string().trim().max(500).optional().default(""),
    attendees: z.string().trim().max(1500).optional().default(""),
    description: z.string().trim().max(3000).optional().default(""),
    timezone: z.string().trim().max(120).optional().default(""),
  }),
  baseSchema.extend({
    kind: z.literal("workflow"),
    fields: z
      .object({
        name: z.string().optional().default(""),
        workflowId: z.string().optional().default(""),
        trigger: z
          .object({
            type: z.string(),
            config: z.record(z.string(), z.string()),
          })
          .optional(),
        nodes: z
          .array(
            z.object({
              type: z.string(),
              config: z.record(z.string(), z.string()),
            }),
          )
          .optional(),
        enabled: z.boolean().optional().default(false),
      })
      .optional(),
  }),
]);

const emailDraftSchema = z.object({
  subject: z.string().describe("A concise email subject line."),
  body: z
    .string()
    .describe("The email body only. No markdown, no code fences."),
});

const eventDraftSchema = z.object({
  summary: z
    .string()
    .describe("Calendar event title, or empty string if not enough context."),
  start: z
    .string()
    .describe("ISO 8601 start datetime with timezone offset, or empty string."),
  end: z
    .string()
    .describe("ISO 8601 end datetime with timezone offset, or empty string."),
  location: z.string().describe("Location or empty string."),
  attendees: z.array(z.string()).describe("Attendee email addresses."),
  description: z
    .string()
    .describe("Short calendar description or empty string."),
});

function patchResponse(args: {
  surfaceId: string;
  fields: Record<string, unknown>;
  status?: "collecting" | "ready";
  explanation?: string;
  questions?: string[];
  missingFields?: string[];
  confidence?: number;
}) {
  return Response.json({
    surfaceId: args.surfaceId,
    patch: { fields: args.fields },
    status: args.status ?? "ready",
    explanation: args.explanation,
    questions: args.questions ?? [],
    missingFields: args.missingFields ?? [],
    confidence: args.confidence,
  });
}

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // LLM-backed endpoint — throttle per user to bound spend.
  const rl = await rateLimit(`compose:${session.user.id}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfterMs);

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid compose assist request." },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    return await compose(input);
  } catch (err) {
    // generateObject can throw (Groq structured-output rejection, timeout, rate
    // limit). Never let it bubble up as an empty 500 body — that reaches the
    // client as a cryptic "Unexpected end of JSON input". Degrade to a readable
    // "collecting" response so the composer stays usable.
    console.error("[compose-assist] generate failed:", err);
    return patchResponse({
      surfaceId: input.surfaceId,
      fields: input.fields ?? {},
      status: "collecting",
      explanation:
        "The assistant couldn't draft this automatically. Add a little more detail (trigger, then the steps) and try again.",
      questions: ["What should trigger this, and what should happen?"],
    });
  }
}

async function compose(
  input: z.infer<typeof requestSchema>,
): Promise<Response> {
  if (input.kind === "event") {
    const fields = input.fields ?? {
      summary: input.summary,
      start: input.start,
      end: input.end,
      location: input.location,
      attendees: input.attendees,
      description: input.description,
    };
    const { object } = await generateObject({
      model: models.draft,
      schema: eventDraftSchema,
      system:
        "You help fill a calendar event composer. Return only structured JSON matching the schema. " +
        "Do not claim the event was created. Preserve unknown required fields as empty strings.",
      prompt: [
        `Current date: ${new Date().toISOString()}`,
        input.timezone
          ? `User timezone: ${input.timezone}`
          : "User timezone: unknown",
        `Existing title: ${fields.summary || "empty"}`,
        `Existing start: ${fields.start || "empty"}`,
        `Existing end: ${fields.end || "empty"}`,
        `Existing attendees: ${Array.isArray(fields.attendees) ? fields.attendees.join(", ") : "empty"}`,
        `Existing location: ${fields.location || "empty"}`,
        `Existing description: ${fields.description || "empty"}`,
        input.prompt
          ? `User instruction: ${input.prompt}`
          : "User instruction: infer clean event details from available context.",
        "",
        "If a relative date is supplied and timezone is available, resolve it. If time is missing, leave start/end empty.",
      ].join("\n"),
    });

    return patchResponse({
      surfaceId: input.surfaceId,
      fields: object,
      status:
        object.summary && object.start && object.end ? "ready" : "collecting",
      explanation:
        object.start && object.end
          ? "Filled event details."
          : "I filled what I could. Pick a time to finish this.",
    });
  }

  if (input.kind === "workflow") {
    const fields = input.fields ?? {};
    const { object } = await generateObject({
      model: models.draft,
      schema: workflowGenerationSchema,
      system:
        "You help users design Helm workflow automations. Return only structured JSON matching the schema. " +
        "Use only the catalog trigger and step types. Each config is an array of {key, value} pairs using the documented field keys; use an empty array when there are no known values. " +
        "Ask short clarifying questions (max 3) when required details are missing. " +
        "Never claim the workflow was created or enabled. Do not invent recipients, labels, reply text, event titles, or email body content for unsafe write actions — leave those values empty and ask instead.",
      prompt: [
        workflowAssistantCatalogPrompt(),
        `Existing workflow: ${JSON.stringify(fields)}`,
        input.prompt
          ? `User instruction: ${input.prompt}`
          : "User instruction: infer a useful workflow from available context.",
        "Build the safest useful draft. Include missingFields for every field the user must review. If a required unsafe detail is missing, leave that config value empty and ask a question.",
        "Prefer disabled reviewable drafts. The user will manually enable after testing.",
      ].join("\n"),
    });
    const result = normalizeWorkflowAssistantResult(fromGeneration(object));
    const status =
      result.questions.length > 0 ||
      result.missingFields.length > 0 ||
      !result.validation.ok
        ? "collecting"
        : "ready";

    return patchResponse({
      surfaceId: input.surfaceId,
      fields: {
        name: result.draft.name,
        enabled: false,
        trigger: result.normalized.trigger,
        nodes: result.normalized.nodes.map(({ type, config }) => ({
          type,
          config,
        })),
      },
      status,
      questions: result.questions,
      missingFields: result.missingFields,
      confidence: result.confidence,
      explanation:
        status === "ready"
          ? "Built a workflow draft for review."
          : "I built the safest draft I could. Answer the open questions before creating it.",
    });
  }

  const emailFields = input.fields ?? {
    to: input.to,
    subject: input.subject,
    body: input.body,
  };
  const { object } = await generateObject({
    model: models.draft,
    schema: emailDraftSchema,
    system:
      "You help fill an email composer. Return only structured JSON matching the schema. " +
      "Do not claim the email was sent. Do not include markdown. Keep it useful and editable.",
    prompt: [
      `Tone: ${input.tone}`,
      emailFields.to ? `Recipient: ${emailFields.to}` : "Recipient: unknown",
      emailFields.subject
        ? `Existing subject: ${emailFields.subject}`
        : "Existing subject: empty",
      emailFields.body
        ? `Existing body: ${emailFields.body}`
        : "Existing body: empty",
      input.prompt
        ? `User instruction: ${input.prompt}`
        : "User instruction: draft a helpful email from the available context.",
      "",
      "If an existing subject or body is already good, improve it lightly instead of replacing the intent.",
      "Write a subject and body that the user can review before sending.",
    ].join("\n"),
  });

  return patchResponse({
    surfaceId: input.surfaceId,
    fields: object,
    status: object.subject && object.body ? "ready" : "collecting",
    explanation: "Drafted subject and message.",
  });
}
