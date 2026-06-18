"use client";

import { CopilotProviders } from "~/app/providers";
import { AgentChat } from "~/components/agent/agent-chat";

export function AgentShell() {
  return (
    <CopilotProviders>
      <AgentChat />
    </CopilotProviders>
  );
}
