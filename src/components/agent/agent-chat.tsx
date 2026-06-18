"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Check, Menu, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { fadeUp, listItem, staggerContainer, tapScale } from "~/lib/motion";

import {
  CopilotChatAssistantMessage,
  CopilotChatView,
  useAgent,
  useCopilotKit,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

import { api } from "~/trpc/react";
import { authClient } from "~/server/better-auth/client";
import { ToolRenderers } from "~/components/agent/tool-renderers";
import { AgentComposer } from "~/components/agent/agent-composer";
import { HelmMark } from "~/components/helm-mark";
import { ReasoningView } from "~/components/agent/reasoning-view";
import { AgentActivityStrip } from "~/components/agent/agent-activity-strip";
import { clearActivity } from "~/lib/agent-activity";
import { cn } from "~/lib/utils";
import { PremiumMarkdown } from "~/components/ui/premium-markdown";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { ConnectionRequired } from "~/components/connection-required";

/** No-op slot to suppress CopilotChatView's built-in composer. */
const renderNothing = () => null;

function isAssistantTextOnly(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const m = message as {
    role?: unknown;
    content?: unknown;
    toolCalls?: unknown;
  };
  return (
    m.role === "assistant" &&
    typeof m.content === "string" &&
    m.content.trim().length > 0 &&
    (!Array.isArray(m.toolCalls) || m.toolCalls.length === 0)
  );
}

function StrictAssistantMessage(props: {
  message: Record<string, unknown> & { content?: unknown; toolCalls?: unknown };
  [key: string]: unknown;
}) {
  if (
    !isAssistantTextOnly({
      role: "assistant",
      content: props.message.content,
      toolCalls: props.message.toolCalls,
    })
  ) {
    const defaultProps = props as Parameters<
      typeof CopilotChatAssistantMessage
    >[0];
    return <CopilotChatAssistantMessage {...defaultProps} />;
  }

  const text =
    typeof props.message.content === "string"
      ? props.message.content.trim()
      : "";

  // Render the agent's prose answer as clean markdown — headings, bold, lists,
  // tables all format correctly. (Previously this chopped the message into a
  // lossy "first line + 3 boxes" card, which mangled real answers.)
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-2">
      <PremiumMarkdown>{text}</PremiumMarkdown>
    </div>
  );
}

/**
 * Helm agent — the flagship surface. Persistent multi-chat (left), a single
 * inline conversation (right) where the generative-UI tool renderers paint the
 * agent's work, and the slash-command composer. Conversations are stored per
 * session in the DB and restored on load.
 */
