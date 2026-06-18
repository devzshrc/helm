"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

const TONES = ["Concise", "Warm", "Professional", "Direct"] as const;
const LENGTHS = ["Short", "Balanced", "Detailed"] as const;

export type ComposeState =
  | {
      mode: "reply";
      threadId: string;
      subject: string;
      initialBody?: string;
      autoDraft?: string;
    }
  | { mode: "new"; initialBody?: string; to?: string; subject?: string }
  | null;

export function ComposeSheet({
  state,
  onClose,
}: {
  state: ComposeState;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const open = state !== null;
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Warm");
  const [length, setLength] = useState<(typeof LENGTHS)[number]>("Balanced");
  const [useMyStyle, setUseMyStyle] = useState(true);

  useEffect(() => {
    if (state?.mode === "reply") {
      setSubject(state.subject);
      setBody(state.initialBody ?? "");
      if (state.autoDraft) {
        draft.mutate({
          threadId: state.threadId,
          instruction: state.autoDraft,
        });
      }
    } else if (state?.mode === "new") {
      setTo(state.to ?? "");
      setSubject(state.subject ?? "");
      setBody(state.initialBody ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const draft = api.mail.draftReply.useMutation({
    onSuccess: (r) => setBody(r.draft),
    onError: (e) => toast.error(e.message),
  });
  const reply = api.mail.reply.useMutation({
    onSuccess: async () => {
      toast.success("Reply sent");
      if (state?.mode === "reply")
        await utils.mail.thread.invalidate({ threadId: state.threadId });
      await utils.mail.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const send = api.mail.send.useMutation({
    onSuccess: async () => {
      toast.success("Email sent");
      await utils.mail.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function submit() {
    if (!body.trim()) return;
    if (state?.mode === "reply") {
      reply.mutate({ threadId: state.threadId, text: body });
    } else {
      send.mutate({ to, subject, text: body });
    }
  }

  const sending = reply.isPending || send.isPending;
  const missing: string[] = [];
  if (state?.mode === "new" && !to.trim()) missing.push("recipient");
  if (state?.mode === "new" && !subject.trim()) missing.push("subject");
  if (!body.trim()) missing.push("message");

  function draftWithControls(extra?: string) {
    if (state?.mode !== "reply") return;
    const instruction = [
      extra,
      `Tone: ${tone}.`,
      `Length: ${length}.`,
      useMyStyle
        ? "Use the user's usual concise executive style."
        : "Use a neutral professional style.",
    ]
      .filter(Boolean)
      .join(" ");
    draft.mutate({ threadId: state.threadId, instruction });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {state?.mode === "reply" ? "Reply" : "New message"}
          </SheetTitle>
          <SheetDescription>
            Review-first composer. Nothing sends until you press Send.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="bg-muted/20 rounded-lg border p-3">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground h-4 w-4" />
              <p className="text-sm font-semibold">AI Reply Studio</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Tone</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTone(item)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        tone === item
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </Field>
              <Field>
                <FieldLabel>Length</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {LENGTHS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setLength(item)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        length === item
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useMyStyle}
                onChange={(event) => setUseMyStyle(event.target.checked)}
                className="size-4"
              />
              Use my style when drafting
            </label>
          </div>

          {state?.mode === "new" && (
            <>
              <Field>
                <FieldLabel htmlFor="c-to">To</FieldLabel>
                <Input
                  id="c-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="someone@example.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-subj">Subject</FieldLabel>
                <Input
                  id="c-subj"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
            </>
          )}
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="c-body">Message</FieldLabel>
              {state?.mode === "reply" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={draft.isPending}
                  onClick={() => draftWithControls()}
                  className="gap-1.5 border-violet-300/60 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:border-violet-500/30 dark:text-violet-300"
                >
                  <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
                  {draft.isPending ? "Drafting…" : "AI draft"}
                </Button>
              )}
            </div>
            <Textarea
              id="c-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </Field>
          {body.trim() ? (
            <div className="bg-background rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Source-grounded review
              </div>
              <p className="text-muted-foreground text-xs">
                This draft is editable. Confirm names, dates, prices, and
                commitments before sending.
              </p>
              {state?.mode === "reply" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draft.isPending}
                    onClick={() =>
                      draftWithControls(
                        "Make the existing draft clearer without adding unsupported facts.",
                      )
                    }
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draft.isPending}
                    onClick={() =>
                      draftWithControls("Make the existing draft shorter.")
                    }
                  >
                    Shorten
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {missing.length > 0 ? (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Missing {missing.join(", ")}
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={sending || missing.length > 0}>
            {sending ? "Sending…" : "Review & send"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
