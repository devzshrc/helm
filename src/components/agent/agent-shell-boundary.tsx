"use client";

import dynamic from "next/dynamic";

import { AgentRouteSkeleton } from "~/components/route-skeletons";

const AgentShell = dynamic(
  () => import("~/components/agent/agent-shell").then((mod) => mod.AgentShell),
  {
    ssr: false,
    loading: () => <AgentRouteSkeleton />,
  },
);

export function AgentShellBoundary() {
  return <AgentShell />;
}
