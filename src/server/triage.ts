import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { emailMeta } from "~/server/db/schema";
import type { ThreadRow } from "~/server/gmail";
import { classifyPriority, type Priority } from "~/lib/ai/triage";
import { embedText } from "~/lib/ai/embed";

const TRIAGE_CONCURRENCY = 4;

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        if (item) await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Ensures every thread has a cached priority (+ embedding for search).
 * Already-triaged threads are skipped (cached in email_meta). New ones are
 * classified by the cheap model and upserted. Returns gmailId -> priority.
 */
export async function ensureTriaged(
  tenantId: string,
  threads: ThreadRow[],
): Promise<Map<string, Priority>> {
  const result = new Map<string, Priority>();
  if (threads.length === 0) return result;

  const ids = threads.map((t) => t.id);
  const existing = await db
    .select({
      gmailId: emailMeta.gmailId,
      priority: emailMeta.priority,
      embedding: emailMeta.embedding,
    })
    .from(emailMeta)
    .where(
      and(eq(emailMeta.tenantId, tenantId), inArray(emailMeta.gmailId, ids)),
    );

  const have = new Map(existing.map((e) => [e.gmailId, e]));
  for (const row of existing)
    if (row.priority) result.set(row.gmailId, row.priority as Priority);

  const needsWork = threads.filter((t) => {
    const cached = have.get(t.id);
    return !cached?.priority || !cached.embedding;
  });

  await mapLimit(needsWork, TRIAGE_CONCURRENCY, async (t) => {
    const cached = have.get(t.id);
    const priority =
      (cached?.priority as Priority | null) ??
      (await classifyPriority({
        from: t.fromName || t.from,
        subject: t.subject,
        snippet: t.snippet,
      }));
    const embedding = await embedText(`${t.subject}\n${t.snippet}`);
    result.set(t.id, priority);
    await db
      .insert(emailMeta)
      .values({
        tenantId,
        gmailId: t.id,
        threadId: t.threadId,
        priority,
        fromAddr: t.from,
        subject: t.subject,
        snippet: t.snippet,
        receivedAt: t.receivedAt ? new Date(t.receivedAt) : null,
        embedding: embedding ?? undefined,
      })
      .onConflictDoUpdate({
        target: [emailMeta.tenantId, emailMeta.gmailId],
        set: {
          priority,
          fromAddr: t.from,
          subject: t.subject,
          snippet: t.snippet,
          receivedAt: t.receivedAt ? new Date(t.receivedAt) : null,
          ...(embedding ? { embedding } : {}),
          updatedAt: new Date(),
        },
      });
  });

  return result;
}

/** Fast read-only priority lookup — no AI, no DB writes. */
export async function getPrioritiesFromMeta(
  tenantId: string,
  gmailIds: string[],
): Promise<Map<string, Priority>> {
  if (!gmailIds.length) return new Map();
  const rows = await db
    .select({ gmailId: emailMeta.gmailId, priority: emailMeta.priority })
    .from(emailMeta)
    .where(
      and(
        eq(emailMeta.tenantId, tenantId),
        inArray(emailMeta.gmailId, gmailIds),
      ),
    );
  const out = new Map<string, Priority>();
  for (const r of rows)
    if (r.priority) out.set(r.gmailId, r.priority as Priority);
  return out;
}

export type SemanticMailResult = {
  gmailId: string;
  threadId: string;
  from: string | null;
  subject: string | null;
  snippet: string | null;
  priority: string | null;
  receivedAt: Date | null;
  score: number;
};

export async function semanticSearchMail(
  tenantId: string,
  query: string,
  limit = 10,
): Promise<{ enabled: boolean; results: SemanticMailResult[] }> {
  const embedding = await embedText(query);
  if (!embedding) return { enabled: false, results: [] };

  const vector = `[${embedding.join(",")}]`;
  const distance = sql<number>`${emailMeta.embedding} <=> ${vector}::vector`;
  const rows = await db
    .select({
      gmailId: emailMeta.gmailId,
      threadId: emailMeta.threadId,
      from: emailMeta.fromAddr,
      subject: emailMeta.subject,
      snippet: emailMeta.snippet,
      priority: emailMeta.priority,
      receivedAt: emailMeta.receivedAt,
      score: sql<number>`1 - (${distance})`,
    })
    .from(emailMeta)
    .where(
      and(
        eq(emailMeta.tenantId, tenantId),
        sql`${emailMeta.embedding} IS NOT NULL`,
      ),
    )
    .orderBy(distance)
    .limit(Math.max(1, Math.min(limit, 50)));

  return { enabled: true, results: rows };
}

export async function backfillMissingEmbeddings(tenantId: string, limit = 25) {
  const rows = await db
    .select({
      gmailId: emailMeta.gmailId,
      subject: emailMeta.subject,
      snippet: emailMeta.snippet,
    })
    .from(emailMeta)
    .where(and(eq(emailMeta.tenantId, tenantId), isNull(emailMeta.embedding)))
    .orderBy(desc(emailMeta.receivedAt))
    .limit(Math.max(1, Math.min(limit, 100)));

  let updated = 0;
  await mapLimit(rows, TRIAGE_CONCURRENCY, async (row) => {
    const embedding = await embedText(
      `${row.subject ?? ""}\n${row.snippet ?? ""}`,
    );
    if (!embedding) return;
    await db
      .update(emailMeta)
      .set({ embedding, updatedAt: new Date() })
      .where(
        and(
          eq(emailMeta.tenantId, tenantId),
          eq(emailMeta.gmailId, row.gmailId),
        ),
      );
    updated += 1;
  });
  return { scanned: rows.length, updated };
}
