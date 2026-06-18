import "server-only";

/**
 * Minimal structured logger. Emits one JSON line per event to stdout/stderr,
 * which Vercel captures and indexes (filter on fields like `tenantId`, `event`,
 * and `level` in the Vercel logs/Observability view). This is also the single
 * seam where an error monitor (e.g. Sentry) can be wired in for `error` events.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: Fields) {
  const line = JSON.stringify({
    level,
    message,
    ...fields,
    ts: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Hook point: forward error-level events to an external monitor here.
  // if (level === "error") Sentry.captureMessage(message, { extra: fields });
}

export const log = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
