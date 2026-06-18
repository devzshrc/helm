import { describe, expect, it } from "vitest";

import { stripMarkdown } from "~/lib/agent-activity";

describe("stripMarkdown", () => {
  it("removes emphasis and headings", () => {
    expect(stripMarkdown("**Morning Briefing** **Unread (8)**")).toBe(
      "Morning Briefing Unread (8)",
    );
    expect(stripMarkdown("# Title\nbody")).toBe("Title body");
  });

  it("flattens links and code", () => {
    expect(stripMarkdown("see [docs](http://x) and `code`")).toBe(
      "see docs and code",
    );
  });

  it("collapses whitespace and strips bullets", () => {
    expect(stripMarkdown("- one\n- two")).toBe("one two");
  });

  it("truncates to maxLen with ellipsis", () => {
    const out = stripMarkdown("a".repeat(200), 50);
    expect(out.length).toBe(50);
    expect(out.endsWith("…")).toBe(true);
  });
});
