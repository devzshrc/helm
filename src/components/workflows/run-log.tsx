"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { NodeIcon } from "~/components/workflows/node-icons";
import { NODE_META, type NodeType } from "~/lib/workflows/types";

export type RunView = {
  status: string;
  error?: string | null;
  input?: unknown;
  steps: { type: NodeType; status: string; detail?: string }[];
};

const STATUS_COLOR: Record<string, string> = {
  success: "bg-green-600 text-white",
  ok: "bg-green-600 text-white",
  failed: "bg-red-600 text-white",
  stopped: "bg-amber-500 text-white",
  skipped: "bg-muted text-muted-foreground",
};

export function RunLog({
  run,
  onOpenChange,
}: {
  run: RunView | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={!!run} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Run result
            {run && (
              <Badge className={STATUS_COLOR[run.status]}>{run.status}</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {run?.error ?? "Step-by-step trace."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto p-4">
          {run?.input ? (
            <div className="bg-muted/30 rounded-md border p-2">
              <p className="text-muted-foreground text-xs font-semibold">
                Input
              </p>
              <pre className="mt-1 max-h-40 overflow-auto text-xs whitespace-pre-wrap">
                {JSON.stringify(run.input, null, 2)}
              </pre>
            </div>
          ) : null}
          {(run?.steps ?? []).map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md border p-2"
            >
              <NodeIcon type={s.type} className="text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {NODE_META[s.type]?.label ?? s.type}
                </p>
                {s.detail && (
                  <p className="text-muted-foreground truncate text-xs">
                    {s.detail}
                  </p>
                )}
              </div>
              <Badge className={STATUS_COLOR[s.status]}>{s.status}</Badge>
            </div>
          ))}
          {run?.steps.length === 0 && (
            <p className="text-muted-foreground text-sm">No steps ran.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
