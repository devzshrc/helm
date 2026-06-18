import { eq, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { webhookEvents } from "~/server/db/schema";

/**
 * Lightweight change clock for a tenant.
 *
 * Every inbound Corsair webhook (Gmail / Calendar) records a row in
 * `webhook_events`. The client polls this single indexed `max(created_at)`
 * value instead of re-fetching the whole inbox/calendar on an interval, and
 * only invalidates the heavy queries when the cursor advances. This is the
 * push-shaped behaviour without a persistent socket: ~one O(1) read per poll
 * vs a full `mail.list` every 10s (which previously hammered the Worker and
 * tripped its CPU limit).
 */
export const syncRouter = createTRPCRouter({
  cursor: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        at: sql<string | null>`max(${webhookEvents.createdAt})`,
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.tenantId, ctx.session.user.id));
    return { cursor: row?.at ? new Date(row.at).getTime() : 0 };
  }),
});
