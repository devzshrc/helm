"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, FilePlus2 } from "lucide-react";

import { api } from "~/trpc/react";
import { patchInList, removeFromList } from "~/lib/optimistic";
import type { ThreadRow } from "~/server/gmail";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive02Icon,
  Delete02Icon,
  StarIcon,
  ArrowTurnBackwardIcon,
  Calendar03Icon,
  Mail01Icon,
  KeyboardIcon,
  NewsIcon,
  Invoice03Icon,
} from "@hugeicons/core-free-icons";

function MessageFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref}
      sandbox="allow-same-origin allow-popups"
      srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: cid:; style-src 'unsafe-inline'; font-src https: data:;"><base target="_blank"><div style="font-family:ui-sans-serif,system-ui;font-size:14px;color:#111;padding:4px">${html}</div>`}
      className="w-full border-0"
      onLoad={() => {
        const frame = ref.current;
        if (!frame) return;
        const doc = frame.contentDocument;
        if (doc) frame.style.height = `${doc.body.scrollHeight + 16}px`;
        // Forward keydown events from inside the iframe to the parent window
        // so inbox keyboard shortcuts keep working after the user clicks email content.
        frame.contentWindow?.addEventListener("keydown", (e) => {
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: e.key,
              code: e.code,
              keyCode: e.keyCode,
              metaKey: e.metaKey,
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              altKey: e.altKey,
              bubbles: true,
              cancelable: true,
            }),
          );
        });
      }}
    />
  );
}

function KeyboardHintsBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2">
      <div className="flex items-center gap-2 text-sm">
        <HugeiconsIcon
          icon={KeyboardIcon}
          strokeWidth={2}
          className="text-muted-foreground size-4"
        />
        <span className="text-muted-foreground">
          Use{" "}
          <kbd className="bg-background rounded px-1.5 py-0.5 font-mono text-xs">
            j
          </kbd>{" "}
          /{" "}
          <kbd className="bg-background rounded px-1.5 py-0.5 font-mono text-xs">
            k
          </kbd>{" "}
          to navigate,{" "}
          <kbd className="bg-background rounded px-1.5 py-0.5 font-mono text-xs">
            ?
          </kbd>{" "}
          for all shortcuts
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        Dismiss
      </button>
    </div>
  );
}

