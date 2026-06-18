"use client";

import { CalendarDays, Mail, PlugZap } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

type Plugin = "gmail" | "googlecalendar";

const META: Record<Plugin, { label: string; icon: typeof Mail }> = {
  gmail: { label: "Gmail", icon: Mail },
  googlecalendar: { label: "Google Calendar", icon: CalendarDays },
};

export function ConnectionRequired({
  plugins,
  title = "Connect your workspace",
  description = "Helm needs access before it can answer this request.",
  actionLabel = "Connect",
  compact = false,
  className,
}: {
  plugins: Plugin[];
  title?: string;
  description?: string;
  actionLabel?: "Connect" | "Reconnect";
  compact?: boolean;
  className?: string;
}) {
  const unique = [...new Set(plugins)];
  return (
    <div
      className={cn(
        "bg-background rounded-md border p-4 text-sm shadow-[0_2px_2px_rgba(0,0,0,0.04)]",
        compact && "p-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
          <PlugZap className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unique.map((plugin) => {
              const Icon = META[plugin].icon;
              return (
                <Button
                  key={plugin}
                  size="sm"
                  render={<a href={`/api/corsair/connect?plugin=${plugin}`} />}
                >
                  <Icon className="size-3.5" />
                  {actionLabel} {META[plugin].label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
