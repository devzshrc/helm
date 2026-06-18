"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Mic, Square } from "lucide-react";

import { cn } from "~/lib/utils";
import { Textarea } from "~/components/ui/textarea";
import { useAutoResizeTextarea } from "~/hooks/use-auto-resize-textarea";
import { useSpeechRecognition } from "~/hooks/use-speech-recognition";
import {
  filterCommands,
  SLASH_COMMANDS,
  type SlashCommand,
} from "~/components/agent/slash-commands";

interface AgentComposerProps {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Helm chat composer — sleek, minimal, single rounded surface with an inline
 * send button. Predefined tasks live as `/slash` commands: type `/` to open the
 * command menu (↑/↓ to move, Enter to pick, Esc to dismiss), or just watch the
 * rotating hint inside the box for ideas. Free text sends as-is on Enter.
 */
export function AgentComposer({
  onSubmit,
  onStop,
  disabled = false,
  placeholder = "Message Helm…",
}: AgentComposerProps) {
  const [value, setValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  // Rotating placeholder hint cycling through the slash commands.
  const [rotIndex, setRotIndex] = useState(0);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 200,
  });
  // Text typed before dictation started — the cumulative transcript is appended
  // to this rather than overwriting what the user already wrote.
  const dictBaseRef = useRef("");
  const {
    supported: micSupported,
    listening,
    toggle: toggleMic,
  } = useSpeechRecognition((t) => {
    const base = dictBaseRef.current;
    setValue(base ? `${base} ${t}` : t);
    requestAnimationFrame(() => adjustHeight());
  });

  function handleMic() {
    if (!listening) dictBaseRef.current = value.trim();
    toggleMic();
  }

  const slashOpen = value.startsWith("/") && !menuDismissed;
  const matches = slashOpen ? filterCommands(value) : [];
  const menuVisible = slashOpen && matches.length > 0;
  const canSend = value.trim().length > 0 && !disabled;
  const showHint = value.length === 0 && !menuVisible;
  const rotCmd = SLASH_COMMANDS[rotIndex % SLASH_COMMANDS.length]!;

  useEffect(() => {
    if (activeIndex >= matches.length) setActiveIndex(0);
  }, [matches.length, activeIndex]);

  // Advance the rotating hint gently while the box is idle.
  useEffect(() => {
    if (!showHint) return;
    const id = setInterval(
      () => setRotIndex((i) => (i + 1) % SLASH_COMMANDS.length),
      2800,
    );
    return () => clearInterval(id);
  }, [showHint]);

  function reset() {
    setValue("");
    setMenuDismissed(false);
    setActiveIndex(0);
    adjustHeight(true);
  }

  function run(text: string) {
    const t = text.trim();
    if (!t || disabled) return;
    onSubmit(t);
    reset();
  }

  function pick(cmd: SlashCommand) {
    run(cmd.prompt);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuVisible) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const cmd = matches[activeIndex];
        if (cmd) pick(cmd);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run(value);
    }
  }

  return (
    <div className="px-3 py-3">
      <div className="relative mx-auto w-full max-w-3xl">
        {/* Slash-command menu */}
        <AnimatePresence>
          {menuVisible && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16, ease: [0.2, 0.65, 0.3, 0.9] }}
              className="bg-popover absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-xl border shadow-lg"
            >
              <div className="text-muted-foreground border-b px-3 py-1.5 text-[11px] font-medium">
                Commands
              </div>
              <ul className="max-h-64 overflow-y-auto p-1">
                {matches.map((cmd, i) => {
                  const Icon = cmd.icon;
                  return (
                    <li key={cmd.command}>
                      <button
                        type="button"
                        // onMouseDown fires before the textarea blur.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pick(cmd);
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                          i === activeIndex
                            ? "bg-accent"
                            : "hover:bg-accent/60",
                        )}
                      >
                        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {cmd.label}
                            <span className="text-muted-foreground font-mono text-xs">
                              {cmd.command}
                            </span>
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {cmd.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input surface — borderless, inset shadow gives shape without a line */}
        <div className="bg-muted/60 focus-within:bg-muted/80 relative flex items-end rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-colors">
          <Textarea
            ref={textareaRef}
            placeholder={showHint ? "" : placeholder}
            className="placeholder:text-muted-foreground max-h-48 w-full resize-none border-none bg-transparent py-3.5 pr-20 pl-4 text-sm leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ minHeight: "52px" }}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (menuDismissed && !e.target.value.startsWith("/")) {
                setMenuDismissed(false);
              }
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
          />

          {/* Rotating slash-command hint — plain placeholder text, not clickable */}
          {showHint ? (
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center pr-12">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={rotCmd.command}
                  initial={{ opacity: 0, y: 5, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -5, filter: "blur(2px)" }}
                  transition={{ duration: 0.34, ease: [0.2, 0.65, 0.3, 0.9] }}
                  className="text-muted-foreground truncate text-sm"
                >
                  <span className="font-mono">{rotCmd.command}</span>
                  <span className="text-muted-foreground/60">
                    {" "}
                    — {rotCmd.description}
                  </span>
                </motion.span>
              </AnimatePresence>
            </div>
          ) : null}

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            {micSupported && !disabled ? (
              <button
                type="button"
                onClick={handleMic}
                aria-label={listening ? "Stop dictation" : "Dictate"}
                className={cn(
                  "grid size-8 place-items-center rounded-full transition-colors",
                  listening
                    ? "animate-pulse bg-red-500 text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            ) : null}
            {disabled ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop"
                className="bg-foreground text-background grid size-8 place-items-center rounded-full transition-opacity hover:opacity-90"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => run(value)}
                disabled={!canSend}
                aria-label="Send"
                className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-full transition-opacity disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-2">
          <p className="text-muted-foreground/70 text-center text-[11px]">
            <span className="hidden sm:inline">
              Shift+Enter for a new line ·{" "}
            </span>
            Helm can make mistakes. It asks before sending or changing anything.
          </p>
          {value.length > 280 ? (
            <span className="text-muted-foreground/50 absolute top-0 right-0 text-[11px] tabular-nums">
              {value.length}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
