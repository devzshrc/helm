"use client";

import dynamic from "next/dynamic";

const InboxWorkspace = dynamic(
  () =>
    import("~/components/inbox/inbox-workspace").then(
      (module) => module.InboxWorkspace,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[60vh] flex-col gap-4 p-4 md:p-6">
        <div className="bg-muted h-10 w-56 animate-pulse rounded-md" />
        <div className="grid min-h-[50vh] grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="bg-card/50 rounded-lg border" />
          <div className="bg-card/50 rounded-lg border" />
        </div>
      </div>
    ),
  },
);

export function InboxWorkspaceBoundary() {
  return <InboxWorkspace />;
}
