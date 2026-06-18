"use client";

import { useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Button } from "~/components/ui/button";
import { NodeIcon } from "~/components/workflows/node-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  NODE_META,
  type NodeType,
  type TriggerType,
  nodesForTrigger,
  suggestNext,
} from "~/lib/workflows/types";

export function AddStep({
  trigger,
  lastType,
  onAdd,
}: {
  trigger: TriggerType;
  lastType: NodeType | null;
  onAdd: (type: NodeType) => void;
}) {
  const [open, setOpen] = useState(false);
  const suggested = suggestNext(trigger, lastType);
  const rest = nodesForTrigger(trigger).filter((t) => !suggested.includes(t));

  function pick(t: NodeType) {
    setOpen(false);
    onAdd(t);
  }

  const row = (t: NodeType) => (
    <CommandItem
      key={t}
      value={`${t} ${NODE_META[t].label}`}
      onSelect={() => pick(t)}
    >
      <NodeIcon type={t} />
      <div className="flex flex-col">
        <span>{NODE_META[t].label}</span>
        <span className="text-muted-foreground text-xs">
          {NODE_META[t].description}
        </span>
      </div>
    </CommandItem>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Add step
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Add a step…" />
        <CommandList>
          <CommandEmpty>No steps.</CommandEmpty>
          {suggested.length > 0 && (
            <CommandGroup heading="Suggested next">
              {suggested.map(row)}
            </CommandGroup>
          )}
          {rest.length > 0 && (
            <CommandGroup heading="All steps">{rest.map(row)}</CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
