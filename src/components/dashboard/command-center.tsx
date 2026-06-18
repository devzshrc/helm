"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquareReply,
  RefreshCw,
  Search,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useRealtime } from "~/hooks/use-realtime";
import { useSyncCursor } from "~/hooks/use-sync-cursor";
import { InboxWorkspaceBoundary } from "~/components/inbox/inbox-workspace-boundary";
import { HelmMark } from "~/components/helm-mark";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";

type Summary = RouterOutputs["dashboard"]["summary"];
type SearchResult = RouterOutputs["search"]["unified"];

function fmtDate(value: string | number | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background hover:border-foreground/20 rounded-xl border p-4 shadow-sm transition-colors">
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-background min-w-0 rounded-xl border shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="text-muted-foreground/70 h-4 w-4 shrink-0" />
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function WorkspaceSwitch({
  value,
  onChange,
}: {
  value: "dashboard" | "inbox";
  onChange: (value: "dashboard" | "inbox") => void;
}) {
  return (
    <div
      className="bg-muted/30 inline-flex rounded-lg border p-0.5"
      aria-label="Dashboard section switch"
    >
      {[
        { value: "dashboard" as const, label: "Dashboard" },
        { value: "inbox" as const, label: "Inbox" },
      ].map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          aria-pressed={value === item.value}
          className={cn(
            "h-8 min-w-24 rounded-md px-3 text-sm font-semibold transition-colors",
            value === item.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function WorkspaceHeader({
  active,
  title,
  description,
  onChange,
  action,
}: {
  active: "dashboard" | "inbox";
  title: string;
  description: string;
  onChange: (value: "dashboard" | "inbox") => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid shrink-0 gap-3 border-b px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto_7rem] lg:items-center lg:px-6">
      <div className="min-w-0">
        <h1 className="truncate font-serif text-2xl tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <div className="flex shrink-0 items-center lg:justify-center">
        <WorkspaceSwitch value={active} onChange={onChange} />
      </div>
      <div
        className={cn(
          "h-9 w-28 shrink-0 items-center justify-start lg:justify-end",
          action ? "flex" : "hidden lg:flex",
        )}
        aria-hidden={!action}
      >
        {action}
      </div>
    </div>
  );
}

function MailRows({
  rows,
  empty,
}: {
  rows: Summary["priorityEmails"] | Summary["repliesOwed"];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground px-1 py-4 text-sm">{empty}</p>;
  }
  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <Link
          key={row.threadId}
          href={`/dashboard?thread=${encodeURIComponent(row.threadId)}`}
          className="hover:bg-accent group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
        >
          <div className="bg-muted text-muted-foreground grid h-8 w-8 shrink-0 place-items-center rounded-lg">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{row.subject}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.from}
              {"receivedAt" in row && row.receivedAt
                ? ` · ${fmtDate(row.receivedAt)}`
                : ""}
            </p>
          </div>
          <MessageSquareReply className="text-muted-foreground/0 group-hover:text-muted-foreground h-4 w-4 shrink-0 transition-colors" />
        </Link>
      ))}
    </div>
  );
}

