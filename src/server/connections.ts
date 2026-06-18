import "server-only";

import { and, eq } from "drizzle-orm";

import { withCorsair } from "~/server/corsair";
import { db } from "~/server/db";
import { corsairAccounts, corsairIntegrations } from "~/server/db/schema";
import { log } from "~/server/logger";

type Plugin = "gmail" | "googlecalendar";

async function connectedAccount(plugin: Plugin, tenantId: string) {
  const [row] = await db
    .select({
      id: corsairAccounts.id,
      config: corsairAccounts.config,
    })
    .from(corsairAccounts)
    .innerJoin(
      corsairIntegrations,
      eq(corsairAccounts.integrationId, corsairIntegrations.id),
    )
    .where(
      and(
        eq(corsairIntegrations.name, plugin),
        eq(corsairAccounts.tenantId, tenantId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function recordConnectedAccountIdentity(input: {
  plugin: Plugin;
  tenantId: string;
  fallbackEmail?: string | null;
}) {
  const account = await connectedAccount(input.plugin, input.tenantId);
  if (!account) return;

  let externalEmail = input.fallbackEmail ?? null;
  if (input.plugin === "gmail") {
    try {
      const profile = await withCorsair((c) => {
        const api = c.withTenant(input.tenantId).gmail.api as {
          users?: {
            getProfile?: (
              args: Record<string, never>,
            ) => Promise<{ emailAddress?: string }>;
          };
        };
        return api.users?.getProfile?.({}) ?? Promise.resolve(undefined);
      });
      if (typeof profile?.emailAddress === "string")
        externalEmail = profile.emailAddress;
    } catch (err) {
      log.error("could not read Gmail profile after connect", {
        err: String(err),
      });
    }
  }

  const current =
    account.config && typeof account.config === "object" ? account.config : {};
  await db
    .update(corsairAccounts)
    .set({
      config: {
        ...current,
        externalEmail,
        externalAccountId: externalEmail,
        webhookStatus: "unknown",
      },
      updatedAt: new Date(),
    })
    .where(eq(corsairAccounts.id, account.id));
}
