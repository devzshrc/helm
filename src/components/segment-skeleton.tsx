import {
  AgentRouteSkeleton,
  CalendarRouteSkeleton,
  InboxRouteSkeleton,
  SettingsRouteSkeleton,
  WorkflowEditorRouteSkeleton,
  WorkflowsRouteSkeleton,
} from "~/components/route-skeletons";

/**
 * Shared `loading.tsx` body for dashboard data segments. Mirrors the page shell
 * (SiteHeader + a column of rows) so navigation paints instantly instead of a
 * blank frame while the client query resolves.
 */
export function SegmentSkeleton({ title }: { title: string }) {
  if (title === "Calendar") return <CalendarRouteSkeleton />;
  if (title === "Workflow") return <WorkflowEditorRouteSkeleton />;
  if (title === "Workflows") return <WorkflowsRouteSkeleton />;
  if (title === "Settings") return <SettingsRouteSkeleton />;
  if (title === "Agent") return <AgentRouteSkeleton />;
  return <InboxRouteSkeleton />;
}
