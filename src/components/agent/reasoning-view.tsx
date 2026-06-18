"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { cn } from "~/lib/utils";
import { ShiningText } from "~/components/ui/shining-text";

interface ReasoningViewProps {
  message?: { content?: string };
  isRunning?: boolean;
}

/** Latest meaningful line of the reasoning stream — the one-line summary. */
function lastLine(content: string): string {
  const parts = content
    .split(/\n+/)
    .map((s) => s.replace(/^[#>*\-\s]+/, "").trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/**
 * Minimal reasoning surface. While the run is active it shows a single
 * shimmering summary line that crossfades to the newest thought as the model
 * streams — a live "what it's doing right now". Once done it collapses to a
 * quiet, expandable "Thought process".
 */
export function ReasoningView({ message, isRunning }: ReasoningViewProps) {
  const [open, setOpen] = useState(false);
  const content = (message?.content ?? "").trim();
  const summary = useMemo(() => lastLine(content), [content]);

  if (isRunning) {
    const label = summary || "Thinking…";
    return (
      <div className="my-1 flex min-w-0 items-center gap-2 py-1">
        <motion.span
          className="bg-foreground/40 h-1.5 w-1.5 shrink-0 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
              transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
              className="truncate"
            >
              <ShiningText text={label} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group text-muted-foreground/70 hover:text-foreground flex items-center gap-1.5 py-1 text-xs font-medium transition-colors"
      >
        <span>Thought process</span>
        <ChevronRight
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden"
          >
            <div className="text-muted-foreground/80 mt-1 ml-1 max-h-60 overflow-y-auto pl-3 text-xs leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
