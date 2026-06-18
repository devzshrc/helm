"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  getActivityItems,
  stripMarkdown,
  subscribeActivity,
  type ActivityItem,
  type RouterTrace,
} from "~/lib/agent-activity";

function useActivityItems(): ActivityItem[] {
  const [items, setItems] = useState<ActivityItem[]>(getActivityItems);
  useEffect(() => subscribeActivity(() => setItems(getActivityItems())), []);
  return items;
}

function riskColor(risk: RouterTrace["riskLevel"]): string {
  if (risk === "high") return "text-destructive";
  if (risk === "medium") return "text-amber-600 dark:text-amber-400";
  if (risk === "low") return "text-sky-600 dark:text-sky-400";
  return "text-muted-foreground";
}

/** The router-decision detail shown on hover over the thinking dot. */
function RouterTraceTooltip({ trace }: { trace: RouterTrace }) {
  return (
    <TooltipContent className="bg-popover text-popover-foreground max-w-xs flex-col items-start gap-2 border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[11px] font-medium">
          {trace.intent.replace(/_/g, " ")}
        </span>
        <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-[11px]">
          {Math.round(trace.confidence * 100)}% confident
        </span>
        <span
          className={cn(
            "bg-muted rounded-md px-2 py-0.5 text-[11px]",
            riskColor(trace.riskLevel),
          )}
        >
          {trace.riskLevel} risk
        </span>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <div>
          <p className="text-muted-foreground text-[10px]">Agent</p>
          <p className="text-xs font-medium">{trace.targetAgent || "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Reason</p>
          <p className="text-xs font-medium">{trace.reasonCode || "—"}</p>
        </div>
      </div>
      {trace.missingFields.length > 0 ? (
        <div className="w-full">
          <p className="text-muted-foreground mb-1 text-[10px]">Needs</p>
          <div className="flex flex-wrap gap-1">
            {trace.missingFields.map((field) => (
              <span
                key={field}
                className="rounded-md border px-1.5 py-0.5 text-[10px]"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </TooltipContent>
  );
}

/**
 * Minimal in-chat status row: a blinking dot with the latest live step beside
 * it. While the router is deciding, the dot carries a hover tooltip with the
 * streamed router trace (intent · confidence · risk · agent · reason).
 */
export function AgentActivityStrip({
  visible,
  className,
}: {
  visible: boolean;
  className?: string;
}) {
  const items = useActivityItems();
  const current =
    [...items]
      .reverse()
      .find((item) => item.status === "running" || item.status === "waiting") ??
    items.at(-1);
  const trace = [...items].reverse().find((i) => i.routerTrace)?.routerTrace;
  // The pill is a *thinking* indicator: only while a run is active. (Activity is
  // cleared when the run settles, so it never lingers with stale content.)
  const show = visible;
  const label = stripMarkdown(current?.title ?? "Thinking", 80);
  const detail =
    current?.status === "done" && current.resultSummary
      ? stripMarkdown(current.resultSummary, 80)
      : "";

  const chip = (
    <span
      className={cn(
        "bg-background/70 text-muted-foreground pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full px-2 py-1 text-xs shadow-sm backdrop-blur transition-colors",
        trace && "hover:bg-background/90 cursor-help",
      )}
    >
      <span
        className={cn(
          "bg-muted-foreground/60 h-1.5 w-1.5 shrink-0 rounded-full",
          visible && "bg-primary animate-pulse",
          current?.status === "error" && "bg-destructive",
          current?.status === "rejected" && "bg-amber-500",
        )}
      />
      <span className="relative min-w-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
            transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="block truncate"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
      {detail ? (
        <span className="text-muted-foreground/60 truncate">{detail}</span>
      ) : null}
    </span>
  );

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="activity-strip"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
          className={cn("mx-auto w-full max-w-3xl px-3", className)}
        >
          {trace ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="pointer-events-auto inline-flex max-w-full bg-transparent p-0">
                  {chip}
                </TooltipTrigger>
                <RouterTraceTooltip trace={trace} />
              </Tooltip>
            </TooltipProvider>
          ) : (
            chip
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
