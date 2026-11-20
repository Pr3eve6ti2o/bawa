import { fetchJson } from './adapters/types';
import { BawaError, WalletErrorCodes } from './errors';

export interface RetryEvent {
  kind: 'retry_attempt' | 'retry_success' | 'retry_give_up';
  operation: string;
  attempt: number;
  errorCode: number | null;
  delayMs: number;
}

export interface RetryOptions {
  operation: string;
  maxAttempts?: number;
  totalBudgetMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  signal?: AbortSignal;
  onEvent?: (event: RetryEvent) => void;
}

let defaultRetryEventListener: ((event: RetryEvent) => void) | undefined;

export function setDefaultRetryEventListener(
  listener: ((event: RetryEvent) => void) | undefined,
): void {
  defaultRetryEventListener = listener;
}

export function classifyRetryableError(error: unknown): boolean {
  if (error instanceof BawaError) {
    switch (error.code) {
      case WalletErrorCodes.PROVIDER_NETWORK:
      case WalletErrorCodes.PROVIDER_TIMEOUT:
      case WalletErrorCodes.PROVIDER_RATE_LIMITED:
      case WalletErrorCodes.PROVIDER_UNAVAILABLE:
        return true;
      default:
        return false;
    }
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    /^HTTP (?:429|502|503|504)$/.test(error.message) ||
    error.message.startsWith('Network error: ')
  );
}

function emitRetryEvent(options: RetryOptions, event: RetryEvent): void {
  try {
    (options.onEvent ?? defaultRetryEventListener)?.(event);
  } catch {
    // Event listeners must not alter retry outcomes.
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason;
  }
}

function waitForRetry(
  delayMs: number,
  sleep: RetryOptions['sleep'],
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };

    const onAbort = (): void => {
      cleanup();
      reject(signal?.reason);
    };

    const onDone = (): void => {
      cleanup();
      resolve();
    };

    const onError = (error: unknown): void => {
      cleanup();
      reject(error);
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    try {
      if (sleep) {
        Promise.resolve(sleep(delayMs)).then(onDone, onError);
      } else {
        timer = setTimeout(onDone, delayMs);
      }
    } catch (error) {
      onError(error);
    }
  });
}

/** Retry read-only operations; never use for signing or broadcasting. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const signal = options.signal;
  throwIfAborted(signal);

  const maxAttempts = options.maxAttempts ?? 3;
  const totalBudgetMs = options.totalBudgetMs ?? 30000;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const startedAt = now();

  for (let attempt = 1; ; attempt += 1) {
    throwIfAborted(signal);

    let result: T;

    try {
      result = await fn();
    } catch (error) {
      throwIfAborted(signal);

      const errorCode = error instanceof BawaError ? error.code : null;
      const giveUp = (): never => {
        emitRetryEvent(options, {
          kind: 'retry_give_up',
          operation: options.operation,
          attempt,
          errorCode,
          delayMs: 0,
        });
        throw error;
      };

      if (!classifyRetryableError(error) || attempt >= maxAttempts) {
        giveUp();
      }

      const elapsedMs = now() - startedAt;
      if (elapsedMs > totalBudgetMs) {
        giveUp();
      }

      const context =
        error instanceof BawaError && error.code === 2003
          ? error.context
          : undefined;
      const retryAfterMs =
        typeof context === 'object' && context !== null
          ? (context as { retryAfterMs?: unknown }).retryAfterMs
          : undefined;
      const delayMs =
        typeof retryAfterMs === 'number'
          ? Math.min(maxDelayMs, retryAfterMs)
          : Math.min(maxDelayMs, random() * baseDelayMs * 2 ** (attempt - 1));

      if (elapsedMs + delayMs > totalBudgetMs) {
        giveUp();
      }

      emitRetryEvent(options, {
        kind: 'retry_attempt',
        operation: options.operation,
        attempt,
        errorCode,
        delayMs,
      });

      await waitForRetry(delayMs, options.sleep, signal);
      throwIfAborted(signal);

      // A timer or injected sleep may take longer than its requested delay.
      if (now() - startedAt > totalBudgetMs) {
        giveUp();
      }

      continue;
    }

    emitRetryEvent(options, {
      kind: 'retry_success',
      operation: options.operation,
      attempt,
      errorCode: null,
      delayMs: 0,
    });

    return result;
  }
}

export function fetchJsonWithRetry(
  url: Parameters<typeof fetchJson>[0],
  init?: Parameters<typeof fetchJson>[1],
  timeoutMs = 10000,
  options?: Omit<RetryOptions, 'operation'>,
): Promise<unknown> {
  return withRetry(() => fetchJson(url, init, timeoutMs), {
    ...options,
    operation: 'fetchJson',
  });
}

export type RetryMetrics = {
  calls: number;
  retries: number;
  successes: number;
  giveUps: number;
};

const retryMetricsState: RetryMetrics = {
  calls: 0,
  retries: 0,
  successes: 0,
  giveUps: 0,
};

const retryEventSubscribers = new Set<(event: RetryEvent) => void>();

export function subscribeRetryEvents(listener: (event: RetryEvent) => void): () => void {
  retryEventSubscribers.add(listener);

  return () => {
    retryEventSubscribers.delete(listener);
  };
}

export function getRetryMetrics(): RetryMetrics {
  return { ...retryMetricsState };
}

export function resetRetryMetrics(): void {
  retryMetricsState.calls = 0;
  retryMetricsState.retries = 0;
  retryMetricsState.successes = 0;
  retryMetricsState.giveUps = 0;
}

setDefaultRetryEventListener((event: RetryEvent): void => {
  switch (event.kind) {
    case 'retry_attempt':
      retryMetricsState.retries += 1;
      break;
    case 'retry_success':
      retryMetricsState.successes += 1;
      retryMetricsState.calls += 1;
      break;
    case 'retry_give_up':
      retryMetricsState.giveUps += 1;
      retryMetricsState.calls += 1;
      break;
  }

  for (const listener of Array.from(retryEventSubscribers)) {
    try {
      listener({ ...event });
    } catch {
      // Subscriber failures must not affect retries or other subscribers.
    }
  }
});
