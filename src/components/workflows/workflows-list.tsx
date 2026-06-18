"use client";

import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { WorkflowSquare03Icon } from "@hugeicons/core-free-icons";

import { api, type RouterOutputs } from "~/trpc/react";
import { patchInList, removeFromList } from "~/lib/optimistic";
import { cn } from "~/lib/utils";
import {
  NODE_META,
  TEMPLATES,
  TRIGGER_META,
  type Template,
  type WorkflowNode,
  type WorkflowTrigger,
} from "~/lib/workflows/types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import { TriggerIcon } from "~/components/workflows/node-icons";

const CATEGORY_STYLES: Record<WorkflowTrigger["type"], string> = {
  email: "border-blue-300/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  calendar:
    "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  schedule:
    "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function categoryLabel(type: WorkflowTrigger["type"]) {
  if (type === "email") return "Email";
  if (type === "calendar") return "Calendar";
  return "Schedule";
}

function workflowSummary(trigger: WorkflowTrigger, nodes: WorkflowNode[]) {
  const triggerLabel = TRIGGER_META[trigger.type]?.label ?? "Workflow trigger";
  const stepLabels = nodes
    .slice(0, 2)
    .map((node) => NODE_META[node.type]?.label)
    .filter(Boolean);
  const suffix =
    nodes.length > 2
      ? ` + ${nodes.length - 2} more`
      : stepLabels.length
        ? ""
        : "No steps";
  return `${triggerLabel}${stepLabels.length ? ` -> ${stepLabels.join(", ")}${suffix}` : ""}`;
}

function lastRunText(lastRun: Wf["lastRun"]) {
  if (!lastRun) return "No runs yet";
  return `Last run ${lastRun.status} at ${new Date(lastRun.startedAt).toLocaleString()}`;
}

type Wf = RouterOutputs["workflows"]["list"][number];

export function WorkflowsList() {
  const queryClient = useQueryClient();
  const list = api.workflows.list.useQuery(undefined, {
    staleTime: 2 * 60_000,
    placeholderData: (previous) => previous,
  });
  const wfListKey = getQueryKey(api.workflows.list);

  const create = api.workflows.create.useMutation({
    onSuccess: async () => {
      toast.success("Template added");
      await queryClient.invalidateQueries({ queryKey: wfListKey });
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
      "Couldn't delete workflow",
    ),
    onSuccess: () => toast.success("Workflow deleted"),
  });

  const workflows = list.data ?? [];
  const busyTemplateId = create.isPending ? create.variables?.templateId : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 lg:p-8">
      <header className="border-b pb-5">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Workflows
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Simple workflow templates.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
          Pick a predefined automation and turn it on when you are ready. Soon
          you will be able to edit and create your own workflows with the power
          of AI.
        </p>
      </header>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Templates</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Common workflow patterns used by busy teams.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              busy={busyTemplateId === template.id}
              disabled={create.isPending}
              onUse={() => create.mutate({ templateId: template.id })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">My workflows</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Enable, pause, or remove templates you have added.
            </p>
          </div>
          {list.error ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void list.refetch()}
            >
              <RefreshCw className="size-4" /> Retry
            </Button>
          ) : null}
        </div>

        {list.error ? (
          <div className="border-destructive/30 bg-destructive/10 rounded-md border p-4">
            <p className="text-sm font-semibold">Could not load workflows.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {list.error.message}
            </p>
          </div>
        ) : list.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <HugeiconsIcon
              icon={WorkflowSquare03Icon}
              strokeWidth={2}
              className="text-muted-foreground mx-auto size-8"
            />
            <p className="mt-3 text-sm font-semibold">No workflows yet</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Pick a template above to get started. Templates are saved off by
              default so you can review before turning them on.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {workflows.map((workflow) => (
              <WorkflowRow
                key={workflow.id}
                workflow={workflow}
                toggling={update.isPending}
                deleting={del.isPending}
                onToggle={(enabled) =>
                  update.mutate({ id: workflow.id, enabled })
                }
                onDelete={() => del.mutate({ id: workflow.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TemplateCard({
  template,
  busy,
  disabled,
  onUse,
}: {
  template: Template;
  busy: boolean;
  disabled: boolean;
  onUse: () => void;
}) {
  return (
    <Card className="rounded-md">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary mt-0.5 grid size-9 shrink-0 place-items-center rounded-md">
            <TriggerIcon type={template.trigger.type} className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{template.name}</h3>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md",
                  CATEGORY_STYLES[template.trigger.type],
                )}
              >
                {categoryLabel(template.trigger.type)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-5">
              {template.description}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="text-muted-foreground text-xs">
            Non-editable template
          </span>
          <Button size="sm" onClick={onUse} disabled={disabled}>
            {busy ? "Adding..." : "Use template"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowRow({
  workflow,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  workflow: Wf;
  toggling: boolean;
  deleting: boolean;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const trigger = workflow.trigger as WorkflowTrigger;
  const nodes = ((workflow.nodes as WorkflowNode[]) ?? []).filter(Boolean);

  return (
    <Card className="rounded-md">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="bg-background grid size-10 shrink-0 place-items-center rounded-md border">
            <TriggerIcon type={trigger.type} className="text-primary size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">
                {workflow.name}
              </h3>
              <Badge variant={workflow.enabled ? "default" : "secondary"}>
                {workflow.enabled ? "On" : "Off"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {workflowSummary(trigger, nodes)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {lastRunText(workflow.lastRun)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Switch
            checked={workflow.enabled}
            disabled={toggling}
            onCheckedChange={onToggle}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={deleting}
            aria-label={`Delete ${workflow.name}`}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
