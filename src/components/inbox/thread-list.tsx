"use client";

import { useEffect, useMemo, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Check, Inbox, Paperclip, Star } from "lucide-react";

import { cn } from "~/lib/utils";
import type { ThreadRow } from "~/server/gmail";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";

function groupLabel(ms: number | null): string {
  if (!ms) return "Earlier";
  if (isToday(ms)) return "Today";
  if (isYesterday(ms)) return "Yesterday";
  return format(ms, "EEE, MMM d");
}

function timeLabel(ms: number | null): string {
  if (!ms) return "";
  if (isToday(ms)) return format(ms, "h:mm a");
  return format(ms, "MMM d");
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
  );
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/20 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function ThreadList({
  threads,
  loading,
  focusedIndex,
  selectedId,
  onSelect,
  selectMode = false,
  selected,
  onToggleSelect,
  onPrefetch,
  onStar,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  searchQuery = "",
  isFiltered = false,
  emptyLabel = "Your inbox is empty.",
  onClearFilters,
}: {
  threads: ThreadRow[];
  loading: boolean;
  focusedIndex: number;
  selectedId: string | null;
  onSelect: (threadId: string, index: number) => void;
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onStar?: (id: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  searchQuery?: string;
  isFiltered?: boolean;
  emptyLabel?: string;
  onClearFilters?: () => void;
}) {
  const focusedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const groups = useMemo(() => {
    const out: { label: string; items: { t: ThreadRow; i: number }[] }[] = [];
    threads.forEach((t, i) => {
      const label = groupLabel(t.receivedAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push({ t, i });
      else out.push({ label, items: [{ t, i }] });
    });
    return out;
  }, [threads]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="bg-card/50 flex h-14 items-center gap-3 rounded-lg border px-3"
          >
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-4 w-28 shrink-0" />
            <Skeleton className="h-4 min-w-0 flex-1" />
            <Skeleton className="h-4 w-12 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <Inbox className="text-muted-foreground/40 size-8" />
        {isFiltered ? (
          <>
            <p className="text-muted-foreground text-sm">
              No emails match your filters.
            </p>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
              >
                Clear filters
              </button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        )}
      </div>
    );
  }

  const needle = searchQuery.trim().toLowerCase();

  return (
    <ScrollArea className="no-scrollbar h-full">
      {groups.map((g) => (
        <div key={`${g.label}-${g.items[0]?.i}`}>
          <div className="bg-background/95 text-muted-foreground/80 sticky top-0 z-10 px-4 py-1.5 text-[11px] font-semibold tracking-wide shadow-sm backdrop-blur">
            {g.label}
          </div>
          {g.items.map(({ t, i }) => {
            const isSel = selected?.has(t.threadId) ?? false;
            const focused = i === focusedIndex;
            const open = selectedId === t.threadId;
            const isStarred = t.labelIds.includes("STARRED");
            // Check if thread has attachments (assumes server provides this)
            const hasAttachment =
              (t as { hasAttachment?: boolean }).hasAttachment ?? false;
            return (
              <div
                key={t.threadId}
                ref={focused ? focusedRef : undefined}
                role="button"
                tabIndex={0}
                onMouseEnter={() => onPrefetch?.(t.threadId)}
                onClick={() =>
                  selectMode
                    ? onToggleSelect?.(t.threadId)
                    : onSelect(t.threadId, i)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (selectMode) onToggleSelect?.(t.threadId);
                    else onSelect(t.threadId, i);
                  }
                }}
                className={cn(
                  "group relative flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left text-sm transition-colors",
                  "hover:bg-accent/50",
                  focused && !open && "bg-accent/40",
                  open && "border-l-primary/60 bg-accent",
                  t.hasUnread &&
                    t.priority === "Urgent" &&
                    "border-l-red-400/70",
                  t.hasUnread &&
                    t.priority === "Important" &&
                    "border-l-amber-400/70",
                  t.hasUnread &&
                    t.priority !== "Urgent" &&
                    t.priority !== "Important" &&
                    "border-l-primary/60",
                  !t.hasUnread && "border-l-transparent",
                  t.hasUnread && "font-medium",
                  isSel && "bg-primary/15",
                )}
              >
                {/* Leading: checkbox in select mode, else unread dot */}
                <span className="grid size-4 shrink-0 place-items-center">
                  {selectMode ? (
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded-[5px] border transition-colors",
                        isSel
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {isSel ? <Check className="size-3" /> : null}
                    </span>
                  ) : t.hasUnread ? (
                    <span className="bg-primary size-2.5 rounded-full" />
                  ) : null}
                </span>

                {/* Sender */}
                <span
                  className={cn(
                    "w-40 shrink-0 truncate",
                    t.hasUnread
                      ? "text-foreground font-semibold"
                      : "text-foreground/80",
                  )}
                >
                  {needle ? highlight(t.fromName, needle) : t.fromName}
                  {t.messageCount > 1 ? (
                    <span className="bg-primary/10 text-primary ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      {t.messageCount}
                    </span>
                  ) : null}
                </span>

                {/* Subject + snippet inline */}
                <span className="min-w-0 flex-1 truncate">
                  <span className={cn(t.hasUnread && "font-semibold")}>
                    {needle
                      ? highlight(t.subject || "(no subject)", needle)
                      : t.subject || "(no subject)"}
                  </span>
                  {t.snippet ? (
                    <span className="text-muted-foreground">
                      {" "}
                      {needle ? highlight(t.snippet, needle) : t.snippet}
                    </span>
                  ) : null}
                </span>

                {/* Right side: priority badge, attachment, quick star, time */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Priority badge */}
                  {t.priority === "Urgent" && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                      Urgent
                    </span>
                  )}
                  {t.priority === "Important" && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Important
                    </span>
                  )}

                  {/* Attachment indicator */}
                  {hasAttachment && (
                    <Paperclip className="text-muted-foreground size-3.5" />
                  )}

                  {/* Quick star (visible on hover or if starred) */}
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStar?.(t.threadId);
                      }}
                      className={cn(
                        "grid size-5 place-items-center rounded transition-opacity",
                        isStarred
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                      aria-label={isStarred ? "Unstar" : "Star"}
                    >
                      <Star
                        className={cn(
                          "size-3.5",
                          isStarred
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      />
                    </button>
                  )}

                  {/* Time */}
                  <span className="text-muted-foreground w-14 shrink-0 text-right text-xs tabular-nums">
                    {timeLabel(t.receivedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {hasMore ? (
        <div className="p-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-muted-foreground hover:bg-accent hover:text-foreground w-full rounded-lg border py-2 text-xs transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </ScrollArea>
  );
}
