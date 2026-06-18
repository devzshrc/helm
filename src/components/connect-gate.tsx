"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import type { IntegrationHealth } from "~/lib/integration-health";
import { api } from "~/trpc/react";
import { BRAND, BRAND_TAGLINE } from "~/lib/brand";
import { HelmMark } from "~/components/helm-mark";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Item, ItemContent, ItemMedia, ItemTitle } from "~/components/ui/item";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";

type Status = {
  gmail: boolean;
  googlecalendar: boolean;
  integrations?: {
    gmail: IntegrationHealth;
    googlecalendar: IntegrationHealth;
  };
};

function ConnectRow({
  step,
  icon,
  label,
  health,
  plugin,
}: {
  step: number;
  icon: typeof Mail01Icon;
  label: string;
  health: IntegrationHealth;
  plugin: string;
}) {
  const connected = health.connected && health.healthy;
  const needsReconnect =
    health.connected && !health.healthy && health.repairAction === "reconnect";
  return (
    <Item variant="outline" className="items-start">
      <ItemMedia>
        {connected ? (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="text-green-600"
          />
        ) : needsReconnect ? (
          <HugeiconsIcon
            icon={AlertCircleIcon}
            strokeWidth={2}
            className="text-amber-600"
          />
        ) : (
          <span className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-full text-xs font-semibold">
            {step}
          </span>
        )}
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
          {label}
        </ItemTitle>
        <p className="text-muted-foreground mt-1 text-xs">
          {connected
            ? `${label} is ready.`
            : needsReconnect
              ? `${label} needs to be reconnected.`
              : `Connect ${label} so Helm can work with your workspace.`}
        </p>
      </ItemContent>
      {connected ? (
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4 text-green-600"
          />
          Connected
        </span>
      ) : (
        <Button render={<a href={`/api/corsair/connect?plugin=${plugin}`} />}>
          {needsReconnect ? "Reconnect" : "Connect"}
        </Button>
      )}
    </Item>
  );
}

export function ConnectGate({ status }: { status: Status }) {
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const connectedPlugin = searchParams.get("connected");
  const connectError = searchParams.get("connect") === "error";
  const health = {
    gmail: status.integrations?.gmail ?? {
      connected: status.gmail,
      healthy: status.gmail,
      externalAccountId: null,
      status: "unknown",
      webhookStatus: "unknown",
      expiresAt: null,
    },
    googlecalendar: status.integrations?.googlecalendar ?? {
      connected: status.googlecalendar,
      healthy: status.googlecalendar,
      externalAccountId: null,
      status: "unknown",
      webhookStatus: "unknown",
      expiresAt: null,
    },
  };
  const allConnected = status.gmail && status.googlecalendar;

  useEffect(() => {
    if (allConnected || connectedPlugin) {
      void utils.dashboard.summary.prefetch();
      void utils.connections.status.invalidate();
    }
  }, [allConnected, connectedPlugin, utils]);

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <HelmMark className="mx-auto mb-2 size-12" />
          <CardTitle className="text-xl">Set up {BRAND}</CardTitle>
          <CardDescription>
            {BRAND_TAGLINE}. Connect Gmail and Calendar to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Item variant="outline">
            <ItemMedia>
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className="text-green-600"
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Google account</ItemTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                You are signed in. Now connect the workspace services Helm uses.
              </p>
            </ItemContent>
          </Item>
          <ConnectRow
            step={2}
            icon={Mail01Icon}
            label="Gmail"
            health={health.gmail}
            plugin="gmail"
          />
          <ConnectRow
            step={3}
            icon={Calendar03Icon}
            label="Google Calendar"
            health={health.googlecalendar}
            plugin="googlecalendar"
          />
          {connectError ? (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Connection failed. Please retry the service that is not connected.
            </div>
          ) : connectedPlugin ? (
            <div className="rounded-lg border border-green-300/60 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
              Connected{" "}
              {connectedPlugin === "gmail" ? "Gmail" : "Google Calendar"}.
            </div>
          ) : null}
          {allConnected ? (
            <Button className="mt-2 w-full" render={<a href="/dashboard" />}>
              Continue
            </Button>
          ) : (
            <p className="text-muted-foreground mt-1 text-center text-sm">
              Connect both to continue.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
