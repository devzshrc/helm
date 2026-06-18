"use client";

import dynamic from "next/dynamic";

import { InboxRouteSkeleton } from "~/components/route-skeletons";

const InboxWorkspace = dynamic(
  () =>
    import("~/components/inbox/inbox-workspace").then(
      (module) => module.InboxWorkspace,
    ),
  {
    ssr: false,
    loading: () => <InboxRouteSkeleton withHeader={false} />,
  },
);

export function InboxWorkspaceBoundary() {
  return <InboxWorkspace />;
}
