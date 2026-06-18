"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  ChevronDown,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "~/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export interface ChatSession {
  id: string;
  title: string | null;
  updatedAt: Date | string;
}

interface ChatMenuProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/**
 * Compact chat history — a single trigger in the agent toolbar that opens a
 * popover with all conversations. Replaces the second sidebar so the layout
 * stays one clean column.
 */
export function ChatMenu({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: ChatMenuProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const active = sessions.find((s) => s.id === activeId);
  const activeTitle = active?.title ?? "New chat";

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  // Pinned chats persist locally (no DB column needed).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("helm:pinned-chats");
      if (raw) setPinned(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);
  function togglePin(id: string) {
    setPinned((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("helm:pinned-chats", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Filter by search, then float pinned to the top.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sessions.filter((s) =>
          (s.title ?? "New chat").toLowerCase().includes(q),
        )
      : sessions;
    return [...filtered].sort(
      (a, b) => (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0),
    );
  }, [sessions, query, pinned]);

  function startEdit(s: ChatSession) {
    setEditingId(s.id);
    setDraft(s.title ?? "");
  }
  function commitEdit() {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              suppressHydrationWarning
              className="hover:bg-accent flex max-w-[16rem] items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium transition-colors"
            >
              <span className="truncate">{activeTitle}</span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            </button>
          }
        />
        <PopoverContent align="start" className="w-72 p-1.5">
          <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Chats
            </span>
            <button
              type="button"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>

          {/* Search */}
          {sessions.length > 4 ? (
            <div className="relative px-1 pb-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats…"
                className="bg-muted/50 placeholder:text-muted-foreground focus:bg-muted w-full rounded-md py-1.5 pr-2 pl-8 text-sm outline-none"
              />
            </div>
          ) : null}

          <ul className="max-h-80 overflow-y-auto">
            {visible.length === 0 ? (
              <li className="text-muted-foreground px-2 py-4 text-center text-xs">
                {sessions.length === 0 ? "No chats yet." : "No matches."}
              </li>
            ) : (
              visible.map((s) => {
                const isActive = s.id === activeId;
                const editing = s.id === editingId;
                const isPinned = pinned.has(s.id);
                return (
                  <li key={s.id}>
                    {editing ? (
                      <div className="bg-background flex items-center gap-1 rounded-lg border px-2 py-1">
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                        <button type="button" onClick={commitEdit}>
                          <Check className="text-muted-foreground hover:text-foreground h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="text-muted-foreground hover:text-foreground h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                          isActive ? "bg-accent" : "hover:bg-accent/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(s.id);
                            setOpen(false);
                          }}
                          className="flex min-w-0 flex-1 flex-col items-start text-left"
                        >
                          <span className="flex w-full items-center gap-1.5">
                            {isPinned ? (
                              <Pin className="text-muted-foreground size-3 shrink-0" />
                            ) : null}
                            <span className="truncate text-sm">
                              {s.title ?? "New chat"}
                            </span>
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {formatDistanceToNow(new Date(s.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </button>
                        <div
                          className={cn(
                            "flex shrink-0 items-center transition-opacity",
                            isPinned
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => togglePin(s.id)}
                            title={isPinned ? "Unpin" : "Pin"}
                            className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded"
                          >
                            {isPinned ? (
                              <PinOff className="h-3.5 w-3.5" />
                            ) : (
                              <Pin className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            title="Rename"
                            className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(s.id)}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive flex h-6 w-6 items-center justify-center rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onNew}
        title="New chat"
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
