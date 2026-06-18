import { describe, expect, it } from "vitest";

import { clean, describeAction, writeSchemas } from "~/lib/ai/write-actions";

describe("clean", () => {
  it("drops empty-string sentinels but keeps real values", () => {
    expect(clean({ to: "a@b.com", subject: "", body: "hi" })).toEqual({
      to: "a@b.com",
      body: "hi",
    });
  });

  it("leaves non-empty values untouched", () => {
    const input = { summary: "Sync", start: "2026-01-01T10:00:00Z" };
    expect(clean(input)).toEqual(input);
  });
});

describe("describeAction", () => {
  it("summarizes send_email", () => {
    expect(describeAction("send_email", { to: "a@b.com", subject: "Hi" })).toBe(
      'Email a@b.com — "Hi"',
    );
  });

  it("summarizes create_event with attendees", () => {
    expect(
      describeAction("create_event", {
        summary: "Sync",
        start: "2026-01-01T10:00:00Z",
        attendees: ["x@y.com", "z@y.com"],
      }),
    ).toContain("invites x@y.com, z@y.com");
  });

  it("tolerates non-string fields", () => {
    expect(describeAction("label_thread", {})).toBe('Label "" → ');
  });
});

describe("writeSchemas", () => {
  it("accepts a valid send_email payload", () => {
    const r = writeSchemas.send_email.safeParse({
      to: "a@b.com",
      subject: "Hi",
      body: "Body",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(writeSchemas.send_email.safeParse({ to: "a@b.com" }).success).toBe(
      false,
    );
  });
});
