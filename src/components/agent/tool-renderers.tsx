"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { z } from "zod";
import {
  Archive,
  CalendarDays,
  Check,
  CheckSquare2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  type LucideIcon,
  Loader2,
  Mail,
  MailOpen,
  Pencil,
  PlugZap,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Workflow as WorkflowIcon,
  Zap,
  ArrowRight,
} from "lucide-react";

import {
  useAgent,
  useCopilotKit,
  useDefaultRenderTool,
  useHumanInTheLoop,
  useRenderTool,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import { ChevronRight, CornerUpLeft } from "lucide-react";
import { ToolCallStatus } from "@copilotkit/core";

import { AnimatePresence, motion } from "framer-motion";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  WRITE_TOOLS,
  type WriteTool,
  writeSchemas,
} from "~/lib/ai/write-actions";
import {
  NODE_META,
  type NodeType,
  TRIGGER_META,
  type TriggerType,
} from "~/lib/workflows/types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  reportActivity,
  type ActivityStatus,
  type RouterTrace,
} from "~/lib/agent-activity";

/* ------------------------------------------------------------------ *
 * Result parsing
 * ------------------------------------------------------------------ */

function parseResult<T>(result: string | undefined): T | null {
  if (!result) return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** ISO datetime → `datetime-local` input value (YYYY-MM-DDTHH:mm) in local tz. */
function toLocalInput(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value (interpreted as local time) → ISO string. */
function fromLocalInput(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}
const labelize = (v: unknown, fallback = ""): string =>
  (typeof v === "string" && v.trim() ? v : fallback).replace(/_/g, " ");

/* ------------------------------------------------------------------ *
 * Activity reporting hook
 * Wraps the module-level store with a stable ref per component instance.
 * ------------------------------------------------------------------ */

function useActivityReporting(
  toolName: string,
  title: string,
  argsSummary: string,
  status: ActivityStatus,
  resultSummary?: string,
  routerTrace?: RouterTrace,
) {
  const seqRef = useRef<number | null>(null);

  useEffect(() => {
    if (seqRef.current === null) {
      seqRef.current = reportActivity({
        toolName,
        title,
        argsSummary,
        status,
        resultSummary,
        routerTrace,
      });
    } else {
      reportActivity({
        toolName,
        title,
        argsSummary,
        status,
        resultSummary,
        routerTrace,
        seq: seqRef.current,
      });
    }
  });
}

/* ------------------------------------------------------------------ *
 * useInteract — drive the next agent turn from a rendered card.
 * ------------------------------------------------------------------ */

function useInteract() {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({
    agentId: "default",
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });
  const busy = agent.isRunning;
  const ask = useCallback(
    (text: string) => {
      if (agent.isRunning) {
        toast.info("One step at a time — let the current action finish.");
        return;
      }
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      });
      void copilotkit.runAgent({ agent });
    },
    [agent, copilotkit],
  );
  return { ask, busy };
}

/* ------------------------------------------------------------------ *
 * Avatar
 * ------------------------------------------------------------------ */

const AVATAR_TINTS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
];
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!;
}
function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        tintFor(name),
      )}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Motion helpers
 * ------------------------------------------------------------------ */

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const listItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

/* ------------------------------------------------------------------ *
 * Domain types
 * ------------------------------------------------------------------ */

type EmailThread = {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  unread?: boolean;
  priority?: string | null;
  score?: number;
};
type SearchEmailResult = {
  query: string;
  threads?: EmailThread[];
  error?: string;
};
type ThreadMessage = { from: string; text: string };
type GetThreadResult = {
  threadId: string;
  subject: string;
  messages?: ThreadMessage[];
  error?: string;
};
type CalEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location?: string;
  attendees: { email: string }[];
};
type ListEventsResult = { events?: CalEvent[]; error?: string };
type FreeSlot = { start: string; end: string; durationMinutes: number };
type FindFreeTimeResult = {
  freeSlots?: FreeSlot[];
  busyCount?: number;
  durationMinutes?: number;
  error?: string;
};
type WorkflowRow = {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  lastRunAt: string | null;
};
type ListWorkflowsResult = { workflows?: WorkflowRow[]; error?: string };
type ConnectionStatus = {
  gmail?: boolean;
  googleCalendar?: boolean;
  error?: string;
};
type DraftReplyResult = {
  threadId: string;
  toEmail?: string;
  subject?: string;
  draftBody?: string;
  error?: string;
};
type IntentRouteResult = {
  intent: string;
  confidence: number;
  targetAgent: string;
  missingFields: string[];
  riskLevel: "none" | "low" | "medium" | "high";
  reasonCode: string;
};
type GenerativeSurfaceAction = {
  id: string;
  label: string;
  prompt: string;
  variant?: "primary" | "secondary" | "destructive";
};
type GenerativeSurfaceResult = {
  surfaceType: string;
  title: string;
  status:
    | "pending"
    | "running"
    | "needs_input"
    | "ready"
    | "complete"
    | "error";
  summary: string;
  data?: { label: string; value: string }[];
  actions?: GenerativeSurfaceAction[];
  requiresInput?: boolean;
  riskLevel?: "none" | "low" | "medium" | "high";
  provenance?: string[];
};

type RenderStatus = "inProgress" | "executing" | "complete";

/* ------------------------------------------------------------------ *
 * ToolCard — consistent frame for every inline tool result.
 * ------------------------------------------------------------------ */

