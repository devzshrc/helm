"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/components/ui/skeleton";

const AgentShell = dynamic(
  () => import("~/components/agent/agent-shell").then((mod) => mod.AgentShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    ),
  },
);

export function AgentShellBoundary() {
  return <AgentShell />;
}
