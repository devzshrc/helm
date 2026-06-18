"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { cn } from "~/lib/utils";

const spring = { type: "spring" as const, stiffness: 600, damping: 32 };

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  function toggle() {
    const next = isDark ? "light" : "dark";

    // Use View Transitions API for a full-page radial wipe when supported
    const doc =
      typeof document !== "undefined"
        ? (document as Document & {
            startViewTransition?: (cb: () => void) => void;
          })
        : undefined;
    if (doc?.startViewTransition) {
      doc.startViewTransition(() => setTheme(next));
    } else {
      setTheme(next);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Toggle theme"
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        "flex h-8 w-16 cursor-pointer rounded-full border p-1 transition-colors duration-200",
        isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        {/* Left slot: starts active (moon, dark bg) — slides right and fades
            to the inactive sun icon when light. */}
        <motion.div
          animate={{ x: isDark ? 0 : 32 }}
          transition={spring}
          className="flex size-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? "#27272a" : "#e5e7eb" }}
        >
          <motion.span
            animate={{ rotate: isDark ? 0 : 180, opacity: 1 }}
            transition={spring}
            className="grid place-items-center"
          >
            {isDark ? (
              <Moon className="size-4 text-white" strokeWidth={1.5} />
            ) : (
              <Sun className="size-4 text-gray-700" strokeWidth={1.5} />
            )}
          </motion.span>
        </motion.div>

        {/* Right slot: mirror of the left — starts inactive (dim sun),
            slides left and becomes active (moon, no bg) when light. */}
        <motion.div
          animate={{ x: isDark ? 0 : -32 }}
          transition={spring}
          className="flex size-6 shrink-0 items-center justify-center rounded-full"
        >
          <motion.span
            animate={{ rotate: isDark ? 0 : -180, opacity: 1 }}
            transition={spring}
            className="grid place-items-center"
          >
            {isDark ? (
              <Sun className="size-4 text-gray-500" strokeWidth={1.5} />
            ) : (
              <Moon className="size-4 text-black" strokeWidth={1.5} />
            )}
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}
