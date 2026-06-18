import { describe, expect, it } from "vitest";

import { redactMessagesForStorage } from "~/lib/agent-redact";

describe("redactMessagesForStorage", () => {
  it("truncates long body fields", () => {
    const long = "x".repeat(1000);
    const [msg] = redactMessagesForStorage([{ role: "tool", html: long }]) as [
      { html: string },
    ];
    expect(msg.html.length).toBeLessThan(long.length);
    expect(msg.html.endsWith("…")).toBe(true);
  });

  it("keeps short fields untouched", () => {
    const out = redactMessagesForStorage([
      { role: "assistant", content: "Hi there" },
    ]);
    expect(out).toEqual([{ role: "assistant", content: "Hi there" }]);
  });

  it("redacts inside a JSON-string tool result", () => {
    const body = "y".repeat(900);
    const content = JSON.stringify({
      messages: [{ from: "a@b.com", text: body }],
    });
    const [msg] = redactMessagesForStorage([{ role: "tool", content }]) as [
      { content: string },
    ];
    const parsed = JSON.parse(msg.content) as {
      messages: { from: string; text: string }[];
    };
    expect(parsed.messages[0]!.from).toBe("a@b.com");
    expect(parsed.messages[0]!.text.length).toBeLessThan(body.length);
  });

  it("leaves non-JSON content strings reasonable", () => {
    const out = redactMessagesForStorage([{ content: "plain answer" }]) as [
      { content: string },
    ];
    expect(out[0].content).toBe("plain answer");
  });
});
