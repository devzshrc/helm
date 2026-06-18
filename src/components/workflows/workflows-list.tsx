"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { patchInList, removeFromList } from "~/lib/optimistic";
import { listItem, staggerContainer } from "~/lib/motion";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { TriggerIcon } from "~/components/workflows/node-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  MoreHorizontalIcon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import {
  TEMPLATES,
  TRIGGER_META,
  type WorkflowTrigger,
} from "~/lib/workflows/types";

type Filter =
  | "all"
  | "active"
  | "attention"
  | "failed"
  | "email"
  | "calendar"
  | "schedule";

const HEALTH_STYLES: Record<string, string> = {
  valid: "bg-green-600 text-white",
  needs_config: "bg-amber-500 text-white",
  webhook_unhealthy: "bg-red-600 text-white",
  no_steps: "bg-slate-400/15 text-slate-600 dark:text-slate-400",
  action_requires_approval: "bg-blue-600 text-white",
};

const CHIP_COLORS: Record<string, string> = {
  email: "border-blue-300/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  calendar:
    "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  schedule:
    "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function attentionText(wf: WfLike) {
  if (wf.health.status === "valid") return "Ready";
  if (wf.health.reasons.length > 0) return wf.health.reasons[0];
  return wf.health.status.replaceAll("_", " ");
}

type WfLike = {
  health: { status: string; reasons: string[] };
};

