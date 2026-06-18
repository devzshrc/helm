"use client";

import { useEffect, useRef } from "react";

import { api } from "~/trpc/react";

/**
 * Poll the cheap per-tenant change cursor (`sync.cursor`) and fire `onChange`
 * only when it advances — i.e. when a Gmail/Calendar webhook actually wrote
 * new data. This replaces the heavy `refetchInterval` that previously re-ran
 * the full `mail.list` / `calendar.list` every 10-15s for every open tab
 * (the load that hammered the Worker and tripped its CPU limit). Only the
 * tiny cursor is polled; the expensive queries refetch solely on real change.
 */
export function useSyncCursor(onChange: () => void, intervalMs = 15_000) {
  const last = useRef<number | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  const { data } = api.sync.cursor.useQuery(undefined, {
    refetchInterval: intervalMs,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const cur = data?.cursor;
    if (cur == null) return;
    // First reading just seeds the baseline — don't fire on mount.
    if (last.current === null) {
      last.current = cur;
      return;
    }
    if (cur > last.current) {
      last.current = cur;
      cb.current();
    }
  }, [data?.cursor]);
}
