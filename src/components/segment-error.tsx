"use client";

import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

/**
 * Shared `error.tsx` boundary for dashboard segments. Each segment's error.tsx
 * re-exports this as its default so a thrown render/query error shows a recover
 * action instead of crashing the whole dashboard.
 */
export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          {error.message || "This view failed to load."}
        </EmptyDescription>
      </EmptyHeader>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </Empty>
  );
}
