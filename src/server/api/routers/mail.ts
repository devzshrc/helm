import { generateText } from "ai";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { log } from "~/server/logger";
import {
  applyLabel,
  archiveThread,
  getThread,
  listInboxCached,
  listLabelNames,
  listThreads,
  markThreadRead,
  replyToThread,
  sendEmail,
  starThread,
  trashThread,
  type ThreadRow,
} from "~/server/gmail";
import { models } from "~/lib/ai/models";
import { draftReply } from "~/lib/ai/draft";
import {
  backfillMissingEmbeddings,
  ensureTriaged,
  getPrioritiesFromMeta,
  semanticSearchMail,
} from "~/server/triage";

let warnedTriageFailure = false;

const CALENDAR_SUBJECT_RE =
  /^(invitation|accepted|declined|tentative|updated invitation|canceled event|cancelled event):/i;

async function safeEnsureTriaged(tenantId: string, threads: ThreadRow[]) {
  try {
    return await ensureTriaged(tenantId, threads);
  } catch (err) {
    if (!warnedTriageFailure) {
      warnedTriageFailure = true;
      log.warn(
        "inbox AI metadata failed; returning mail without priority badges",
        {
          err: String(err),
        },
      );
    }
    return new Map<string, string>();
  }
}

function senderText(t: ThreadRow) {
  return `${t.fromName} ${t.from}`.toLowerCase();
}

function bodyText(t: ThreadRow) {
  return `${t.subject} ${t.snippet}`.toLowerCase();
}

function looksLikeCalendarNoise(t: ThreadRow) {
  const sender = senderText(t);
  const body = bodyText(t);
  return (
    CALENDAR_SUBJECT_RE.test(t.subject) ||
    (/\b(calendar|invite|invitation|meeting update|rsvp)\b/.test(body) &&
      /\b(calendar|noreply|notification|notifications)\b/.test(sender))
  );
}

function looksLikeNewsletter(t: ThreadRow) {
  const sender = senderText(t);
  const body = bodyText(t);
  const hasStrongPromoSignal =
    /\b(unsubscribe|newsletter|digest|manage preferences|email preferences)\b/.test(
      body,
    ) || /\b(sale|deal|offer|promo|promotion|marketing|discount)\b/.test(body);
  const senderLooksAutomated =
    /\b(no-?reply|noreply|updates|news|newsletter|digest|mailer)\b/.test(
      sender,
    );
  return (
    hasStrongPromoSignal ||
    (senderLooksAutomated && /%\s*off|\bshop\b/.test(body))
  );
}

function looksLikeReceipt(t: ThreadRow) {
  const sender = senderText(t);
  const body = bodyText(t);
  return (
    /\b(receipt|invoice|payment|paid|order\b|order #|transaction|billing|renewal|statement|shipped|delivery)\b/.test(
      body,
    ) ||
    (/\b(stripe|paypal|square|quickbooks|amazon|shopify)\b/.test(sender) &&
      /\b(payment|invoice|order|receipt)\b/.test(body))
  );
}

function cleanupKind(
  t: ThreadRow,
): "newsletter" | "receipt" | "calendar" | null {
  if (looksLikeCalendarNoise(t)) return "calendar";
  if (looksLikeReceipt(t)) return "receipt";
  if (looksLikeNewsletter(t)) return "newsletter";
  return null;
}

async function inboxThreads(tenantId: string, limit: number) {
  return (
    (await listInboxCached(tenantId, limit)) ??
    (await listThreads(tenantId, { maxResults: limit }))
  );
}

