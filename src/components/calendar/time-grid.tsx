"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";

import { cn } from "~/lib/utils";
import type { CalEvent } from "~/server/calendar";
import { eventColor } from "~/components/calendar/event-colors";

const HOUR_H = 40; // px per hour (tighter for more visible hours)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function gmtLabel(): string {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const h = Math.floor(Math.abs(off) / 60);
  const m = Math.abs(off) % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export function TimeGrid({
  days,
  events,
  onOpenEvent,
  onCreateAt,
}: {
  days: Date[];
  events: CalEvent[];
  onOpenEvent: (e: CalEvent) => void;
  onCreateAt: (d: Date) => void;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const { timed, allDay } = useMemo(() => {
    const timed: CalEvent[] = [];
    const allDay: CalEvent[] = [];
    for (const e of events) {
      if (!e.start) continue;
      (e.allDay ? allDay : timed).push(e);
    }
    return { timed, allDay };
  }, [events]);

  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR_H / 60);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day header */}
      <div
        className="grid shrink-0 border-b"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, 1fr)` }}
      >
        <div className="text-muted-foreground grid place-items-center py-2 text-[11px]">
          {gmtLabel()}
        </div>
        {days.map((d) => {
          const isWknd = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "border-l py-2 text-center",
                isWknd && "bg-muted/25 dark:bg-muted/10",
              )}
            >
              <div className="text-muted-foreground text-xs">
                {format(d, "EEE")}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm",
                  isToday(d)
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "font-medium",
                )}
              >
                {format(d, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div
        className="grid shrink-0 border-b"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, 1fr)` }}
      >
        <div className="text-muted-foreground grid place-items-center py-1 text-[10px]">
          All day
        </div>
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className="min-h-8 space-y-0.5 border-l p-1"
          >
            {allDay
              .filter((e) => e.start && isSameDay(new Date(e.start), d))
              .map((e) => {
                const c = eventColor(e.id || e.summary);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpenEvent(e)}
                    className={cn(
                      "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]",
                      c.block,
                    )}
                  >
                    {e.summary || "(no title)"}
                  </button>
                );
              })}
          </div>
        ))}
      </div>

      {/* Scrollable hour grid */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `4rem repeat(${days.length}, 1fr)`,
            height: `${24 * HOUR_H}px`,
          }}
        >
          {/* Hour gutter */}
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[10px]"
                style={{ top: `${h * HOUR_H}px` }}
              >
                {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const dayEvents = timed.filter(
              (e) => e.start && isSameDay(new Date(e.start), d),
            );
            const isNowDay = isToday(d);
            const isWkndCol = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "relative border-l",
                  isWkndCol && "bg-muted/20 dark:bg-muted/10",
                  isNowDay && "bg-primary/[0.02]",
                )}
              >
                {/* Hour lines + click-to-create */}
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      onCreateAt(
                        new Date(
                          d.getFullYear(),
                          d.getMonth(),
                          d.getDate(),
                          h,
                          0,
                        ),
                      )
                    }
                    className="border-border/60 hover:bg-accent/30 absolute inset-x-0 border-b transition-colors"
                    style={{ top: `${h * HOUR_H}px`, height: `${HOUR_H}px` }}
                  />
                ))}
                {/* Current time indicator */}
                {isNowDay && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: `${nowTop}px` }}
                  >
                    <span className="absolute right-full pr-1 text-[10px] leading-none font-medium text-red-500 tabular-nums">
                      {format(now, "h:mm")}
                    </span>
                    <div className="size-2 rounded-full bg-red-500" />
                    <div className="h-px flex-1 bg-red-500" />
                  </div>
                )}
                {/* Events */}
                {dayEvents.map((e) => {
                  const start = new Date(e.start!);
                  const end = e.end
                    ? new Date(e.end)
                    : new Date(start.getTime() + 30 * 60000);
                  const top =
                    (start.getHours() * 60 + start.getMinutes()) *
                    (HOUR_H / 60);
                  const mins = Math.max(
                    24,
                    (end.getTime() - start.getTime()) / 60000,
                  );
                  const height = mins * (HOUR_H / 60);
                  const c = eventColor(e.id || e.summary);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onOpenEvent(e)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm",
                        c.block,
                      )}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <span className="block truncate font-medium">
                        {e.summary || "(no title)"}
                      </span>
                      <span className="block truncate opacity-75">
                        {format(start, "h:mm a")} – {format(end, "h:mm a")}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
