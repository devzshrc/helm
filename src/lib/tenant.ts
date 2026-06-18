import "server-only";

import { getSession } from "~/server/better-auth/server";

/**
 * The Corsair tenant id for the current request = the authenticated user id.
 * All Corsair reads/writes are scoped through this so no user can touch
 * another tenant's mailbox or calendar.
 */
export async function getTenantId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session.user.id;
}