export function AgentChat() {
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const { copilotkit } = useCopilotKit();
  const { data: session, isPending: authPending } = authClient.useSession();
  const sessionsQ = api.agent.sessions.list.useQuery(undefined, {
    enabled: !!session && !authPending,
    staleTime: 2 * 60_000,
    placeholderData: (previous) => previous,
  });
  const connectionsQ = api.connections.status.useQuery(undefined, {
    enabled: !!session && !authPending,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const createSession = api.agent.sessions.create.useMutation();
  const removeSession = api.agent.sessions.remove.useMutation();
  const renameSession = api.agent.sessions.rename.useMutation();
  const saveSession = api.agent.sessions.save.useMutation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const { agent } = useAgent({
    agentId: "default",
    updates: [
      UseAgentUpdate.OnRunStatusChanged,
      UseAgentUpdate.OnMessagesChanged,
    ],
  });

  const hydratingRef = useRef(false);
  const lastSavedRef = useRef("");
  const submittingRef = useRef(false);
  const creatingRef = useRef(false);
  const lastUserTextRef = useRef("");
  const [runError, setRunError] = useState<string | null>(null);
  const [blockedConnections, setBlockedConnections] = useState<
    Array<"gmail" | "googlecalendar">
  >([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const promptConsumedRef = useRef("");

  // Pick / create an initial session once the list resolves.
  // creatingRef latches so a double-render can't spawn duplicate empty sessions.
  useEffect(() => {
    if (!sessionsQ.data || activeId !== null) return;
    if (sessionsQ.data.length > 0) {
      setActiveId(sessionsQ.data[0]!.id);
    } else if (!creatingRef.current) {
      creatingRef.current = true;
      createSession.mutate(undefined, {
        onSuccess: ({ id }) => {
          setActiveId(id);
          void utils.agent.sessions.list.invalidate();
        },
        onSettled: () => {
          creatingRef.current = false;
        },
      });
    }
  }, [sessionsQ.data, activeId, createSession, utils]);

  // Clear the activity feed as soon as a run settles, so the status pill never
  // lingers showing the last step after the answer arrives.
  useEffect(() => {
    if (!agent.isRunning) clearActivity();
  }, [agent.isRunning]);

  // Hydrate the per-thread agent from the DB when the active session changes.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    hydratingRef.current = true;
    setActiveLoading(true);
    agent.threadId = activeId; // scope runs to this conversation
    void utils.agent.sessions.load
      .fetch({ id: activeId })
      .then((res) => {
        if (cancelled) return;
        agent.setMessages((res.messages ?? []) as never);
        lastSavedRef.current = JSON.stringify(agent.messages);
      })
      .catch((err) => {
        console.error("Failed to load session:", err);
        if (!cancelled) lastSavedRef.current = JSON.stringify(agent.messages);
      })
      .finally(() => {
        // Release on the next tick so the resulting render doesn't auto-save.
        setTimeout(() => {
          if (!cancelled) hydratingRef.current = false;
          if (!cancelled) setActiveLoading(false);
        }, 0);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, agent, utils]);

  // Serialize every render so streamed edits that DON'T change message count
  // (e.g. a tool result filling in) still trigger a save. Used as both the
  // effect trigger and the echo-guard key.
  const messagesJson = JSON.stringify(agent.messages);

  // Persist once a run has settled (not on every streamed token) — echo-guarded.
  // Skipping mid-run avoids re-serializing + saving the whole transcript on each
  // streamed delta.
  useEffect(() => {
    if (!activeId || hydratingRef.current || agent.isRunning) return;
    if (messagesJson === lastSavedRef.current) return;
    if (agent.messages.length === 0) {
      lastSavedRef.current = messagesJson;
      return;
    }
    const t = setTimeout(() => {
      lastSavedRef.current = messagesJson;
      saveSession.mutate(
        { id: activeId, messages: agent.messages },
        { onSuccess: () => void utils.agent.sessions.list.invalidate() },
      );
    }, 500);
    return () => clearTimeout(t);
    // Re-run whenever the serialized conversation changes or a run settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, messagesJson, agent.isRunning]);

  const submit = useCallback(
    async (text: string) => {
      const t = text.trim();
      // Guard against double-fire (Enter+click, or before isRunning flips).
      if (!t || !activeId || submittingRef.current || agent.isRunning) return;
      const lower = t.toLowerCase();
      const needsGmail =
        /\b(email|emails|mail|inbox|thread|threads|gmail|reply|draft|archive|newsletter|unread|sender)\b/.test(
          lower,
        );
      const needsCalendar =
        /\b(calendar|meeting|meetings|event|events|schedule|free slot|availability|available|invite|attendee)\b/.test(
          lower,
        );
      const missing: Array<"gmail" | "googlecalendar"> = [];
      if (needsGmail && connectionsQ.data && !connectionsQ.data.gmail) {
        missing.push("gmail");
      }
      if (
        needsCalendar &&
        connectionsQ.data &&
        !connectionsQ.data.googlecalendar
      ) {
        missing.push("googlecalendar");
      }
      if (missing.length > 0) {
        setBlockedConnections(missing);
        return;
      }
      submittingRef.current = true;
      setRunError(null);
      setBlockedConnections([]);
      clearActivity();
      lastUserTextRef.current = t;
      // Single path: every request goes through the agent router. The agent
      // renders the right HITL composer card for compose/send/create actions.
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: t });
      try {
        await copilotkit.runAgent({ agent });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "The agent run failed.";
        setRunError(msg);
        toast.error(msg);
      } finally {
        submittingRef.current = false;
      }
    },
    [activeId, agent, copilotkit, connectionsQ.data],
  );

  useEffect(() => {
    const prompt = searchParams.get("prompt")?.trim();
    if (
      !prompt ||
      promptConsumedRef.current === prompt ||
      !activeId ||
      agent.isRunning
    ) {
      return;
    }
    promptConsumedRef.current = prompt;
    void submit(prompt);
  }, [activeId, agent.isRunning, searchParams, submit]);

  const retry = useCallback(() => {
    const last = lastUserTextRef.current;
    if (!last || agent.isRunning) return;
    setRunError(null);
    clearActivity();
    void copilotkit.runAgent({ agent }).catch((e) => {
      setRunError(e instanceof Error ? e.message : "The agent run failed.");
    });
  }, [agent, copilotkit]);

  function selectChat(id: string) {
    if (agent.isRunning) {
      toast.info("Let the current run finish first.");
      return;
    }
    setRunError(null);
    setActiveId(id);
    setMobileHistoryOpen(false);
  }

  function newChat() {
    if (agent.isRunning) {
      toast.info("Let the current run finish first.");
      return;
    }
    setRunError(null);
    if (creatingRef.current) return;
    creatingRef.current = true;
    createSession.mutate(undefined, {
      onSuccess: ({ id }) => {
        setActiveId(id);
        void utils.agent.sessions.list.invalidate();
      },
      onSettled: () => {
        creatingRef.current = false;
      },
    });
  }

  function deleteChat(id: string) {
    removeSession.mutate(
      { id },
      {
        onSuccess: () => {
          void utils.agent.sessions.list.invalidate();
          if (id === activeId) {
            const next = (sessionsQ.data ?? []).find((s) => s.id !== id);
            if (next) setActiveId(next.id);
            else
              createSession.mutate(undefined, {
                onSuccess: ({ id: nid }) => setActiveId(nid),
              });
          }
        },
      },
    );
  }

  function renameChat(id: string, title: string) {
    renameSession.mutate(
      { id, title },
      { onSuccess: () => void utils.agent.sessions.list.invalidate() },
    );
  }

  const isEmpty = agent.messages.length === 0;

  // Contextual next-step pills shown after an assistant turn settles.
  const suggestions = (() => {
    if (agent.isRunning || isEmpty) return [] as string[];
    const last = agent.messages[agent.messages.length - 1] as
      | { role?: string; content?: unknown }
      | undefined;
    if (last?.role !== "assistant") return [];
    const c = (
      typeof last.content === "string" ? last.content : ""
    ).toLowerCase();
    const out: string[] = [];
    if (c.includes("thread") || c.includes("email") || c.includes("from:"))
      out.push("Draft a reply to this");
    if (c.includes("unread") || c.includes("inbox"))
      out.push("Archive the ones I don't need");
    if (c.includes("event") || c.includes("calendar") || c.includes("meeting"))
      out.push("Find a free slot for this week");
    if (c.includes("draft") || c.includes("document"))
      out.push("Make it more concise");
    if (c.includes("workflow") || c.includes("automation"))
      out.push("Turn it on now");
    return [...new Set(out)].slice(0, 3);
  })();

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ToolRenderers />

        <ChatHistoryRail
          sessions={sessionsQ.data ?? []}
          activeId={activeId}
          loading={sessionsQ.isLoading || authPending}
          error={sessionsQ.error?.message}
          onRetry={() => void sessionsQ.refetch()}
          onPrefetch={(id) => void utils.agent.sessions.load.prefetch({ id })}
          onSelect={selectChat}
          onNew={newChat}
          onDelete={deleteChat}
          onRename={renameChat}
          mobileOpen={mobileHistoryOpen}
          onMobileOpenChange={setMobileHistoryOpen}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              className="text-muted-foreground hover:bg-accent hover:text-foreground grid size-8 place-items-center rounded-lg"
              aria-label="Open chats"
            >
              <Menu className="size-4" />
            </button>
            <p className="truncate text-sm font-semibold">
              {(sessionsQ.data ?? []).find((s) => s.id === activeId)?.title ??
                "New chat"}
            </p>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {activeLoading ? (
              <ActiveChatSkeleton />
            ) : isEmpty ? (
              <EmptyState
                onPick={submit}
                name={session?.user?.name}
                sessions={sessionsQ.data ?? []}
                activeId={activeId}
                onResume={selectChat}
              />
            ) : (
              <CopilotChatView
                messages={agent.messages}
                isRunning={agent.isRunning}
                welcomeScreen={false}
                autoScroll
                input={renderNothing as never}
                scrollView={{ className: "no-scrollbar" }}
                messageView={
                  {
                    reasoningMessage: ReasoningView,
                    assistantMessage: StrictAssistantMessage,
                  } as never
                }
                className="h-full w-full"
              />
            )}
          </div>

          {/* Live status pill — sits in flow above the composer (never overlaps
            the transcript) and only while a run is active. */}
          <AgentActivityStrip visible={agent.isRunning} className="pb-1" />

          {/* Run-level error with retry (not just a toast). */}
          <AnimatePresence>
            {blockedConnections.length > 0 && !agent.isRunning ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="mx-auto w-full max-w-3xl px-3 pb-2"
              >
                <ConnectionRequired
                  plugins={blockedConnections}
                  title="Connect before asking Helm"
                  description="This request needs workspace data that is not connected yet."
                />
              </motion.div>
            ) : null}
            {runError && !agent.isRunning ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-3 pb-1"
              >
                <span className="text-destructive text-xs">{runError}</span>
                <button
                  type="button"
                  onClick={retry}
                  className="text-foreground hover:bg-accent rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                >
                  Retry
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Contextual next-step suggestions */}
          <AnimatePresence>
            {suggestions.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
                className="mx-auto flex w-full max-w-3xl flex-wrap gap-1.5 px-3 pb-1"
              >
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="bg-card/50 text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AgentComposer
            onSubmit={submit}
            onStop={() => agent.abortRun()}
            disabled={
              agent.isRunning ||
              !activeId ||
              authPending ||
              sessionsQ.isLoading ||
              activeLoading
            }
          />
        </div>
      </div>
    </MotionConfig>
  );
}

type ChatSession = {
  id: string;
  title: string | null;
  updatedAt: Date | string;
};

function ChatHistoryRail({
  sessions,
  activeId,
  loading,
  error,
  onRetry,
  onPrefetch,
  onSelect,
  onNew,
  onDelete,
  onRename,
  mobileOpen,
  onMobileOpenChange,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onPrefetch: (id: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 180);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const visible = sessions.filter((session) =>
    (session.title ?? "New chat")
      .toLowerCase()
      .includes(debouncedQuery.trim().toLowerCase()),
  );

  function startRename(session: ChatSession) {
    setEditingId(session.id);
    setDraft(session.title ?? "");
  }

  function commitRename() {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  }

  const renderBody = () => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 p-3">
        <div>
          <p className="text-sm font-semibold">Chats</p>
          <p className="text-muted-foreground text-xs">Your Helm history</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="bg-primary text-primary-foreground hover:bg-primary/90 grid size-8 place-items-center rounded-lg transition-colors"
          aria-label="New chat"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="bg-background flex h-9 items-center gap-2 rounded-lg border px-2">
          <Search className="text-muted-foreground size-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {error ? (
        <div className="mx-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p>Chat history could not load.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-md border px-2 py-1 font-medium"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="bg-muted h-11 animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-xs">
            {sessions.length === 0 ? "No chats yet." : "No matching chats."}
          </p>
        ) : (
          <div className="space-y-1">
            {visible.map((session) => {
              const active = session.id === activeId;
              const editing = session.id === editingId;
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group rounded-lg px-2 py-2 transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename();
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        className="bg-background min-w-0 flex-1 rounded-md border px-2 py-1 text-sm outline-none"
                        autoFocus
                      />
                      <button type="button" onClick={commitRename}>
                        <Check className="text-muted-foreground size-4" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        <X className="text-muted-foreground size-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onMouseEnter={() => onPrefetch(session.id)}
                        onFocus={() => onPrefetch(session.id)}
                        onClick={() => onSelect(session.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium">
                          {session.title ?? "New chat"}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-[11px]">
                          {formatDistanceToNow(new Date(session.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </button>
                      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startRename(session)}
                          className="text-muted-foreground hover:text-foreground grid size-6 place-items-center rounded"
                          aria-label="Rename chat"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(session.id)}
                          className="text-muted-foreground hover:text-destructive grid size-6 place-items-center rounded"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="bg-muted/20 hidden w-72 shrink-0 border-r md:block">
        {renderBody()}
      </aside>
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="bg-background/80 absolute inset-0 backdrop-blur-sm"
              onClick={() => onMobileOpenChange(false)}
              aria-label="Close chats"
            />
            <motion.aside
              className="bg-background absolute inset-y-0 left-0 w-80 max-w-[85vw] border-r shadow-xl"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderBody()}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ActiveChatSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-end gap-5 px-4 py-8">
      <div className="bg-muted ml-auto h-10 w-2/3 animate-pulse rounded-2xl" />
      <div className="space-y-3">
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        <div className="bg-muted h-4 w-full animate-pulse rounded" />
        <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
      </div>
    </div>
  );
}

/** "Good morning/afternoon/evening" by local hour. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const EXAMPLES: { title: string; prompt: string }[] = [
  {
    title: "Catch me up on unread mail",
    prompt: "Search for my unread emails and summarize what needs attention.",
  },
  {
    title: "Find time for a 1-hour meeting",
    prompt: "Find me a free 1-hour slot on my calendar this week.",
  },
  {
    title: "Draft a reply to my latest email",
    prompt: "Find my most recent unread email and draft a professional reply.",
  },
  {
    title: "Show my active automations",
    prompt: "List my Helm workflows and tell me which are active.",
  },
];

function EmptyState({
  onPick,
  name,
  sessions,
  activeId,
  onResume,
}: {
  onPick: (text: string) => void;
  name?: string;
  sessions: { id: string; title: string | null }[];
  activeId: string | null;
  onResume: (id: string) => void;
}) {
  const firstName = name?.trim().split(/\s+/)[0];
  const recent = sessions
    .filter((s) => s.id !== activeId && s.title)
    .slice(0, 3);

  return (
    <motion.div
      className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-7 px-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={fadeUp}
        className="flex flex-col items-center space-y-3 text-center"
      >
        <HelmMark className="size-12" />
        <h2 className="font-serif text-3xl tracking-tight">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </h2>
        <p className="text-muted-foreground text-sm">
          Triage mail, schedule events, draft replies, or automate it all — type{" "}
          <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
            /
          </kbd>{" "}
          for quick commands.
        </p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {EXAMPLES.map((ex) => (
          <motion.button
            key={ex.title}
            type="button"
            variants={listItem}
            whileTap={tapScale}
            whileHover={{ y: -1 }}
            onClick={() => onPick(ex.prompt)}
            className="bg-card/50 text-foreground/80 hover:bg-accent hover:text-foreground rounded-xl border px-4 py-3 text-left text-sm transition-colors"
          >
            {ex.title}
          </motion.button>
        ))}
      </motion.div>

      {recent.length > 0 ? (
        <motion.div variants={fadeUp} className="w-full">
          <p className="text-muted-foreground/70 mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
            Recent
          </p>
          <div className="flex flex-col">
            {recent.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onResume(s.id)}
                className="text-muted-foreground hover:bg-accent hover:text-foreground truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
              >
                {s.title}
              </button>
            ))}
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
