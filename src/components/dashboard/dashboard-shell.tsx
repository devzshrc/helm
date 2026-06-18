"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

import { AppSidebar } from "~/components/app-sidebar";
import { CommandPalette } from "~/components/command-palette";
import { ConnectGate } from "~/components/connect-gate";
import { PageTransition } from "~/components/page-transition";
import { InboxRouteSkeleton } from "~/components/route-skeletons";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const {
    data: status,
    isPending: statusPending,
    error: statusError,
  } = api.connections.status.useQuery(undefined, {
    enabled: Boolean(session?.user),
    retry: false,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace("/login");
    }
  }, [router, session, sessionPending]);

  useEffect(() => {
    if (statusError?.data?.code === "UNAUTHORIZED") {
      router.replace("/login");
    }
  }, [router, statusError]);

  useEffect(() => {
    if (!session?.user || !status?.gmail || !status?.googlecalendar) return;
    const now = new Date();
    const calendarRange = {
      timeMin: startOfWeek(startOfMonth(now)).toISOString(),
      timeMax: endOfWeek(endOfMonth(now)).toISOString(),
    };
    void utils.mail.list.prefetch({ limit: 25 });
    void utils.mail.list.prefetch({ labelIds: ["SENT"], limit: 25 });
    void utils.mail.list.prefetch({ labelIds: ["STARRED"], limit: 25 });
    void utils.mail.list.prefetch({ labelIds: ["TRASH"], limit: 25 });
    void utils.calendar.list.prefetch(calendarRange);
    void utils.dashboard.summary.prefetch();
    void utils.workflows.list.prefetch();
    void utils.agent.sessions.list.prefetch();
    void utils.preferences.get.prefetch();
  }, [session?.user, status?.gmail, status?.googlecalendar, utils]);

  if (sessionPending) {
    return (
      <DashboardChrome>
        <InboxRouteSkeleton withHeader={false} />
      </DashboardChrome>
    );
  }

  if (!session?.user) {
    return (
      <DashboardChrome>
        <InboxRouteSkeleton withHeader={false} />
      </DashboardChrome>
    );
  }

  if (!statusPending && status && (!status.gmail || !status.googlecalendar)) {
    return <ConnectGate status={status} />;
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.image ?? "",
  };

  return (
    <DashboardChrome user={user}>
      <PageTransition>{children}</PageTransition>
      {statusPending ? (
        <div className="text-muted-foreground bg-background/90 pointer-events-none fixed top-3 right-4 z-50 rounded-full border px-3 py-1 text-xs shadow-sm backdrop-blur">
          Checking integrations…
        </div>
      ) : null}
    </DashboardChrome>
  );
}

function DashboardChrome({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: { name: string; email: string; avatar: string };
}) {
  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} />
      <SidebarInset className="min-w-0 overflow-hidden">
        {children}
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