export function ThreadReader({
  threadId,
  onReply,
  onCreateEvent,
  onCreateWorkflow,
  showKeyboardHints = false,
  onDismissHints,
}: {
  threadId: string | null;
  onReply: (
    threadId: string,
    subject: string,
    initialBody?: string,
    autoDraft?: string,
  ) => void;
  onCreateEvent: (threadId: string) => void;
  onCreateWorkflow: (threadId: string, subject: string) => void;
  showKeyboardHints?: boolean;
  onDismissHints?: () => void;
}) {
  const thread = api.mail.thread.useQuery(
    // threadId! safe: enabled guard below prevents fetch when null/undefined
    { threadId: threadId ?? "" },
    { enabled: !!threadId && threadId.length > 0 },
  );

  // Collapse state: collapse all but last 3 messages if > 5 messages
  const [collapsed, setCollapsed] = useState(true);

  // Reset collapse when thread changes
  useEffect(() => {
    setCollapsed(true);
  }, [threadId]);

  const queryClient = useQueryClient();
  const mailListKey = getQueryKey(api.mail.list);

  const archive = api.mail.archive.useMutation({
    ...removeFromList<{ threadId: string }, ThreadRow>(
      queryClient,
      mailListKey,
      (t, v) => t.threadId === v.threadId,
      "Couldn't archive",
    ),
    onSuccess: () => toast.success("Archived"),
  });
  const labelThread = api.mail.applyCleanup.useMutation({
    onSuccess: () => toast.success("Label applied"),
    onError: (e) => toast.error(e.message),
  });
  const trash = api.mail.trash.useMutation({
    ...removeFromList<{ threadId: string }, ThreadRow>(
      queryClient,
      mailListKey,
      (t, v) => t.threadId === v.threadId,
      "Couldn't move to trash",
    ),
    onSuccess: () => toast.success("Moved to trash"),
  });
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
  if (!threadId) {
    return (
      <div className="flex h-full flex-col">
        {showKeyboardHints && onDismissHints && (
          <KeyboardHintsBanner onDismiss={onDismissHints} />
        )}
        <Empty className="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No thread selected</EmptyTitle>
            <EmptyDescription>
              Pick a thread from the list, or press{" "}
              <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                j
              </kbd>{" "}
              /{" "}
              <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                k
              </kbd>{" "}
              to navigate.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (thread.isLoading) {
    return (
      <div className="flex h-full min-w-0 flex-col overflow-hidden">
        {showKeyboardHints && onDismissHints && (
          <KeyboardHintsBanner onDismiss={onDismissHints} />
        )}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const data = thread.data;
  if (!data) return null;
  const subject = data.subject;
  const messages = data.messages;
  const latest = messages[messages.length - 1];
  const latestText =
    `${subject} ${latest?.fromName ?? ""} ${latest?.from ?? ""} ${latest?.html ?? ""}`.toLowerCase();
  const isScheduling =
    /\b(meet|meeting|schedule|availability|available|calendar|call|zoom|slot|time)\b/.test(
      latestText,
    );
  const isInvoice =
    /\b(invoice|receipt|payment|paid|order|purchase|subscription)\b/.test(
      latestText,
    );
  const isNewsletter =
    /\b(unsubscribe|newsletter|digest|promotion|marketing)\b/.test(latestText);
  const intentTags = [
    isScheduling ? "Scheduling" : null,
    isInvoice ? "Finance" : null,
    isNewsletter ? "Newsletter" : null,
    messages.some((m) => m.labelIds.includes("STARRED")) ? "VIP" : null,
  ].filter(Boolean);
  const replyIdeas = [
    {
      label: "Quick reply",
      description: "A short acknowledgement for simple threads.",
      cta: "Draft short reply",
      instruction: "Write a short, casual acknowledgement — 1–2 sentences max.",
    },
    {
      label: "Warm reply",
      description: "Friendly, polished, and still concise.",
      cta: "Draft warm reply",
      instruction:
        "Write a warm, friendly reply. Acknowledge their message and express enthusiasm.",
    },
    {
      label: "Full reply",
      description: "A complete answer that covers every point.",
      cta: "Draft full reply",
      instruction:
        "Write a thorough, professional reply addressing all points raised in the thread.",
    },
  ];
  const shouldCollapse = messages.length > 5;
  const visibleMessages =
    shouldCollapse && collapsed ? messages.slice(-3) : messages;
  const hiddenCount = shouldCollapse && collapsed ? messages.length - 3 : 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {showKeyboardHints && onDismissHints && (
        <KeyboardHintsBanner onDismiss={onDismissHints} />
      )}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        <h2 className="truncate text-sm font-semibold">{subject}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <ButtonGroup>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onReply(threadId, subject)}
            >
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />{" "}
              Reply
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCreateEvent(threadId)}
            >
              <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} /> Event
            </Button>
          </ButtonGroup>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ButtonGroup>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Star"
              onClick={() =>
                star.mutate({
                  threadId,
                  starred: !messages.some((m) =>
                    m.labelIds.includes("STARRED"),
                  ),
                })
              }
            >
              <HugeiconsIcon icon={StarIcon} strokeWidth={2} />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Archive"
              onClick={() => archive.mutate({ threadId })}
            >
              <HugeiconsIcon icon={Archive02Icon} strokeWidth={2} />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => trash.mutate({ threadId })}
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <ScrollArea
        key={threadId}
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <div className="flex min-w-0 flex-col gap-4 p-4 pb-8">
          {(isScheduling || isInvoice || isNewsletter) && (
            <div className="bg-background divide-y rounded-lg border">
              {isScheduling && (
                <div className="flex items-center gap-2 p-2">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    strokeWidth={2}
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    Looks like scheduling
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateEvent(threadId)}
                  >
                    Create event
                  </Button>
                </div>
              )}
              {isInvoice && (
                <div className="flex items-center gap-2 p-2">
                  <HugeiconsIcon
                    icon={Invoice03Icon}
                    strokeWidth={2}
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    Finance related
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={labelThread.isPending}
                    onClick={() =>
                      labelThread.mutate({
                        actions: [
                          {
                            threadId,
                            action: "label",
                            labelName: "Receipts",
                          },
                        ],
                      })
                    }
                  >
                    {labelThread.isPending ? "Filing…" : "File as receipt"}
                  </Button>
                </div>
              )}
              {isNewsletter && (
                <div className="flex items-center gap-2 p-2">
                  <HugeiconsIcon
                    icon={NewsIcon}
                    strokeWidth={2}
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    Newsletter / promo
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate({ threadId })}
                  >
                    {archive.isPending ? "Archiving…" : "Archive"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="bg-background flex flex-wrap items-center gap-1.5 rounded-lg border p-2">
            {replyIdeas.map((idea) => (
              <Button
                key={idea.label}
                variant="outline"
                size="sm"
                title={idea.description}
                onClick={() =>
                  onReply(threadId, subject, undefined, idea.instruction)
                }
              >
                {idea.label}
              </Button>
            ))}
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Button
              variant="outline"
              size="sm"
              title="Turn repeated threads like this into a workflow."
              onClick={() => onCreateWorkflow(threadId, subject)}
            >
              <FilePlus2 className="size-4" /> Automate
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="Pull date and time details into Calendar."
              onClick={() => onCreateEvent(threadId)}
            >
              <HugeiconsIcon
                icon={Calendar03Icon}
                strokeWidth={2}
                className="size-4"
              />
              Extract event
            </Button>
            {intentTags.length > 0 && (
              <div className="ml-auto flex flex-wrap gap-1.5">
                {intentTags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-[11px] font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Show collapse button if hidden messages */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
            >
              <ChevronDown className="size-4" />
              Show {hiddenCount} earlier message{hiddenCount === 1 ? "" : "s"}
            </button>
          )}

          {/* Render visible messages */}
          {visibleMessages.map((m, i) => {
            const isFirst = i === 0;
            return (
              <div key={m.id} className="min-w-0 overflow-hidden">
                {!isFirst && <Separator className="mb-4" />}
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{m.fromName}</span>
                  <span className="text-muted-foreground text-xs">
                    {m.receivedAt
                      ? new Date(m.receivedAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                <p className="text-muted-foreground mb-2 truncate text-xs">
                  {m.from}
                </p>
                <MessageFrame html={m.html} />
              </div>
            );
          })}

          {/* Show expand button if was collapsed */}
          {shouldCollapse && !collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
            >
              <ChevronUp className="size-4" />
              Collapse older messages
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
