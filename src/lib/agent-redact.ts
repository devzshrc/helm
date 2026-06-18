/**
 * Redact PII from CopilotKit/AG-UI chat messages before persisting them in
 * `chat_sessions.messages`. Full email/event bodies are streamed into tool
 * results and would otherwise sit in the DB indefinitely (PII at rest).
 *
 * Strategy: keep the message/card structure intact (so restored conversations
 * still render) but truncate large body-like fields. Tool results are often a
 * JSON string under `content`/`result`; we parse, redact inside, and re-stringify.
 *
 * Pure module (no server-only / DB imports) so it is unit-testable.
 */

const BODY_KEYS = new Set([
  "html",
  "text",
  "body",
  "draftBody",
  "markdown",
  "content_html",
]);
const MAX_BODY = 280;
const MAX_OPAQUE = 4000;

function redactValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string" && BODY_KEYS.has(k)) {
        out[k] = val.length > MAX_BODY ? `${val.slice(0, MAX_BODY)}…` : val;
      } else if (
        typeof val === "string" &&
        (k === "content" || k === "result")
      ) {
        out[k] = redactJsonString(val);
      } else {
        out[k] = redactValue(val);
      }
    }
    return out;
  }
  return v;
}

/** Tool results are commonly a JSON string; redact inside it when parseable. */
function redactJsonString(s: string): string {
  if (s.length === 0) return s;
  try {
    const parsed: unknown = JSON.parse(s);
    if (parsed && typeof parsed === "object") {
      return JSON.stringify(redactValue(parsed));
    }
  } catch {
    // not JSON — fall through
  }
  return s.length > MAX_OPAQUE ? `${s.slice(0, MAX_OPAQUE)}…` : s;
}

export function redactMessagesForStorage(messages: unknown[]): unknown[] {
  return messages.map(redactValue);
}
