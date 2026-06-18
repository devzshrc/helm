import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { type CorsairClient, withCorsair } from "~/server/corsair";
import { db } from "~/server/db";
import { calendarEvents } from "~/server/db/schema";

function client(c: CorsairClient, tenantId: string) {
  return c.withTenant(tenantId).googlecalendar.api;
}

export type CalEvent = {
  id: string;
  summary: string;
  start: string | null; // ISO dateTime or date
  end: string | null;
  allDay: boolean;
  location?: string;
  description?: string;
  attendees: { email: string; responseStatus?: string }[];
  htmlLink?: string;
};

type RawEvent = {
  id?: string;
  summary?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { email?: string; responseStatus?: string }[];
};

function mapEvent(e: RawEvent): CalEvent {
  const allDay = !!e.start?.date && !e.start?.dateTime;
  return {
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    allDay,
    location: e.location,
    description: e.description,
    htmlLink: e.htmlLink,
    attendees: (e.attendees ?? [])
      .filter((a) => a.email)
      .map((a) => ({ email: a.email!, responseStatus: a.responseStatus })),
  };
}

// How long a cached window is trusted before a live re-fetch. Short, because a
// stale window can surface events the user has since deleted (the "Happy
// birthday!" ghost) or miss freshly-created ones.
const CACHE_TTL_MS = 90_000;

function cachedEvents(
  rows: (typeof calendarEvents.$inferSelect)[],
): CalEvent[] {
  return rows.map((r) => ({
    id: r.eventId,
    summary: r.title,
    start: r.start,
    end: r.end,
    allDay: r.allDay,
    location: r.location ?? undefined,
    description: r.description ?? undefined,
    attendees: (r.attendees as CalEvent["attendees"]) ?? [],
    htmlLink: r.htmlLink ?? undefined,
  }));
}

async function refreshEventWindow(
  tenantId: string,
  opts: { timeMin: string; timeMax: string },
) {
  const res = (await withCorsair((c) =>
    client(c, tenantId).events.getMany({
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    }),
  )) as { items?: RawEvent[] };
  const events = (res.items ?? []).map(mapEvent).filter((e) => e.id);

  await db
    .delete(calendarEvents)
    .where(
      and(
        eq(calendarEvents.tenantId, tenantId),
        gte(calendarEvents.start, opts.timeMin),
        lte(calendarEvents.start, opts.timeMax),
      ),
    );
  if (events.length > 0) {
    await db
      .insert(calendarEvents)
      .values(
        events.map((e) => ({
          tenantId,
          eventId: e.id,
          title: e.summary,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          location: e.location ?? null,
          description: e.description ?? null,
          attendees: e.attendees,
          htmlLink: e.htmlLink ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [calendarEvents.tenantId, calendarEvents.eventId],
        set: {
          title: sql`excluded.title`,
          start: sql`excluded.start`,
          end: sql`excluded.end`,
          allDay: sql`excluded.all_day`,
          location: sql`excluded.location`,
          description: sql`excluded.description`,
          attendees: sql`excluded.attendees`,
          htmlLink: sql`excluded.html_link`,
          updatedAt: new Date(),
        },
      });
  }

  return events;
}

export async function listEvents(
  tenantId: string,
  opts: { timeMin: string; timeMax: string },
): Promise<CalEvent[]> {
  // Try DB cache first (cal_events_tenant_start_idx covers this query)
  const cached = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.tenantId, tenantId),
        gte(calendarEvents.start, opts.timeMin),
        lte(calendarEvents.start, opts.timeMax),
      ),
    );

  // Use the cache only if it's fresh. The previous code trusted ANY cached rows
  // forever (and never deleted events that vanished from Google), so a stale
  // window kept returning deleted events indefinitely.
  const fresh =
    cached.length > 0 &&
    cached.every(
      (r) => Date.now() - new Date(r.updatedAt).getTime() < CACHE_TTL_MS,
    );
  if (cached.length > 0) {
    if (!fresh) {
      void refreshEventWindow(tenantId, opts).catch(() => {
        // The visible request already has usable cached data; the next explicit
        // refresh/focus will surface persistent errors.
      });
    }
    return cachedEvents(cached);
  }

  // Stale or empty → live fetch. Fall back to whatever was cached if the live
  // call fails, so a transient Google/Corsair error doesn't blank the calendar.
  try {
    return await refreshEventWindow(tenantId, opts);
  } catch (err) {
    if (cached.length > 0) {
      return cachedEvents(cached);
    }
    throw err;
  }
}

export type EventDraft = {
  summary: string;
  start: string; // ISO dateTime or YYYY-MM-DD for all-day
  end: string;
  allDay?: boolean;
  attendees?: string[];
  location?: string;
  description?: string;
};

function toDateOnly(iso: string): string {
  // Accepts "YYYY-MM-DD" or full ISO — returns "YYYY-MM-DD"
  return iso.slice(0, 10);
}

function toEventBody(d: EventDraft) {
  return {
    summary: d.summary,
    location: d.location,
    description: d.description,
    start: d.allDay ? { date: toDateOnly(d.start) } : { dateTime: d.start },
    end: d.allDay ? { date: toDateOnly(d.end) } : { dateTime: d.end },
    attendees: (d.attendees ?? []).map((email) => ({ email })),
  };
}

export async function createEvent(
  tenantId: string,
  draft: EventDraft,
): Promise<CalEvent> {
  const res = (await withCorsair((c) =>
    client(c, tenantId).events.create({
      event: toEventBody(draft),
      sendUpdates: "all",
    }),
  )) as RawEvent;
  return mapEvent(res);
}

export async function updateEvent(
  tenantId: string,
  id: string,
  draft: EventDraft,
): Promise<CalEvent> {
  const res = (await withCorsair((c) =>
    client(c, tenantId).events.update({
      id,
      event: toEventBody(draft),
      sendUpdates: "all",
    }),
  )) as RawEvent;
  return mapEvent(res);
}

export async function deleteEvent(tenantId: string, id: string): Promise<void> {
  await withCorsair((c) =>
    client(c, tenantId).events.delete({ id, sendUpdates: "all" }),
  );
}
