"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { toast } from "sonner";
import {
  Archive,
  CheckSquare,
  ChevronDown,
  FolderOpen,
  MailOpen,
  Search,
  Send,
  Star,
  Tag,
  Tags,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { patchInList, removeFromList } from "~/lib/optimistic";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ThreadList } from "~/components/inbox/thread-list";
import { ThreadReader } from "~/components/inbox/thread-reader";
import {
  ComposeSheet,
  type ComposeState,
} from "~/components/inbox/compose-sheet";
import {
  EventSheet,
  type EventInitial,
} from "~/components/calendar/event-sheet";
import { ShortcutsHelp } from "~/components/shortcuts-help";
import { useShortcuts } from "~/hooks/use-shortcuts";
import { useRealtime } from "~/hooks/use-realtime";
import { useSyncCursor } from "~/hooks/use-sync-cursor";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import type { ThreadRow } from "~/server/gmail";

const CAL_RE =
  /^(Invitation|Accepted|Declined|Tentative|Updated invitation|Canceled event|Cancelled event):/i;

type SearchMode = "filter" | "gmail" | "semantic";
type MailboxMode = "inbox" | "sent";
type QueueMode =
  | "all"
  | "reply"
  | "schedule"
  | "waiting_me"
  | "waiting_them"
  | "newsletter"
  | "receipt"
  | "vip"
  | "calendar"
  | "archive";

function queueMode(t: ThreadRow): QueueMode {
  const hay = `${t.fromName} ${t.from} ${t.subject} ${t.snippet}`.toLowerCase();
  if (t.labelIds.includes("STARRED") || ["Urgent", "Important"].includes(String(t.priority ?? ""))) {
    return "vip";
  }
  if (CAL_RE.test(t.subject) || /\b(calendar|invite|invitation|rsvp|meeting update)\b/.test(hay)) {
    return "calendar";
  }
  if (/\b(unsubscribe|newsletter|digest|promotion|marketing)\b/.test(hay)) {
    return "newsletter";
  }
  if (
    /\b(meet|meeting|schedule|available|availability|calendar|call|zoom|slot)\b/.test(
      hay,
    )
  )
    return "schedule";
  if (
    /\b(invoice|receipt|payment|paid|order|purchase|subscription)\b/.test(hay)
  )
    return "receipt";
  if (/\b(sent|following up|checking in|waiting)\b/.test(hay)) {
    return "waiting_them";
  }
  if (
    /\b(question|can you|could you|please|need|reply|respond|confirm)\b/.test(
      hay,
    )
  )
    return "waiting_me";
  return "archive";
}

