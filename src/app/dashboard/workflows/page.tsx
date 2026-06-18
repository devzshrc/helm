import { SiteHeader } from "~/components/site-header";
import { WorkflowsList } from "~/components/workflows/workflows-list";
import { api, HydrateClient } from "~/trpc/server";

export default function WorkflowsPage() {
  // Prefetch on the server so the client list reads hydrated cache — no
  // post-mount fetch flash. (Key matches the no-input useQuery in WorkflowsList.)
  void api.workflows.list.prefetch();
  return (
    <HydrateClient>
      <SiteHeader title="Workflows" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <WorkflowsList />
      </div>
    </HydrateClient>
  );
}
