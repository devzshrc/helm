import { SiteHeader } from "~/components/site-header";
import { WorkflowEditor } from "~/components/workflows/workflow-editor";
import { api, HydrateClient } from "~/trpc/server";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await Promise.all([
    api.workflows.get.prefetch({ id }),
    api.workflows.runs.prefetch({ workflowId: id }),
  ]);
  return (
    <HydrateClient>
      <SiteHeader title="Workflow" />
      <div className="overflow-y-auto">
        <WorkflowEditor id={id} />
      </div>
    </HydrateClient>
  );
}
