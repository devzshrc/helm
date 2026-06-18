"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Item, ItemContent, ItemMedia, ItemTitle } from "~/components/ui/item";
import { Badge } from "~/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  LinkIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";

type Status = { gmail: boolean; googlecalendar: boolean };

export function IntegrationsSection({ status }: { status: Status }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const disconnect = api.connections.disconnect.useMutation();

  function handleDisconnect(plugin: "gmail" | "googlecalendar") {
    disconnect.mutate(
      { plugin },
      {
        onSuccess: () => {
          toast.success(
            `Disconnected ${
              plugin === "gmail"
                ? "Gmail"
                : "Google Calendar"
            }`,
          );
          startTransition(() => router.refresh());
        },
        onError: () => {
          toast.error("Failed to disconnect. Please try again.");
        },
      },
    );
  }

  function row(
    label: string,
    icon: typeof Mail01Icon,
    connected: boolean,
    plugin: "gmail" | "googlecalendar",
  ) {
    return (
      <Item variant="outline" key={plugin}>
        <ItemMedia>
          <HugeiconsIcon icon={icon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{label}</ItemTitle>
        </ItemContent>
        {connected ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className="size-3 text-green-600"
              />
              Connected
            </Badge>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleDisconnect(plugin)}
              disabled={disconnect.isPending}
              aria-label={`Disconnect ${label}`}
            >
              <HugeiconsIcon
                icon={Unlink01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            render={<a href={`/api/corsair/connect?plugin=${plugin}`} />}
          >
            <HugeiconsIcon
              icon={LinkIcon}
              strokeWidth={2}
              className="size-3.5"
            />
            Connect
          </Button>
        )}
      </Item>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your connected integrations. Disconnecting will stop syncing
            data from that service.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {row("Gmail", Mail01Icon, status.gmail, "gmail")}
          {row(
            "Google Calendar",
            Calendar03Icon,
            status.googlecalendar,
            "googlecalendar",
          )}
        </CardContent>
      </Card>
    </div>
  );
}
