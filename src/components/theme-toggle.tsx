"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "~/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => void;
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  function set(next: "light" | "dark") {
    if ((next === "dark") === isDark) return;
    const doc =
      typeof document !== "undefined"
        ? (document as ViewTransitionDocument)
        : undefined;
    if (doc?.startViewTransition) {
      doc.startViewTransition(() => setTheme(next));
    } else {
      setTheme(next);
    }
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        "bg-muted/40 flex h-8 items-center rounded-md border p-0.5 text-xs font-medium",
        className,
      )}
    >
      {[
        { value: "light" as const, label: "Light" },
        { value: "dark" as const, label: "Dark" },
      ].map((item) => {
        const active = isDark ? item.value === "dark" : item.value === "light";
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => set(item.value)}
            aria-pressed={active}
            className={cn(
              "h-7 rounded-[6px] px-2.5 transition-colors duration-150",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
