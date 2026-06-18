/**
 * Module-level activity store for the current agent run.
 * Tool renderers report steps here; the activity strip reads it live.
 * Cleared via clearActivity() at the start of each new agent run.
 *
 * Pure module — no React imports — so it can be consumed by both
 * client components (via the useActivityItems hook) and server-side
 * tool renderers.
 */

export type ActivityStatus =
  | "running"
  | "waiting"
  | "done"
  | "error"
  | "rejected";

/** Structured router decision, streamed from the show_router_trace tool. */
export type RouterTrace = {
  intent: string;
  confidence: number;
  targetAgent: string;
  reasonCode: string;
  riskLevel: "none" | "low" | "medium" | "high";
  missingFields: string[];
};

export type ActivityItem = {
  seq: number;
  toolName: string;
  title: string;
  argsSummary: string;
  resultSummary?: string;
  status: ActivityStatus;
  routerTrace?: RouterTrace;
};

let _items: ActivityItem[] = [];
let _nextSeq = 0;
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((l) => l());
}

/**
 * Report or update an activity item.
 * - Pass no `seq` to add a new item; returns the new seq number.
 * - Pass `seq` to update an existing item; noop if not found (returns seq).
 */
export function reportActivity(opts: {
  toolName: string;
  title: string;
  argsSummary: string;
  status: ActivityStatus;
  resultSummary?: string;
  routerTrace?: RouterTrace;
  seq?: number;
}): number {
  if (opts.seq !== undefined) {
    const idx = _items.findIndex((i) => i.seq === opts.seq);
    if (idx >= 0) {
      const prev = _items[idx]!;
      _items = _items.map((item, i) =>
        i === idx
          ? {
              ...item,
              title: opts.title,
              argsSummary: opts.argsSummary,
              status: opts.status,
              resultSummary: opts.resultSummary ?? item.resultSummary,
              routerTrace: opts.routerTrace ?? item.routerTrace,
            }
          : item,
      );
      // Only notify if something actually changed.
      if (
        prev.title !== opts.title ||
        prev.status !== opts.status ||
        prev.resultSummary !== opts.resultSummary ||
        (opts.routerTrace && prev.routerTrace !== opts.routerTrace)
      ) {
        _notify();
      }
      return opts.seq;
    }
  }
  const seq = ++_nextSeq;
  _items = [
    ..._items,
    {
      seq,
      toolName: opts.toolName,
      title: opts.title,
      argsSummary: opts.argsSummary,
      status: opts.status,
      resultSummary: opts.resultSummary,
      routerTrace: opts.routerTrace,
    },
  ];
  _notify();
  return seq;
}

/** Clear all items. Call at the start of each copilotkit.runAgent() invocation. */
export function clearActivity(): void {
  _items = [];
  _nextSeq = 0;
  _notify();
}

/** Subscribe to store changes. Returns unsubscribe fn. */
export function subscribeActivity(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

/** Snapshot of current items. */
export function getActivityItems(): ActivityItem[] {
  return _items;
}

/**
 * Flatten markdown to a single plain-text line for compact status display.
 * Strips emphasis/headings/quotes/code/links and collapses whitespace, so the
 * status pill can never show a raw `**…**` blob.
 */
export function stripMarkdown(input: string, maxLen = 120): string {
  const text = input
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1") // code spans
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[*_~]{1,3}/g, "") // emphasis markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // list bullets
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen
    ? `${text.slice(0, maxLen - 1).trimEnd()}…`
    : text;
}

/** Latest router decision reported this run, if any. */
export function getRouterTrace(): RouterTrace | undefined {
  for (let i = _items.length - 1; i >= 0; i--) {
    if (_items[i]!.routerTrace) return _items[i]!.routerTrace;
  }
  return undefined;
}
