/**
 * Pure helpers for Gmail message payloads. No Corsair / IO here so it can be
 * unit-reasoned and reused by the agent tools later.
 *
 * Gmail `messages.get`/`threads.get` with format:'full' return a `payload`
 * tree: { mimeType, headers:[{name,value}], body:{data}, parts:[...] } where
 * body.data is base64url. format:'metadata' does NOT populate headers, so we
 * always request 'full'.
 */

export type GmailHeader = { name?: string; value?: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: Date | string | number | null;
  payload?: GmailPart;
};

export function getHeader(
  payload: GmailPart | undefined,
  name: string,
): string {
  const headers = payload?.headers ?? [];
  const lower = name.toLowerCase();
  return headers.find((h) => h.name?.toLowerCase() === lower)?.value ?? "";
}

function decodeB64Url(data: string | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Walks the part tree, returning the first matching mime body. */
function findPart(
  part: GmailPart | undefined,
  mime: string,
): GmailPart | undefined {
  if (!part) return undefined;
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return undefined;
}

/** Returns rendered HTML if present, else plain text wrapped, else snippet. */
export function bodyHtml(msg: GmailMessage): string {
  const html = findPart(msg.payload, "text/html");
  if (html) return decodeB64Url(html.body?.data);
  const text = findPart(msg.payload, "text/plain");
  if (text) {
    const t = decodeB64Url(text.body?.data);
    return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(t)}</pre>`;
  }
  return escapeHtml(msg.snippet ?? "");
}

export function bodyText(msg: GmailMessage): string {
  const text = findPart(msg.payload, "text/plain");
  if (text) return decodeB64Url(text.body?.data);
  const html = findPart(msg.payload, "text/html");
  if (html) return decodeB64Url(html.body?.data).replace(/<[^>]+>/g, " ");
  return msg.snippet ?? "";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Gmail internalDate can be a bad value; guard to a valid epoch ms or null. */
export function epochMs(
  internalDate: Date | string | number | null | undefined,
): number | null {
  if (internalDate == null) return null;
  const d =
    internalDate instanceof Date
      ? internalDate
      : new Date(Number(internalDate) || internalDate);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export type MessageSummary = {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  snippet: string;
  receivedAt: number | null;
  labelIds: string[];
  unread: boolean;
};

export function summarize(msg: GmailMessage): MessageSummary {
  const from = getHeader(msg.payload, "From");
  const match = /^(.*?)\s*<(.+?)>$/.exec(from);
  const fromName = match ? match[1]!.replace(/(^"|"$)/g, "").trim() : from;
  const fromAddr = match ? match[2]! : from;
  const labelIds = msg.labelIds ?? [];
  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    from: fromAddr,
    fromName: fromName || fromAddr,
    to: getHeader(msg.payload, "To"),
    subject: getHeader(msg.payload, "Subject"),
    snippet: msg.snippet ?? "",
    receivedAt: epochMs(msg.internalDate),
    labelIds,
    unread: labelIds.includes("UNREAD"),
  };
}
