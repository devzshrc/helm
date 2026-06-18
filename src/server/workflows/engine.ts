import "server-only";

import {
  applyLabel,
  archiveThread,
  listThreads,
  markThreadRead,
  replyToThread,
  sendEmail,
  starThread,
} from "~/server/gmail";
import { createEvent } from "~/server/calendar";
import { draftReply } from "~/lib/ai/draft";
import { classifyPriority } from "~/lib/ai/triage";
import { summarizeText, askYesNo } from "~/lib/ai/summarize";
import { extractEventFromThread } from "~/lib/ai/events";
import type {
  NodeType,
  WorkflowNode,
  WorkflowTrigger,
} from "~/lib/workflows/types";
import { NODE_META } from "~/lib/workflows/types";

export type EmailCtx = {
  threadId: string;
  from: string;
  subject: string;
  body: string;
  labelIds?: string[];
  hasAttachment?: boolean;
  priority?: string | null;
};

export type CalendarCtx = {
  eventId: string;
  action: "created" | "updated" | "deleted";
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  attendees?: string[];
};

export type RunCtx = {
  tenantId: string;
  trigger: WorkflowTrigger;
  email?: EmailCtx;
  calendar?: CalendarCtx;
  vars: Record<string, string>;
};

export type StepLog = {
  type: NodeType;
  status: "ok" | "stopped" | "failed" | "skipped";
  detail?: string;
};

export type RunResult = {
  status: "success" | "stopped" | "failed";
  steps: StepLog[];
  error?: string;
};

