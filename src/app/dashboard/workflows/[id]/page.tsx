import { SiteHeader } from "~/components/site-header";
import { WorkflowEditor } from "~/components/workflows/workflow-editor";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <SiteHeader title="Workflow" />
      <div className="overflow-y-auto">
        <WorkflowEditor id={id} />
      </div>
    </>
  );
}
