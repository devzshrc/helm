"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "~/components/ui/button";

export default function WorkflowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workflows]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-xl">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <p className="text-lg font-semibold">
          Workflow editor failed to render
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          {error.message ||
            "The workflow editor hit an unexpected client error."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