function EventRows({ rows }: { rows: Summary["upcomingEvents"] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-sm">
        No upcoming meetings in the next week.
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {rows.map((event) => (
        <Link
          key={event.id}
          href="/dashboard/calendar"
          className="hover:bg-accent flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
        >
          <div className="bg-muted text-muted-foreground grid h-8 w-8 shrink-0 place-items-center rounded-lg">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{event.summary}</p>
            <p className="text-muted-foreground truncate text-xs">
              {fmtDate(event.start)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function WorkflowRows({ rows }: { rows: Summary["workflowHealth"] }) {
  const attention = rows
    .filter(
      (workflow) =>
        workflow.health.status !== "valid" ||
        workflow.lastRun?.status === "failed",
    )
    .slice(0, 5);
  if (attention.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-sm">
        Workflows look healthy. Test new automations before enabling them.
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {attention.map((workflow) => (
        <Link
          key={workflow.id}
          href={`/dashboard/workflows/${workflow.id}`}
          className="hover:bg-accent flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
        >
          <div className="bg-muted text-muted-foreground grid h-8 w-8 shrink-0 place-items-center rounded-lg">
            <Workflow className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{workflow.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {workflow.lastRun?.status === "failed"
                ? (workflow.lastRun.error ?? "Last run failed")
                : (workflow.health.reasons[0] ?? workflow.health.status)}
            </p>
          </div>
          {workflow.enabled ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          )}
        </Link>
      ))}
    </div>
  );
}

function SearchResults({
  data,
  loading,
  onClose,
}: {
  data?: SearchResult;
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="bg-background rounded-lg border p-3 shadow-sm">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-full" />
      </div>
    );
  }
  if (!data) return null;
  const nonActionGroups = data.groups.filter(
    (group) => group.type !== "actions",
  );
  const total = nonActionGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );
  return (
    <div className="bg-background rounded-lg border p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Search results</p>
          <p className="text-muted-foreground text-xs">
            {total} grounded result{total === 1 ? "" : "s"} for “{data.query}”
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {data.partialErrors.length > 0 ? (
        <div className="mb-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {data.partialErrors[0]}
        </div>
      ) : null}
      {total === 0 ? (
        <p className="text-muted-foreground px-1 py-4 text-sm">
          No verified mail or calendar results found.
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {data.groups.map((group) => {
            if (group.type === "actions") return null;
            return (
              <div key={group.type} className="rounded-md border p-2">
                <p className="text-muted-foreground mb-1 px-1 text-xs font-medium uppercase">
                  {group.type === "mail_threads" ? "Mail" : "Calendar"}
                </p>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const row = item as {
                      id: string;
                      title: string;
                      subtitle?: string;
                      snippet?: string;
                      start?: string | null;
                      href: string;
                    };
                    return (
                      <Link
                        key={row.id}
                        href={row.href}
                        className="hover:bg-accent rounded-md px-2 py-1.5 transition-colors"
                      >
                        <p className="truncate text-sm font-medium">
                          {row.title}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {row.subtitle ?? fmtDate(row.start)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-muted-foreground mt-3 text-[11px]">
        Sources: {data.provenance.join(", ")}
      </p>
    </div>
  );
}

export function CommandCenter() {
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const [showInbox, setShowInbox] = useState(
    () => searchParams.has("thread") || searchParams.has("mode"),
  );
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const summary = api.dashboard.summary.useQuery(undefined, {
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  // Scheduling proposals the concierge is holding for approval — surfaced on
  // the dashboard so an inbound interview/meeting email shows up here too.
  const scheduling = api.concierge.pending.useQuery(undefined, {
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const search = api.search.unified.useQuery(
    { query: submitted, limit: 8 },
    { enabled: submitted.length > 0 },
  );

  // Keep the dashboard live: invalidate on the change cursor advancing (the
  // mechanism that survives serverless — useRealtime is a no-op there) and on
  // any realtime push where available.
  const refresh = useCallback(() => {
    void utils.dashboard.summary.invalidate();
    void utils.concierge.pending.invalidate();
  }, [utils]);
  useSyncCursor(refresh);
  useRealtime(refresh);

  const hour = new Date().getHours();
  const greeting = useMemo(() => {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [hour]);

  useEffect(() => {
    if (searchParams.has("thread") || searchParams.has("mode")) {
      setShowInbox(true);
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        active={showInbox ? "inbox" : "dashboard"}
        title={
          showInbox ? "Inbox" : `${greeting}. Here is what needs attention.`
        }
        description={
          showInbox
            ? "Triage, reply, schedule, and clean up."
            : "Search mail and calendar, review approvals, and jump into the exact workspace."
        }
        onChange={(value) => setShowInbox(value === "inbox")}
        action={
          showInbox ? null : (
            <Link
              href="/dashboard/agent"
              className="bg-background hover:bg-accent inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            >
              <HelmMark className="h-4 w-4" /> Ask Helm
            </Link>
          )
        }
      />
      <AnimatePresence mode="wait" initial={false}>
        {showInbox ? (
          <motion.div
            key="inbox"
            className="min-h-0 flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <InboxWorkspaceBoundary />
          </motion.div>
        ) : (
          <motion.main
            key="dashboard"
            className="min-h-0 flex-1 overflow-y-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:p-8">
              <form
                className="relative"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted(query.trim());
                }}
              >
                <Search className="text-muted-foreground absolute top-4 left-3 h-4 w-4" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search mail and calendar, e.g. meetings with investors next week"
                  className="h-12 rounded-xl pr-28 pl-9 shadow-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!query.trim()}
                  className="absolute top-1.5 right-1.5"
                >
                  Search
                </Button>
              </form>
              <SearchResults
                data={search.data}
                loading={search.isFetching}
                onClose={() => {
                  setSubmitted("");
                  setQuery("");
                }}
              />

              {summary.isLoading ? (
                <div className="grid gap-3 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : summary.error ? (
                <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-4">
                  <p className="text-sm font-semibold">
                    Could not load command center.
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {summary.error.message}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void summary.refetch()}
                  >
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                </div>
              ) : summary.data ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Unread" value={summary.data.counts.unread} />
                    <Stat
                      label="Priority"
                      value={summary.data.counts.priority}
                    />
                    <Stat label="Replies" value={summary.data.counts.replies} />
                    <Stat
                      label="Meetings"
                      value={summary.data.counts.meetings}
                    />
                    <Stat
                      label="Workflow flags"
                      value={summary.data.counts.workflowAttention}
                    />
                    <Stat label="Cleanup" value={summary.data.counts.cleanup} />
                  </div>

                  {(scheduling.data?.length ?? 0) > 0 && (
                    <Section
                      title="Scheduling — needs you"
                      icon={CalendarClock}
                      action={
                        <Link
                          href="/dashboard/calendar"
                          className="text-primary text-sm font-medium"
                        >
                          Open
                        </Link>
                      }
                    >
                      <div className="flex flex-col">
                        {scheduling.data!.map((n) => (
                          <Link
                            key={n.id}
                            href="/dashboard/calendar"
                            className="hover:bg-accent flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
                          >
                            <div className="bg-primary/10 text-primary grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                              <CalendarClock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {n.subject?.trim()
                                  ? n.subject
                                  : "Scheduling request"}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {n.counterpartyEmail}
                                {n.status === "awaiting_approval"
                                  ? " · proposal ready"
                                  : " · awaiting confirm"}
                              </p>
                            </div>
                            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                              Review
                            </span>
                          </Link>
                        ))}
                      </div>
                    </Section>
                  )}

                  <div className="grid gap-5 xl:grid-cols-3">
                    <Section
                      title="Priority inbox"
                      icon={Mail}
                      action={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowInbox(true)}
                        >
                          Review
                        </Button>
                      }
                    >
                      <MailRows
                        rows={summary.data.priorityEmails}
                        empty="No urgent or important email found."
                      />
                    </Section>
                    <Section title="Replies owed" icon={MessageSquareReply}>
                      <MailRows
                        rows={summary.data.repliesOwed}
                        empty="No obvious reply queue right now."
                      />
                    </Section>
                    <Section title="Upcoming meetings" icon={Clock}>
                      <EventRows rows={summary.data.upcomingEvents} />
                    </Section>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-3">
                    <Section title="Workflow health" icon={Workflow}>
                      <WorkflowRows rows={summary.data.workflowHealth} />
                    </Section>
                    <Section title="Approvals & safety" icon={ShieldCheck}>
                      <div className="space-y-2 px-1 py-1">
                        <p className="text-sm font-medium">
                          Writes are review-first.
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Emails, calendar changes, workflow enablement, and
                          bulk cleanup stay user-approved before they execute.
                        </p>
                        <Link
                          href="/dashboard/agent"
                          className="text-primary inline-flex text-sm font-medium"
                        >
                          Review agent actions
                        </Link>
                      </div>
                    </Section>
                    <Section title="Cleanup opportunities" icon={Archive}>
                      {summary.data.cleanup.length === 0 ? (
                        <p className="text-muted-foreground px-1 py-4 text-sm">
                          No obvious cleanup batch right now.
                        </p>
                      ) : (
                        <div className="flex flex-col">
                          {summary.data.cleanup.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setShowInbox(true)}
                              className="hover:bg-accent rounded-lg px-2 py-2.5 text-left transition-colors"
                            >
                              <p className="truncate text-sm font-medium">
                                {item.subject}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {item.from} · {item.reason}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </Section>
                  </div>
                </>
              ) : null}
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