export const mailRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          labelIds: z.array(z.string()).optional(),
          mode: z.enum(["gmail", "semantic"]).optional(),
          // How many threads to return. The client grows this for "load more"
          // — kept as a single growing window so the optimistic cache helpers
          // (which patch one mail.list entry) keep working.
          limit: z.number().int().min(10).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const limit = input?.limit ?? 25;
      if (input?.mode === "semantic" && input.q?.trim()) {
        const semantic = await semanticSearchMail(tenantId, input.q, limit);
        const cachedThreads =
          (await listInboxCached(tenantId, Math.max(limit * 3, 75))) ?? [];
        const byThreadId = new Map(
          cachedThreads.map((thread) => [thread.threadId, thread]),
        );
        return semantic.results.map((t) => ({
          ...(byThreadId.get(t.threadId) ?? {}),
          id: t.gmailId,
          threadId: t.threadId,
          from: t.from ?? byThreadId.get(t.threadId)?.from ?? "",
          fromName:
            byThreadId.get(t.threadId)?.fromName ?? t.from ?? "Unknown sender",
          to: "",
          subject:
            t.subject ?? byThreadId.get(t.threadId)?.subject ?? "(no subject)",
          snippet: t.snippet ?? byThreadId.get(t.threadId)?.snippet ?? "",
          receivedAt:
            t.receivedAt?.getTime() ??
            byThreadId.get(t.threadId)?.receivedAt ??
            null,
          labelIds: byThreadId.get(t.threadId)?.labelIds ?? ([] as string[]),
          unread: byThreadId.get(t.threadId)?.unread ?? false,
          messageCount: byThreadId.get(t.threadId)?.messageCount ?? 1,
          hasUnread: byThreadId.get(t.threadId)?.hasUnread ?? false,
          hasAttachment: byThreadId.get(t.threadId)?.hasAttachment ?? false,
          priority: t.priority,
        }));
      }
      // Default inbox view: serve from Corsair's cache, fall back to live
      // (which repopulates the cache). Searches always go live for accuracy.
      // Fall back when the cache is null OR empty — an empty array is NOT
      // nullish, so `??=` alone would strand the inbox blank when the local
      // message cache hasn't been populated (only threads/sent synced).
      let threads =
        !input?.q && !input?.labelIds
          ? await listInboxCached(tenantId, limit)
          : null;
      if (!threads || threads.length === 0) {
        threads = await listThreads(tenantId, {
          q: input?.q,
          labelIds: input?.labelIds,
          maxResults: limit,
        });
      }
      const priorities = await getPrioritiesFromMeta(
        tenantId,
        threads.map((t) => t.id),
      );
      const needsTriage = threads.filter((t) => !priorities.has(t.id));
      if (needsTriage.length > 0) void safeEnsureTriaged(tenantId, needsTriage);
      return threads.map((t) => ({
        ...t,
        priority: priorities.get(t.id) ?? null,
      }));
    }),

  thread: protectedProcedure
    .input(z.object({ threadId: z.string().min(1) }))
    .query(({ ctx, input }) => getThread(ctx.session.user.id, input.threadId)),

  send: protectedProcedure
    .input(
      z.object({
        to: z.string(),
        subject: z.string(),
        text: z.string(),
        threadId: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => sendEmail(ctx.session.user.id, input)),

  reply: protectedProcedure
    .input(z.object({ threadId: z.string(), text: z.string() }))
    .mutation(({ ctx, input }) =>
      replyToThread(ctx.session.user.id, input.threadId, input.text),
    ),

  draftReply: protectedProcedure
    .input(
      z.object({ threadId: z.string(), instruction: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const thread = await getThread(ctx.session.user.id, input.threadId);
        const text = thread.messages
          .map(
            (m) =>
              `From: ${m.fromName} <${m.from}>\n${m.subject}\n${stripHtml(m.html)}`,
          )
          .join("\n\n---\n\n");
        return { draft: await draftReply(text, input.instruction) };
      } catch {
        return { draft: "" };
      }
    }),

  archive: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(({ ctx, input }) =>
      archiveThread(ctx.session.user.id, input.threadId),
    ),

  trash: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(({ ctx, input }) =>
      trashThread(ctx.session.user.id, input.threadId),
    ),

  markRead: protectedProcedure
    .input(z.object({ threadId: z.string(), read: z.boolean() }))
    .mutation(({ ctx, input }) =>
      markThreadRead(ctx.session.user.id, input.threadId, input.read),
    ),

  star: protectedProcedure
    .input(z.object({ threadId: z.string(), starred: z.boolean() }))
    .mutation(({ ctx, input }) =>
      starThread(ctx.session.user.id, input.threadId, input.starred),
    ),

  labels: protectedProcedure.query(({ ctx }) =>
    listLabelNames(ctx.session.user.id),
  ),

  semanticSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(400),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const backfill = await backfillMissingEmbeddings(ctx.session.user.id, 25);
      const result = await semanticSearchMail(
        ctx.session.user.id,
        input.query,
        input.limit ?? 10,
      );
      return { ...result, backfill };
    }),

  cleanupPreview: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.id;
    const threads = await inboxThreads(tenantId, 80);
    const actions = threads
      .map((t) => {
        const kind = cleanupKind(t);
        if (kind === "newsletter") {
          return {
            id: `${t.id}:newsletter`,
            threadId: t.threadId,
            messageId: t.id,
            action: "label_archive" as const,
            labelName: "Newsletters",
            reason: "Looks like newsletter or promotional mail.",
            from: t.fromName,
            subject: t.subject,
            snippet: t.snippet,
          };
        }
        if (kind === "receipt") {
          return {
            id: `${t.id}:receipt`,
            threadId: t.threadId,
            messageId: t.id,
            action: "label" as const,
            labelName: "Receipts",
            reason: "Looks like a receipt, invoice, order, or payment update.",
            from: t.fromName,
            subject: t.subject,
            snippet: t.snippet,
          };
        }
        if (kind === "calendar") {
          return {
            id: `${t.id}:calendar`,
            threadId: t.threadId,
            messageId: t.id,
            action: "mark_read" as const,
            labelName: null,
            reason: "Looks like an automated calendar notification.",
            from: t.fromName,
            subject: t.subject,
            snippet: t.snippet,
          };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 25);
    const groups = [
      {
        key: "label_archive",
        title: "Archive newsletters",
        actionLabel: "Apply Newsletters label and archive",
      },
      {
        key: "label",
        title: "Label receipts",
        actionLabel: "Apply Receipts label",
      },
      {
        key: "mark_read",
        title: "Mark calendar noise as read",
        actionLabel: "Mark read",
      },
    ]
      .map((group) => {
        const matching = actions.filter(
          (action) => action.action === group.key,
        );
        return {
          ...group,
          count: matching.length,
          examples: matching.slice(0, 5),
        };
      })
      .filter((group) => group.count > 0);
    return { actions, groups };
  }),

  applyCleanup: protectedProcedure
    .input(
      z.object({
        actions: z.array(
          z.object({
            threadId: z.string(),
            action: z.enum(["label_archive", "label", "mark_read"]),
            labelName: z.string().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      let applied = 0;
      for (const action of input.actions.slice(0, 50)) {
        if (action.action === "label_archive") {
          await applyLabel(
            tenantId,
            action.threadId,
            action.labelName ?? "Newsletters",
          );
          await archiveThread(tenantId, action.threadId);
          applied += 1;
        } else if (action.action === "label") {
          await applyLabel(
            tenantId,
            action.threadId,
            action.labelName ?? "Receipts",
          );
          applied += 1;
        } else if (action.action === "mark_read") {
          await markThreadRead(tenantId, action.threadId, true);
          applied += 1;
        }
      }
      return { applied };
    }),

  /**
   * AI auto-label: the user describes (in plain language) which inbox emails
   * should get a label; the model picks the matches and the Gmail label is
   * applied to each. One model call over the inbox batch — fast + cheap.
   */
  autoLabel: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1).max(400),
        labelName: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const threads =
        (await listInboxCached(tenantId)) ??
        (await listThreads(tenantId, { maxResults: 40 }));
      if (threads.length === 0) return { labeled: 0 };

      const list = threads
        .map(
          (t, i) =>
            `${i}\t${t.fromName} | ${t.subject || "(no subject)"} | ${t.snippet.slice(0, 120)}`,
        )
        .join("\n");

      const { text } = await generateText({
        model: models.triage,
        system:
          "You match emails against a user's rule. Reply with ONLY a JSON array of the " +
          "integer indices of emails that match the rule — e.g. [0,3,4]. No prose, no fences.",
        prompt: `Rule: ${input.description}\n\nEmails (index<TAB>from | subject | snippet):\n${list}`,
      });

      let idxs: number[] = [];
      try {
        const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
        idxs = (JSON.parse(json) as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < threads.length);
      } catch {
        idxs = [];
      }

      const matches = [...new Set(idxs)]
        .map((i) => threads[i]!)
        .filter(Boolean);
      await Promise.all(
        matches.map((t) => applyLabel(tenantId, t.threadId, input.labelName)),
      );
      return { labeled: matches.length };
    }),
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}