function ToolCard({
  icon: Icon,
  label,
  status,
  children,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  status: RenderStatus;
  children?: React.ReactNode;
  tone?: "default" | "warning";
}) {
  const running = status !== "complete";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      className={cn(
        "bg-card/60 text-card-foreground my-2 w-full overflow-hidden rounded-xl border shadow-sm",
        tone === "warning" && "border-amber-300/60 dark:border-amber-500/30",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3.5 py-2",
          children ? "border-b" : "",
          tone === "warning" && "bg-amber-50/60 dark:bg-amber-500/5",
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tone === "warning" ? "text-amber-600" : "text-muted-foreground",
          )}
        />
        <span className="text-muted-foreground flex-1 truncate text-xs font-medium">
          {label}
        </span>
        {running ? (
          <Loader2 className="text-muted-foreground/70 h-3.5 w-3.5 animate-spin" />
        ) : tone === "warning" ? null : (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>
      {children ? <div className="p-3.5">{children}</div> : null}
    </motion.div>
  );
}

function InlineError({ message }: { message: string }) {
  return <p className="text-destructive text-sm">{message}</p>;
}

function formatEventTime(ev: CalEvent): string {
  if (!ev.start) return "";
  if (ev.allDay) return new Date(ev.start).toLocaleDateString();
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : null;
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return end ? `${date} · ${t(start)}–${t(end)}` : `${date} · ${t(start)}`;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-muted-foreground py-1 text-sm">{text}</p>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Read tool body components
 * ------------------------------------------------------------------ */

function EmailListBody({ data }: { data: SearchEmailResult }) {
  const { ask, busy } = useInteract();
  if (data.error) return <InlineError message={data.error} />;
  const threads = data.threads ?? [];
  if (threads.length === 0) return <EmptyLine text="No matching mail." />;
  return (
    <motion.ul
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="-mx-1.5 -my-1 max-h-80 overflow-y-auto"
    >
      {threads.map((t) => (
        <motion.li key={t.threadId} variants={listItem}>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              ask(
                `Open the email thread with id ${t.threadId} (from ${t.from}: "${t.subject}").`,
              )
            }
            className="group hover:bg-accent/60 flex w-full items-start gap-3 rounded-lg px-1.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
          >
            <Avatar name={t.from} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "truncate text-sm",
                    t.unread ? "font-semibold" : "font-medium",
                  )}
                >
                  {t.from}
                </span>
                {t.unread && (
                  <span className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
                )}
                {t.priority === "Urgent" && (
                  <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-px text-[10px] font-semibold text-red-600 dark:text-red-400">
                    Urgent
                  </span>
                )}
              </div>
              <p className="text-foreground/90 truncate text-sm">{t.subject}</p>
              <p className="text-muted-foreground truncate text-xs">
                {t.snippet}
              </p>
            </div>
            <ChevronRight className="text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5" />
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function ThreadBody({ data }: { data: GetThreadResult }) {
  const { ask, busy } = useInteract();
  if (data.error) return <InlineError message={data.error} />;
  const messages = data.messages ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{data.subject}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
          onClick={() =>
            ask(
              `Draft a reply to the thread "${data.subject}" (id ${data.threadId}) and show it to me.`,
            )
          }
        >
          <CornerUpLeft className="h-3.5 w-3.5" /> Draft reply
        </Button>
      </div>
      <motion.div
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-0.5"
      >
        {messages.map((m, i) => (
          <motion.div
            key={i}
            variants={listItem}
            className="bg-muted/40 rounded-xl border p-3"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <Avatar name={m.from} size={6} />
              <span className="text-foreground/80 truncate text-xs font-medium">
                {m.from}
              </span>
            </div>
            <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
              {m.text}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function EventsBody({ data }: { data: ListEventsResult }) {
  const { ask, busy } = useInteract();
  if (data.error) return <InlineError message={data.error} />;
  const events = data.events ?? [];
  if (events.length === 0) return <EmptyLine text="Nothing scheduled." />;
  return (
    <motion.ul
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-1.5"
    >
      {events.map((ev) => (
        <motion.li
          key={ev.id}
          variants={listItem}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              ask(
                `Tell me about the event "${ev.summary}" (id ${ev.id}). ` +
                  `Offer to reschedule, cancel, or update guest list.`,
              )
            }
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
              "border-border/60 bg-card/40",
              "hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ev.summary}</p>
              <p className="text-muted-foreground text-xs">
                {formatEventTime(ev)}
              </p>
              {ev.location && (
                <p className="text-muted-foreground truncate text-xs">
                  {ev.location}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {ev.attendees.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  {ev.attendees.length} guest
                  {ev.attendees.length === 1 ? "" : "s"}
                </span>
              )}
              <span className="text-primary hidden text-[10px] font-semibold group-hover:inline">
                Edit →
              </span>
            </div>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function FreeTimeSlotsBody({ data }: { data: FindFreeTimeResult }) {
  const { ask, busy } = useInteract();
  if (data.error) return <InlineError message={data.error} />;
  const slots = data.freeSlots ?? [];
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <EmptyLine
          text={`No free ${data.durationMinutes ?? 30}-min slots in business hours.`}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          className="h-7 text-xs"
          onClick={() =>
            ask(
              `Try finding free ${data.durationMinutes ?? 60}-min slots over the next 2 weeks instead.`,
            )
          }
        >
          Try 2 weeks
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {data.busyCount !== undefined && (
        <p className="text-muted-foreground mb-1 text-xs">
          {slots.length} open slot{slots.length === 1 ? "" : "s"} — click to
          book
        </p>
      )}
      <motion.ul
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-1"
      >
        {slots.map((slot, i) => {
          const start = new Date(slot.start);
          const end = new Date(slot.end);
          const fmt = (d: Date) =>
            d.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });
          const dateLabel = start.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const durationLabel =
            slot.durationMinutes >= 60
              ? `${Math.round(slot.durationMinutes / 60)}h${slot.durationMinutes % 60 ? ` ${slot.durationMinutes % 60}m` : ""}`
              : `${slot.durationMinutes}m`;
          return (
            <motion.li
              key={i}
              variants={listItem}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  ask(
                    `I'm choosing this slot: ${dateLabel} ${fmt(start)} – ${fmt(end)}. ` +
                      `Use ask_options to ask me what to call the event, ` +
                      `then call create_event with start="${slot.start}" end="${slot.end}".`,
                  )
                }
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                  "border-border/60 bg-muted/20",
                  "hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {/* Time block accent */}
                <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md">
                  <Clock className="h-4 w-4" />
                </div>

                {/* Date + time */}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium">
                    {dateLabel}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {fmt(start)} – {fmt(end)}
                  </p>
                </div>

                {/* Duration + "Book" on hover */}
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {durationLabel}
                  </span>
                  <span className="text-primary hidden text-[10px] font-semibold group-hover:inline">
                    Book →
                  </span>
                </div>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

function WorkflowListBody({ data }: { data: ListWorkflowsResult }) {
  const { ask, busy } = useInteract();
  if (data.error) return <InlineError message={data.error} />;
  const wfs = data.workflows ?? [];
  if (wfs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <p className="text-muted-foreground text-sm">No workflows yet.</p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          className="h-7 text-xs"
          onClick={() => ask("Help me set up my first workflow automation.")}
        >
          Create one
        </Button>
      </div>
    );
  }
  return (
    <motion.ul
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-1"
    >
      {wfs.map((wf) => (
        <motion.li
          key={wf.id}
          variants={listItem}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              ask(
                `Tell me about the workflow "${wf.name}" (id ${wf.id}). ` +
                  `Explain what it does and offer to edit, toggle, or delete it.`,
              )
            }
            className={cn(
              "group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
              "border-border/60 bg-muted/20",
              "hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {/* Status dot */}
            <div
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-colors",
                wf.enabled
                  ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                  : "bg-muted-foreground/30",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate font-medium">{wf.name}</p>
              <p className="text-muted-foreground truncate text-xs capitalize">
                {wf.triggerType} trigger
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {wf.lastRunAt && (
                <span className="text-muted-foreground text-xs">
                  {new Date(wf.lastRunAt).toLocaleDateString()}
                </span>
              )}
              <span className="text-primary hidden text-[10px] font-semibold group-hover:inline">
                Manage →
              </span>
            </div>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function ConnectionStatusBody({ data }: { data: ConnectionStatus }) {
  if (data.error) return <InlineError message={data.error} />;
  const services = [
    {
      key: "gmail" as const,
      label: "Gmail",
      icon: Mail,
      connected: data.gmail ?? false,
      connectSlug: "gmail",
    },
    {
      key: "googleCalendar" as const,
      label: "Google Calendar",
      icon: CalendarDays,
      connected: data.googleCalendar ?? false,
      connectSlug: "googlecalendar",
    },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {services.map(({ key, label, icon: Icon, connected, connectSlug }) => (
        <div
          key={key}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
            connected
              ? "border-border/40 bg-muted/10"
              : "border-border/60 bg-muted/5 border-dashed",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              connected ? "text-foreground/70" : "text-muted-foreground/50",
            )}
          />
          <span className="flex-1 text-sm font-medium">{label}</span>
          {connected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Connected
            </span>
          ) : (
            <a
              href={`/dashboard/connections?connect=${connectSlug}`}
              className="bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
            >
              Connect <ChevronRight className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function DraftReplyBody({
  data,
  onSend,
}: {
  data: DraftReplyResult;
  onSend?: (to: string, subject: string, body: string) => void;
}) {
  const [body, setBody] = useState(data.draftBody ?? "");
  const [to] = useState(data.toEmail ?? "");
  const execute = api.agent.execute.useMutation();
  const utils = api.useUtils();
  const [phase, setPhase] = useState<"edit" | "sending" | "done">("edit");
  const [resultText, setResultText] = useState("");

  if (data.error) return <InlineError message={data.error} />;

  async function send() {
    if (phase !== "edit") return;
    setPhase("sending");
    try {
      const res = await execute.mutateAsync({
        tool: "send_email",
        input: { to, subject: data.subject ?? "", body },
      });
      setResultText(res.result);
      setPhase("done");
      toast.success("Email sent!");
      void utils.mail.list.invalidate();
      onSend?.(to, data.subject ?? "", body);
    } catch (e) {
      setPhase("edit");
      toast.error(e instanceof Error ? e.message : "Failed to send");
    }
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <Check className="h-4 w-4" /> {resultText || "Sent!"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.subject && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="font-medium">To:</span> {to}
          <span className="mx-1">·</span>
          <span className="font-medium">Re:</span> {data.subject}
        </div>
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={phase === "sending"}
        className="max-h-52 min-h-28 resize-none text-sm"
        placeholder="Draft body…"
      />
      {phase === "sending" ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Sending…
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!body.trim() || !to}
            onClick={() => void send()}
          >
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBody(data.draftBody ?? "")}
          >
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Wrapper components for read tools (enable hooks including activity reporting)
 * ------------------------------------------------------------------ */

function SearchEmailCard({
  status,
  parameters,
  result,
}: {
  status: RenderStatus;
  parameters?: { query?: string };
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<SearchEmailResult>(result) : null;
  const label = status === "complete" ? "Searched mail" : "Searching mail…";
  useActivityReporting(
    "search_email",
    label,
    parameters?.query ? `"${parameters.query}"` : "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={Mail} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <EmailListBody data={data} />
        ) : (
          <InlineError message="Could not read mail results." />
        )
      ) : parameters?.query ? (
        <p className="text-muted-foreground text-xs">
          &quot;{parameters.query}&quot;
        </p>
      ) : null}
    </ToolCard>
  );
}

function SemanticSearchEmailCard({
  status,
  parameters,
  result,
}: {
  status: RenderStatus;
  parameters?: { query?: string };
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<SearchEmailResult>(result) : null;
  const label =
    status === "complete" ? "Semantic search" : "Searching semantically…";
  useActivityReporting(
    "semantic_search_email",
    label,
    parameters?.query ? `"${parameters.query}"` : "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={Search} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <EmailListBody data={data} />
        ) : (
          <InlineError message="Could not read search results." />
        )
      ) : parameters?.query ? (
        <p className="text-muted-foreground text-xs">
          &quot;{parameters.query}&quot;
        </p>
      ) : null}
    </ToolCard>
  );
}

function GetThreadCard({
  status,
  result,
}: {
  status: RenderStatus;
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<GetThreadResult>(result) : null;
  const label = status === "complete" ? "Opened thread" : "Reading thread…";
  useActivityReporting(
    "get_thread",
    label,
    data?.subject ?? "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={MailOpen} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <ThreadBody data={data} />
        ) : (
          <InlineError message="Could not load the thread." />
        )
      ) : null}
    </ToolCard>
  );
}

function DraftEmailOnlyCard({
  status,
  parameters,
  result,
}: {
  status: RenderStatus;
  parameters?: { threadId?: string; instructions?: string };
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<DraftReplyResult>(result) : null;
  const label = status === "complete" ? "Draft ready" : "Drafting reply…";
  useActivityReporting(
    "draft_email_only",
    label,
    parameters?.instructions ? `"${parameters.instructions}"` : "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={Pencil} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <DraftReplyBody data={data} />
        ) : (
          <InlineError message="Could not generate draft." />
        )
      ) : (
        <p className="text-muted-foreground text-xs">
          {parameters?.instructions ?? "Generating…"}
        </p>
      )}
    </ToolCard>
  );
}

function ListEventsCard({
  status,
  parameters,
  result,
}: {
  status: RenderStatus;
  parameters?: { timeMin?: string; timeMax?: string };
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<ListEventsResult>(result) : null;
  const label =
    status === "complete" ? "Checked calendar" : "Checking calendar…";
  useActivityReporting(
    "list_events",
    label,
    parameters?.timeMin ? `${parameters.timeMin.slice(0, 10)} →` : "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={CalendarDays} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <EventsBody data={data} />
        ) : (
          <InlineError message="Could not load events." />
        )
      ) : null}
    </ToolCard>
  );
}

function FindFreeTimeCard({
  status,
  parameters,
  result,
}: {
  status: RenderStatus;
  parameters?: { timeMin?: string; timeMax?: string; durationMinutes?: number };
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<FindFreeTimeResult>(result) : null;
  const label =
    status === "complete" ? "Found free slots" : "Finding free time…";
  useActivityReporting(
    "find_free_time",
    label,
    parameters?.durationMinutes ? `≥ ${parameters.durationMinutes} min` : "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={Clock} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <FreeTimeSlotsBody data={data} />
        ) : (
          <InlineError message="Could not check free time." />
        )
      ) : null}
    </ToolCard>
  );
}

function ListWorkflowsCard({
  status,
  result,
}: {
  status: RenderStatus;
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<ListWorkflowsResult>(result) : null;
  const label = status === "complete" ? "Workflows" : "Loading workflows…";
  useActivityReporting(
    "list_workflows",
    label,
    "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={WorkflowIcon} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <WorkflowListBody data={data} />
        ) : (
          <InlineError message="Could not load workflows." />
        )
      ) : null}
    </ToolCard>
  );
}

function ConnectionStatusCard({
  status,
  result,
}: {
  status: RenderStatus;
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<ConnectionStatus>(result) : null;
  const label =
    status === "complete" ? "Connection status" : "Checking connections…";
  useActivityReporting(
    "get_connection_status",
    label,
    "",
    status === "complete" ? "done" : "running",
  );
  return (
    <ToolCard icon={PlugZap} label={label} status={status}>
      {status === "complete" ? (
        data ? (
          <ConnectionStatusBody data={data} />
        ) : (
          <InlineError message="Could not check connections." />
        )
      ) : null}
    </ToolCard>
  );
}

function ShowMarkdownCard({
  status,
  parameters,
}: {
  status: RenderStatus;
  parameters: { title?: string; markdown?: string };
}) {
  const label = parameters.title?.trim() ? parameters.title : "Summary";
  useActivityReporting(
    "show_markdown",
    status === "complete" ? label : "Composing…",
    "",
    status === "complete" ? "done" : "running",
  );
  if (status === "inProgress") {
    return <ToolCard icon={Sparkles} label="Composing…" status={status} />;
  }
  return (
    <ToolCard icon={Sparkles} label={label} status="complete">
      <div className="prose prose-sm dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>
          {parameters.markdown ?? ""}
        </Markdown>
      </div>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ *
 * Human-in-the-loop approval cards (write actions)
 * ------------------------------------------------------------------ */

type WriteProps = {
  args: Record<string, unknown>;
  status: ToolCallStatus;
  respond: ((result: unknown) => Promise<void>) | undefined;
};

type Phase = "edit" | "sending" | "done" | "rejected";

function useWriteAction(tool: WriteTool, respond: WriteProps["respond"]) {
  const execute = api.agent.execute.useMutation();
  const utils = api.useUtils();
  const [phase, setPhase] = useState<Phase>("edit");
  const [resultText, setResultText] = useState("");
  const [errorText, setErrorText] = useState("");

  async function run(input: Record<string, unknown>) {
    if (!respond || phase !== "edit") return;
    setErrorText("");
    setPhase("sending");
    try {
      const res = await execute.mutateAsync({ tool, input });
      await new Promise((r) => setTimeout(r, 480));
      setResultText(res.result);
      setPhase("done");
      toast.success(res.result);
      void utils.mail.list.invalidate();
      void utils.calendar.list.invalidate();
      await respond(res.result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to run action";
      setPhase("edit");
      setErrorText(msg);
      toast.error(msg);
    }
  }

  async function reject() {
    if (!respond || phase !== "edit") return;
    setPhase("rejected");
    await respond(
      errorText ? `Action failed: ${errorText}` : "Rejected by user",
    );
  }

  return {
    phase,
    resultText,
    errorText,
    run,
    reject,
    busy: phase === "sending",
  };
}

function ActionResult({
  phase,
  text,
  rejectedText = "Dismissed.",
}: {
  phase: Phase;
  text: string;
  rejectedText?: string;
}) {
  if (phase === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-emerald-600"
      >
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
        >
          <Check className="h-4 w-4" />
        </motion.span>
        {text}
      </motion.div>
    );
  }
  return <p className="text-muted-foreground text-sm">{rejectedText}</p>;
}

function SendingOverlay({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-muted-foreground flex items-center gap-2 py-1 text-sm"
    >
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
      >
        <Send className="text-primary h-4 w-4" />
      </motion.span>
      {label}
    </motion.div>
  );
}

/* ---- send_email ---- */
export function EmailComposerCard({ args, status, respond }: WriteProps) {
  const { phase, resultText, errorText, run, reject, busy } = useWriteAction(
    "send_email",
    respond,
  );
  const [to, setTo] = useState(str(args.to));
  const [subject, setSubject] = useState(str(args.subject));
  const [body, setBody] = useState(str(args.body));
  const [assistOpen, setAssistOpen] = useState(
    !str(args.subject) || !str(args.body),
  );
  const [assistPrompt, setAssistPrompt] = useState("");
  const [assistTone, setAssistTone] = useState<
    "concise" | "friendly" | "professional" | "warm"
  >("professional");
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistError, setAssistError] = useState("");
  const active = status === ToolCallStatus.Executing && !!respond;
  const canSend =
    to.trim().length > 0 && subject.trim().length > 0 && body.trim().length > 0;

  const settled =
    phase === "done" || phase === "rejected"
      ? phase
      : status === ToolCallStatus.Complete && phase === "edit"
        ? "done"
        : null;

  async function assist() {
    if (!active || busy || assistBusy) return;
    setAssistBusy(true);
    setAssistError("");
    try {
      const res = await fetch("/api/agent/compose-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "email",
          prompt: assistPrompt,
          tone: assistTone,
          to,
          subject,
          body,
        }),
      });
      const json = (await res.json()) as {
        subject?: unknown;
        body?: unknown;
        error?: unknown;
        patch?: { fields?: { subject?: unknown; body?: unknown } };
      };
      if (!res.ok) throw new Error(str(json.error) || "Could not draft email.");
      const nextSubject = str(json.patch?.fields?.subject) || str(json.subject);
      const nextBody = str(json.patch?.fields?.body) || str(json.body);
      if (nextSubject) setSubject(nextSubject);
      if (nextBody) setBody(nextBody);
      setAssistOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not draft email.";
      setAssistError(message);
      toast.error(message);
    } finally {
      setAssistBusy(false);
    }
  }

  return (
    <ToolCard
      icon={Mail}
      label={settled === "done" ? "Email sent" : "Compose email"}
      status="complete"
      tone={settled ? "default" : "warning"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {settled ? (
          <motion.div key="result" layout>
            <ActionResult
              phase={phase === "edit" ? "done" : phase}
              text={resultText || `Sent to ${to}`}
              rejectedText="Email discarded."
            />
          </motion.div>
        ) : phase === "sending" ? (
          <SendingOverlay key="sending" label={`Sending to ${to}…`} />
        ) : (
          <motion.div
            key="form"
            layout
            exit={{ opacity: 0, y: -4, transition: { duration: 0.18 } }}
            className="flex flex-col gap-3"
          >
            <Field label="To">
              <Input
                value={to}
                disabled={!active || busy}
                onChange={(e) => setTo(e.target.value)}
                className="h-8"
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Subject">
              <Input
                value={subject}
                disabled={!active || busy}
                onChange={(e) => setSubject(e.target.value)}
                className="h-8"
                placeholder="Subject"
              />
            </Field>
            <Field label="Message">
              <Textarea
                value={body}
                disabled={!active || busy}
                onChange={(e) => setBody(e.target.value)}
                className="max-h-48 min-h-24 resize-none"
                placeholder="Write your message..."
              />
            </Field>
            <div className="bg-muted/20 rounded-lg border p-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!active || busy}
                  onClick={() => setAssistOpen((v) => !v)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Help me fill this
                </button>
                {!assistOpen && (!subject || !body) ? (
                  <span className="text-muted-foreground/70 text-[11px]">
                    subject + message needed
                  </span>
                ) : null}
              </div>
              <AnimatePresence initial={false}>
                {assistOpen ? (
                  <motion.div
                    key="assist"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.16, ease: [0.2, 0.65, 0.3, 0.9] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-2">
                      <Input
                        value={assistPrompt}
                        disabled={!active || busy || assistBusy}
                        onChange={(e) => setAssistPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void assist();
                          }
                        }}
                        className="h-8"
                        placeholder="What should this email say?"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            "professional",
                            "concise",
                            "friendly",
                            "warm",
                          ] as const
                        ).map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            disabled={!active || busy || assistBusy}
                            onClick={() => setAssistTone(tone)}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] capitalize transition-colors disabled:opacity-50",
                              assistTone === tone
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "bg-background text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {tone}
                          </button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!active || busy || assistBusy}
                          onClick={() => void assist()}
                          className="ml-auto h-7 gap-1.5"
                        >
                          {assistBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Draft
                        </Button>
                      </div>
                      {assistError ? (
                        <InlineError message={assistError} />
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            {errorText ? <InlineError message={errorText} /> : null}
            <div className="flex gap-2">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  disabled={!active || busy || !canSend}
                  onClick={() => void run({ to, subject, body })}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />{" "}
                  {errorText ? "Retry" : "Send"}
                </Button>
              </motion.div>
              <Button
                size="sm"
                variant="ghost"
                disabled={!active || busy}
                onClick={reject}
              >
                {errorText ? "Cancel" : "Discard"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToolCard>
  );
}

/* ---- create_event / update_event ---- */
export function EventComposerCard({
  tool,
  args,
  status,
  respond,
}: WriteProps & { tool: "create_event" | "update_event" }) {
  const { phase, resultText, errorText, run, reject, busy } = useWriteAction(
    tool,
    respond,
  );
  const [summary, setSummary] = useState(str(args.summary));
  const [start, setStart] = useState(str(args.start));
  const [end, setEnd] = useState(str(args.end));
  const [location, setLocation] = useState(str(args.location));
  const [description, setDescription] = useState(str(args.description));
  const [attendees, setAttendees] = useState(
    Array.isArray(args.attendees)
      ? (args.attendees as string[]).join(", ")
      : "",
  );
  const [assistOpen, setAssistOpen] = useState(
    !str(args.summary) || !str(args.start) || !str(args.end),
  );
  const [assistPrompt, setAssistPrompt] = useState("");
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistError, setAssistError] = useState("");
  const active = status === ToolCallStatus.Executing && !!respond;
  const endAfterStart =
    !start || !end || new Date(end).getTime() > new Date(start).getTime();
  const canSaveEvent =
    summary.trim().length > 0 &&
    start.trim().length > 0 &&
    end.trim().length > 0 &&
    endAfterStart;
  const settled =
    phase === "done" || phase === "rejected"
      ? phase
      : status === ToolCallStatus.Complete && phase === "edit"
        ? "done"
        : null;

  function submit() {
    void run({
      ...(tool === "update_event" ? { id: str(args.id) } : {}),
      summary,
      start,
      end,
      location,
      description,
      attendees: attendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    });
  }

  async function assistEvent() {
    if (!active || busy || assistBusy) return;
    setAssistBusy(true);
    setAssistError("");
    try {
      const res = await fetch("/api/agent/compose-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "event",
          prompt: assistPrompt,
          summary,
          start,
          end,
          location,
          attendees,
          description,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const json = (await res.json()) as {
        summary?: unknown;
        start?: unknown;
        end?: unknown;
        location?: unknown;
        attendees?: unknown;
        description?: unknown;
        error?: unknown;
        patch?: {
          fields?: {
            summary?: unknown;
            start?: unknown;
            end?: unknown;
            location?: unknown;
            attendees?: unknown;
            description?: unknown;
          };
        };
      };
      if (!res.ok) throw new Error(str(json.error) || "Could not fill event.");
      const patchFields = json.patch?.fields;
      const nextSummary = str(patchFields?.summary) || str(json.summary);
      const nextStart = str(patchFields?.start) || str(json.start);
      const nextEnd = str(patchFields?.end) || str(json.end);
      const nextLocation = str(patchFields?.location) || str(json.location);
      const nextDescription =
        str(patchFields?.description) || str(json.description);
      if (nextSummary) setSummary(nextSummary);
      if (nextStart) setStart(nextStart);
      if (nextEnd) setEnd(nextEnd);
      if (nextLocation) setLocation(nextLocation);
      if (nextDescription) setDescription(nextDescription);
      const nextAttendees = patchFields?.attendees ?? json.attendees;
      if (Array.isArray(nextAttendees)) {
        setAttendees(
          nextAttendees
            .filter((v): v is string => typeof v === "string")
            .join(", "),
        );
      }
      setAssistOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not fill event.";
      setAssistError(message);
      toast.error(message);
    } finally {
      setAssistBusy(false);
    }
  }

  return (
    <ToolCard
      icon={CalendarDays}
      label={
        settled === "done"
          ? tool === "update_event"
            ? "Event updated"
            : "Event created"
          : tool === "update_event"
            ? "Edit event"
            : "Create event"
      }
      status="complete"
      tone={settled ? "default" : "warning"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {settled ? (
          <motion.div key="result" layout>
            <ActionResult
              phase={phase === "edit" ? "done" : phase}
              text={resultText || summary}
              rejectedText="Event discarded."
            />
          </motion.div>
        ) : phase === "sending" ? (
          <SendingOverlay key="sending" label="Saving event…" />
        ) : (
          <motion.div
            key="form"
            layout
            exit={{ opacity: 0, y: -4, transition: { duration: 0.18 } }}
            className="flex flex-col gap-3"
          >
            <Field label="Title">
              <Input
                value={summary}
                disabled={!active || busy}
                onChange={(e) => setSummary(e.target.value)}
                className="h-8"
                placeholder="Event title"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <Input
                  type="datetime-local"
                  value={toLocalInput(start)}
                  disabled={!active || busy}
                  onChange={(e) => setStart(fromLocalInput(e.target.value))}
                  className="h-8"
                />
              </Field>
              <Field label="End">
                <Input
                  type="datetime-local"
                  value={toLocalInput(end)}
                  disabled={!active || busy}
                  onChange={(e) => setEnd(fromLocalInput(e.target.value))}
                  className="h-8"
                />
              </Field>
            </div>
            {!endAfterStart ? (
              <InlineError message="End time must be after the start time." />
            ) : null}
            <Field label="Guests (comma-separated)">
              <Input
                value={attendees}
                disabled={!active || busy}
                onChange={(e) => setAttendees(e.target.value)}
                className="h-8"
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Location">
              <Input
                value={location}
                disabled={!active || busy}
                onChange={(e) => setLocation(e.target.value)}
                className="h-8"
                placeholder="Optional"
              />
            </Field>
            <div className="bg-muted/20 rounded-lg border p-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!active || busy}
                  onClick={() => setAssistOpen((v) => !v)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Help me fill this
                </button>
                {!assistOpen && !canSaveEvent ? (
                  <span className="text-muted-foreground/70 text-[11px]">
                    title + time needed
                  </span>
                ) : null}
              </div>
              <AnimatePresence initial={false}>
                {assistOpen ? (
                  <motion.div
                    key="event-assist"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.16, ease: [0.2, 0.65, 0.3, 0.9] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={assistPrompt}
                        disabled={!active || busy || assistBusy}
                        onChange={(e) => setAssistPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void assistEvent();
                          }
                        }}
                        className="h-8"
                        placeholder="e.g. coffee with Alex tomorrow 3pm for 30 minutes"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!active || busy || assistBusy}
                        onClick={() => void assistEvent()}
                        className="h-8 shrink-0 gap-1.5"
                      >
                        {assistBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Fill
                      </Button>
                    </div>
                    {assistError ? <InlineError message={assistError} /> : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            {errorText ? <InlineError message={errorText} /> : null}
            <div className="flex gap-2">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  disabled={!active || busy || !canSaveEvent}
                  onClick={submit}
                >
                  {errorText
                    ? "Retry"
                    : tool === "update_event"
                      ? "Update event"
                      : "Create event"}
                </Button>
              </motion.div>
              <Button
                size="sm"
                variant="ghost"
                disabled={!active || busy}
                onClick={reject}
              >
                {errorText ? "Cancel" : "Discard"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToolCard>
  );
}

/* ---- delete_event ---- */
function DeleteEventCard({ args, status, respond }: WriteProps) {
  const { phase, resultText, errorText, run, reject, busy } = useWriteAction(
    "delete_event",
    respond,
  );
  const active = status === ToolCallStatus.Executing && !!respond;
  const settled =
    phase === "done" || phase === "rejected"
      ? phase
      : status === ToolCallStatus.Complete && phase === "edit"
        ? "done"
        : null;

  return (
    <ToolCard
      icon={ShieldCheck}
      label={settled === "done" ? "Event cancelled" : "Cancel this event?"}
      status="complete"
      tone={settled ? "default" : "warning"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {settled ? (
          <motion.div key="result" layout>
            <ActionResult
              phase={phase === "edit" ? "done" : phase}
              text={resultText || "Event cancelled"}
              rejectedText="Kept the event."
            />
          </motion.div>
        ) : phase === "sending" ? (
          <SendingOverlay key="sending" label="Cancelling…" />
        ) : (
          <motion.div key="form" layout className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              This removes the event from your calendar.
            </p>
            {errorText ? <InlineError message={errorText} /> : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={!active || busy}
                onClick={() => void run({ id: str(args.id) })}
              >
                {errorText ? "Retry" : "Cancel event"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!active || busy}
                onClick={reject}
              >
                Keep it
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToolCard>
  );
}

/* ---- Quick inbox actions: archive / mark-read / star / label ---- */

function QuickActionCard({
  tool,
  args,
  status,
  respond,
  icon: Icon,
  cardLabel,
  confirmLabel,
  description,
  rejectedText,
}: WriteProps & {
  tool: WriteTool;
  icon: LucideIcon;
  cardLabel: string;
  confirmLabel: string;
  description: string;
  rejectedText: string;
}) {
  const { phase, resultText, errorText, run, reject, busy } = useWriteAction(
    tool,
    respond,
  );
  const active = status === ToolCallStatus.Executing && !!respond;
  const settled =
    phase === "done" || phase === "rejected"
      ? phase
      : status === ToolCallStatus.Complete && phase === "edit"
        ? "done"
        : null;

  return (
    <ToolCard
      icon={Icon}
      label={settled === "done" ? `${cardLabel} ✓` : cardLabel}
      status="complete"
      tone={settled ? "default" : "warning"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {settled ? (
          <motion.div key="result" layout>
            <ActionResult
              phase={phase === "edit" ? "done" : phase}
              text={resultText || confirmLabel}
              rejectedText={rejectedText}
            />
          </motion.div>
        ) : phase === "sending" ? (
          <SendingOverlay key="sending" label={`${confirmLabel}…`} />
        ) : (
          <motion.div key="form" layout className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">{description}</p>
            {errorText ? <InlineError message={errorText} /> : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!active || busy}
                onClick={() => void run(args)}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />{" "}
                {errorText ? "Retry" : confirmLabel}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!active || busy}
                onClick={reject}
              >
                Skip
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ *
 * ask_options — clarifying question with clickable MCQ choices.
 * ------------------------------------------------------------------ */

type AskProps = {
  args: {
    question?: string;
    options?: string[];
    inputType?:
      | "choice"
      | "text"
      | "datetime"
      | "contact"
      | "thread"
      | "event"
      | "workflow";
    defaultValue?: string;
    helperText?: string;
  };
  status: ToolCallStatus;
  respond: ((result: unknown) => Promise<void>) | undefined;
};

function AskOptionsCard({ args, status, respond }: AskProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  const question = args.question ?? "Which option?";
  const options = Array.isArray(args.options) ? args.options : [];
  const inputType = args.inputType ?? "choice";
  const active = status === ToolCallStatus.Executing && !!respond && !chosen;

  async function send(value: string) {
    const v = value.trim();
    if (!v || !respond || chosen) return;
    setChosen(v);
    await respond(v);
  }

  async function bestGuess() {
    if (!respond || chosen) return;
    const guess = options[0] ?? "Use your best judgment";
    setChosen(`[best guess] ${guess}`);
    await respond(
      `Use your best judgment — if pressed, lean toward: "${guess}"`,
    );
  }

  return (
    <ToolCard icon={ListChecks} label="Quick question" status="complete">
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{question}</p>
            <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-[11px]">
              {inputType}
            </span>
          </div>
          {args.helperText ? (
            <p className="text-muted-foreground text-xs">{args.helperText}</p>
          ) : null}
        </div>

        {chosen ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Check className="h-3.5 w-3.5 text-emerald-500" /> You chose:{" "}
            <span className="text-foreground font-medium">{chosen}</span>
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={!active}
                  onClick={() => send(opt)}
                  className={cn(
                    "group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                    "hover:border-foreground/20 hover:bg-accent transition-colors disabled:opacity-50",
                  )}
                >
                  <span>{opt}</span>
                  <Check className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-40" />
                </button>
              ))}

              {customOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={custom}
                    disabled={!active}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void send(custom);
                      }
                    }}
                    placeholder={args.defaultValue ?? "Type your answer..."}
                    className="focus-visible:border-foreground/20 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm focus-visible:outline-none"
                  />
                  <Button
                    size="sm"
                    disabled={!active || !custom.trim()}
                    onClick={() => void send(custom)}
                  >
                    Send
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setCustomOpen(true)}
                  className={cn(
                    "text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm",
                    "hover:bg-accent transition-colors disabled:opacity-50",
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" /> Something else…
                </button>
              )}

              {/* Use best guess — lets the agent proceed autonomously */}
              {!customOpen && options.length > 0 && (
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => void bestGuess()}
                  className={cn(
                    "text-muted-foreground/70 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs",
                    "hover:bg-accent hover:text-muted-foreground transition-colors disabled:opacity-50",
                  )}
                >
                  <Sparkles className="h-3 w-3" /> Use best guess
                </button>
              )}
            </div>
            {!active && !chosen ? (
              <p className="text-muted-foreground text-xs">Waiting…</p>
            ) : null}
          </>
        )}
      </div>
    </ToolCard>
  );
}

function riskTone(
  risk?: IntentRouteResult["riskLevel"] | GenerativeSurfaceResult["riskLevel"],
) {
  if (risk === "high") return "text-destructive";
  if (risk === "medium") return "text-amber-600 dark:text-amber-400";
  if (risk === "low") return "text-sky-600 dark:text-sky-400";
  return "text-muted-foreground";
}

/** Build a (possibly partial) RouterTrace from streamed params or the final result. */
function toRouterTrace(
  parameters: Partial<IntentRouteResult> | undefined,
  result: IntentRouteResult | null,
): RouterTrace | undefined {
  const src = result ?? parameters;
  if (!src || (!src.intent && !src.targetAgent)) return undefined;
  return {
    intent: str(src.intent) || "…",
    confidence: typeof src.confidence === "number" ? src.confidence : 0,
    targetAgent: str(src.targetAgent),
    reasonCode: str(src.reasonCode),
    riskLevel: src.riskLevel ?? "none",
    missingFields: Array.isArray(src.missingFields) ? src.missingFields : [],
  };
}

/**
 * Router decision. The detail now lives in a live tooltip on the thinking-dot
 * (AgentActivityStrip) — fed via the activity store as Mastra streams the
 * show_router_trace args. Inline we keep only a quiet one-line marker so the
 * transcript stays clean.
 */
function RouterTraceCard({
  status,
  parameters,
  result,
}: {
  status: RenderStatus;
  parameters?: Partial<IntentRouteResult>;
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<IntentRouteResult>(result) : null;
  const trace = toRouterTrace(parameters, data);
  useActivityReporting(
    "show_router_trace",
    status === "complete" ? "Understood request" : "Understanding request…",
    trace ? `${trace.intent} → ${trace.targetAgent}` : "",
    status === "complete" ? "done" : "running",
    undefined,
    trace,
  );

  return (
    <div className="text-muted-foreground/70 my-1 flex items-center gap-2 px-1 text-xs">
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {status === "complete"
          ? "Understood request"
          : "Understanding request…"}
        {trace?.intent && trace.intent !== "…"
          ? ` · ${trace.intent.replace(/_/g, " ")}`
          : ""}
      </span>
    </div>
  );
}

function GenerativeSurfaceCard({
  status,
  result,
}: {
  status: RenderStatus;
  result?: string;
}) {
  const data =
    status === "complete" ? parseResult<GenerativeSurfaceResult>(result) : null;
  const { ask, busy } = useInteract();
  const surfaceType = labelize(data?.surfaceType, "generated surface");
  const surfaceStatus = labelize(
    data?.status,
    status === "complete" ? "ready" : "running",
  );
  const summary = str(data?.summary);
  const icon =
    data?.surfaceType === "error"
      ? PlugZap
      : data?.surfaceType === "workflow_preview"
        ? WorkflowIcon
        : Zap;

  useActivityReporting(
    "render_surface",
    data?.title ??
      (status === "complete" ? "Generated surface" : "Generating surface..."),
    data?.surfaceType ?? "",
    status === "complete"
      ? data?.status === "error"
        ? "error"
        : "done"
      : "running",
    data?.summary,
  );

  return (
    <ToolCard
      icon={icon}
      label={data?.title ?? "Generating interface..."}
      status={status}
      tone={data?.status === "error" ? "warning" : "default"}
    >
      {status !== "complete" ? (
        <div className="space-y-2">
          <div className="bg-muted h-3 w-3/4 rounded" />
          <div className="bg-muted h-3 w-1/2 rounded" />
        </div>
      ) : data ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs">
                {surfaceType}
              </span>
              <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs">
                {surfaceStatus}
              </span>
              {data.riskLevel && data.riskLevel !== "none" ? (
                <span
                  className={cn(
                    "bg-muted rounded-md px-2 py-1 text-xs",
                    riskTone(data.riskLevel),
                  )}
                >
                  {data.riskLevel} risk
                </span>
              ) : null}
            </div>
            {summary ? (
              <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-ul:my-1.5 max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{summary}</Markdown>
              </div>
            ) : null}
          </div>

          {data.data && data.data.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.data.map((item) => (
                <div
                  key={`${item.label}:${item.value}`}
                  className="rounded-lg border px-3 py-2"
                >
                  <p className="text-muted-foreground text-xs">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {data.provenance && data.provenance.length > 0 ? (
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                Based on
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.provenance.map((item) => (
                  <span
                    key={item}
                    className="bg-background rounded-md px-2 py-1 text-xs"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {data.actions && data.actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.actions.map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant={
                    action.variant === "primary"
                      ? "default"
                      : action.variant === "destructive"
                        ? "destructive"
                        : "outline"
                  }
                  disabled={busy}
                  onClick={() => ask(action.prompt)}
                  className="gap-1.5"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  {action.label}
                </Button>
              ))}
            </div>
          ) : data.requiresInput ? (
            <p className="text-muted-foreground text-xs">
              Waiting for your input...
            </p>
          ) : null}
        </div>
      ) : (
        <InlineError message="Could not render generated interface." />
      )}
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ *
 * DocumentArtifact
 * ------------------------------------------------------------------ */

function sanitizeFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "document"}.md`;
}

function DocumentArtifact({
  title,
  content,
}: {
  title?: string;
  content?: string;
}) {
  const body = content ?? "";
  const heading = title?.trim() ? title : "Document";

  function copy() {
    void navigator.clipboard
      .writeText(body)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Couldn't copy"));
  }

  function download() {
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFilename(heading);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-card my-2 w-full overflow-hidden rounded-xl border shadow-sm">
      <div className="bg-muted/30 flex items-center gap-2 border-b px-3.5 py-2">
        <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-sm font-medium">{heading}</span>
        <button
          type="button"
          onClick={copy}
          title="Copy"
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1 transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={download}
          title="Download .md"
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[28rem] overflow-y-auto px-5 py-4">
        <article className="prose prose-sm dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
        </article>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * WorkflowPreviewCard
 * ------------------------------------------------------------------ */

type WorkflowArgs = {
  name?: string;
  workflowId?: string;
  trigger?: { type?: string; config?: Record<string, string> };
  nodes?: { type?: string; config?: Record<string, string> }[];
};

function isTriggerType(t: string | undefined): t is TriggerType {
  return t === "email" || t === "schedule" || t === "calendar";
}

function cfgText(config?: Record<string, string>): string {
  if (!config) return "";
  return Object.entries(config)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export function WorkflowPreviewCard({ args, status, respond }: WriteProps) {
  const a = args as WorkflowArgs;
  const create = api.workflows.createFromSpec.useMutation();
  const update = api.workflows.update.useMutation();
  const utils = api.useUtils();

  const [name, setName] = useState(
    a.name?.trim() ? a.name : "Untitled workflow",
  );
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("edit");
  const [savedId, setSavedId] = useState<string | null>(null);

  const triggerType = isTriggerType(a.trigger?.type) ? a.trigger.type : "email";
  const editId = a.workflowId?.trim() ? a.workflowId : null;
  const steps = (a.nodes ?? [])
    .map((n) => n.type)
    .filter((t): t is NodeType => !!t && t in NODE_META)
    .filter((t) => NODE_META[t].triggers.includes(triggerType));

  const active = status === ToolCallStatus.Executing && !!respond;
  const busy = phase === "sending";
  const canSaveWorkflow = name.trim().length > 0 && steps.length > 0;

  async function confirm() {
    if (!respond || phase !== "edit") return;
    setPhase("sending");
    const nodes = steps.map((t, i) => ({
      id: `${editId ?? "step"}-${i}`,
      type: t,
      config: (a.nodes ?? []).find((n) => n.type === t)?.config ?? {},
    }));
    const trigger = { type: triggerType, config: a.trigger?.config ?? {} };
    try {
      let id: string;
      if (editId) {
        await update.mutateAsync({ id: editId, name, enabled, trigger, nodes });
        id = editId;
      } else {
        const res = await create.mutateAsync({ name, enabled, trigger, nodes });
        if (!res.ok) throw new Error(res.error);
        id = res.id;
      }
      await new Promise((r) => setTimeout(r, 320));
      setSavedId(id);
      setPhase("done");
      void utils.workflows.list.invalidate();
      toast.success(editId ? "Workflow updated" : "Workflow created");
      await respond(`${editId ? "Updated" : "Created"} workflow "${name}".`);
    } catch (e) {
      setPhase("edit");
      toast.error(
        e instanceof Error ? e.message : "Could not save the workflow",
      );
    }
  }

  async function discard() {
    if (!respond || phase !== "edit") return;
    setPhase("rejected");
    await respond("Discarded the workflow.");
  }

  const settled =
    phase === "done" || phase === "rejected"
      ? phase
      : status === ToolCallStatus.Complete && phase === "edit"
        ? "done"
        : null;

  return (
    <ToolCard
      icon={WorkflowIcon}
      label={
        settled === "done"
          ? editId
            ? "Workflow updated"
            : "Workflow created"
          : editId
            ? "Review changes"
            : "New workflow"
      }
      status="complete"
      tone={settled ? "default" : "warning"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {settled === "done" ? (
          <motion.div
            key="done"
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Saved to your Workflows.
            </div>
            {savedId ? (
              <a
                href={`/dashboard/workflows/${savedId}`}
                className="text-primary inline-flex w-fit items-center gap-1.5 text-xs font-medium hover:underline"
              >
                Open in editor <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </motion.div>
        ) : settled === "rejected" ? (
          <p className="text-muted-foreground text-sm">Workflow discarded.</p>
        ) : (
          <motion.div
            key="form"
            layout
            exit={{ opacity: 0, y: -4, transition: { duration: 0.16 } }}
            className="flex flex-col gap-3"
          >
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Name</Label>
              <Input
                value={name}
                disabled={!active || busy}
                onChange={(e) => setName(e.target.value)}
                className="h-8"
                placeholder="Workflow name"
              />
            </div>
            <div className="bg-muted/30 rounded-lg border p-3">
              <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Zap className="h-3.5 w-3.5" /> When
              </div>
              <p className="text-sm">
                {TRIGGER_META[triggerType].label}
                {cfgText(a.trigger?.config) ? (
                  <span className="text-muted-foreground ml-1">
                    · {cfgText(a.trigger?.config)}
                  </span>
                ) : null}
              </p>
              {steps.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {steps.map((t, i) => {
                    const sc = cfgText(
                      (a.nodes ?? []).find((n) => n.type === t)?.config,
                    );
                    return (
                      <span
                        key={`${t}-${i}`}
                        className="flex items-center gap-1.5"
                      >
                        {i > 0 ? (
                          <ArrowRight className="text-muted-foreground/50 h-3 w-3" />
                        ) : null}
                        <span className="bg-background rounded-md border px-2 py-1 text-xs font-medium">
                          {NODE_META[t].label}
                          {sc ? (
                            <span className="text-muted-foreground ml-1 font-normal">
                              {sc}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  No steps yet. Open the editor to add actions.
                </p>
              )}
            </div>
            <label className="flex items-center justify-between">
              <span className="text-sm">Turn on immediately</span>
              <Switch
                checked={enabled}
                disabled={!active || busy}
                onCheckedChange={setEnabled}
              />
            </label>
            <div className="flex gap-2">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  disabled={!active || busy || !canSaveWorkflow}
                  onClick={confirm}
                >
                  {busy
                    ? "Saving…"
                    : editId
                      ? "Save changes"
                      : "Create workflow"}
                </Button>
              </motion.div>
              {!canSaveWorkflow ? (
                <Link
                  href="/dashboard/workflows"
                  className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors"
                >
                  Open editor
                </Link>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={!active || busy}
                onClick={discard}
              >
                Discard
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ *
 * ToolRenderers — registration host. Mounted once where the chat lives.
 * ------------------------------------------------------------------ */

export function ToolRenderers() {
  const { agent } = useAgent({
    agentId: "default",
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });
  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = agent.isRunning;
  }, [agent.isRunning]);
  useEffect(
    () => () => {
      if (runningRef.current) agent.abortRun();
    },
    [agent],
  );

  /* ── Read tools ── */
  useRenderTool({
    name: "search_email",
    parameters: z.object({ query: z.string() }),
    render: (props) => <SearchEmailCard {...props} />,
  });

  useRenderTool({
    name: "semantic_search_email",
    parameters: z.object({ query: z.string() }),
    render: (props) => <SemanticSearchEmailCard {...props} />,
  });

  useRenderTool({
    name: "get_thread",
    parameters: z.object({ threadId: z.string() }),
    render: (props) => <GetThreadCard {...props} />,
  });

  useRenderTool({
    name: "draft_email_only",
    parameters: z.object({ threadId: z.string(), instructions: z.string() }),
    render: (props) => <DraftEmailOnlyCard {...props} />,
  });

  useRenderTool({
    name: "list_events",
    parameters: z.object({ timeMin: z.string(), timeMax: z.string() }),
    render: (props) => <ListEventsCard {...props} />,
  });

  useRenderTool({
    name: "find_free_time",
    parameters: z.object({
      timeMin: z.string(),
      timeMax: z.string(),
      durationMinutes: z.number(),
    }),
    render: (props) => <FindFreeTimeCard {...props} />,
  });

  useRenderTool({
    name: "list_workflows",
    parameters: z.object({}),
    render: (props) => <ListWorkflowsCard {...props} />,
  });

  useRenderTool({
    name: "get_connection_status",
    parameters: z.object({}),
    render: (props) => <ConnectionStatusCard {...props} />,
  });

  useRenderTool({
    name: "show_markdown",
    parameters: z.object({ title: z.string(), markdown: z.string() }),
    render: (props) => <ShowMarkdownCard {...props} />,
  });

  useRenderTool({
    name: "create_document",
    parameters: z.object({ title: z.string(), content: z.string() }),
    render: ({ status, parameters }) => {
      if (status === "inProgress") {
        return (
          <ToolCard icon={FileText} label="Writing document…" status={status} />
        );
      }
      return (
        <DocumentArtifact
          title={parameters.title}
          content={parameters.content ?? ""}
        />
      );
    },
  });

  useRenderTool({
    name: "show_router_trace",
    parameters: z.object({
      intent: z.string(),
      confidence: z.number(),
      targetAgent: z.string(),
      missingFields: z.array(z.string()),
      riskLevel: z.enum(["none", "low", "medium", "high"]),
      reasonCode: z.string(),
    }),
    render: (props) => <RouterTraceCard {...props} />,
  });

  useRenderTool({
    name: "render_surface",
    parameters: z.object({
      surfaceType: z.string(),
      title: z.string(),
      status: z.string(),
      summary: z
        .string()
        .describe(
          "ONE short sentence (max ~140 chars). Never a full report or raw markdown list. Put itemized detail in `data`.",
        ),
      data: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .optional()
        .describe(
          "Itemized detail as label/value rows. Use this for lists instead of writing them into summary.",
        ),
      actions: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            prompt: z.string(),
            variant: z.enum(["primary", "secondary", "destructive"]).optional(),
          }),
        )
        .optional(),
      requiresInput: z.boolean().optional(),
      riskLevel: z.enum(["none", "low", "medium", "high"]).optional(),
      provenance: z.array(z.string()).optional(),
    }),
    render: (props) => <GenerativeSurfaceCard {...props} />,
  });

  /* ── Clarification ── */
  useHumanInTheLoop({
    name: "ask_options",
    description:
      "Ask the user a clarifying question with selectable options when you need info to " +
      "proceed. Provide 2-5 concise, relevant options. The user can also type a custom answer " +
      "or choose 'Use best guess' to let the agent proceed autonomously. Always set inputType to 'choice'.",
    parameters: z.object({
      question: z.string(),
      options: z.array(z.string()),
      inputType: z.literal("choice"),
    }),
    render: (props) => <AskOptionsCard {...(props as unknown as AskProps)} />,
  });

  /* ── Workflow builder ── */
  useHumanInTheLoop({
    name: "create_workflow",
    description:
      "Create or edit a Helm automation. Provide a name, a trigger {type, config} where type " +
      "is email|schedule|calendar, and ordered nodes [{type, config}] from the catalog. Pass " +
      "workflowId to edit an existing workflow (empty string to create). Shows the user a " +
      "preview to confirm before saving. Call this tool to open the workflow composer even when " +
      "details are incomplete; use a concise default name, a sensible default trigger, and an " +
      "empty nodes array so the UI can collect/review details. Do not answer with markdown.",
    parameters: z.object({
      name: z.string(),
      workflowId: z.string(),
      trigger: z.object({
        type: z.string(),
        config: z.object({}).catchall(z.string()),
      }),
      nodes: z.array(
        z.object({
          type: z.string(),
          config: z.object({}).catchall(z.string()),
        }),
      ),
    }),
    render: (props) => (
      <WorkflowPreviewCard {...(props as unknown as WriteProps)} />
    ),
  });

  /* ── Write tools (full editors) ── */
  useHumanInTheLoop({
    name: "send_email",
    description:
      "Open the compact email composer and approval UI. Call this whenever the user asks to " +
      "compose or send an email, even when subject/body/recipient are missing. Prefill known " +
      "fields and pass empty strings for unknown fields. Do not answer with markdown, tables, " +
      "or prose instructions.",
    parameters: writeSchemas.send_email,
    render: (props) => (
      <EmailComposerCard {...(props as unknown as WriteProps)} />
    ),
  });
  useHumanInTheLoop({
    name: "create_event",
    description:
      "Open the compact calendar event composer and approval UI. Call this whenever the user " +
      "asks to schedule/create/add an event, even when title/start/end are missing. Prefill " +
      "known fields and pass empty strings for unknown fields. Do not answer with markdown.",
    parameters: writeSchemas.create_event,
    render: (props) => (
      <EventComposerCard
        tool="create_event"
        {...(props as unknown as WriteProps)}
      />
    ),
  });
  useHumanInTheLoop({
    name: "update_event",
    description:
      "Open the compact calendar event editor and approval UI. Use an existing event id from " +
      "calendar results, prefill known fields, and pass empty strings for unknown editable fields.",
    parameters: writeSchemas.update_event,
    render: (props) => (
      <EventComposerCard
        tool="update_event"
        {...(props as unknown as WriteProps)}
      />
    ),
  });
  useHumanInTheLoop({
    name: "delete_event",
    description: "Cancel/delete a calendar event. Requires approval.",
    parameters: writeSchemas.delete_event,
    render: (props) => (
      <DeleteEventCard {...(props as unknown as WriteProps)} />
    ),
  });

  /* ── Quick inbox actions ── */
  useHumanInTheLoop({
    name: "archive_thread",
    description:
      "Archive (remove from inbox) an email thread. Requires a single confirm.",
    parameters: writeSchemas.archive_thread,
    render: (props) => (
      <QuickActionCard
        tool="archive_thread"
        icon={Archive}
        cardLabel={`Archive "${str((props.args as Record<string, unknown>).subject)}"`}
        confirmLabel="Archive"
        description={`Remove "${str((props.args as Record<string, unknown>).subject)}" from your inbox.`}
        rejectedText="Kept in inbox."
        {...(props as unknown as WriteProps)}
      />
    ),
  });
  useHumanInTheLoop({
    name: "mark_thread_read",
    description: "Mark an email thread as read. Requires a single confirm.",
    parameters: writeSchemas.mark_thread_read,
    render: (props) => (
      <QuickActionCard
        tool="mark_thread_read"
        icon={CheckSquare2}
        cardLabel={`Mark as read`}
        confirmLabel="Mark read"
        description={`Mark "${str((props.args as Record<string, unknown>).subject)}" as read.`}
        rejectedText="Left as unread."
        {...(props as unknown as WriteProps)}
      />
    ),
  });
  useHumanInTheLoop({
    name: "star_thread",
    description: "Star an email thread. Requires a single confirm.",
    parameters: writeSchemas.star_thread,
    render: (props) => (
      <QuickActionCard
        tool="star_thread"
        icon={Star}
        cardLabel={`Star email`}
        confirmLabel="Star"
        description={`Star "${str((props.args as Record<string, unknown>).subject)}" for quick access.`}
        rejectedText="Not starred."
        {...(props as unknown as WriteProps)}
      />
    ),
  });
  useHumanInTheLoop({
    name: "label_thread",
    description: "Apply a label to an email thread. Requires a single confirm.",
    parameters: writeSchemas.label_thread,
    render: (props) => (
      <QuickActionCard
        tool="label_thread"
        icon={Tag}
        cardLabel={`Label → ${str((props.args as Record<string, unknown>).labelName)}`}
        confirmLabel="Apply label"
        description={`Apply label "${str((props.args as Record<string, unknown>).labelName)}" to "${str((props.args as Record<string, unknown>).subject)}".`}
        rejectedText="No label applied."
        {...(props as unknown as WriteProps)}
      />
    ),
  });

  useDefaultRenderTool();

  void WRITE_TOOLS;
  return null;
}
