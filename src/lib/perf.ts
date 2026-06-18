export async function timeDev<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV !== "development") return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = Math.round(performance.now() - start);
    if (elapsed > 250) {
      console.info(`[perf] ${label}: ${elapsed}ms`);
    }
  }
}
