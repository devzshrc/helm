"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND } from "~/lib/brand";

/* ─── nav items (matches app-sidebar.tsx navMain order + icons) ─────────── */
const NAV = [
  {
    label: "Agent",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4 shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.05-6.95-2.12 2.12M7.17 16.83l-2.12 2.12m0-12.02 2.12 2.12m7.54 7.54 2.12 2.12" />
      </svg>
    ),
  },
  {
    label: "Inbox",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4 shrink-0"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 8 10 6 10-6" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4 shrink-0"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    label: "Workflows",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4 shrink-0"
      >
        <rect x="2" y="3" width="6" height="6" rx="1" />
        <rect x="16" y="3" width="6" height="6" rx="1" />
        <rect x="9" y="15" width="6" height="6" rx="1" />
        <path d="M5 9v3h14V9M12 15v-3" />
      </svg>
    ),
  },
  {
    label: "Settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4 shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
      </svg>
    ),
  },
];

/* The views the preview auto-cycles through, mapped to their NAV label. */
const VIEWS = ["Agent", "Calendar", "Workflows"] as const;
const VIEW_MS = [6500, 3600, 3600]; // dwell per view

/* ─── conversation loop ──────────────────────────────────────────────────── */
interface EmailCard {
  type: "email";
  from: string;
  subject: string;
  badge: string;
}
interface CalendarCard {
  type: "calendar";
  events: { time: string; title: string; color: string }[];
}
interface DraftCard {
  type: "draft";
  to: string;
  body: string;
}
type AnyCard = EmailCard | CalendarCard | DraftCard;

interface Turn {
  user: string;
  thinking: string[];
  reply: string;
  card: AnyCard;
  pills: string[];
}

const TURNS: Turn[] = [
  {
    user: "Summarize my unread mail and flag anything urgent",
    thinking: ["Reading inbox…", "Scanning threads…", "Ranking by priority…"],
    reply: "You have **4 unread emails**. One urgent:",
    card: {
      type: "email",
      from: "Sara Chen",
      subject: "Contract renewal — needs your signature by Friday",
      badge: "Urgent",
    },
    pills: ["Draft a reply", "Mark as read", "Open thread"],
  },
  {
    user: "What's on my calendar today?",
    thinking: ["Fetching events…", "Checking conflicts…"],
    reply: "You have **3 events** today:",
    card: {
      type: "calendar",
      events: [
        { time: "9:00 AM", title: "Standup", color: "bg-blue-400" },
        { time: "2:00 PM", title: "Design review", color: "bg-violet-400" },
        { time: "4:30 PM", title: "1:1 with Liam", color: "bg-emerald-400" },
      ],
    },
    pills: ["Add a meeting", "Reschedule 2 PM", "Block focus time"],
  },
  {
    user: "Draft a reply to Sara about the contract",
    thinking: ["Reading thread…", "Composing draft…"],
    reply: "Here's a draft reply:",
    card: {
      type: "draft",
      to: "Sara Chen",
      body: "Hi Sara, thanks for the reminder. I'll review and sign the contract by Thursday EOD. Let me know if you need anything else.",
    },
    pills: ["Send it", "Edit draft", "Add CC"],
  },
];

function ThinkingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="bg-muted-foreground/60 block size-[3px] rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
      <span className="text-muted-foreground text-[10px]">{label}</span>
    </div>
  );
}

function DraftTyping({ body }: { body: string }) {
  const [revealed, setRevealed] = useState(0);
  const words = body.split(" ");
  useEffect(() => {
    setRevealed(0);
  }, [body]);
  useEffect(() => {
    if (revealed >= words.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 45);
    return () => clearTimeout(t);
  }, [revealed, words.length]);
  return (
    <p className="text-foreground text-[10px] leading-relaxed">
      {words.slice(0, revealed).join(" ")}
      {revealed < words.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="bg-foreground ml-px inline-block h-[10px] w-px align-middle"
        />
      )}
    </p>
  );
}

