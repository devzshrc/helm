"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { PaintBrush01Icon } from "@hugeicons/core-free-icons";

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const themes = [
  {
    value: "light",
    label: "Light",
    icon: SunIcon,
    description: "Light mode for bright environments",
  },
  {
    value: "dark",
    label: "Dark",
    icon: MoonIcon,
    description: "Dark mode for low-light environments",
  },
  {
    value: "system",
    label: "System",
    icon: SystemIcon,
    description: "Follow your OS preference",
  },
] as const;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => void;
};

export function AppearanceSection() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  function handleThemeChange(next: string) {
    const viewTransitionDocument =
      typeof document !== "undefined"
        ? (document as ViewTransitionDocument)
        : null;
    if (viewTransitionDocument?.startViewTransition) {
      viewTransitionDocument.startViewTransition(() => setTheme(next));
    } else {
      setTheme(next);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={PaintBrush01Icon}
              strokeWidth={2}
              className="text-muted-foreground size-5"
            />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>
            Choose how the app looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleThemeChange(t.value)}
                  className={`group flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200 ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="bg-muted/50 group-hover:bg-muted relative grid size-10 place-items-center rounded-full transition-colors">
                    <AnimatePresence mode="wait" initial={false}>
                      {mounted ? (
                        <motion.span
                          key={
                            t.value === "system"
                              ? isDark
                                ? "system-dark"
                                : "system-light"
                              : t.value
                          }
                          initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                          transition={{
                            duration: 0.2,
                            ease: [0.2, 0.65, 0.3, 0.9],
                          }}
                          className="absolute inset-0 grid place-items-center"
                        >
                          <Icon />
                        </motion.span>
                      ) : (
                        <span className="size-5" />
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}
                    >
                      {t.label}
                    </span>
                    <span className="text-muted-foreground text-center text-xs leading-tight">
                      {t.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
