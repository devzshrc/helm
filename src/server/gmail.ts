import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { type CorsairClient, withCorsair } from "~/server/corsair";
import { sanitizeEmailHtml } from "~/server/sanitize";
import { db } from "~/server/db";
import { emailBodies, emailMeta } from "~/server/db/schema";
import {
  type GmailMessage,
  bodyHtml,
  epochMs,
  getHeader,
  summarize,
  type MessageSummary,
} from "~/server/gmail-parse";

function client(c: CorsairClient, tenantId: string) {
  return c.withTenant(tenantId).gmail.api;
}

export type ThreadRow = MessageSummary & {
  messageCount: number;
  hasUnread: boolean;
  hasAttachment: boolean;
  priority?: string | null;
};

function hasAttachment(messages: GmailMessage[]): boolean {
  const walk = (part: GmailMessage["payload"]): boolean => {
    if (!part) return false;
    if (part.filename || part.body?.attachmentId) return true;
    return (part.parts ?? []).some(walk);
  };
  return messages.some((m) => walk(m.payload));
}

/** List threads (inbox by default), summarized by their latest message. */
export async function listThreads(
  tenantId: string,
  opts: { q?: string; labelIds?: string[]; maxResults?: number } = {},
): Promise<ThreadRow[]> {
  return withCorsair(async (c) => {
    const gmail = client(c, tenantId);
    const requestedLabels = opts.labelIds ?? (opts.q ? undefined : ["INBOX"]);
    const list = await gmail.threads.list({
      q: opts.q,
      labelIds: requestedLabels,
      maxResults: opts.maxResults ?? 25,
    });
    const summaryLabel = requestedLabels?.includes("SENT") ? "SENT" : null;

    const ids = (list.threads ?? [])
      .map((t) => t.id)
      .filter((x): x is string => !!x);

    const threads = await Promise.all(
      ids.map(async (id) => {
        const full = (await gmail.threads.get({ id, format: "full" })) as {
          messages?: GmailMessage[];
        };
        const messages = full.messages ?? [];
        const candidates = summaryLabel
          ? messages.filter((m) => (m.labelIds ?? []).includes(summaryLabel))
          : messages;
        const latest = candidates[candidates.length - 1];
        if (!latest) return null;
        const summary = summarize(latest);
        return {
          ...summary,
          threadId: id,
          messageCount: messages.length,
          hasUnread: messages.some((m) =>
            (m.labelIds ?? []).includes("UNREAD"),
          ),
          hasAttachment: hasAttachment(messages),
        } satisfies ThreadRow;
      }),
    );

    return threads.filter((t): t is ThreadRow => t !== null);
  });
}

/**
 * Inbox list from Corsair's local cache (corsair_entities) — avoids hitting
 * Google on every load. Returns null when the cache is empty so the caller can
 * fall back to a live fetch (which repopulates the cache).
 */
export async function listInboxCached(
  tenantId: string,
  maxResults = 25,
): Promise<ThreadRow[] | null> {
  return withCorsair(async (c) => {
    let ents;
    try {
      ents = await c
        .withTenant(tenantId)
        .gmail.db.messages.list({ limit: 300 });
    } catch {
      return null;
    }
    if (!ents?.length) return null;

    const byThread = new Map<string, GmailMessage[]>();
    for (const e of ents) {
      const m = e.data as GmailMessage;
      const tid = m.threadId ?? e.entity_id;
      const arr = byThread.get(tid) ?? [];
      arr.push(m);
      byThread.set(tid, arr);
    }

    const rows: ThreadRow[] = [];
    for (const [tid, msgs] of byThread) {
      msgs.sort(
        (a, b) =>
          (epochMs(a.internalDate) ?? 0) - (epochMs(b.internalDate) ?? 0),
      );
      const latest = msgs[msgs.length - 1];
      if (!latest) continue;
      if (!(latest.labelIds ?? []).includes("INBOX")) continue;
      rows.push({
        ...summarize(latest),
        threadId: tid,
        messageCount: msgs.length,
        hasUnread: msgs.some((m) => (m.labelIds ?? []).includes("UNREAD")),
        hasAttachment: hasAttachment(msgs),
      });
    }
    rows.sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0));
    return rows.slice(0, maxResults);
  });
}