/* ─── Agent pane (the conversation, self-driving) ────────────────────────── */
function AgentPane() {
  const [turn, setTurn] = useState(0);
  // phases: 0=user msg, 1=thinking, 2=reply+card, 3=pills, 4=pause
  const [phase, setPhase] = useState(0);
  const [thinkIdx, setThinkIdx] = useState(0);

  const current = TURNS[turn % TURNS.length]!;

  useEffect(() => {
    const durations: Record<number, number> = {
      0: 550,
      1: 1100,
      2: 450,
      3: 1700,
      4: 350,
    };
    const t = setTimeout(() => {
      if (phase < 4) {
        setPhase((p) => p + 1);
        if (phase === 0) setThinkIdx(0);
      } else {
        setPhase(0);
        setTurn((n) => n + 1);
      }
    }, durations[phase] ?? 800);
    return () => clearTimeout(t);
  }, [phase, turn]);

  useEffect(() => {
    if (phase !== 1) return;
    const t = setInterval(() => setThinkIdx((i) => i + 1), 550);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="bg-muted/40 text-muted-foreground flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="size-3"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Morning triage
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="size-3 opacity-50"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="ml-auto" />
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={turn}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <div className="bg-primary text-primary-foreground max-w-[76%] rounded-2xl rounded-tr-sm px-3 py-2 text-[11px] leading-relaxed">
                {current.user}
              </div>
            </motion.div>

            {phase === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2"
              >
                <div className="bg-muted mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border">
                  <motion.svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="text-muted-foreground size-3.5"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.05-6.95-2.12 2.12M7.17 16.83l-2.12 2.12m0-12.02 2.12 2.12m7.54 7.54 2.12 2.12" />
                  </motion.svg>
                </div>
                <div className="bg-card rounded-2xl rounded-tl-sm border px-3 py-2">
                  <ThinkingDots
                    label={
                      current.thinking[thinkIdx % current.thinking.length]!
                    }
                  />
                </div>
              </motion.div>
            )}

            {phase >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2"
              >
                <div className="bg-muted mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="text-muted-foreground size-3.5"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.05-6.95-2.12 2.12M7.17 16.83l-2.12 2.12m0-12.02 2.12 2.12m7.54 7.54 2.12 2.12" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="bg-card space-y-1.5 rounded-2xl rounded-tl-sm border px-3 py-2.5">
                    <p
                      className="text-card-foreground text-[11px] leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: current.reply.replace(
                          /\*\*(.*?)\*\*/g,
                          "<strong>$1</strong>",
                        ),
                      }}
                    />

                    {current.card.type === "email" && (
                      <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-background/60 flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground text-[10px] font-semibold">
                            {current.card.from}
                          </p>
                          <p className="text-muted-foreground truncate text-[10px]">
                            {current.card.subject}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">
                          {current.card.badge}
                        </span>
                      </motion.div>
                    )}

                    {current.card.type === "calendar" &&
                      (() => {
                        const cal = current.card;
                        return (
                          <div className="space-y-1">
                            {cal.events.map((ev, i) => (
                              <motion.div
                                key={ev.title}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.09 }}
                                className="bg-background/60 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                              >
                                <div
                                  className={`size-1.5 shrink-0 rounded-full ${ev.color}`}
                                />
                                <span className="text-muted-foreground w-12 shrink-0 text-[10px]">
                                  {ev.time}
                                </span>
                                <span className="text-foreground text-[10px] font-medium">
                                  {ev.title}
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        );
                      })()}

                    {current.card.type === "draft" && (
                      <div className="bg-background/60 space-y-1 rounded-lg border px-2.5 py-2">
                        <p className="text-muted-foreground text-[9px]">
                          To: {current.card.to}
                        </p>
                        <DraftTyping body={current.card.body} />
                      </div>
                    )}
                  </div>

                  {phase >= 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 flex flex-wrap gap-1"
                    >
                      {current.pills.map((p, i) => (
                        <motion.div
                          key={p}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.07 }}
                          className="bg-card/50 text-muted-foreground rounded-full border px-2.5 py-1 text-[10px]"
                        >
                          {p}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="border-t px-3 py-2.5">
        <div className="bg-muted/30 flex items-center gap-2 rounded-xl border px-3.5 py-2">
          <span className="text-muted-foreground/50 flex-1 text-[11px]">
            Message {BRAND}…
          </span>
          <div className="flex items-center gap-1.5">
            <div className="text-muted-foreground/40 flex size-6 items-center justify-center rounded-full border">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="size-3"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4m-4 0h8" />
              </svg>
            </div>
            <motion.div
              className="bg-primary/20 flex size-6 items-center justify-center rounded-full"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="text-primary size-3"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Calendar pane (mirrors calendar-view week grid) ────────────────────── */
const CAL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAL_DATES = [10, 11, 12, 13, 14, 15, 16];
const CAL_TODAY = 3; // index of "today"
const CAL_EVENTS: {
  day: number;
  top: number;
  h: number;
  title: string;
  time: string;
  cls: string;
}[] = [
  {
    day: 0,
    top: 14,
    h: 26,
    title: "Standup",
    time: "9:00",
    cls: "border-blue-300/50 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  {
    day: 2,
    top: 40,
    h: 34,
    title: "Design review",
    time: "2 PM",
    cls: "border-violet-300/50 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  {
    day: 3,
    top: 22,
    h: 22,
    title: "1:1 · Liam",
    time: "11 AM",
    cls: "border-emerald-300/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    day: 3,
    top: 58,
    h: 30,
    title: "Roadmap sync",
    time: "4 PM",
    cls: "border-amber-300/50 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    day: 5,
    top: 30,
    h: 28,
    title: "Customer call",
    time: "1 PM",
    cls: "border-blue-300/50 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
];

function CalendarPane() {
  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-foreground text-[12px] font-semibold">
          June 2026
        </span>
        <div className="text-muted-foreground ml-1 flex items-center gap-0.5">
          <span className="grid size-5 place-items-center rounded border">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="size-3"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </span>
          <span className="grid size-5 place-items-center rounded border">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="size-3"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </div>
        <div className="bg-muted/40 ml-auto flex items-center gap-0.5 rounded-md border p-0.5 text-[10px]">
          {["Day", "Week", "Month"].map((v) => (
            <span
              key={v}
              className={`rounded px-1.5 py-0.5 ${v === "Week" ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Day header */}
      <div
        className="grid shrink-0 border-b text-center"
        style={{ gridTemplateColumns: "2rem repeat(7, 1fr)" }}
      >
        <div />
        {CAL_DAYS.map((d, i) => (
          <div key={d} className="py-1.5">
            <div className="text-muted-foreground text-[9px] tracking-wide uppercase">
              {d}
            </div>
            <div
              className={`mx-auto mt-0.5 grid size-5 place-items-center rounded-full text-[10px] font-medium ${i === CAL_TODAY ? "bg-primary text-primary-foreground" : "text-foreground"}`}
            >
              {CAL_DATES[i]}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: "2rem repeat(7, 1fr)" }}
      >
        {/* hour gutter */}
        <div className="text-muted-foreground/70 flex flex-col justify-between border-r py-1 pr-1 text-right text-[8px]">
          {["9", "12", "3", "6"].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {CAL_DAYS.map((d, ci) => (
          <div
            key={d}
            className="relative border-r [background-image:repeating-linear-gradient(to_bottom,transparent,transparent_27px,rgba(125,125,140,0.12)_28px)]"
          >
            {CAL_EVENTS.filter((e) => e.day === ci).map((e) => (
              <motion.div
                key={e.title}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.1 + ci * 0.04,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                className={`absolute inset-x-0.5 overflow-hidden rounded-md border px-1 py-0.5 ${e.cls}`}
                style={{ top: `${e.top}%`, height: `${e.h}%` }}
              >
                <p className="truncate text-[8px] leading-tight font-semibold">
                  {e.title}
                </p>
                <p className="truncate text-[7px] opacity-70">{e.time}</p>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Workflows pane (mirrors workflows-list) ────────────────────────────── */
const WF_FILTERS = ["Active", "Email", "Calendar", "Schedule"];
const WORKFLOWS: {
  name: string;
  trigger: string;
  on: boolean;
  cls: string;
  icon: React.ReactNode;
}[] = [
  {
    name: "Auto-label receipts & archive",
    trigger: "On new email",
    on: true,
    cls: "text-blue-500",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 8 10 6 10-6" />
      </svg>
    ),
  },
  {
    name: "Meeting prep brief",
    trigger: "On calendar event",
    on: true,
    cls: "text-emerald-500",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    name: "Daily inbox digest",
    trigger: "Every day · 8:00 AM",
    on: false,
    cls: "text-amber-500",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="size-4"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

function WorkflowsPane() {
  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <p className="text-foreground text-[12px] font-semibold">Workflows</p>
          <p className="text-muted-foreground text-[9px]">
            Automate Gmail &amp; Calendar. No code.
          </p>
        </div>
        <span className="border-primary/30 bg-primary/10 text-primary flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className="size-3"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-3">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-1">
          {WF_FILTERS.map((f, i) => (
            <span
              key={f}
              className={`rounded-full border px-2 py-0.5 text-[9px] ${i === 0 ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {f}
            </span>
          ))}
        </div>

        {/* Workflow cards */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
          className="flex flex-col gap-2"
        >
          {WORKFLOWS.map((wf) => (
            <motion.div
              key={wf.name}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              className="bg-card flex items-center gap-3 rounded-xl border px-3 py-2.5"
            >
              <span className={wf.cls}>{wf.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-[11px] font-medium">
                  {wf.name}
                </p>
                <p className="text-muted-foreground truncate text-[9px]">
                  {wf.trigger}
                  <span className="text-emerald-500"> · valid</span>
                </p>
              </div>
              {/* toggle */}
              <span
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${wf.on ? "bg-primary" : "bg-muted-foreground/25"}`}
              >
                <span
                  className={`bg-background absolute top-0.5 size-3 rounded-full shadow-sm transition-all ${wf.on ? "left-3.5" : "left-0.5"}`}
                />
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </>
  );
}

/* ─── Shell: sidebar + auto-cycling main ─────────────────────────────────── */
export function DashboardPreview() {
  const [view, setView] = useState(0);

  useEffect(() => {
    const t = setTimeout(
      () => setView((v) => (v + 1) % VIEWS.length),
      VIEW_MS[view],
    );
    return () => clearTimeout(t);
  }, [view]);

  const activeLabel = VIEWS[view];

  return (
    <div className="bg-background text-foreground flex h-full w-full overflow-hidden rounded-2xl">
      {/* ── Sidebar ── */}
      <aside className="bg-sidebar flex w-[168px] shrink-0 flex-col border-r">
        <div className="flex items-center gap-2 p-4 pb-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="text-sidebar-foreground size-5 shrink-0"
          >
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v14M5 11H2a10 10 0 0 0 20 0h-3" />
          </svg>
          <span className="text-sidebar-foreground font-serif text-xl">
            {BRAND}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-1">
          <div className="flex flex-col gap-[3px]">
            {NAV.map((item) => {
              const active = item.label === activeLabel;
              return (
                <div
                  key={item.label}
                  className={`relative flex w-full items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="preview-nav-active"
                      className="bg-sidebar-accent absolute inset-0 -z-10 rounded-lg"
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 30,
                      }}
                    />
                  )}
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="border-sidebar-border border-t p-2">
          <div className="flex w-full items-center gap-2 rounded-lg px-2 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://pbs.twimg.com/profile_images/2056130595688939521/FVaB42Oj_400x400.jpg"
              alt="Devashish"
              className="size-8 shrink-0 rounded-lg object-cover grayscale"
            />
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="text-sidebar-foreground truncate text-sm font-medium">
                Devashish
              </span>
              <span className="text-sidebar-foreground/60 truncate text-xs">
                d@helm.app
              </span>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="text-sidebar-foreground/40 ml-auto size-4 shrink-0"
            >
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="12" cy="19" r="1" fill="currentColor" />
            </svg>
          </div>
        </div>
      </aside>

      {/* ── Main: swaps panes as the view cycles ── */}
      <main className="bg-background flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {view === 0 && <AgentPane />}
            {view === 1 && <CalendarPane />}
            {view === 2 && <WorkflowsPane />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
