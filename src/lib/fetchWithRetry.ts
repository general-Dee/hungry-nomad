// Generic retry-with-timeout helper, extracted from the retry loop originally
// written for the checkout page's delivery zone fetch. Each attempt gets its
// own AbortController-based hard timeout so a hung request can't stall the
// caller forever; attempts are spaced out with exponential backoff.
export interface WithRetryOptions {
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_BACKOFF_MS = 500;

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: WithRetryOptions = {}
): Promise<T> {
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const delay = backoffMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}
