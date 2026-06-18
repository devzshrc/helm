"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppSidebar } from "~/components/app-sidebar";
import { CommandPalette } from "~/components/command-palette";
import { ConnectGate } from "~/components/connect-gate";
import { HelmMark } from "~/components/helm-mark";
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
    return (
      <DashboardLoading
        label={
          sessionPending
            ? "Checking your session"
            : "Checking Gmail and Calendar"
        }
      />
    );
  }

  if (!session?.user) {
    return <DashboardLoading label="Redirecting to sign in" />;
  }

  if (!status) {
    return <DashboardLoading label="Checking Gmail and Calendar" />;
  }

  if (!status?.gmail || !status?.googlecalendar) {
    return <ConnectGate status={status} />;
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

function DashboardLoading({ label }: { label: string }) {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <HelmMark className="size-12" />
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Preparing your workspace.
          </p>
        </div>
        <div className="w-full space-y-2">
          <div className="bg-muted h-3 animate-pulse rounded-full" />
          <div className="bg-muted/70 mx-auto h-3 w-4/5 animate-pulse rounded-full" />
          <div className="bg-muted/50 mx-auto h-3 w-2/3 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}
