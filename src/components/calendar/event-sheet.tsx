"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

import { api } from "~/trpc/react";
import { patchInList, removeFromList } from "~/lib/optimistic";
import type { CalEvent } from "~/server/calendar";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Spinner } from "~/components/ui/spinner";

export type EventInitial = {
  id?: string;
  summary: string;
  start: string; // ISO
  end: string; // ISO
  allDay?: boolean;
  attendees?: string[];
  attendeeStatuses?: Record<string, string>; // email → responseStatus
  location?: string;
  description?: string;
};

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function localToIso(local: string): string {
  const d = new Date(local);
  return isNaN(d.getTime()) ? local : d.toISOString();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RSVP_DOT: Record<string, string> = {
  accepted: "bg-emerald-500",
  declined: "bg-red-500",
  tentative: "bg-amber-400",
  needsAction: "bg-muted-foreground/50",
};

// ── Attendee tag input ────────────────────────────────────────────────────────

function AttendeeTags({
  value,
  onChange,
  statuses,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  statuses?: Record<string, string>;
}) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setInvalid(true);
      return;
    }
    if (!value.includes(email)) onChange([...value, email]);
    setDraft("");
    setInvalid(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    } else {
      setInvalid(false);
    }
  }

  function remove(email: string) {
    onChange(value.filter((e) => e !== email));
  }

  return (
    <div
      className={cn(
        "ring-offset-background focus-within:ring-ring flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none",
        invalid && "border-destructive focus-within:ring-destructive",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((email) => {
        const status = statuses?.[email];
        const dot = status ? (RSVP_DOT[status] ?? RSVP_DOT.needsAction) : null;
        return (
          <span
            key={email}
            className="bg-muted flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
          >
            {dot && (
              <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
            )}
            {email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(email);
              }}
              className="text-muted-foreground hover:text-foreground ml-0.5"
              aria-label={`Remove ${email}`}
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={onKey}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? "Add email, press Enter…" : ""}
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent text-xs outline-none"
      />
    </div>
  );
}

// ── EventSheet ────────────────────────────────────────────────────────────────

export function EventSheet({
  open,
  onOpenChange,
  initial,
  loading,
  title = "New event",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: EventInitial | null;
  loading?: boolean;
  title?: string;
}) {
  const utils = api.useUtils();
  const [id, setId] = useState<string | undefined>();
  const [summary, setSummary] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attendeeStatuses, setAttendeeStatuses] = useState<
    Record<string, string>
  >({});
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (initial) {
      setId(initial.id);
      setSummary(initial.summary);
      setAllDay(initial.allDay ?? false);
      setStart(
        initial.allDay ? initial.start.slice(0, 10) : isoToLocal(initial.start),
      );
      setEnd(
        initial.allDay ? initial.end.slice(0, 10) : isoToLocal(initial.end),
      );
      setAttendees(initial.attendees ?? []);
      setAttendeeStatuses(initial.attendeeStatuses ?? {});
      setLocation(initial.location ?? "");
      setDescription(initial.description ?? "");
    }
  }, [initial]);

  // When allDay toggles, reformat start/end
  function toggleAllDay(v: boolean) {
    setAllDay(v);
    if (v) {
      // Convert datetime-local → date-only
      const s = start ? new Date(start).toISOString().slice(0, 10) : "";
      const e = end ? new Date(end).toISOString().slice(0, 10) : "";
      setStart(s);
      setEnd(e);
    } else {
      // Convert date-only → datetime-local (noon)
      const s = start ? `${start}T12:00` : "";
      const e = end ? `${end}T13:00` : "";
      setStart(s);
      setEnd(e);
    }
  }

  const queryClient = useQueryClient();
  const calListKey = getQueryKey(api.calendar.list);

  const create = api.calendar.create.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: calListKey });
      const snapshot = queryClient.getQueriesData<CalEvent[]>({
        queryKey: calListKey,
      });
      const tempId = `optimistic-${crypto.randomUUID()}`;
      const tempEvent: CalEvent = {
        id: tempId,
        summary: vars.summary,
        start: vars.start,
        end: vars.end,
        allDay: vars.allDay ?? false,
        location: vars.location,
        description: vars.description,
        attendees: (vars.attendees ?? []).map((email) => ({ email })),
      };
      queryClient.setQueriesData<CalEvent[]>({ queryKey: calListKey }, (old) =>
        old ? [...old, tempEvent] : [tempEvent],
      );
      return { snapshot, tempId };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
      toast.error("Couldn't create event");
    },
    onSuccess: async (ev, _vars, ctx) => {
      // Replace temp entry with real event
      queryClient.setQueriesData<CalEvent[]>({ queryKey: calListKey }, (old) =>
        old ? old.map((e) => (e.id === ctx?.tempId ? ev : e)) : [ev],
      );
      const n = ev.attendees.length;
      toast.success(
        n > 0
          ? `Event created — invite sent to ${n} guest${n > 1 ? "s" : ""}`
          : "Event created",
      );
      onOpenChange(false);
    },
    onSettled: () => {
      void utils.calendar.list.invalidate();
    },
  });

  const update = api.calendar.update.useMutation({
    ...patchInList<
      {
        id: string;
        summary: string;
        start: string;
        end: string;
        allDay?: boolean;
        attendees?: string[];
        location?: string;
      },
      CalEvent
    >(
      queryClient,
      calListKey,
      (e, v) => e.id === v.id,
      (e, v) => ({
        ...e,
        summary: v.summary,
        start: v.start,
        end: v.end,
        allDay: v.allDay ?? e.allDay,
        location: v.location,
        attendees: v.attendees
          ? v.attendees.map((email) => ({ email }))
          : e.attendees,
      }),
      "Couldn't update event",
    ),
    onSuccess: () => {
      toast.success("Event updated — guests notified");
      onOpenChange(false);
    },
  });

  const remove = api.calendar.delete.useMutation({
    ...removeFromList<{ id: string }, CalEvent>(
      queryClient,
      calListKey,
      (e, v) => e.id === v.id,
      "Couldn't cancel event",
    ),
    onSuccess: () => {
      toast.success("Event cancelled — guests notified");
      onOpenChange(false);
    },
  });

  function fields() {
    return {
      summary,
      start: allDay ? start : localToIso(start),
      end: allDay ? end : localToIso(end),
      allDay,
      attendees,
      location,
      description,
    };
  }
  function submit() {
    if (id) update.mutate({ id, ...fields() });
    else create.mutate(fields());
  }

  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{id ? "Edit event" : title}</SheetTitle>
          <SheetDescription>
            {id
              ? "Changes email all guests."
              : "Review and confirm. Invites send on create."}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm">
            <Spinner /> Extracting details…
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <Field>
              <FieldLabel htmlFor="ev-summary">Title</FieldLabel>
              <Input
                id="ev-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </Field>

            {/* All-day toggle */}
            <div className="flex items-center gap-2">
              <input
                id="ev-allday"
                type="checkbox"
                checked={allDay}
                onChange={(e) => toggleAllDay(e.target.checked)}
                className="border-input size-4 rounded"
              />
              <label htmlFor="ev-allday" className="text-sm select-none">
                All day
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ev-start">Start</FieldLabel>
                <Input
                  id="ev-start"
                  type={allDay ? "date" : "datetime-local"}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ev-end">End</FieldLabel>
                <Input
                  id="ev-end"
                  type={allDay ? "date" : "datetime-local"}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Attendees</FieldLabel>
              <AttendeeTags
                value={attendees}
                onChange={setAttendees}
                statuses={attendeeStatuses}
              />
              {Object.keys(attendeeStatuses).length > 0 && (
                <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-[10px]">
                  {[
                    ["bg-emerald-500", "Accepted"],
                    ["bg-amber-400", "Tentative"],
                    ["bg-red-500", "Declined"],
                    ["bg-muted-foreground/50", "No reply"],
                  ].map(([cls, label]) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className={cn("size-1.5 rounded-full", cls)} />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="ev-loc">Location</FieldLabel>
              <Input
                id="ev-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ev-desc">Description</FieldLabel>
              <Textarea
                id="ev-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </Field>
          </div>
        )}

        <SheetFooter className="flex-row gap-2">
          {id && (
            <Button
              variant="destructive"
              onClick={() => remove.mutate({ id })}
              disabled={busy}
            >
              {remove.isPending ? "Cancelling…" : "Cancel event"}
            </Button>
          )}
          <Button
            onClick={submit}
            disabled={busy || !!loading || !summary}
            className="flex-1"
          >
            {id
              ? update.isPending
                ? "Updating…"
                : "Update event"
              : create.isPending
                ? "Creating…"
                : "Create event"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
