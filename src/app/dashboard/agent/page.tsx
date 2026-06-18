import { AgentShellBoundary } from "~/components/agent/agent-shell-boundary";
import { SiteHeader } from "~/components/site-header";

export default function AgentPage() {
  return (
    <>
      <SiteHeader title="Agent" />
      <AgentShellBoundary />
    </>
  );
}
