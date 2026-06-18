import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userPreferences } from "~/server/db/schema";

export const preferencesRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.id;
    const row = await ctx.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.tenantId, tenantId))
      .then((r) => r[0] ?? null);
    return {
      timezone: row?.timezone ?? "UTC",
      focusThreshold: row?.focusThreshold ?? "Important",
      triagePrefs: (row?.triagePrefs as Record<string, unknown>) ?? {},
      shortcuts: (row?.shortcuts as Record<string, unknown>) ?? {},
    };
  }),

  setTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userPreferences)
        .values({ tenantId: ctx.session.user.id, timezone: input.timezone })
        .onConflictDoUpdate({
          target: userPreferences.tenantId,
          set: { timezone: input.timezone, updatedAt: new Date() },
        });
      return { ok: true as const };
    }),

  setFocusThreshold: protectedProcedure
    .input(z.object({ level: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userPreferences)
        .values({ tenantId: ctx.session.user.id, focusThreshold: input.level })
        .onConflictDoUpdate({
          target: userPreferences.tenantId,
          set: { focusThreshold: input.level, updatedAt: new Date() },
        });
      return { ok: true as const };
    }),

  setTriagePrefs: protectedProcedure
    .input(z.object({ prefs: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userPreferences)
        .values({ tenantId: ctx.session.user.id, triagePrefs: input.prefs })
        .onConflictDoUpdate({
          target: userPreferences.tenantId,
          set: { triagePrefs: input.prefs, updatedAt: new Date() },
        });
      return { ok: true as const };
    }),

  setShortcuts: protectedProcedure
    .input(z.object({ shortcuts: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userPreferences)
        .values({ tenantId: ctx.session.user.id, shortcuts: input.shortcuts })
        .onConflictDoUpdate({
          target: userPreferences.tenantId,
          set: { shortcuts: input.shortcuts, updatedAt: new Date() },
        });
      return { ok: true as const };
    }),
});
