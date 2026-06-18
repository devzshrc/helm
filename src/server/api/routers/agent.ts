import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { chatSessions } from "~/server/db/schema";
import { WRITE_TOOLS, executeWriteAction } from "~/lib/ai/agent-tools";
import { redactMessagesForStorage } from "~/lib/agent-redact";
import { timeDev } from "~/lib/perf";

/** First user message → a short session title. */
function deriveTitle(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  for (const m of messages as { role?: string; content?: unknown }[]) {
    if (
      m?.role === "user" &&
      typeof m.content === "string" &&
      m.content.trim()
    ) {
      const t = m.content.trim().replace(/\s+/g, " ");
      return t.length > 48 ? `${t.slice(0, 48)}…` : t;
    }
  }
  return null;
}

export const agentRouter = createTRPCRouter({
  /* ---- chat session management (persists CopilotKit conversations) ---- */
  sessions: createTRPCRouter({
    list: protectedProcedure.query(({ ctx }) =>
      timeDev("agent.sessions.list", () =>
        ctx.db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          updatedAt: chatSessions.updatedAt,
        })
        .from(chatSessions)
        .where(eq(chatSessions.tenantId, ctx.session.user.id))
        .orderBy(desc(chatSessions.updatedAt)),
      ),
    ),

    create: protectedProcedure.mutation(async ({ ctx }) => {
      const id = crypto.randomUUID();
      await ctx.db
        .insert(chatSessions)
        .values({ id, tenantId: ctx.session.user.id, messages: [] });
      return { id };
    }),

    load: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return timeDev("agent.sessions.load", async () => {
        const [row] = await ctx.db
          .select({ messages: chatSessions.messages })
          .from(chatSessions)
          .where(
            and(
              eq(chatSessions.id, input.id),
              eq(chatSessions.tenantId, ctx.session.user.id),
            ),
          )
          .limit(1);
        return { messages: (row?.messages ?? []) as unknown[] };
        });
      }),

    save: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          messages: z.array(z.unknown()),
          title: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.session.user.id;
        const title = input.title ?? deriveTitle(input.messages) ?? undefined;
        // Strip full email/event bodies out of tool results before persisting —
        // keeps card structure but no PII at rest.
        const messages = redactMessagesForStorage(input.messages);
        // Upsert: the session is created client-side first, but be defensive.
        await ctx.db
          .insert(chatSessions)
          .values({
            id: input.id,
            tenantId,
            messages,
            title: title ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: chatSessions.id,
            set: {
              messages,
              updatedAt: new Date(),
              ...(title ? { title } : {}),
            },
          });
        return { ok: true };
      }),

    rename: protectedProcedure
      .input(z.object({ id: z.string(), title: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(chatSessions)
          .set({ title: input.title })
          .where(
            and(
              eq(chatSessions.id, input.id),
              eq(chatSessions.tenantId, ctx.session.user.id),
            ),
          );
        return { ok: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .delete(chatSessions)
          .where(
            and(
              eq(chatSessions.id, input.id),
              eq(chatSessions.tenantId, ctx.session.user.id),
            ),
          );
        return { ok: true };
      }),
  }),

  /**
   * Executes an approved write action for the CopilotKit Human-in-the-Loop
   * approval cards. The agent surfaces a write tool; the frontend renders an
   * approval card and, on Approve, calls this with the tool name + args.
   */
  execute: protectedProcedure
    .input(z.object({ tool: z.enum(WRITE_TOOLS), input: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const result = await executeWriteAction(
        ctx.session.user.id,
        input.tool,
        input.input,
      );
      return { result };
    }),
});
