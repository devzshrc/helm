"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "~/lib/utils";

export function PremiumMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-p:my-2 prose-p:leading-7 prose-li:my-1 prose-ul:my-2 prose-ol:my-2",
        "prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:rounded-xl prose-pre:border prose-pre:bg-muted/60 prose-pre:p-3",
        "prose-blockquote:rounded-r-lg prose-blockquote:border-l-primary prose-blockquote:bg-muted/40 prose-blockquote:py-1 prose-blockquote:pr-3",
        "prose-table:text-sm prose-th:border prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:px-3 prose-td:py-2",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}
