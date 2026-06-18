import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { log } from "~/server/logger";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    // Always surface server errors (the seam where a monitor like Sentry plugs in).
    onError: ({ path, error }) => {
      log.error("trpc failed", {
        path: path ?? "<no-path>",
        code: error.code,
        message: error.message,
      });
    },
  });

export { handler as GET, handler as POST };
