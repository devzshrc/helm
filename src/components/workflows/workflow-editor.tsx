"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GripVertical, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { requestWorkflowDraft } from "~/lib/workflows/assistant-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Spinner } from "~/components/ui/spinner";
import { ConfigForm } from "~/components/workflows/config-form";
import { AddStep } from "~/components/workflows/add-step";
import { RunLog, type RunView } from "~/components/workflows/run-log";
import { NodeIcon, TriggerIcon } from "~/components/workflows/node-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings02Icon,
  Delete02Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { Play } from "lucide-react";
import {
  NODE_META,
  TRIGGER_META,
  type NodeType,
  type TriggerType,
  type WorkflowNode,
  type WorkflowTrigger,
  nodesForTrigger,
} from "~/lib/workflows/types";
import {
  getWorkflowHealth,
  validateWorkflowSpec,
  type WorkflowValidationIssue,
} from "~/lib/workflows/validation";

type ConfigTarget = { kind: "trigger" } | { kind: "node"; id: string } | null;

function summarize(config: Record<string, string>): string {
  const vals = Object.values(config).filter(Boolean);
  return vals.length ? vals.join(" · ") : "Needs details";
}

const HEALTH_STYLES: Record<string, string> = {
  valid: "bg-green-600 text-white",
  needs_config: "bg-amber-500 text-white",
  webhook_unhealthy: "bg-red-600 text-white",
  no_steps: "bg-slate-400/15 text-slate-600 dark:text-slate-400",
  action_requires_approval: "bg-blue-600 text-white",
};

const RUN_BORDER: Record<string, string> = {
  success: "border-l-2 border-l-emerald-400",
  error: "border-l-2 border-l-red-400",
  failed: "border-l-2 border-l-red-400",
  running: "border-l-2 border-l-blue-400",
};

const VARIABLES = [
  "{{from}}",
  "{{subject}}",
  "{{body}}",
  "{{summary}}",
  "{{draft}}",
  "{{digest}}",
  "{{priority}}",
  "{{title}}",
  "{{start}}",
  "{{end}}",
  "{{location}}",
];

function fieldErrors(issues: WorkflowValidationIssue[], target: ConfigTarget) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    if (target?.kind === "trigger" && issue.target === "trigger") {
      if (issue.fieldKey) out[issue.fieldKey] = issue.message;
    }
    if (
      target?.kind === "node" &&
      issue.target === "node" &&
      issue.nodeId === target.id
    ) {
      if (issue.fieldKey) out[issue.fieldKey] = issue.message;
    }
  }
  return out;
}

function issuesForTarget(
  issues: WorkflowValidationIssue[],
  target: ConfigTarget,
) {
  return issues.filter((issue) => {
    if (target?.kind === "trigger") return issue.target === "trigger";
    if (target?.kind === "node")
      return issue.target === "node" && issue.nodeId === target.id;
    return issue.target === "workflow";
  });
}

