"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { useRealtime } from "~/hooks/use-realtime";
import { useSyncCursor } from "~/hooks/use-sync-cursor";
import { removeFromList } from "~/lib/optimistic";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

type Slot = { start: string; end: string };

function fmtSlot(s: Slot): string {
  return new Date(s.start).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

/**
 * Scheduling Concierge rail — the negotiations Helm is working on, the approval
 * queue, and a live activity log. Updates in real time via the SSE pipeline.
 */
export function ConciergePanel() {
  const utils = api.useUtils();
  // Webhook-driven negotiations refresh via the change cursor; the slow 60s
  // interval is only a safety net for purely agent-side changes that don't
  // produce a webhook (so they don't write the cursor).
  const pending = api.concierge.pending.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const negotiations = api.concierge.negotiations.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const activity = api.concierge.activity.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const invalidateConcierge = () => {
    void utils.concierge.pending.invalidate();
    void utils.concierge.negotiations.invalidate();
    void utils.concierge.activity.invalidate();
    void utils.calendar.list.invalidate();
  };

  useSyncCursor(invalidateConcierge);
  useRealtime(invalidateConcierge);

  const scan = api.concierge.scanInbox.useMutation({
    onSuccess: ({ found }) => {
      invalidateConcierge();
      toast.success(
        found > 0
          ? `Found ${found} scheduling email${found === 1 ? "" : "s"}.`
          : "No scheduling emails in recent inbox.",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const hasPending = (pending.data?.length ?? 0) > 0;
  const active = negotiations.data ?? [];

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-1">
      <header className="flex items-center gap-2">
        <Sparkles className="text-primary h-4 w-4" />
        <h2 className="font-serif text-lg">Scheduling Concierge</h2>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => scan.mutate()}
          disabled={scan.isPending}
        >
          {scan.isPending ? "Scanning…" : "Scan inbox"}
        </Button>
      </header>

      {/* Approval queue */}
      <AnimatePresence initial={false}>
        {pending.data?.map((n) => (
          <ApprovalCard
            key={n.id}
            n={n}
            onDone={() => {
              void utils.concierge.pending.invalidate();
              void utils.concierge.negotiations.invalidate();
              void utils.concierge.activity.invalidate();
            }}
          />
        ))}
      </AnimatePresence>

      {/* Active negotiations (proposed / confirmed / needs review) */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            On the calendar
          </p>
          <AnimatePresence initial={false}>
            {active.map((n) => (
              <NegotiationCard key={n.id} n={n} />
            ))}
          </AnimatePresence>
        </section>
      )}

      {/* Activity rail */}
      <section className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Activity
        </p>
        {(activity.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-xs">
            Nothing yet. Helm handles scheduling emails automatically as they
            arrive — or hit “Scan inbox” to check recent mail now.
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.data?.map((a) => (
              <li key={a.id} className="flex gap-2 text-xs">
                <span className="bg-primary/60 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                <span className="flex-1">
                  <span className="text-foreground">{a.description}</span>
                  <span className="text-muted-foreground ml-1">
                    · {fmtAgo(a.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!hasPending && active.length === 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          Helm watches for scheduling emails and drafts proposals for your
          approval — nothing is sent without you.
        </p>
      )}
    </div>
  );
}

type Negotiation = RouterOutputs["concierge"]["pending"][number];

function ApprovalCard({ n, onDone }: { n: Negotiation; onDone: () => void }) {
  const isConfirm = n.status === "awaiting_confirm";
  const slots = (n.proposedSlots as Slot[]) ?? [];
  const chosen = n.chosenSlot as Slot | null;
  const [draft, setDraft] = useState(n.draftReply ?? "");
  const [busy, setBusy] = useState(false);

  // Optimistically drop the card from the approval queue on action; AnimatePresence
  // plays the exit, and onSettled re-fetches to reconcile (restores it if the
  // server reports a logical failure).
  const queryClient = useQueryClient();
  const pendingKey = getQueryKey(api.concierge.pending);
  const dropById = removeFromList<{ id: string }, Negotiation>(
    queryClient,
    pendingKey,
    (item, v) => item.id === v.id,
  );

  const approve = api.concierge.approveProposal.useMutation(dropById);
  const confirm = api.concierge.confirmEvent.useMutation(dropById);
  const reject = api.concierge.rejectProposal.useMutation(dropById);

  async function onApprove() {
    setBusy(true);
    const res = isConfirm
      ? await confirm.mutateAsync({ id: n.id })
      : await approve.mutateAsync({ id: n.id, draftReply: draft });
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed");
    toast.success(isConfirm ? "Event created" : "Reply sent");
    onDone();
  }
  async function onReject() {
    await reject.mutateAsync({ id: n.id });
    onDone();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/5"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
        {isConfirm ? (
          <CalendarCheck className="h-3.5 w-3.5" />
        ) : (
          <CalendarClock className="h-3.5 w-3.5" />
        )}
        {isConfirm
          ? "Confirm & create event"
          : "Proposed reply — approve to send"}
      </div>

      <p className="text-sm font-medium">{n.counterpartyEmail}</p>
      {n.subject ? (
        <p className="text-muted-foreground truncate text-xs">{n.subject}</p>
      ) : null}

      {isConfirm && chosen ? (
        <p className="bg-background mt-2 rounded-lg px-2.5 py-1.5 text-sm">
          {fmtSlot(chosen)}
        </p>
      ) : slots.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {slots.map((s, i) => (
            <li
              key={i}
              className="bg-background text-muted-foreground rounded-lg px-2.5 py-1 text-xs"
            >
              {fmtSlot(s)}
            </li>
          ))}
        </ul>
      ) : null}

      {!isConfirm ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="bg-background mt-2 max-h-40 min-h-20 resize-none text-xs"
        />
      ) : null}

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={busy}
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {busy ? "Working…" : isConfirm ? "Create event" : "Approve & send"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject} disabled={busy}>
          <X className="h-3.5 w-3.5" /> Dismiss
        </Button>
      </div>
    </motion.div>
  );
}

function NegotiationCard({ n }: { n: Negotiation }) {
  const slots = (n.proposedSlots as Slot[]) ?? [];
  const chosen = n.chosenSlot as Slot | null;
  const confirmed = n.status === "confirmed";
  const review = n.status === "needs_review";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-xl border p-3 text-sm shadow-sm",
        confirmed &&
          "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5",
        review && "border-amber-300/60 bg-amber-50/40 dark:border-amber-500/30",
        !confirmed && !review && "bg-muted/30 border-dashed",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {confirmed ? (
          <>
            <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700 dark:text-emerald-400">
              Confirmed
            </span>
          </>
        ) : review ? (
          <>
            <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-amber-700 dark:text-amber-400">
              Needs review
            </span>
          </>
        ) : (
          <>
            <Clock className="text-muted-foreground h-3.5 w-3.5 animate-pulse" />
            <span className="text-muted-foreground">
              Proposed → {n.counterpartyEmail}
            </span>
          </>
        )}
      </div>
      {n.subject ? <p className="mt-1 truncate">{n.subject}</p> : null}
      {confirmed && chosen ? (
        <p className="text-muted-foreground mt-1 text-xs">{fmtSlot(chosen)}</p>
      ) : !confirmed && slots.length > 0 ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {slots.map(fmtSlot).join("  ·  ")}
        </p>
      ) : null}
    </motion.div>
  );
}