export function InboxWorkspace({
  externalThreads,
  externalLoading,
}: {
  externalThreads?: ThreadRow[];
  externalLoading?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const useExternal = externalThreads !== undefined;
  // Growing window → "load more" without breaking the optimistic cache helpers.
  const [limit, setLimit] = useState(25);
  const [serverSearch, setServerSearch] = useState("");
  const debouncedServerSearch = useDebouncedValue(serverSearch, 300);
  const [searchMode, setSearchMode] = useState<SearchMode>("filter");
  const [mailbox, setMailbox] = useState<MailboxMode>("inbox");
  const serverMode =
    searchMode === "filter"
      ? undefined
      : mailbox === "sent"
        ? "gmail"
        : searchMode;
  const activeServerSearch =
    searchMode === "filter" ? "" : debouncedServerSearch;
  const threadsQuery = api.mail.list.useQuery(
    {
      q: activeServerSearch || undefined,
      labelIds: mailbox === "sent" ? ["SENT"] : undefined,
      limit,
      mode: activeServerSearch ? serverMode : undefined,
    },
    {
      enabled: !useExternal,
      placeholderData: (previous) => previous,
      staleTime: 30_000,
      // No interval polling — refreshes are driven by the webhook change
      // cursor (useSyncCursor below) plus window-focus.
      refetchOnWindowFocus: true,
    },
  );
  const allThreads = useMemo(
    () => (useExternal ? (externalThreads ?? []) : (threadsQuery.data ?? [])),
    [useExternal, externalThreads, threadsQuery.data],
  );
  const loading = useExternal ? !!externalLoading : threadsQuery.isLoading;

  // Filters
  const [term, setTerm] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [hideCalendar, setHideCalendar] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueMode>("all");
  const queueLabels: Array<{ value: QueueMode; label: string }> = [
    { value: "waiting_me", label: "Needs reply" },
    { value: "waiting_them", label: "Waiting on them" },
    { value: "newsletter", label: "Newsletters" },
    { value: "receipt", label: "Receipts" },
    { value: "vip", label: "VIP" },
    { value: "calendar", label: "Calendar-related" },
    { value: "archive", label: "Can archive" },
  ];

  const searchMeta: Record<
    SearchMode,
    { placeholder: string; helper: string | null; actionLabel: string | null }
  > = {
    filter: {
      placeholder: "Filter visible emails",
      helper: null,
      actionLabel: null,
    },
    gmail: {
      placeholder: "Search Gmail (supports Gmail operators)",
      helper:
        "Use Gmail operators like from:, label:, has:attachment, or newer_than:.",
      actionLabel: "Search Gmail",
    },
    semantic: {
      placeholder: "Search by meaning",
      helper:
        "Best for plain-English searches like “that renewal thread from last month.”",
      actionLabel: "Search by meaning",
    },
  };

  // Extract unique labels from all threads
  const availableLabels = useMemo(() => {
    const labels = new Set<string>();
    allThreads.forEach((t) =>
      t.labelIds.forEach((l) => {
        // Filter system labels
        if (
          !l.startsWith("CATEGORY_") &&
          ![
            "INBOX",
            "UNREAD",
            "STARRED",
            "SENT",
            "DRAFT",
            "TRASH",
            "SPAM",
          ].includes(l)
        ) {
          labels.add(l);
        }
      }),
    );
    return Array.from(labels).sort();
  }, [allThreads]);

  const threads = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return allThreads.filter((t) => {
      if (queue !== "all" && queueMode(t) !== queue) return false;
      if (unreadOnly && !t.hasUnread) return false;
      if (starredOnly && !t.labelIds.includes("STARRED")) return false;
      if (hideCalendar && CAL_RE.test(t.subject)) return false;
      if (selectedLabel && !t.labelIds.includes(selectedLabel)) return false;
      if (
        needle &&
        searchMode === "filter" &&
        !`${t.fromName} ${t.subject} ${t.snippet}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [
    allThreads,
    term,
    unreadOnly,
    starredOnly,
    hideCalendar,
    selectedLabel,
    queue,
    searchMode,
  ]);

  // Counts from full allThreads (unfiltered) for chip badges
  const unreadCount = useMemo(
    () => allThreads.filter((t) => t.hasUnread).length,
    [allThreads],
  );
  const starredCount = useMemo(
    () => allThreads.filter((t) => t.labelIds.includes("STARRED")).length,
    [allThreads],
  );

  const hasActiveFilters =
    queue !== "all" ||
    unreadOnly ||
    starredOnly ||
    hideCalendar ||
    !!selectedLabel ||
    !!term;

  function clearFilters() {
    setTerm("");
    setUnreadOnly(false);
    setStarredOnly(false);
    setHideCalendar(false);
    setSelectedLabel(null);
    setQueue("all");
  }

  // Update browser title with total unread count
  useEffect(() => {
    document.title =
      unreadCount > 0 ? `(${unreadCount}) Helm - Inbox` : "Helm - Inbox";
  }, [unreadCount]);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(() => {
    if (typeof window === "undefined") return true;
    return !localStorage.getItem("helm_keyboard_hints_dismissed");
  });

  // Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [splitOrientation, setSplitOrientation] = useState<
    "horizontal" | "vertical"
  >("horizontal");

  // Auto-label dialog
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoDesc, setAutoDesc] = useState("");
  const [autoLabelName, setAutoLabelName] = useState("");
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const [eventOpen, setEventOpen] = useState(false);
  const [eventInitial, setEventInitial] = useState<EventInitial | null>(null);

  useEffect(() => {
    const mode = searchParams.get("mode") as QueueMode | null;
    const box = searchParams.get("box") as MailboxMode | null;
    const thread = searchParams.get("thread");
    if (box === "sent" || box === "inbox") {
      setMailbox(box);
    }
    if (mode && queueLabels.some((item) => item.value === mode)) {
      setQueue(mode);
    }
    if (thread) {
      setSelectedId(thread);
      void utils.mail.thread.prefetch({ threadId: thread });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Prefetch the focused thread so opening it (Enter / click) is instant.
  useEffect(() => {
    const t = threads[focusedIndex];
    if (t?.threadId) void utils.mail.thread.prefetch({ threadId: t.threadId });
  }, [focusedIndex, threads, utils]);

  const hasMore = !useExternal && allThreads.length >= limit && limit < 200;
  const prefetchThread = (id: string) => {
    if (id) void utils.mail.thread.prefetch({ threadId: id });
  };

  const queryClient = useQueryClient();
  const mailListKey = getQueryKey(api.mail.list);

  const archive = api.mail.archive.useMutation(
    removeFromList<{ threadId: string }, ThreadRow>(
      queryClient,
      mailListKey,
      (t, v) => t.threadId === v.threadId,
      "Couldn't archive",
    ),
  );
  const trash = api.mail.trash.useMutation(
    removeFromList<{ threadId: string }, ThreadRow>(
      queryClient,
      mailListKey,
      (t, v) => t.threadId === v.threadId,
      "Couldn't move to trash",
    ),
  );
  const star = api.mail.star.useMutation(
    patchInList<{ threadId: string; starred: boolean }, ThreadRow>(
      queryClient,
      mailListKey,
      (t, v) => t.threadId === v.threadId,
      (t, v) => ({
        ...t,
        labelIds: v.starred
          ? [...new Set([...t.labelIds, "STARRED"])]
          : t.labelIds.filter((l) => l !== "STARRED"),
      }),
      "Couldn't update star",
    ),
  );
  const markRead = api.mail.markRead.useMutation(
    patchInList<{ threadId: string; read: boolean }, ThreadRow>(
      queryClient,
      mailListKey,
      (t, v) => t.threadId === v.threadId,
      (t, v) => ({ ...t, hasUnread: !v.read, unread: !v.read }),
    ),
  );
  const autoLabel = api.mail.autoLabel.useMutation({
    onSuccess: ({ labeled }) => {
      toast.success(
        labeled > 0
          ? `Labeled ${labeled} email${labeled === 1 ? "" : "s"}`
          : "No matching emails found",
      );
      void utils.mail.list.invalidate();
      setAutoOpen(false);
      setAutoDesc("");
      setAutoLabelName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const cleanupPreview = api.mail.cleanupPreview.useQuery(undefined, {
    enabled: false,
  });
  const cleanupGroups = cleanupPreview.data?.groups ?? [];
  const cleanupActions = cleanupPreview.data?.actions ?? [];
  const cleanupApply = api.mail.applyCleanup.useMutation({
    onSuccess: async ({ applied }) => {
      toast.success(
        `Applied ${applied} cleanup action${applied === 1 ? "" : "s"}`,
      );
      await utils.mail.list.invalidate();
      await cleanupPreview.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const extract = api.calendar.extractFromEmail.useMutation({
    onSuccess: (draft) => setEventInitial(draft),
    onError: (e) => {
      toast.error(e.message);
      setEventOpen(false);
    },
  });

  function openCreateEvent(threadId: string) {
    setEventInitial(null);
    setEventOpen(true);
    extract.mutate({
      threadId,
      nowISO: new Date().toISOString(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  // --- bulk helpers ---
  const toggleSelect = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);
  function bulk(fn: (id: string) => void, label: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    ids.forEach(fn);
    toast.success(`${label} ${ids.length}`);
    exitSelect();
  }

  const selectThreadAt = useCallback(
    (index: number, markAsRead = true) => {
      const nextIndex = Math.max(0, Math.min(index, threads.length - 1));
      const thread = threads[nextIndex];
      if (!thread) return;
      setFocusedIndex(nextIndex);
      setSelectedId(thread.threadId);
      if (markAsRead && thread.hasUnread) {
        markRead.mutate({ threadId: thread.threadId, read: true });
      }
    },
    [markRead, threads],
  );

  const activeId = selectedId ?? threads[focusedIndex]?.threadId ?? null;

  const shortcuts = useMemo(
    () => ({
      j: () => selectThreadAt(focusedIndex + 1),
      k: () => selectThreadAt(focusedIndex - 1),
      Enter: () => selectThreadAt(focusedIndex),
      e: () => activeId && archive.mutate({ threadId: activeId }),
      "#": () => activeId && trash.mutate({ threadId: activeId }),
      s: () => activeId && star.mutate({ threadId: activeId, starred: true }),
      x: () => activeId && toggleSelect(activeId),
      u: () => {
        const t = threads[focusedIndex];
        if (t) markRead.mutate({ threadId: t.threadId, read: t.hasUnread });
      },
      r: () => {
        const t = threads.find((x) => x.threadId === activeId);
        if (activeId)
          setCompose({
            mode: "reply",
            threadId: activeId,
            subject: t?.subject ?? "",
          });
      },
      c: () => setCompose({ mode: "new" }),
      "?": () => setHelpOpen(true),
      Escape: () => selectMode && exitSelect(),
      "g i": () => router.push("/dashboard"),
      "g c": () => router.push("/dashboard/calendar"),
    }),
    [
      threads,
      focusedIndex,
      activeId,
      selectThreadAt,
      archive,
      trash,
      star,
      markRead,
      router,
      selectMode,
      toggleSelect,
      exitSelect,
    ],
  );

  useShortcuts(
    shortcuts,
    !compose && !eventOpen && !helpOpen && !autoOpen && !cleanupOpen,
  );

  // Webhook-driven refresh: poll the cheap change cursor and refetch the inbox
  // only when a Gmail/Calendar webhook actually landed (no interval polling).
  useSyncCursor(() => void utils.mail.list.invalidate());

  // Phase 2 (live push): same effect via Durable Object WebSocket. No-op until
  // the realtime transport ships; harmless to keep wired.
  useRealtime((payload) => {
    if (payload.plugin === "gmail") {
      const tid = payload.meta?.threadId;
      if (payload.action === "messageReceived" || !tid) {
        void utils.mail.list.invalidate();
      } else {
        void utils.mail.thread.invalidate({ threadId: tid });
      }
    } else if (payload.plugin === "googlecalendar") {
      void utils.calendar.list.invalidate();
    } else {
      void utils.mail.list.invalidate();
    }
  });

  return (
    <div className="h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
      <ResizablePanelGroup
        orientation={splitOrientation}
        className="h-full min-h-0"
      >
        <ResizablePanel
          defaultSize="38%"
          minSize="28%"
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col">
            {/* Toolbar: search bar + action buttons */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              {/* Search with inline mode selector */}
              <div className="bg-background flex flex-1 items-center overflow-hidden rounded-md border">
                <DropdownMenu>
                  <DropdownMenuTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 shrink-0 items-center gap-1 border-r px-2.5 text-xs transition-colors">
                    {searchMode === "filter"
                      ? "Filter"
                      : searchMode === "gmail"
                        ? "Gmail"
                        : "Smart"}
                    <ChevronDown className="size-2.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuItem
                      onClick={() => {
                        setSearchMode("filter");
                        setServerSearch("");
                      }}
                    >
                      Filter
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSearchMode("gmail")}>
                      Gmail search
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSearchMode("semantic")}>
                      Smart search
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Search className="text-muted-foreground mx-2 size-3.5 shrink-0" />
                <input
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    if (!e.target.value.trim()) setServerSearch("");
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      searchMode !== "filter" &&
                      term.trim()
                    ) {
                      setServerSearch(term.trim());
                      setLimit(25);
                    }
                  }}
                  placeholder={searchMeta[searchMode].placeholder}
                  className="placeholder:text-muted-foreground h-8 flex-1 bg-transparent text-sm outline-none"
                />
                {searchMode !== "filter" &&
                  term.trim() &&
                  !activeServerSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setServerSearch(term.trim());
                        setLimit(25);
                      }}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground mr-2 shrink-0 rounded px-2 py-0.5 text-xs transition-colors"
                    >
                      {searchMode === "gmail" ? "Search" : "Find"}
                    </button>
                  )}
                {activeServerSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setServerSearch("");
                      setLimit(25);
                    }}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground mr-1.5 grid size-5 shrink-0 place-items-center rounded transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* AI actions */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => setAutoOpen(true)}
                    >
                      <Tags className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Auto label</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={async () => {
                        await cleanupPreview.refetch();
                        setCleanupOpen(true);
                      }}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Quick cleanup</TooltipContent>
              </Tooltip>

              {/* Layout toggle */}
              <button
                type="button"
                onClick={() =>
                  setSplitOrientation((o) =>
                    o === "horizontal" ? "vertical" : "horizontal",
                  )
                }
                className="text-muted-foreground hover:bg-accent hover:text-foreground grid size-8 shrink-0 place-items-center rounded-md transition-colors"
                aria-label="Toggle split orientation"
              >
                {splitOrientation === "horizontal" ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="size-4"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 12h18" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="size-4"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M12 3v18" />
                  </svg>
                )}
              </button>
            </div>

            <div className="px-4 pb-2">
              <div
                className="grid rounded-xl border bg-muted/20 p-1 sm:grid-cols-2"
                aria-label="Mailbox section"
              >
                {[
                  {
                    value: "inbox" as const,
                    label: "Inbox",
                    description: "Incoming mail to triage",
                    icon: MailOpen,
                  },
                  {
                    value: "sent" as const,
                    label: "Sent mail",
                    description: "Messages sent by you",
                    icon: Send,
                  },
                ].map(({ value, label, description, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setMailbox(value);
                      setQueue("all");
                      setUnreadOnly(false);
                      setStarredOnly(false);
                      setHideCalendar(false);
                      setSelectedLabel(null);
                      setSelectedId(null);
                      setFocusedIndex(0);
                      setLimit(25);
                      setServerSearch("");
                    }}
                    aria-pressed={mailbox === value}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      mailbox === value
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                        mailbox === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search result hint */}
            {activeServerSearch && (
              <p className="text-muted-foreground px-4 pb-1 text-xs">
                {searchMode === "semantic" ? "Smart" : "Gmail"} · &ldquo;
                {activeServerSearch}&rdquo;
                {typeof threadsQuery.data?.length === "number"
                  ? ` · ${threadsQuery.data.length} result${threadsQuery.data.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            )}

            {/* Filter chips + select — single row */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-4 pb-2">
              {searchMode === "filter" && mailbox === "inbox" && (
                <>
                  {queueLabels.map((item) => (
                    <Chip
                      key={item.value}
                      active={queue === item.value}
                      onClick={() =>
                        setQueue(queue === item.value ? "all" : item.value)
                      }
                    >
                      {item.label}
                    </Chip>
                  ))}
                  <Chip
                    active={unreadOnly}
                    onClick={() => setUnreadOnly((v) => !v)}
                  >
                    Unread
                    {unreadCount > 0 && (
                      <span className="ml-1 opacity-60">{unreadCount}</span>
                    )}
                  </Chip>
                  <Chip
                    active={starredOnly}
                    onClick={() => setStarredOnly((v) => !v)}
                  >
                    Starred
                    {starredCount > 0 && (
                      <span className="ml-1 opacity-60">{starredCount}</span>
                    )}
                  </Chip>
                  <Chip
                    active={hideCalendar}
                    onClick={() => setHideCalendar((v) => !v)}
                  >
                    No invites
                  </Chip>
                  {availableLabels.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                          selectedLabel
                            ? "border-foreground/20 bg-foreground/8 text-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        {selectedLabel ? (
                          <>
                            <Tag className="size-3" />
                            {selectedLabel}
                          </>
                        ) : (
                          <>
                            <FolderOpen className="size-3" />
                            Labels
                          </>
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-60 overflow-y-auto"
                      >
                        <DropdownMenuItem
                          onClick={() => setSelectedLabel(null)}
                        >
                          <FolderOpen className="text-muted-foreground mr-2 size-3.5" />
                          All labels
                        </DropdownMenuItem>
                        {availableLabels.map((label) => (
                          <DropdownMenuItem
                            key={label}
                            onClick={() =>
                              setSelectedLabel(
                                label === selectedLabel ? null : label,
                              )
                            }
                          >
                            <Tag className="text-muted-foreground mr-2 size-3.5" />
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-muted-foreground hover:text-foreground shrink-0 rounded-full px-2 py-1 text-xs transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </>
              )}
              {searchMode === "filter" && mailbox === "sent" && (
                <>
                  <Chip
                    active={starredOnly}
                    onClick={() => setStarredOnly((v) => !v)}
                  >
                    Starred
                    {starredCount > 0 && (
                      <span className="ml-1 opacity-60">{starredCount}</span>
                    )}
                  </Chip>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-muted-foreground hover:text-foreground shrink-0 rounded-full px-2 py-1 text-xs transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </>
              )}

              {/* Select mode toggle — always at end */}
              {selectMode ? (
                <button
                  type="button"
                  onClick={exitSelect}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                >
                  <X className="size-3" /> Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground ml-auto flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
                >
                  <CheckSquare className="size-3" /> Select
                </button>
              )}
            </div>

            {/* Bulk action bar */}
            {selectMode && selected.size > 0 ? (
              <div className="border-border bg-muted/30 flex items-center gap-1 border-y px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (selected.size === threads.length) {
                      setSelected(new Set());
                    } else {
                      setSelected(new Set(threads.map((t) => t.threadId)));
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground mr-1 text-xs transition-colors"
                >
                  {selected.size === threads.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
                <span className="bg-primary/10 text-primary mr-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {selected.size} selected
                </span>
                <BulkBtn
                  icon={Archive}
                  label="Archive"
                  iconClass="text-muted-foreground"
                  onClick={() =>
                    bulk((id) => archive.mutate({ threadId: id }), "Archived")
                  }
                />
                <BulkBtn
                  icon={MailOpen}
                  label="Read"
                  iconClass="text-muted-foreground"
                  onClick={() =>
                    bulk(
                      (id) => markRead.mutate({ threadId: id, read: true }),
                      "Marked read",
                    )
                  }
                />
                <BulkBtn
                  icon={Star}
                  label="Star"
                  iconClass="text-muted-foreground"
                  onClick={() =>
                    bulk(
                      (id) => star.mutate({ threadId: id, starred: true }),
                      "Starred",
                    )
                  }
                />
                <BulkBtn
                  icon={Trash2}
                  label="Trash"
                  iconClass="text-muted-foreground"
                  onClick={() =>
                    bulk((id) => trash.mutate({ threadId: id }), "Trashed")
                  }
                />
                <button
                  type="button"
                  onClick={exitSelect}
                  className="text-muted-foreground hover:bg-accent ml-auto grid size-6 place-items-center rounded"
                  aria-label="Cancel selection"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            {!useExternal && threadsQuery.error ? (
              <div className="border-destructive/30 bg-destructive/10 mx-4 mb-2 rounded-lg border p-3 text-sm">
                <div className="text-destructive font-medium">
                  {threadsQuery.error.data?.code === "PRECONDITION_FAILED"
                    ? "Reconnect Gmail"
                    : "Inbox sync issue"}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {threadsQuery.error.message}
                </div>
                <div className="mt-2 flex gap-2">
                  {threadsQuery.error.data?.code === "PRECONDITION_FAILED" ? (
                    <a
                      href="/api/corsair/connect?plugin=gmail"
                      className="text-foreground hover:bg-accent rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                    >
                      Reconnect Gmail
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void threadsQuery.refetch()}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md border px-2.5 py-1 text-xs transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1">
              <ThreadList
                threads={threads}
                loading={loading}
                focusedIndex={focusedIndex}
                selectedId={selectedId}
                selectMode={selectMode}
                selected={selected}
                onToggleSelect={toggleSelect}
                onPrefetch={prefetchThread}
                onStar={(id) =>
                  star.mutate({
                    threadId: id,
                    starred: !threads
                      .find((t) => t.threadId === id)
                      ?.labelIds.includes("STARRED"),
                  })
                }
                searchQuery={searchMode === "filter" ? term : ""}
                hasMore={hasMore}
                loadingMore={threadsQuery.isFetching && limit > 25}
                onLoadMore={() => setLimit((l) => Math.min(l + 25, 200))}
                isFiltered={hasActiveFilters || searchMode !== "filter"}
                emptyLabel={
                  mailbox === "sent"
                    ? "No sent emails found."
                    : "Your inbox is empty."
                }
                onClearFilters={clearFilters}
                onSelect={(_id, i) => {
                  selectThreadAt(i);
                }}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="62%"
          minSize="40%"
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <ThreadReader
            threadId={selectedId}
            onReply={(threadId, subject, initialBody, autoDraft) =>
              setCompose({
                mode: "reply",
                threadId,
                subject,
                initialBody,
                autoDraft,
              })
            }
            onCreateEvent={openCreateEvent}
            onCreateWorkflow={(threadId, subject) =>
              router.push(
                `/dashboard/workflows?prompt=${encodeURIComponent(`Create an automation for emails like "${subject}" from thread ${threadId}`)}`,
              )
            }
            showKeyboardHints={showKeyboardHints}
            onDismissHints={() => {
              setShowKeyboardHints(false);
              localStorage.setItem("helm_keyboard_hints_dismissed", "1");
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Auto-label dialog */}
      <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" /> Auto label
            </DialogTitle>
            <DialogDescription>
              Describe which emails to label — Helm scans your inbox and applies
              the label to every match.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={autoDesc}
              onChange={(e) => setAutoDesc(e.target.value)}
              placeholder='e.g. "order & delivery updates from shopping sites"'
            />
            <Input
              value={autoLabelName}
              onChange={(e) => setAutoLabelName(e.target.value)}
              placeholder="Label name — e.g. Shopping"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAutoOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !autoDesc.trim() || !autoLabelName.trim() || autoLabel.isPending
              }
              onClick={() =>
                autoLabel.mutate({
                  description: autoDesc.trim(),
                  labelName: autoLabelName.trim(),
                })
              }
            >
              {autoLabel.isPending ? "Scanning…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Quick cleanup
            </DialogTitle>
            <DialogDescription>
              Archives newsletters, labels receipts, and marks automated
              calendar noise as read.
            </DialogDescription>
          </DialogHeader>
          {cleanupGroups.length ? (
            <div className="grid gap-2">
              {cleanupGroups.map((group) => {
                const accent = "border-border/60 bg-muted/20";
                const badge = "bg-muted text-muted-foreground";
                return (
                  <div
                    key={group.key}
                    className={cn("rounded-lg border p-3", accent)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{group.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {group.actionLabel}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          badge,
                        )}
                      >
                        {group.count}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-2 flex flex-col gap-1 text-xs">
                      {group.examples.map((example) => (
                        <button
                          key={example.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(example.threadId);
                            setCleanupOpen(false);
                          }}
                          className="hover:text-foreground truncate text-left"
                        >
                          {example.subject || "(no subject)"} · {example.reason}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
              Nothing obvious to clean up right now.
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCleanupOpen(false)}>
              Close
            </Button>
            <Button
              disabled={cleanupApply.isPending || cleanupActions.length === 0}
              onClick={() =>
                cleanupApply.mutate({
                  actions: cleanupActions.map((a) => ({
                    threadId: a.threadId,
                    action: a.action,
                    labelName: a.labelName,
                  })),
                })
              }
            >
              {cleanupApply.isPending ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComposeSheet state={compose} onClose={() => setCompose(null)} />
      <EventSheet
        open={eventOpen}
        onOpenChange={setEventOpen}
        initial={eventInitial}
        loading={extract.isPending}
        title="Create event from email"
      />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function Chip({
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
        "relative rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
        active
          ? "border-foreground/20 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <AnimatePresence>
        {active && (
          <motion.span
            className="bg-foreground/8 absolute inset-0 rounded-full"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
          />
        )}
      </AnimatePresence>
      <span className="relative z-10 flex items-center">{children}</span>
    </button>
  );
}

function BulkBtn({
  icon: Icon,
  label,
  iconClass,
  onClick,
}: {
  icon: typeof Archive;
  label: string;
  iconClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent hover:text-foreground text-muted-foreground flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
    >
      <Icon className={cn("size-3.5", iconClass)} /> {label}
    </button>
  );
}
