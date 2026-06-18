"use client";

import { useMemo } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { cn } from "~/lib/utils";
import type { CalEvent } from "~/server/calendar";
import { eventColor } from "~/components/calendar/event-colors";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date | string): string {
  return format(new Date(d), "yyyy-MM-dd");
}

export function MonthGrid({
  cursor,
  events,
  onOpenEvent,
  onCreateAt,
}: {
  cursor: Date;
  events: CalEvent[];
  onOpenEvent: (e: CalEvent) => void;
  onCreateAt: (d: Date) => void;
}) {
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor)),
        end: endOfWeek(endOfMonth(cursor)),
      }),
    [cursor],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!e.start) continue;
      const k = dayKey(e.start);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) ||
          (a.start ?? "").localeCompare(b.start ?? ""),
      );
    }
    return map;
  }, [events]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Weekday header */}
      <div className="grid shrink-0 grid-cols-7 border-b">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-muted-foreground px-2 py-2 text-right text-xs font-medium"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week grid — exact number of weeks so it fills height with no empty row */}
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{
          gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))`,
        }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const evs = byDay.get(dayKey(day)) ?? [];
          const shown = evs.slice(0, 3);
          const extra = evs.length - shown.length;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() =>
                onCreateAt(
                  new Date(
                    day.getFullYear(),
                    day.getMonth(),
                    day.getDate(),
                    9,
                    0,
                  ),
                )
              }
              className={cn(
                "hover:bg-accent/30 flex min-h-0 flex-col gap-1 border-r border-b p-1.5 text-left transition-colors last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground/60",
              )}
            >
              <span
                className={cn(
                  "ml-auto grid size-6 shrink-0 place-items-center rounded-full text-xs",
                  today && "bg-foreground text-background font-semibold",
                  !today &&
                    (inMonth ? "text-foreground" : "text-muted-foreground/60"),
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                {shown.map((e) => {
                  const c = eventColor(e.id || e.summary);
                  return (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onOpenEvent(e);
                      }}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[11px] leading-tight",
                        c.pill,
                      )}
                    >
                      {!e.allDay && e.start ? (
                        <span className="tabular-nums opacity-70">
                          {format(new Date(e.start), "h:mm a")}{" "}
                        </span>
                      ) : null}
                      {e.summary || "(no title)"}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span className="text-muted-foreground px-1 text-[11px]">
                    +{extra} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