export function WorkflowsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const list = api.workflows.list.useQuery(undefined, {
    staleTime: 2 * 60_000,
    placeholderData: (previous) => previous,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const promptForwardedRef = useRef(false);
  const pendingCreatePromptRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const wfListKey = getQueryKey(api.workflows.list);
  type Wf = RouterOutputs["workflows"]["list"][number];

  const create = api.workflows.create.useMutation({
    onSuccess: ({ id }) => {
      const prompt = pendingCreatePromptRef.current;
      pendingCreatePromptRef.current = null;
      router.push(
        prompt
          ? `/dashboard/workflows/${id}?prompt=${encodeURIComponent(prompt)}`
          : `/dashboard/workflows/${id}`,
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const update = api.workflows.update.useMutation(
    patchInList<{ id: string; enabled?: boolean }, Wf>(
      queryClient,
      wfListKey,
      (wf, v) => wf.id === v.id,
      (wf, v) => ({ ...wf, enabled: v.enabled ?? wf.enabled }),
      "Couldn't update workflow",
    ),
  );
  const del = api.workflows.delete.useMutation({
    ...removeFromList<{ id: string }, Wf>(
      queryClient,
      wfListKey,
      (wf, v) => wf.id === v.id,
      "Couldn't delete",
    ),
    onSuccess: () => toast.success("Deleted"),
  });
  const duplicateWorkflow = api.workflows.duplicate.useMutation({
    onSuccess: ({ id }) => router.push(`/dashboard/workflows/${id}`),
    onError: (e) => toast.error(e.message),
  });
  const test = api.workflows.test.useMutation({
    onSuccess: (res) => {
      if ("ok" in res) toast.error(res.error);
      else toast.success(`Run ${res.status}`);
      void list.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const visible = (list.data ?? []).filter((wf) => {
    const trigger = wf.trigger as WorkflowTrigger;
    if (filter === "active") return wf.enabled;
    if (filter === "attention") return wf.health.status !== "valid";
    if (filter === "failed") return wf.lastRun?.status === "failed";
    if (filter === "email") return trigger.type === "email";
    if (filter === "calendar") return trigger.type === "calendar";
    if (filter === "schedule") return trigger.type === "schedule";
    return true;
  });

  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    const filterParam = searchParams.get("filter") as Filter | null;
    // A `?prompt=` (e.g. from the inbox "Automate" action) used to open an AI
    // dialog. Now it spins up a fresh builder and forwards the prompt so the
    // in-editor AI helper drafts the steps onto the canvas.
    if (promptParam && !promptForwardedRef.current) {
      promptForwardedRef.current = true;
      pendingCreatePromptRef.current = promptParam;
      create.mutate({});
    }
    if (
      filterParam &&
      [
        "all",
        "active",
        "attention",
        "failed",
        "email",
        "calendar",
        "schedule",
      ].includes(filterParam)
    ) {
      setFilter(filterParam);
    }
  }, [searchParams, create, router]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 lg:p-8">
      <div className="flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Workflows
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Automations that explain themselves.
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            Start blank or from a template, click together the trigger and
            steps, then test before turning anything on. Helm can draft the
            steps for you inside the builder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              pendingCreatePromptRef.current =
                "Help me create a workflow. Ask me for any missing details, then draft the workflow for review.";
              create.mutate({});
            }}
            disabled={create.isPending}
          >
            <HugeiconsIcon icon={WorkflowSquare03Icon} strokeWidth={2} />
            Create with AI
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              pendingCreatePromptRef.current = null;
              create.mutate({});
            }}
            disabled={create.isPending}
          >
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Start blank
          </Button>
        </div>
      </div>

      {/* Quick-start templates — click a card to open the builder pre-filled. */}
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.16em] uppercase">
          Quick start
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => create.mutate({ templateId: t.id })}
              disabled={create.isPending}
              className="hover:border-foreground/15 hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm disabled:opacity-60"
            >
              <span className="bg-primary/10 text-primary mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
                <TriggerIcon type={t.trigger.type} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="text-muted-foreground block text-xs leading-snug">
                  {t.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <HealthStat
          label="Active"
          value={(list.data ?? []).filter((wf) => wf.enabled).length}
        />
        <HealthStat
          label="Needs attention"
          value={
            (list.data ?? []).filter((wf) => wf.health.status !== "valid")
              .length
          }
        />
        <HealthStat
          label="Failed last run"
          value={
            (list.data ?? []).filter((wf) => wf.lastRun?.status === "failed")
              .length
          }
        />
        <HealthStat
          label="Never tested"
          value={(list.data ?? []).filter((wf) => !wf.lastRun).length}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["active", "Active"],
          ["attention", "Needs attention"],
          ["failed", "Failed"],
          ["email", "Email"],
          ["calendar", "Calendar"],
          ["schedule", "Scheduled"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value as Filter)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              filter === value
                ? (CHIP_COLORS[value] ??
                  "border-foreground/20 bg-foreground text-background")
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (list.data ?? []).length === 0 ? (
        <Empty className="min-h-[48vh] rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={WorkflowSquare03Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No workflows yet</EmptyTitle>
            <EmptyDescription>
              Start blank or pick a quick-start template above. Build the
              trigger and steps by clicking — Helm can draft them for you.
            </EmptyDescription>
            <Button
              className="mt-4"
              onClick={() => create.mutate({})}
              disabled={create.isPending}
            >
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Start blank
            </Button>
          </EmptyHeader>
        </Empty>
      ) : (
        <motion.div
          className="flex flex-col gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence initial={false}>
            {visible.map((wf) => {
              const trigger = wf.trigger as WorkflowTrigger;
              const stepCount = Array.isArray(wf.nodes) ? wf.nodes.length : 0;
              return (
                <motion.div key={wf.id} layout variants={listItem} exit="exit">
                  <Card className="hover:border-foreground/10 hover:bg-accent/20 overflow-hidden rounded-lg transition-all hover:shadow-sm">
                    <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <button
                        className="grid min-w-0 grid-cols-[auto_1fr] gap-4 text-left"
                        onClick={() =>
                          router.push(`/dashboard/workflows/${wf.id}`)
                        }
                      >
                        <span className="bg-background flex size-10 items-center justify-center rounded-full border">
                          <TriggerIcon
                            type={trigger.type}
                            className="text-primary"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {wf.name}
                            </span>
                            {wf.enabled ? (
                              <Badge className="bg-green-600 text-white">
                                On
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Off</Badge>
                            )}
                          </span>
                          <span className="text-muted-foreground mt-1 block text-sm">
                            When{" "}
                            {TRIGGER_META[trigger.type].label.toLowerCase()},
                            run {stepCount} {stepCount === 1 ? "step" : "steps"}
                            .
                          </span>
                          <span className="text-muted-foreground mt-2 block text-xs">
                            {attentionText(wf)}
                            {wf.lastRun
                              ? ` · last run ${new Date(wf.lastRun.startedAt).toLocaleString()} (${wf.lastRun.status})`
                              : " · never run"}
                            {trigger.type !== "schedule"
                              ? ` · realtime ${wf.webhookStatus}`
                              : ""}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-3 lg:justify-end">
                        <Badge
                          className={
                            HEALTH_STYLES[wf.health.status] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {wf.health.status.replaceAll("_", " ")}
                        </Badge>
                        <Switch
                          checked={wf.enabled}
                          onCheckedChange={(v) =>
                            update.mutate({ id: wf.id, enabled: v })
                          }
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <HugeiconsIcon
                              icon={MoreHorizontalIcon}
                              strokeWidth={2}
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/dashboard/workflows/${wf.id}`)
                              }
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => test.mutate({ id: wf.id })}
                            >
                              Test
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                duplicateWorkflow.mutate({ id: wf.id })
                              }
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => del.mutate({ id: wf.id })}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {visible.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-8 text-center text-sm">
              No workflows match this filter.
            </p>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

function HealthStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background rounded-lg border px-3 py-2">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
    </div>
  );
}