function StepCard({
  node,
  index,
  hasError,
  hasWarning,
  summary,
  hasFields,
  dragging,
  onConfig,
  onRemove,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  node: WorkflowNode;
  index: number;
  hasError: boolean;
  hasWarning: boolean;
  summary: string;
  hasFields: boolean;
  dragging: boolean;
  onConfig: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "flex flex-col items-center gap-2 transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <div className="bg-border h-3 w-px" />
      <Card
        className="flex w-full items-center gap-3 rounded-lg p-4"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span
          aria-hidden
          className="text-muted-foreground/50 -mr-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </span>
        <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-full border">
          <NodeIcon type={node.type} className="text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              Then {index + 1}: {NODE_META[node.type].label}
            </p>
            {hasError ? (
              <Badge variant="destructive">Needs config</Badge>
            ) : hasWarning ? (
              <Badge variant="outline">External action</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {NODE_META[node.type].description}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {summary}
          </p>
        </div>
        <div className="flex items-center">
          {hasFields && (
            <Button variant="ghost" size="icon-sm" onClick={onConfig}>
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onRemove}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function WorkflowEditor({ id }: { id: string }) {
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const get = api.workflows.get.useQuery({ id });
  const runs = api.workflows.runs.useQuery(
    { workflowId: id },
    {
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    },
  );

  const [seeded, setSeeded] = useState(false);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [trigger, setTrigger] = useState<WorkflowTrigger>({
    type: "email",
    config: {},
  });
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [config, setConfig] = useState<ConfigTarget>(null);
  const [runView, setRunView] = useState<RunView | null>(null);
  const [saveState, setSaveState] = useState<
    "saved" | "dirty" | "saving" | "failed"
  >("saved");

  useEffect(() => {
    if (get.data && !seeded) {
      setName(get.data.name);
      setEnabled(get.data.enabled);
      setTrigger(get.data.trigger as WorkflowTrigger);
      setNodes((get.data.nodes as WorkflowNode[]) ?? []);
      setSeeded(true);
    }
  }, [get.data, seeded]);

  useEffect(() => {
    if (!seeded || !get.data) return;
    const dirty =
      name !== get.data.name ||
      enabled !== get.data.enabled ||
      JSON.stringify(trigger) !== JSON.stringify(get.data.trigger) ||
      JSON.stringify(nodes) !== JSON.stringify(get.data.nodes);
    setSaveState((state) =>
      state === "saving" ? state : dirty ? "dirty" : "saved",
    );
  }, [enabled, get.data, name, nodes, seeded, trigger]);

  const validation = useMemo(
    () => validateWorkflowSpec({ name, trigger, nodes }),
    [name, nodes, trigger],
  );
  const health = useMemo(
    () =>
      getWorkflowHealth({
        validation,
        triggerType: trigger.type,
        enabled,
        webhookStatus: get.data?.webhookStatus,
      }),
    [enabled, get.data?.webhookStatus, trigger.type, validation],
  );

  const update = api.workflows.update.useMutation({
    onMutate: () => setSaveState("saving"),
    onSuccess: async (_res, vars) => {
      if (typeof vars.enabled === "boolean") {
        setEnabled(vars.enabled);
      }
      await utils.workflows.list.invalidate();
      await utils.workflows.get.invalidate({ id });
      await runs.refetch();
      setSaveState("saved");
      toast.success("Saved");
    },
    onError: (e) => {
      setSaveState("failed");
      toast.error(e.message);
    },
  });
  const test = api.workflows.test.useMutation({
    onSuccess: async (res) => {
      if ("ok" in res) {
        toast.error(res.error);
        return;
      }
      setRunView({ status: res.status, error: res.error, steps: res.steps });
      await runs.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function save() {
    if (!validation.ok && enabled) {
      toast.error(validation.errors.map((issue) => issue.message).join(" "));
      return;
    }
    update.mutate({ id, name, enabled, trigger, nodes });
  }
  function toggle(v: boolean) {
    if (v && !validation.ok) {
      toast.error(validation.errors.map((issue) => issue.message).join(" "));
      return;
    }
    update.mutate({ id, enabled: v });
  }
  function changeTriggerType(type: TriggerType) {
    const compatible = nodesForTrigger(type);
    const removed = nodes.filter((n) => !compatible.includes(n.type));
    if (
      removed.length > 0 &&
      !window.confirm(
        `${removed.length} incompatible ${removed.length === 1 ? "step" : "steps"} will be removed for this trigger. Continue?`,
      )
    ) {
      return;
    }
    const nextFieldKeys = new Set(
      TRIGGER_META[type].fields.map((field) => field.key),
    );
    const nextConfig = Object.fromEntries(
      Object.entries(trigger.config).filter(([key]) => nextFieldKeys.has(key)),
    );
    setTrigger({ type, config: nextConfig });
    setNodes((ns) => ns.filter((n) => compatible.includes(n.type)));
    if (removed.length > 0) {
      toast.warning(
        `${removed.length} incompatible ${removed.length === 1 ? "step was" : "steps were"} removed for this trigger.`,
      );
    }
  }
  function addNode(type: NodeType) {
    setNodes((ns) => [...ns, { id: crypto.randomUUID(), type, config: {} }]);
  }
  // Native HTML5 drag reorder: live-swap as the dragged card enters another.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  function onStepDragEnter(target: number) {
    setDragIndex((from) => {
      if (from === null || from === target) return from;
      setNodes((ns) => {
        const next = [...ns];
        const [moved] = next.splice(from, 1);
        if (moved) next.splice(target, 0, moved);
        return next;
      });
      return target;
    });
  }
  function remove(nid: string) {
    setNodes((ns) => ns.filter((n) => n.id !== nid));
  }
  function setNodeConfig(nid: string, key: string, value: string) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nid ? { ...n, config: { ...n.config, [key]: value } } : n,
      ),
    );
  }

  // ── In-builder AI helper ──────────────────────────────────────────────
  // Helm drafts the trigger + steps directly onto the editable canvas. The
  // user then tweaks everything by hand — AI assists, never blocks.
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiHint, setAiHint] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  async function draftWithAi(text = aiPrompt) {
    const prompt = text.trim();
    if (!prompt) {
      toast.error("Describe what the automation should do.");
      return;
    }
    setAiPending(true);
    setAiHint([]);
    try {
      const res = await requestWorkflowDraft({
        prompt,
        fields: { name, trigger, nodes },
      });
      const fields = res.patch?.fields;
      if (
        Array.isArray(fields?.nodes) &&
        nodes.length > 0 &&
        !window.confirm(
          "Helm will replace the current steps on this canvas. Continue?",
        )
      ) {
        return;
      }
      if (fields?.trigger) setTrigger(fields.trigger);
      if (fields?.name && !name.trim()) setName(fields.name);
      if (Array.isArray(fields?.nodes)) {
        setNodes(
          fields.nodes.map((n) => ({
            id: crypto.randomUUID(),
            type: n.type,
            config: n.config ?? {},
          })),
        );
      }
      const hints = [...(res.questions ?? []), ...(res.missingFields ?? [])];
      setAiHint(hints);
      toast.success(
        res.status === "ready"
          ? "Drafted onto the canvas — review and tweak below."
          : "Drafted a starting point — finish the highlighted details.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't draft the workflow.",
      );
    } finally {
      setAiPending(false);
    }
  }

  // Consume a `?prompt=` handoff (e.g. from the inbox "Automate" action) once
  // the editor has seeded, drafting the steps automatically.
  const promptConsumedRef = useRef(false);
  useEffect(() => {
    if (!seeded || promptConsumedRef.current) return;
    const p = searchParams.get("prompt")?.trim();
    if (!p) return;
    promptConsumedRef.current = true;
    setAiOpen(true);
    setAiPrompt(p);
    void draftWithAi(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, searchParams]);

  if (get.error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Could not load workflow</p>
        <p className="text-muted-foreground text-sm">{get.error.message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void get.refetch()}>
            Retry
          </Button>
          <Button variant="ghost" render={<Link href="/dashboard/workflows" />}>
            Back to workflows
          </Button>
        </div>
      </div>
    );
  }

  if (!get.isLoading && get.data === null) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Workflow not found</p>
        <p className="text-muted-foreground text-sm">
          It may have been deleted or you may not have access to it.
        </p>
        <Button variant="outline" render={<Link href="/dashboard/workflows" />}>
          Back to workflows
        </Button>
      </div>
    );
  }

  if (get.isLoading || !seeded) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
        <div className="min-w-0 space-y-5">
          <div className="flex items-center gap-3 border-b py-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <aside className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </aside>
      </div>
    );
  }

  const editingNode =
    config?.kind === "node" ? nodes.find((n) => n.id === config.id) : null;
  const lastType = nodes.length ? nodes[nodes.length - 1]!.type : null;
  const configErrors = fieldErrors(validation.errors, config);
  const nextError = validation.errors[0];
  const externalWarnings = validation.warnings.filter(
    (issue) => issue.target === "node",
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
      <div className="min-w-0 space-y-5">
        <div className="bg-background/95 sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b py-3 backdrop-blur">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-48 flex-1 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
          />
          <Badge
            className={
              HEALTH_STYLES[health.status] ?? "bg-muted text-muted-foreground"
            }
          >
            {health.status.replaceAll("_", " ")}
          </Badge>
          <Badge
            variant="outline"
            className={
              saveState === "dirty"
                ? "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : ""
            }
          >
            {saveState === "dirty" ? "Unsaved changes" : saveState}
          </Badge>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Label htmlFor="wf-enabled" className="text-sm">
              Enabled
            </Label>
            <Switch
              id="wf-enabled"
              checked={enabled}
              disabled={update.isPending}
              onCheckedChange={toggle}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => test.mutate({ id })}
            disabled={test.isPending}
          >
            {test.isPending ? (
              <Spinner />
            ) : (
              <HugeiconsIcon icon={PlayIcon} strokeWidth={2} />
            )}
            Test
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>

        {nextError ? (
          <Alert variant="destructive">
            <AlertTitle>Next fix</AlertTitle>
            <AlertDescription>{nextError.message}</AlertDescription>
          </Alert>
        ) : externalWarnings.length > 0 ? (
          <Alert>
            <AlertTitle>Review before enabling</AlertTitle>
            <AlertDescription>
              This workflow changes mail, calendar, or sends externally. Test it
              before turning it on.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* In-builder AI helper */}
        <Card className="rounded-lg p-4">
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-lg">
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                Describe it — Helm drafts the steps
              </span>
              <span className="text-muted-foreground block text-xs">
                Type what should happen; edit the result on the canvas below.
              </span>
            </span>
          </button>
          {aiOpen && (
            <div className="mt-3 flex flex-col gap-2">
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. When a newsletter arrives, label it Newsletters and archive it."
                rows={2}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void draftWithAi();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  ⌘/Ctrl + Enter to draft
                </span>
                <Button
                  size="sm"
                  onClick={() => void draftWithAi()}
                  disabled={aiPending}
                >
                  {aiPending ? <Spinner /> : <Sparkles className="size-4" />}
                  {nodes.length > 0 ? "Redraft" : "Draft steps"}
                </Button>
              </div>
              {aiHint.length > 0 && (
                <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                  Finish these: {aiHint.join(", ")}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Trigger */}
        <Card className="flex flex-col gap-4 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <span className="bg-background flex size-10 shrink-0 items-center justify-center rounded-full border">
              <TriggerIcon type={trigger.type} className="text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
                  When this happens
                </span>
                <Badge variant="outline">Trigger</Badge>
              </div>
              <p className="mt-1 text-base font-semibold">
                {TRIGGER_META[trigger.type].label}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {TRIGGER_META[trigger.type].description}
              </p>
            </div>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
            <span>Realtime: {get.data?.webhookStatus ?? "unknown"}</span>
            <span>
              Last run:{" "}
              {get.data?.lastRunAt
                ? new Date(get.data.lastRunAt).toLocaleString()
                : "never"}
            </span>
          </div>
          <Select
            value={trigger.type}
            onValueChange={(v) => v && changeTriggerType(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TRIGGER_META) as TriggerType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TRIGGER_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {TRIGGER_META[trigger.type].fields.length > 0 && (
            <Button
              variant={
                issuesForTarget(validation.errors, { kind: "trigger" }).length
                  ? "outline"
                  : "ghost"
              }
              size="sm"
              className="self-start"
              onClick={() => setConfig({ kind: "trigger" })}
            >
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />{" "}
              {summarize(trigger.config)}
            </Button>
          )}
        </Card>

        {/* Steps — drag a card to reorder */}
        <div className="flex flex-col">
          {nodes.map((node, i) => (
            <StepCard
              key={node.id}
              node={node}
              index={i}
              dragging={dragIndex === i}
              hasError={validation.errors.some(
                (issue) => issue.nodeId === node.id,
              )}
              hasWarning={validation.warnings.some(
                (issue) => issue.nodeId === node.id,
              )}
              summary={summarize(node.config)}
              hasFields={NODE_META[node.type].fields.length > 0}
              onConfig={() => setConfig({ kind: "node", id: node.id })}
              onRemove={() => remove(node.id)}
              onDragStart={() => setDragIndex(i)}
              onDragEnter={() => onStepDragEnter(i)}
              onDragEnd={() => setDragIndex(null)}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="bg-border h-3 w-px" />
          <AddStep trigger={trigger.type} lastType={lastType} onAdd={addNode} />
          {nodes.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Add steps, or let Helm draft them above.
            </p>
          )}
        </div>

        {/* Config sheet */}
        <Sheet
          open={config !== null}
          onOpenChange={(v) => !v && setConfig(null)}
        >
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>
                {config?.kind === "trigger"
                  ? "Trigger settings"
                  : editingNode
                    ? NODE_META[editingNode.type].label
                    : "Settings"}
              </SheetTitle>
            </SheetHeader>
            <div className="p-4">
              {config?.kind === "trigger" ? (
                <ConfigForm
                  fields={TRIGGER_META[trigger.type].fields}
                  values={trigger.config}
                  onChange={(k, v) =>
                    setTrigger((t) => ({
                      ...t,
                      config: { ...t.config, [k]: v },
                    }))
                  }
                  variables={VARIABLES}
                  errors={configErrors}
                />
              ) : editingNode ? (
                <ConfigForm
                  fields={NODE_META[editingNode.type].fields}
                  values={editingNode.config}
                  onChange={(k, v) => setNodeConfig(editingNode.id, k, v)}
                  variables={VARIABLES}
                  errors={configErrors}
                />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Recent runs</p>
              <p className="text-muted-foreground text-xs">
                Webhook, cron, and test executions appear here.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runs.refetch()}
              disabled={runs.isFetching}
            >
              {runs.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {runs.error ? (
              <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3 text-sm">
                <p className="font-medium">Could not load recent runs.</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {runs.error.message}
                </p>
              </div>
            ) : runs.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))
            ) : (
              (runs.data ?? []).slice(0, 5).map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() =>
                    setRunView({
                      status: run.status,
                      error: run.error,
                      steps: run.steps as RunView["steps"],
                      input: run.input,
                    })
                  }
                  className={`hover:bg-accent/40 flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${RUN_BORDER[run.status] ?? "border-l-muted border-l-2"}`}
                >
                  <Badge
                    className={
                      HEALTH_STYLES[run.status] ??
                      "bg-muted text-muted-foreground"
                    }
                  >
                    {run.status}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {typeof run.input === "object" &&
                    run.input &&
                    "source" in run.input &&
                    typeof (run.input as { source?: unknown }).source ===
                      "string"
                      ? (run.input as { source: string }).source
                      : ""}
                  </span>
                </button>
              ))
            )}
            {!runs.error &&
            !runs.isLoading &&
            (runs.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
                <Play className="text-muted-foreground/30 size-5" />
                <p className="text-muted-foreground text-xs">
                  No runs yet. Use Test or wait for next webhook/schedule.
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <RunLog run={runView} onOpenChange={(v) => !v && setRunView(null)} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="rounded-lg p-4">
          <p className="text-sm font-semibold">Review</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <Badge
                className={
                  HEALTH_STYLES[health.status] ??
                  "bg-muted text-muted-foreground"
                }
              >
                {health.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Steps</span>
              <span>{nodes.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Runs</span>
              <span>{runs.data?.length ?? 0}</span>
            </div>
          </div>
          <div className="mt-4 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
              What to do next
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {nextError
                ? nextError.message
                : enabled
                  ? "This workflow is live. Watch recent runs after changes."
                  : "Test the workflow, then turn it on when the result looks right."}
            </p>
          </div>
        </Card>
        {health.reasons.length > 0 || validation.warnings.length > 0 ? (
          <Card className="rounded-lg p-4">
            <p className="text-sm font-semibold">Health details</p>
            <div className="text-muted-foreground mt-3 flex flex-col gap-2 text-xs">
              {[
                ...health.reasons,
                ...validation.warnings.map((w) => w.message),
              ].map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
