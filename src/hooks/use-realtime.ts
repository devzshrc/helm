"use client";

export type RealtimePayload = {
  tenantId?: string;
  plugin?: string;
  action?: string;
  status?: string;
  meta?: Record<string, string>;
};

/**
 * No-op on serverless (Vercel) — no persistent TCP / LISTEN-NOTIFY.
 * Live updates are delivered via `refetchInterval` on individual queries.
 */
export function useRealtime(_onUpdate: (payload: RealtimePayload) => void) {
  // intentional no-op
}
