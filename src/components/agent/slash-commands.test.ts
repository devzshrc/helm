import { describe, expect, it } from "vitest";

import {
  filterCommands,
  SLASH_COMMANDS,
} from "~/components/agent/slash-commands";

describe("filterCommands", () => {
  it("returns all commands for an empty / query", () => {
    expect(filterCommands("/")).toHaveLength(SLASH_COMMANDS.length);
  });

  it("matches by command token", () => {
    const r = filterCommands("/unr");
    expect(r.some((c) => c.command === "/unread")).toBe(true);
  });

  it("matches by label/description", () => {
    expect(filterCommands("brief").some((c) => c.command === "/digest")).toBe(
      true,
    );
  });

  it("returns nothing for a non-match", () => {
    expect(filterCommands("/zzzz")).toHaveLength(0);
  });
});
