"use client";

import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { CalendarDays, Check } from "lucide-react";

import { cn } from "~/lib/utils";
import type { CalEvent } from "~/server/calendar";
import { eventColor } from "~/components/calendar/event-colors";

export function AgendaView({
  events,
  onOpenEvent,
  selectable = false,
  selected,
  onToggleSelect,
}: {
  events: CalEvent[];
  onOpenEvent: (e: CalEvent) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!e.start) continue;
      const k = format(new Date(e.start), "yyyy-MM-dd");
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, evs]) => ({
        date: new Date(`${k}T00:00:00`),
        events: evs.sort((a, b) =>
          (a.start ?? "").localeCompare(b.start ?? ""),
        ),
      }));
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <CalendarDays className="text-muted-foreground/30 size-8" />
        <p className="text-muted-foreground text-sm">
          Nothing scheduled in this range.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
        {groups.map(({ date, events }) => (
          <div key={date.toISOString()} className="flex flex-col gap-2">
            <div className="bg-background/95 sticky top-0 z-10 flex items-center gap-2 py-1 backdrop-blur">
              <div
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
                  isToday(date)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {format(date, "d")}
              </div>
              <span className="text-xs font-medium">
                {isToday(date) ? "Today" : format(date, "EEE, MMM d")}
              </span>
              {isToday(date) && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  Today
                </span>
              )}
            </div>
            {events.map((e) => {
              const c = eventColor(e.id || e.summary);
              const time = e.allDay
                ? "All day"
                : e.start
                  ? `${format(new Date(e.start), "h:mm a")}${
                      e.end ? ` – ${format(new Date(e.end), "h:mm a")}` : ""
                    }`
                  : "";
              const isSel = selected?.has(e.id) ?? false;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    selectable ? onToggleSelect?.(e.id) : onOpenEvent(e)
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:opacity-90 hover:shadow-sm active:scale-[0.99]",
                    c.block,
                    selectable && isSel && "ring-primary/60 ring-2",
                  )}
                >
                  {selectable ? (
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border",
                        isSel
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/30",
                      )}
                    >
                      {isSel ? <Check className="size-3.5" /> : null}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {e.summary || "(no title)"}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-75">
                      {time}
                      {e.location ? ` · ${e.location}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
