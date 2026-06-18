import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { MastraAgent } from "@ag-ui/mastra";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "~/server/better-auth";
import { createMastra } from "~/lib/mastra/runtime";
import { rateLimit, tooMany } from "~/server/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_PATH = "/api/copilotkit";

async function handle(req: Request): Promise<Response> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const tenantId = session?.user?.id;
    if (!tenantId) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (req.method === "POST") {
      const rl = await rateLimit(`copilot:${tenantId}`, 40, 60_000);
      if (!rl.ok) return tooMany(rl.retryAfterMs);
    }

    const requestContext = new RequestContext();
    requestContext.set("tenantId", tenantId);
    requestContext.set("userId", tenantId);
    requestContext.set("now", new Date().toISOString());

    const { mastra } = createMastra();
    const agents = {
      default: MastraAgent.getLocalAgent({
        mastra,
        agentId: "default",
        resourceId: tenantId,
        requestContext,
      }),
    };

    const runtime = new CopilotRuntime({
      agents,
      a2ui: {},
    });

    const handler = createCopilotRuntimeHandler({
      runtime,
      basePath: BASE_PATH,
      mode: "single-route",
    });
    return await handler(req);
  } catch (err) {
    // Never let an init/handler throw bubble up as an unhandled crash — that
    // surfaces in the client as an opaque "Failed to fetch" / runtime_info_
    // fetch_failed. Return a structured 500 the CopilotKit client can read.
    console.error("[copilotkit] handler error:", err);
    return new Response(
      JSON.stringify({
        error: "runtime_error",
        message: err instanceof Error ? err.message : "Agent runtime failed.",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
