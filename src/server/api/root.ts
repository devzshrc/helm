import { agentRouter } from "~/server/api/routers/agent";
import { calendarRouter } from "~/server/api/routers/calendar";
import { conciergeRouter } from "~/server/api/routers/concierge";
import { connectionsRouter } from "~/server/api/routers/connections";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { mailRouter } from "~/server/api/routers/mail";
import { preferencesRouter } from "~/server/api/routers/preferences";
import { searchRouter } from "~/server/api/routers/search";
import { syncRouter } from "~/server/api/routers/sync";
import { workflowsRouter } from "~/server/api/routers/workflows";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  connections: connectionsRouter,
  dashboard: dashboardRouter,
  search: searchRouter,
  mail: mailRouter,
  calendar: calendarRouter,
  agent: agentRouter,
  concierge: conciergeRouter,
  preferences: preferencesRouter,
  sync: syncRouter,
  workflows: workflowsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.connections.status();
 */
export const createCaller = createCallerFactory(appRouter);
