export function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const error = err as { code?: unknown; message?: unknown };
  return (
    error.code === "42P01" ||
    (typeof error.message === "string" &&
      error.message.includes('relation "webhook_subscriptions" does not exist'))
  );
}