function interp(s: string | undefined, vars: Record<string, string>): string {
  if (!s) return "";
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

function requireEmail(ctx: RunCtx): EmailCtx {
  if (!ctx.email) throw new Error("This step needs an email; trigger has none");
  return ctx.email;
}

function contextText(ctx: RunCtx): string {
  if (ctx.email) return ctx.email.body;
  if (ctx.calendar) {
    return [
      ctx.calendar.title,
      ctx.calendar.location,
      ctx.calendar.start,
      ctx.calendar.end,
      ctx.calendar.attendees?.join(", "),
    ]
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Executes a single node. Returns { stop } to halt the chain (filter). */
async function execNode(
  node: WorkflowNode,
  ctx: RunCtx,
): Promise<{ stop?: boolean; detail?: string }> {
  const c = node.config ?? {};
  const t = ctx.tenantId;

  switch (node.type) {
    case "filter": {
      const value = c.value ?? "";
      let matched: boolean;
      if (c.field === "ai") {
        matched = await askYesNo(value, contextText(ctx));
      } else {
        const hay = (ctx.vars[c.field ?? "subject"] ?? "").toLowerCase();
        const has = hay.includes(value.toLowerCase());
        matched = c.op === "not_contains" ? !has : has;
      }
      return matched
        ? { detail: "passed" }
        : { stop: true, detail: "condition not met" };
    }
    case "ai_summarize": {
      const email = requireEmail(ctx);
      ctx.vars.summary = await summarizeText(email.body);
      return { detail: ctx.vars.summary.slice(0, 80) };
    }
    case "ai_draft": {
      const email = requireEmail(ctx);
      const instruction = c.instruction?.trim() ? c.instruction : undefined;
      ctx.vars.draft = await draftReply(email.body, instruction);
      return { detail: "drafted" };
    }
    case "ai_classify": {
      const email = requireEmail(ctx);
      ctx.vars.priority = await classifyPriority({
        from: email.from,
        subject: email.subject,
        snippet: email.body.slice(0, 200),
      });
      return { detail: ctx.vars.priority };
    }
    case "ai_digest": {
      const threads = await listThreads(t, {
        q: "is:unread newer_than:1d",
        maxResults: 20,
      });
      if (threads.length === 0) {
        ctx.vars.digest = "No unread mail in the last 24 hours.";
        return { detail: "empty" };
      }
      const text = threads
        .map((th) => `- ${th.fromName}: ${th.subject} — ${th.snippet}`)
        .join("\n");
      ctx.vars.digest = await summarizeText(`Unread emails:\n${text}`, "inbox");
      return { detail: `${threads.length} threads` };
    }
    case "label": {
      const email = requireEmail(ctx);
      const labelName = interp(c.labelName, ctx.vars);
      await applyLabel(t, email.threadId, labelName ? labelName : "Helm");
      return { detail: c.labelName };
    }
    case "move_to_label": {
      const email = requireEmail(ctx);
      const labelName = interp(c.labelName, ctx.vars);
      await applyLabel(t, email.threadId, labelName ? labelName : "Helm");
      await archiveThread(t, email.threadId);
      return {
        detail: labelName ? `${labelName} + archived` : "Helm + archived",
      };
    }
    case "add_note": {
      return { detail: interp(c.text, ctx.vars).slice(0, 240) || "note" };
    }
    case "archive":
      await archiveThread(t, requireEmail(ctx).threadId);
      return {};
    case "mark_read":
      await markThreadRead(t, requireEmail(ctx).threadId, true);
      return {};
    case "star":
      await starThread(t, requireEmail(ctx).threadId, true);
      return {};
    case "reply": {
      const email = requireEmail(ctx);
      const typed = interp(c.text, ctx.vars);
      const text = typed ? typed : ctx.vars.draft;
      if (!text) throw new Error("Reply has no text and no {{draft}}");
      await replyToThread(t, email.threadId, text);
      return {};
    }
    case "forward": {
      const email = requireEmail(ctx);
      const to = interp(c.to, ctx.vars);
      if (!to) throw new Error("Forward needs a recipient");
      await sendEmail(t, {
        to,
        subject: `Fwd: ${email.subject}`,
        text: `---------- Forwarded message ----------\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`,
      });
      return { detail: to };
    }
    case "send_email": {
      const to = interp(c.to, ctx.vars);
      if (!to) throw new Error("Send email needs a recipient");
      await sendEmail(t, {
        to,
        subject: interp(c.subject, ctx.vars),
        text: interp(c.body, ctx.vars),
      });
      return { detail: to };
    }
    case "create_event": {
      const email = requireEmail(ctx);
      if (c.summary) {
        const start = new Date(Date.now() + 3600_000);
        const end = new Date(start.getTime() + 1800_000);
        await createEvent(t, {
          summary: interp(c.summary, ctx.vars),
          start: start.toISOString(),
          end: end.toISOString(),
        });
      } else {
        const draft = await extractEventFromThread(
          `Subject: ${email.subject}\n${email.body}`,
          new Date().toISOString(),
          "UTC",
        );
        await createEvent(t, draft);
      }
      return {};
    }
  }
}

export async function runWorkflow(
  trigger: WorkflowTrigger,
  nodes: WorkflowNode[],
  ctx: RunCtx,
): Promise<RunResult> {
  const steps: StepLog[] = [];

  if (ctx.email) {
    ctx.vars.from = ctx.email.from;
    ctx.vars.subject = ctx.email.subject;
    ctx.vars.body = ctx.email.body;
    ctx.vars.labels = ctx.email.labelIds?.join(", ") ?? "";
    ctx.vars.hasAttachment = ctx.email.hasAttachment ? "yes" : "no";
    ctx.vars.priority = ctx.email.priority ?? "";
  }
  if (ctx.calendar) {
    ctx.vars.eventId = ctx.calendar.eventId;
    ctx.vars.action = ctx.calendar.action;
    ctx.vars.title = ctx.calendar.title;
    ctx.vars.subject = ctx.calendar.title;
    ctx.vars.start = ctx.calendar.start ?? "";
    ctx.vars.end = ctx.calendar.end ?? "";
    ctx.vars.location = ctx.calendar.location ?? "";
    ctx.vars.attendees = ctx.calendar.attendees?.join(", ") ?? "";
    ctx.vars.body = contextText(ctx);
  }

  for (const node of nodes) {
    if (!NODE_META[node.type]?.triggers.includes(trigger.type)) {
      steps.push({
        type: node.type,
        status: "skipped",
        detail: "not valid for this trigger",
      });
      continue;
    }
    try {
      const r = await execNode(node, ctx);
      if (r.stop) {
        steps.push({ type: node.type, status: "stopped", detail: r.detail });
        return { status: "stopped", steps };
      }
      steps.push({ type: node.type, status: "ok", detail: r.detail });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ type: node.type, status: "failed", detail: msg });
      return { status: "failed", steps, error: msg };
    }
  }

  return { status: "success", steps };
}
