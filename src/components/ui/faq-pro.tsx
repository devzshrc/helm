"use client";

import { ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

import { cn } from "~/lib/utils";

const componentThemeClassName =
  "[--ic-background:#ffffff] [--ic-foreground:#111111] [--ic-primary:#111111] [--ic-secondary:#646b75] [--ic-surface-border:#e9edf2] [--ic-border:#e3e7ec] [--ic-card:#ffffff] [--ic-card-foreground:#111111] [--ic-muted:#f5f7fa] [--ic-muted-foreground:#6d7480] [--ic-accent:#f3f5f8] [--color-accent:var(--ic-accent)] [--color-accent-foreground:var(--ic-accent-foreground)] [--ic-accent-foreground:#111111] [--ic-input:#e3e7ec] [--ic-ring:rgba(17,17,17,0.16)] [--ic-destructive:#dc2626] [--ic-paper:#fcfcfd] [--ic-popover-foreground:#111111] [--color-background:var(--ic-background)] [--color-foreground:var(--ic-foreground)] [--color-primary:var(--ic-primary)] [--color-secondary:var(--ic-secondary)] [--color-border:var(--ic-border)] [--color-card:var(--ic-card)] [--color-card-foreground:var(--ic-card-foreground)] [--color-muted:var(--ic-muted)] [--color-muted-foreground:var(--ic-muted-foreground)] [--color-accent:var(--ic-accent)] [--color-accent-foreground:var(--ic-accent-foreground)] [--color-input:var(--ic-input)] [--color-ring:var(--ic-ring)] [--color-destructive:var(--ic-destructive)] dark:[--ic-background:#0a0f1c] dark:[--ic-foreground:#eef2fb] dark:[--ic-primary:#eef2fb] dark:[--ic-secondary:#9aa3b8] dark:[--ic-surface-border:#1d2536] dark:[--ic-border:#1d2536] dark:[--ic-card:#0d1322] dark:[--ic-card-foreground:#eef2fb] dark:[--ic-muted:#111827] dark:[--ic-muted-foreground:#8b94a8] dark:[--ic-accent:#141b2c] dark:[--ic-accent-foreground:#eef2fb] dark:[--ic-input:#1d2536] dark:[--ic-ring:rgba(238,242,251,0.18)] dark:[--ic-destructive:#f87171] dark:[--ic-paper:#0d1322] dark:[--ic-popover-foreground:#eef2fb]";

const PANEL_EASE = [0.16, 1, 0.3, 1] as const;
const EXPAND_SPRING = {
  type: "spring" as const,
  stiffness: 150,
  damping: 26,
  mass: 1.05,
};
const COLLAPSE_SPRING = {
  type: "spring" as const,
  stiffness: 190,
  damping: 30,
  mass: 1.1,
};

export type FaqProItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqProProps = {
  className?: string;
  defaultOpenFirst?: boolean;
  items: FaqProItem[];
  searchPlaceholder?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;
  const parts = text.split(
    new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi"),
  );
  return parts.map((part, index) => {
    if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
      return (
        <mark
          className="text-foreground rounded-sm bg-amber-200/90 px-0.5 dark:bg-amber-400/40"
          key={index}
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function itemMatchesQuery(item: FaqProItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return (
    item.question.toLowerCase().includes(normalizedQuery) ||
    item.answer.toLowerCase().includes(normalizedQuery)
  );
}

function getDefaultOpenId(items: FaqProItem[], defaultOpenFirst: boolean) {
  if (defaultOpenFirst && items[0]) return items[0].id;
  return null;
}

type FaqProRowProps = {
  isOpen: boolean;
  item: FaqProItem;
  onToggle: () => void;
  panelId: string;
  query: string;
  triggerId: string;
};

function FaqProRow({
  isOpen,
  item,
  onToggle,
  panelId,
  query,
  triggerId,
}: FaqProRowProps) {
  return (
    <div className="bg-muted/70 dark:bg-muted/50 overflow-hidden rounded-2xl">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className="focus-visible:ring-ring flex w-full items-start justify-between gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
        id={triggerId}
        onClick={onToggle}
        type="button"
      >
        <span className="text-foreground text-[15px] leading-6 font-medium tracking-[-0.02em]">
          {highlightText(item.question, query)}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform duration-300",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <motion.div
        animate={{ height: isOpen ? "auto" : 0 }}
        aria-labelledby={triggerId}
        className="overflow-hidden"
        id={panelId}
        initial={false}
        role="region"
        transition={{ height: isOpen ? EXPAND_SPRING : COLLAPSE_SPRING }}
      >
        <motion.div
          animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : -6 }}
          aria-hidden={!isOpen}
          className="text-muted-foreground px-5 pb-5 text-[14px] leading-6"
          initial={false}
          transition={{
            opacity: {
              duration: isOpen ? 0.38 : 0.2,
              ease: PANEL_EASE,
              delay: isOpen ? 0.06 : 0,
            },
            y: isOpen ? EXPAND_SPRING : COLLAPSE_SPRING,
          }}
        >
          {highlightText(item.answer, query)}
        </motion.div>
      </motion.div>
    </div>
  );
}

function FaqPro({
  className,
  defaultOpenFirst = false,
  items,
  searchPlaceholder = "Search FAQs...",
}: FaqProProps) {
  const listId = React.useId();
  const wasSearchingRef = React.useRef(false);

  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(() =>
    getDefaultOpenId(items, defaultOpenFirst),
  );

  const normalizedQuery = query.trim();
  const isSearching = normalizedQuery.length > 0;

  const visibleItems = React.useMemo(
    () => items.filter((item) => itemMatchesQuery(item, query)),
    [items, query],
  );

  React.useEffect(() => {
    if (isSearching) {
      wasSearchingRef.current = true;
      setOpenId((current) => {
        if (current && visibleItems.some((item) => item.id === current)) {
          return current;
        }
        return visibleItems[0]?.id ?? null;
      });
      return;
    }
    if (wasSearchingRef.current) {
      wasSearchingRef.current = false;
      setOpenId(getDefaultOpenId(items, defaultOpenFirst));
      return;
    }
  }, [defaultOpenFirst, isSearching, items, visibleItems]);

  React.useEffect(() => {
    setOpenId((current) => {
      if (!current) return current;
      return items.some((item) => item.id === current) ? current : null;
    });
  }, [items]);

  const toggleItem = React.useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <div
      className={cn(
        componentThemeClassName,
        "mx-auto flex w-full max-w-2xl flex-col gap-3",
        className,
      )}
    >
      <div className="relative">
        <input
          aria-label={searchPlaceholder}
          className={cn(
            "border-border bg-card text-foreground h-12 w-full appearance-none rounded-full border-[0.5px] px-5 pr-11 text-[15px]",
            "shadow-none outline-none focus:shadow-none focus:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none",
            "placeholder:text-muted-foreground",
            "[&::-webkit-search-cancel-button]:appearance-none",
            "[&::-webkit-search-decoration]:appearance-none",
          )}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="text-muted-foreground hover:bg-accent/60 hover:text-foreground absolute top-1/2 right-3 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full"
            onClick={() => setQuery("")}
            type="button"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleItems.length > 0 ? (
            visibleItems.map((item) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                key={item.id}
                layout="position"
                transition={{ duration: 0.2, ease: PANEL_EASE }}
              >
                <FaqProRow
                  isOpen={openId === item.id}
                  item={item}
                  onToggle={() => toggleItem(item.id)}
                  panelId={`${listId}-${item.id}-panel`}
                  query={query}
                  triggerId={`${listId}-${item.id}-trigger`}
                />
              </motion.div>
            ))
          ) : (
            <motion.p
              animate={{ opacity: 1 }}
              className="text-muted-foreground px-2 py-8 text-center text-[14px]"
              initial={{ opacity: 0 }}
              key="empty"
            >
              No FAQs match your search.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
FaqPro.displayName = "FaqPro";

export { FaqPro };