export type ThreadMessage = MessageSummary & { html: string };

export async function getThread(
  tenantId: string,
  threadId: string,
): Promise<{ id: string; subject: string; messages: ThreadMessage[] }> {
  // Try serving from DB cache (email_meta + email_bodies).
  // email_meta_tenant_thread_idx covers the WHERE clause — free lookup.
  const metaRows = await db
    .select({
      gmailId: emailMeta.gmailId,
      fromAddr: emailMeta.fromAddr,
      subject: emailMeta.subject,
      snippet: emailMeta.snippet,
      receivedAt: emailMeta.receivedAt,
    })
    .from(emailMeta)
    .where(
      and(eq(emailMeta.tenantId, tenantId), eq(emailMeta.threadId, threadId)),
    );

  if (metaRows.length > 0) {
    const ids = metaRows.map((r) => r.gmailId);
    const bodyRows = await db
      .select({ gmailId: emailBodies.gmailId, html: emailBodies.html })
      .from(emailBodies)
      .where(
        and(
          eq(emailBodies.tenantId, tenantId),
          inArray(emailBodies.gmailId, ids),
        ),
      );

    if (bodyRows.length === ids.length) {
      // Full cache hit — zero Gmail API calls
      const bodyMap = new Map(bodyRows.map((b) => [b.gmailId, b.html]));
      const messages: ThreadMessage[] = metaRows
        .sort(
          (a, b) =>
            (a.receivedAt?.getTime() ?? 0) - (b.receivedAt?.getTime() ?? 0),
        )
        .map((r) => ({
          id: r.gmailId,
          threadId,
          from: r.fromAddr ?? "",
          fromName: r.fromAddr ?? "",
          to: "",
          subject: r.subject ?? "(no subject)",
          snippet: r.snippet ?? "",
          receivedAt: r.receivedAt?.getTime() ?? null,
          labelIds: [],
          unread: false,
          html: sanitizeEmailHtml(bodyMap.get(r.gmailId) ?? ""),
        }));
      return {
        id: threadId,
        subject: messages[0]?.subject ?? "(no subject)",
        messages,
      };
    }
  }

  // Cache miss → live Gmail API fetch
  const full = (await withCorsair((c) =>
    client(c, tenantId).threads.get({ id: threadId, format: "full" }),
  )) as { id?: string; messages?: GmailMessage[] };

  const messages = (full.messages ?? []).map((m) => ({
    ...summarize(m),
    html: sanitizeEmailHtml(bodyHtml(m)),
  }));

  // Populate body cache for future opens
  if (messages.length > 0) {
    await db
      .insert(emailBodies)
      .values(messages.map((m) => ({ tenantId, gmailId: m.id, html: m.html })))
      .onConflictDoUpdate({
        target: [emailBodies.tenantId, emailBodies.gmailId],
        set: { html: emailBodies.html, cachedAt: new Date() },
      });
  }

  return {
    id: threadId,
    subject: messages[0]?.subject ?? "(no subject)",
    messages,
  };
}

function buildMime(opts: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.references ? `References: ${opts.references}` : null,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    opts.text,
  ].filter((l): l is string => l !== null);
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

type SendOpts = {
  to: string;
  subject: string;
  text: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
};

function sendEmailC(c: CorsairClient, tenantId: string, opts: SendOpts) {
  const raw = buildMime(opts);
  return client(c, tenantId).messages.send({ raw, threadId: opts.threadId });
}

