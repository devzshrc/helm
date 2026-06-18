// Deterministic soft pastel per event — used across month/week/agenda views.

export type EventColor = {
  /** Compact pill (month grid). */
  pill: string;
  /** Filled block (week grid + agenda card). */
  block: string;
  /** Small accent dot. */
  dot: string;
};

const PALETTE: EventColor[] = [
  {
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    block: "bg-sky-100/80 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100",
    dot: "bg-sky-500",
  },
  {
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    block:
      "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  {
    pill: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    block:
      "bg-violet-100/80 text-violet-900 dark:bg-violet-500/15 dark:text-violet-100",
    dot: "bg-violet-500",
  },
  {
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    block:
      "bg-rose-100/80 text-rose-900 dark:bg-rose-500/15 dark:text-rose-100",
    dot: "bg-rose-500",
  },
  {
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    block:
      "bg-amber-100/80 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100",
    dot: "bg-amber-500",
  },
];

export function eventColor(key: string): EventColor {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
