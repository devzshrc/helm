"use client";

import { useState } from "react";
import {
  ArrowDownWideNarrow,
  CheckCheck,
  CornerRightDown,
  type LucideIcon,
  Text,
} from "lucide-react";

import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { useAutoResizeTextarea } from "~/hooks/use-auto-resize-textarea";

interface ActionItem {
  text: string;
  icon: LucideIcon;
  colors: {
    icon: string;
    border: string;
    bg: string;
  };
}

interface AIInputWithSuggestionsProps {
  id?: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  actions?: ActionItem[];
  defaultSelected?: string;
  onSubmit?: (text: string, action?: string) => void;
  className?: string;
}

const DEFAULT_ACTIONS: ActionItem[] = [
  {
    text: "Summary",
    icon: Text,
    colors: {
      icon: "text-orange-600",
      border: "border-orange-500",
      bg: "bg-orange-100",
    },
  },
  {
    text: "Fix Spelling and Grammar",
    icon: CheckCheck,
    colors: {
      icon: "text-emerald-600",
      border: "border-emerald-500",
      bg: "bg-emerald-100",
    },
  },
  {
    text: "Make shorter",
    icon: ArrowDownWideNarrow,
    colors: {
      icon: "text-purple-600",
      border: "border-purple-500",
      bg: "bg-purple-100",
    },
  },
];

export function AIInputWithSuggestions({
  id = "ai-input-with-actions",
  placeholder = "Enter your text here...",
  minHeight = 64,
  maxHeight = 200,
  actions = DEFAULT_ACTIONS,
  defaultSelected,
  onSubmit,
  className,
}: AIInputWithSuggestionsProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(
    defaultSelected ?? null,
  );

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });

  const toggleItem = (itemText: string) => {
    setSelectedItem((prev) => (prev === itemText ? null : itemText));
  };

  const currentItem = selectedItem
    ? actions.find((item) => item.text === selectedItem)
    : null;

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit?.(inputValue, selectedItem ?? undefined);
      setInputValue("");
      setSelectedItem(null);
      adjustHeight(true);
    }
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative mx-auto w-full max-w-xl">
        <div className="bg-muted/40 focus-within:border-foreground/20 relative rounded-2xl border">
          <div className="flex flex-col">
            <div
              className="overflow-y-auto"
              style={{ maxHeight: `${maxHeight - 48}px` }}
            >
              <Textarea
                ref={textareaRef}
                id={id}
                placeholder={placeholder}
                className="text-foreground placeholder:text-muted-foreground w-full max-w-xl resize-none rounded-2xl border-none bg-transparent pt-3 pr-10 pb-3 leading-[1.2] text-wrap focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ minHeight: `${minHeight}px` }}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>

            <div className="h-12 bg-transparent">
              {currentItem && (
                <div className="absolute bottom-3 left-3 z-10">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      "rounded-md border px-2 py-0.5 text-xs font-medium shadow-sm",
                      "animate-in fade-in hover:bg-accent transition-colors duration-200",
                      currentItem.colors.bg,
                      currentItem.colors.border,
                    )}
                  >
                    <currentItem.icon
                      className={`h-3.5 w-3.5 ${currentItem.colors.icon}`}
                    />
                    <span className={currentItem.colors.icon}>
                      {selectedItem}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <CornerRightDown
            className={cn(
              "text-foreground absolute top-3 right-3 h-4 w-4 transition-all duration-200",
              inputValue ? "scale-100 opacity-100" : "scale-95 opacity-30",
            )}
          />
        </div>
      </div>
      <div className="mx-auto mt-2 flex max-w-xl flex-wrap justify-start gap-1.5 px-4">
        {actions
          .filter((item) => item.text !== selectedItem)
          .map(({ text, icon: Icon, colors }) => (
            <button
              type="button"
              key={text}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                "border transition-all duration-200",
                "bg-card hover:bg-accent border",
                "flex-shrink-0",
              )}
              onClick={() => toggleItem(text)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-4 w-4", colors.icon)} />
                <span className="text-muted-foreground whitespace-nowrap">
                  {text}
                </span>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
