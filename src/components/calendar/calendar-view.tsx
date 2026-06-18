"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { api } from "~/trpc/react";
import { useRealtime, type RealtimePayload } from "~/hooks/use-realtime";
import { useSyncCursor } from "~/hooks/use-sync-cursor";
import { cn } from "~/lib/utils";
import type { CalEvent } from "~/server/calendar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Calendar } from "~/components/ui/calendar";
import {
  EventSheet,
  type EventInitial,
} from "~/components/calendar/event-sheet";
import { MonthGrid } from "~/components/calendar/month-grid";
import { TimeGrid } from "~/components/calendar/time-grid";
import { AgendaView } from "~/components/calendar/agenda-view";
import { ConciergePanel } from "~/components/calendar/concierge-panel";
import { ConnectionRequired } from "~/components/connection-required";

type View = "month" | "week" | "day" | "agenda";
const VIEWS: View[] = ["month", "week", "day", "agenda"];

export function CalendarView() {
  const utils = api.useUtils();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<EventInitial | null>(null);
  const [showMini, setShowMini] = useState(false);

  // Quick-add bar
  const [quickText, setQuickText] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  // Filters
  const [q, setQ] = useState("");
  const [hideAllDay, setHideAllDay] = useState(false);
  const [withGuests, setWithGuests] = useState(false);

  // Bulk selection (agenda)
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Live-refresh on calendar webhooks.
  // On eventDeleted we can remove by id without a network round-trip.
  const queryClient = useQueryClient();
  const calListKey = getQueryKey(api.calendar.list);
  useRealtime((payload: RealtimePayload) => {
    if (
      payload.plugin === "googlecalendar" &&
      payload.meta?.action === "deleted" &&
      payload.meta.eventId
    ) {
      const delId = payload.meta.eventId;
      queryClient.setQueriesData<CalEvent[]>({ queryKey: calListKey }, (old) =>
        old ? old.filter((e) => e.id !== delId) : old,
      );
    } else {
      void utils.calendar.list.invalidate();
    }
  });

  // Webhook-driven refresh (no interval polling): refetch the calendar only
  // when a webhook actually landed, signalled by the cheap change cursor.
  useSyncCursor(() => void utils.calendar.list.invalidate());

  // Keyboard shortcut: "n" focuses quick-add
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        quickRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const range = useMemo(() => {
    switch (view) {
      case "month":
        return {
          start: startOfWeek(startOfMonth(cursor)),
          end: endOfWeek(endOfMonth(cursor)),
        };
      case "week":
        return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
      case "day":
        return { start: startOfDay(cursor), end: endOfDay(cursor) };
      case "agenda":
        return { start: startOfDay(cursor), end: addDays(cursor, 30) };
    }
  }, [view, cursor]);

  const events = api.calendar.list.useQuery(
    {
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
    },
    // No interval or focus polling — refreshed via the webhook change cursor
    // and explicit user actions.
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      placeholderData: (previous) => previous,
    },
  );
  const del = api.calendar.delete.useMutation();
  const parse = api.calendar.parse.useMutation();

  const data = useMemo(() => {
    const all = events.data ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((e) => {
      if (hideAllDay && e.allDay) return false;
      if (withGuests && e.attendees.length === 0) return false;
      if (
        needle &&
        !`${e.summary} ${e.location ?? ""}`.toLowerCase().includes(needle)
      )
        return false;
      return true;
    });
  }, [events.data, q, hideAllDay, withGuests]);

  // Days with events — for mini calendar dot highlights
  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of events.data ?? []) {
      if (e.start) set.add(e.start.slice(0, 10));
    }
    return set;
  }, [events.data]);

  const title = useMemo(() => {
    switch (view) {
      case "month":
        return format(cursor, "MMMM yyyy");
      case "week": {
        const s = startOfWeek(cursor);
        const e = endOfWeek(cursor);
        return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
      }
      case "day":
        return format(cursor, "EEEE, MMMM d");
      case "agenda": {
        const e = addDays(cursor, 30);
        return `${format(cursor, "MMM")} – ${format(e, "MMM yyyy")}`;
      }
    }
  }, [view, cursor]);

  function shift(dir: 1 | -1) {
    setCursor((c) => {
      if (view === "month") return addMonths(c, dir);
      if (view === "week") return addWeeks(c, dir);
      if (view === "day") return addDays(c, dir);
      return addDays(c, dir * 30);
    });
  }

  function changeView(v: View) {
    setView(v);
    if (v !== "agenda") {
      setSelectMode(false);
      setSelected(new Set());
    }
  }

  function openEvent(e: CalEvent) {
    setInitial({
      id: e.id,
      summary: e.summary,
      start: e.start ?? new Date().toISOString(),
      end: e.end ?? new Date().toISOString(),
      allDay: e.allDay,
      attendees: e.attendees.map((a) => a.email),
      attendeeStatuses: Object.fromEntries(
        e.attendees
          .filter((a) => a.responseStatus)
          .map((a) => [a.email, a.responseStatus!]),
      ),
      location: e.location,
      description: e.description,
    });
    setOpen(true);
  }

  function openBlank(at?: Date) {
    const start = at ?? new Date(Math.ceil(Date.now() / 1800000) * 1800000);
    const end = new Date(start.getTime() + 30 * 60000);
    setInitial({
      summary: "",
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setOpen(true);
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = quickText.trim();
    if (!text) {
      openBlank();
      return;
    }
    setQuickLoading(true);
    try {
      const draft = await parse.mutateAsync({
        text,
        nowISO: new Date().toISOString(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setInitial({
        summary: draft.summary,
        start: draft.start,
        end: draft.end,
        location: draft.location,
        description: draft.description,
      });
    } catch {
      setInitial({
        summary: text,
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      });
    } finally {
      setQuickLoading(false);
      setQuickText("");
      setOpen(true);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => del.mutateAsync({ id })));
      await utils.calendar.list.invalidate();
      toast.success(
        `Deleted ${ids.length} event${ids.length === 1 ? "" : "s"}`,
      );
      setSelected(new Set());
      setSelectMode(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete events");
    }
  }

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) }),
    [cursor],
  );
  const nextEvent = data.find(
    (event) => event.start && new Date(event.start) >= new Date(),
  );

  return (
    <div className="grid h-full min-h-0 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="bg-card/30 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date())}
          >
            Today
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => shift(-1)}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => shift(1)}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="ml-1 min-w-0 flex-1 truncate text-lg font-semibold">
            {title}
            {events.isFetching && (
              <Spinner className="text-muted-foreground ml-2 inline size-3 align-middle" />
            )}
          </h2>

          {/* Mini calendar toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowMini((v) => !v)}
            aria-label="Toggle mini calendar"
            aria-pressed={showMini}
          >
            <CalendarDays className="h-4 w-4" />
          </Button>

          {/* View switcher */}
          <div
            role="tablist"
            aria-label="Calendar view"
            className="bg-muted/40 flex items-center rounded-lg border p-0.5"
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => changeView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  view === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Quick-add form */}
          <form onSubmit={handleQuickAdd} className="flex items-center gap-1">
            <div className="relative">
              <Input
                ref={quickRef}
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder='Quick add… (press "n")'
                className="h-8 w-52 pr-8 text-xs"
              />
              {quickLoading && (
                <Spinner className="text-muted-foreground absolute top-1/2 right-2 size-3 -translate-y-1/2" />
              )}
            </div>
            <Button size="sm" type="submit" disabled={quickLoading}>
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add</span>
            </Button>
          </form>
        </div>

        {/* Mini calendar */}
        {showMini && (
          <div className="border-b px-3 py-2">
            <Calendar
              mode="single"
              selected={cursor}
              onSelect={(d) => {
                if (d) {
                  setCursor(d);
                  if (view === "month" || view === "agenda") changeView("day");
                }
              }}
              modifiers={{
                hasEvent: (d) => eventDays.has(format(d, "yyyy-MM-dd")),
              }}
              modifiersClassNames={{
                hasEvent: "font-bold underline decoration-primary/60",
              }}
              className="p-0"
            />
          </div>
        )}

        {/* Filter + bulk-action bar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div className="relative min-w-40 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter events…"
              className="h-8 pl-8"
            />
          </div>
          <FilterChip
            active={hideAllDay}
            onClick={() => setHideAllDay((v) => !v)}
          >
            Hide all-day
          </FilterChip>
          <FilterChip
            active={withGuests}
            onClick={() => setWithGuests((v) => !v)}
          >
            With guests
          </FilterChip>

          {view === "agenda" &&
            (selectMode ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {selected.size} selected
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selected.size === 0 || del.isPending}
                  onClick={bulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectMode(false);
                    setSelected(new Set());
                  }}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setSelectMode(true)}
              >
                Select
              </Button>
            ))}
        </div>

        {/* Active view */}
        <div className="min-h-0 flex-1">
          {events.error ? (
            events.error.data?.code === "PRECONDITION_FAILED" ? (
              <ConnectionRequired
                className="m-3"
                compact
                plugins={["googlecalendar"]}
                title="Reconnect Google Calendar"
                description={events.error.message}
                actionLabel="Reconnect"
              />
            ) : (
              <div className="border-destructive/30 bg-destructive/10 m-3 rounded-md border p-3 text-sm">
                <p className="font-medium">Calendar sync issue</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {events.error.message}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void events.refetch()}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md border px-2.5 py-1 text-xs transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )
          ) : null}
          {view === "month" && (
            <MonthGrid
              cursor={cursor}
              events={data}
              onOpenEvent={openEvent}
              onCreateAt={openBlank}
            />
          )}
          {view === "week" && (
            <TimeGrid
              days={weekDays}
              events={data}
              onOpenEvent={openEvent}
              onCreateAt={openBlank}
            />
          )}
          {view === "day" && (
            <TimeGrid
              days={[cursor]}
              events={data}
              onOpenEvent={openEvent}
              onCreateAt={openBlank}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              events={data}
              onOpenEvent={openEvent}
              selectable={selectMode}
              selected={selected}
              onToggleSelect={toggleSelect}
            />
          )}
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col gap-3 xl:flex">
        <div className="bg-background rounded-xl border p-3">
          <p className="text-sm font-semibold">Meeting prep</p>
          {nextEvent ? (
            <div className="mt-3 space-y-2">
              <p className="truncate text-sm font-medium">
                {nextEvent.summary}
              </p>
              <p className="text-muted-foreground text-xs">
                {nextEvent.start
                  ? new Date(nextEvent.start).toLocaleString()
                  : "Time TBD"}
              </p>
              <div className="bg-muted/20 rounded-lg border p-2 text-xs">
                <p className="font-medium">Prep prompts</p>
                <ul className="text-muted-foreground mt-1 list-inside list-disc space-y-1">
                  <li>Review related email before joining.</li>
                  <li>Confirm attendees and location.</li>
                  <li>Draft follow-up notes after the meeting.</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground mt-3 text-sm">
              No upcoming event in this view.
            </p>
          )}
        </div>
        <div className="bg-background min-h-0 flex-1 rounded-xl border p-3">
          <ConciergePanel />
        </div>
      </aside>

      <EventSheet open={open} onOpenChange={setOpen} initial={initial} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-foreground/20 bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
