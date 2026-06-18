import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { IntegrationHealth } from "~/lib/integration-health";
import {
  corsairAccounts,
  corsairIntegrations,
  webhookSubscriptions,
} from "~/server/db/schema";
import { isMissingRelationError } from "~/server/db/errors";
import { log } from "~/server/logger";

type WebhookSubscriptionStatus = {
  plugin: string;
  status: string;
  expiresAt: Date | null;
};

/**
 * Reports which Corsair plugins the current tenant (= user id) has connected.
 * Drives the dashboard connect gate.
 */
export const connectionsRouter = createTRPCRouter({
  status: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.session.user.id;

    const rows = await ctx.db
      .select({
        name: corsairIntegrations.name,
        config: corsairAccounts.config,
      })
      .from(corsairAccounts)
      .innerJoin(
        corsairIntegrations,
        eq(corsairAccounts.integrationId, corsairIntegrations.id),
      )
      .where(eq(corsairAccounts.tenantId, tenantId));

    let subscriptions: WebhookSubscriptionStatus[] = [];
    try {
      subscriptions = await ctx.db
        .select({
          plugin: webhookSubscriptions.plugin,
          status: webhookSubscriptions.status,
          expiresAt: webhookSubscriptions.expiresAt,
        })
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.tenantId, tenantId));
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
      log.warn(
        "webhook_subscriptions table is missing; run `bun run db:migrate` to enable webhook health metadata.",
      );
    }

    const accountHealth = (plugin: "gmail" | "googlecalendar"): IntegrationHealth => {
      const row = rows.find((r) => r.name === plugin);
      const config =
        row?.config && typeof row.config === "object"
          ? (row.config as Record<string, unknown>)
          : {};
      const sub = subscriptions.find((s) => s.plugin === plugin);
      return {
        connected: Boolean(row),
        healthy: Boolean(row),
        externalAccountId:
          typeof config.externalAccountId === "string"
            ? config.externalAccountId
            : typeof config.externalEmail === "string"
              ? config.externalEmail
              : null,
        status:
          sub?.status ??
          (typeof config.webhookStatus === "string"
            ? config.webhookStatus
            : "unknown"),
        webhookStatus:
          sub?.status ??
          (typeof config.webhookStatus === "string"
            ? config.webhookStatus
            : "unknown"),
        expiresAt: sub?.expiresAt ?? null,
      };
    };

    const gmail = accountHealth("gmail");
    const googlecalendar = accountHealth("googlecalendar");
    return {
      gmail: gmail.connected && gmail.healthy,
      googlecalendar: googlecalendar.connected && googlecalendar.healthy,
      integrations: {
        gmail,
        googlecalendar,
      },
      webhooks: {
        gmail,
        googlecalendar,
      },
    };
  }),

  disconnect: protectedProcedure
    .input(z.object({ plugin: z.enum(["gmail", "googlecalendar"]) }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;

      const integration = await ctx.db
        .select({ id: corsairIntegrations.id })
        .from(corsairIntegrations)
        .where(eq(corsairIntegrations.name, input.plugin))
        .then((r) => r[0]);

      if (!integration) return { ok: false as const };

      await ctx.db
        .delete(corsairAccounts)
        .where(
          and(
            eq(corsairAccounts.tenantId, tenantId),
            eq(corsairAccounts.integrationId, integration.id),
          ),
        );

      return { ok: true as const };
    }),
});