export async function sendEmail(
  tenantId: string,
  opts: SendOpts,
): Promise<{ id?: string; threadId?: string }> {
  return withCorsair((c) => sendEmailC(c, tenantId, opts));
}

/** Reply to a thread: pulls Message-ID/References/Subject from the latest msg. */
export async function replyToThread(
  tenantId: string,
  threadId: string,
  text: string,
): Promise<{ id?: string; threadId?: string }> {
  return withCorsair(async (c) => {
    const full = (await client(c, tenantId).threads.get({
      id: threadId,
      format: "full",
    })) as { messages?: GmailMessage[] };
    const messages = full.messages ?? [];
    const latest = messages[messages.length - 1];
    const messageId = getHeader(latest?.payload, "Message-ID");
    const refs = getHeader(latest?.payload, "References");
    const from = getHeader(latest?.payload, "From");
    const replyTo = getHeader(latest?.payload, "Reply-To") || from;
    const addr = /<(.+?)>/.exec(replyTo)?.[1] ?? replyTo;
    let subject = getHeader(latest?.payload, "Subject");
    if (!/^re:/i.test(subject)) subject = `Re: ${subject}`;

    return sendEmailC(c, tenantId, {
      to: addr,
      subject,
      text,
      threadId,
      inReplyTo: messageId || undefined,
      references: [refs, messageId].filter(Boolean).join(" ") || undefined,
    });
  });
}

// --- single-key actions (thread-level) ---

export async function archiveThread(tenantId: string, threadId: string) {
  return withCorsair((c) =>
    client(c, tenantId).threads.modify({
      id: threadId,
      removeLabelIds: ["INBOX"],
    }),
  );
}
export async function trashThread(tenantId: string, threadId: string) {
  return withCorsair((c) =>
    client(c, tenantId).threads.trash({ id: threadId }),
  );
}
export async function markThreadRead(
  tenantId: string,
  threadId: string,
  read: boolean,
) {
  return withCorsair((c) =>
    client(c, tenantId).threads.modify({
      id: threadId,
      addLabelIds: read ? undefined : ["UNREAD"],
      removeLabelIds: read ? ["UNREAD"] : undefined,
    }),
  );
}
export async function starThread(
  tenantId: string,
  threadId: string,
  starred: boolean,
) {
  return withCorsair((c) =>
    client(c, tenantId).threads.modify({
      id: threadId,
      addLabelIds: starred ? ["STARRED"] : undefined,
      removeLabelIds: starred ? undefined : ["STARRED"],
    }),
  );
}

async function ensureLabelC(
  c: CorsairClient,
  tenantId: string,
  name: string,
): Promise<string> {
  const gmail = client(c, tenantId);
  const res = await gmail.labels.list({});
  const found = res.labels?.find(
    (l) => l.name?.toLowerCase() === name.toLowerCase(),
  );
  if (found?.id) return found.id;
  const created = (await gmail.labels.create({ label: { name } })) as {
    id?: string;
  };
  return created.id ?? "";
}

/** Returns the id of a label by name, creating it if it doesn't exist. */
export async function ensureLabel(
  tenantId: string,
  name: string,
): Promise<string> {
  return withCorsair((c) => ensureLabelC(c, tenantId, name));
}

/** User-created label names (excludes Gmail system labels). */
export async function listLabelNames(tenantId: string): Promise<string[]> {
  return withCorsair(async (c) => {
    const res = (await client(c, tenantId).labels.list({})) as {
      labels?: { name?: string; type?: string }[];
    };
    return (res.labels ?? [])
      .filter((l) => l.type !== "system" && l.name)
      .map((l) => l.name!)
      .sort();
  });
}

export async function applyLabel(
  tenantId: string,
  threadId: string,
  name: string,
) {
  return withCorsair(async (c) => {
    const id = await ensureLabelC(c, tenantId, name);
    if (id)
      await client(c, tenantId).threads.modify({
        id: threadId,
        addLabelIds: [id],
      });
  });
}
