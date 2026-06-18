"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppSidebar } from "~/components/app-sidebar";
import { CommandPalette } from "~/components/command-palette";
import { ConnectGate } from "~/components/connect-gate";
import { PageTransition } from "~/components/page-transition";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const {
    data: status,
    isPending: statusPending,
    error: statusError,
  } = api.connections.status.useQuery(undefined, {
    enabled: Boolean(session?.user),
    retry: false,
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

  if (sessionPending || (session && statusPending)) {
    return <div className="bg-background min-h-svh" />;
  }

  if (!session?.user) {
    return <div className="bg-background min-h-svh" />;
  }

  if (!status?.gmail || !status?.googlecalendar) {
    return (
      <ConnectGate
        status={{
          gmail: Boolean(status?.gmail),
          googlecalendar: Boolean(status?.googlecalendar),
        }}
      />
    );
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.image ?? "",
  };

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
        <PageTransition>{children}</PageTransition>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
