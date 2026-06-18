"use client";

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
} from "@hugeicons/core-free-icons";

type Status = { gmail: boolean; googlecalendar: boolean };

function ConnectRow({
  icon,
  label,
  connected,
  plugin,
}: {
  icon: typeof Mail01Icon;
  label: string;
  connected: boolean;
  plugin: string;
}) {
  return (
    <Item variant="outline">
      <ItemMedia>
        <HugeiconsIcon icon={icon} strokeWidth={2} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
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
          Connect
        </Button>
      )}
    </Item>
  );
}

export function ConnectGate({ status }: { status: Status }) {
  const allConnected = status.gmail && status.googlecalendar;

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <HelmMark className="mx-auto mb-2 size-12" />
          <CardTitle className="text-xl">Connect {BRAND}</CardTitle>
          <CardDescription>{BRAND_TAGLINE}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ConnectRow
            icon={Mail01Icon}
            label="Gmail"
            connected={status.gmail}
            plugin="gmail"
          />
          <ConnectRow
            icon={Calendar03Icon}
            label="Google Calendar"
            connected={status.googlecalendar}
            plugin="googlecalendar"
          />
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
