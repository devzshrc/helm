"use client";

import { useEffect, useMemo, useRef } from "react";
import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

import { api } from "~/trpc/react";
import { authClient } from "~/server/better-auth/client";

/**
 * CopilotKit provider for the Helm agent. Mounted near the root (inside the
 * tRPC provider, since the HITL approval cards call tRPC) so every agent hook
 * and chat surface has access. The runtime lives at /api/copilotkit.
 */
/**
 * Persist the browser timezone once so the server-side scheduling concierge
 * (which has no browser) can compute slots in the user's local business hours.
 * A leaf component (not the provider body) so the tRPC hook resolves the context
 * provided higher up by TRPCReactProvider.
 */
function TimezoneSync() {
  const setTimezone = api.preferences.setTimezone.useMutation({
    // Best-effort + non-blocking. Swallow errors (e.g. before the migration is
    // applied) so a failed write doesn't surface in the console.
    onError: () => undefined,
  });
  const { data: session, isPending } = authClient.useSession();
  const savedTz = useRef(false);
  useEffect(() => {
    if (savedTz.current) return;
    if (isPending || !session) return;
    savedTz.current = true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) setTimezone.mutate({ timezone: tz });
  }, [setTimezone, session, isPending]);
  return null;
}

export function CopilotProviders({ children }: { children: React.ReactNode }) {
  // Forwarded to the runtime on every run so the agent resolves times in the
  // user's zone (and stops asking about timezone).
  const properties = useMemo(
    () => ({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    [],
  );

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint
      credentials="include"
      properties={properties}
      a2ui={{
        theme: {
          colors: {
            primary: "#5468ff",
            background: "#080b12",
            surface: "#101520",
            border: "#252b38",
            text: "#f4f7fb",
          },
        },
      }}
      onError={(event) => {
        // Surfaces connection/runtime failures instead of a stuck "connecting…".
        console.error("[copilotkit]", event.type, event.error, event.context);
      }}
    >
      <TimezoneSync />
      {children}
    </CopilotKit>
  );
}
