"use client";

import { useEffect, useRef } from "react";

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Gmail-style single-key + two-key-sequence shortcuts.
 * Keys: single ("j", "e", "#"), "mod+Enter", or sequences ("g i", "g c").
 * Ignored while typing in inputs/textareas/contenteditable.
 */
export function useShortcuts(map: ShortcutMap, enabled = true) {
  const seqRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // mod+Enter (send)
      if (mod && e.key === "Enter" && map["mod+Enter"]) {
        e.preventDefault();
        map["mod+Enter"](e);
        return;
      }
      if (mod) return;

      // two-key sequence (g i, g c)
      const prev = seqRef.current;
      if (prev && Date.now() - prev.at < 800) {
        const combo = `${prev.key} ${e.key}`;
        if (map[combo]) {
          e.preventDefault();
          seqRef.current = null;
          map[combo](e);
          return;
        }
      }
      if (e.key === "g") {
        seqRef.current = { key: "g", at: Date.now() };
        return;
      }
      seqRef.current = null;

      const handler = map[e.key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, enabled]);
}

/** The canonical shortcut list, used by the help overlay too. */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "j / k", label: "Next / previous thread" },
  { keys: "Enter", label: "Open focused thread" },
  { keys: "e", label: "Archive" },
  { keys: "#", label: "Trash" },
  { keys: "r", label: "Reply" },
  { keys: "s", label: "Star" },
  { keys: "u", label: "Mark read / unread" },
  { keys: "c", label: "Compose" },
  { keys: "⌘ Enter", label: "Send" },
  { keys: "g h", label: "Go to Dashboard" },
  { keys: "g i", label: "Show Inbox" },
  { keys: "g t", label: "Show Sent" },
  { keys: "g s", label: "Show Starred" },
  { keys: "g r", label: "Show Trash" },
  { keys: "g c", label: "Go to Calendar" },
  { keys: "?", label: "Show this help" },
];
