"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InboxIcon,
  Calendar03Icon,
  AiChat02Icon,
  Settings02Icon,
  PlusSignIcon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";

const NAV = [
  {
    label: "Inbox",
    href: "/dashboard",
    icon: InboxIcon,
    iconClass: "text-blue-500",
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: Calendar03Icon,
    iconClass: "text-emerald-500",
  },
  {
    label: "Workflows",
    href: "/dashboard/workflows",
    icon: WorkflowSquare03Icon,
    iconClass: "text-amber-500",
  },
  {
    label: "Agent",
    href: "/dashboard/agent",
    icon: AiChat02Icon,
    iconClass: "text-violet-500",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings02Icon,
    iconClass: "text-slate-400",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Defer rendering to the client. The dialog always renders a hidden
  // (sr-only) title/description whose base-ui generated ids aren't SSR-stable,
  // which causes a hydration mismatch. It's keyboard-triggered, so there is no
  // value in server-rendering it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        router.push("/dashboard/agent");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!mounted) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to… ⌘K" />
      <CommandList>
        <CommandEmpty className="py-4 text-center">
          <Search className="text-muted-foreground/30 mx-auto mb-2 size-5" />
          <p className="text-muted-foreground text-sm">No results</p>
        </CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem key={n.href} onSelect={() => go(n.href)}>
              <HugeiconsIcon
                icon={n.icon}
                strokeWidth={2}
                className={n.iconClass}
              />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/dashboard/calendar")}>
            <HugeiconsIcon
              icon={PlusSignIcon}
              strokeWidth={2}
              className="text-emerald-500"
            />
            New event
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
