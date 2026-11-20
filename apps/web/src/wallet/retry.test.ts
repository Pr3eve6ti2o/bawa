import { afterEach, describe, expect, it, vi } from 'vitest';
import { BawaError } from './errors';
import {
  classifyRetryableError,
  fetchJsonWithRetry,
  getRetryMetrics,
  resetRetryMetrics,
  subscribeRetryEvents,
  withRetry,
  type RetryEvent,
} from './retry';

function createTiming() {
  let currentTime = 0;

  const advance = (durationMs: number) => {
    currentTime += durationMs;
  };

  const sleep = vi.fn(async (delayMs: number) => {
    advance(delayMs);
  });

  return {
    sleep,
    now: () => currentTime,
    random: () => 1,
    advance,
  };
}

afterEach(() => {
  resetRetryMetrics();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('classifyRetryableError', () => {
  it('classifies retryable and terminal errors', () => {
    expect(classifyRetryableError(new BawaError(2002))).toBe(true);
    expect(classifyRetryableError(new BawaError(2004))).toBe(false);
    expect(classifyRetryableError(new BawaError(2005))).toBe(false);
    expect(classifyRetryableError(new BawaError(3001))).toBe(false);
    expect(classifyRetryableError(new Error('HTTP 429'))).toBe(true);
    expect(classifyRetryableError(new Error('HTTP 503'))).toBe(true);
    expect(classifyRetryableError(new Error('HTTP 404'))).toBe(false);
    expect(classifyRetryableError(new Error('Network error: boom'))).toBe(true);
    expect(classifyRetryableError(new Error('boom'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('succeeds on the first attempt without sleeping', async () => {
    const { sleep, now, random } = createTiming();
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      sleep,
      now,
      random,
    })).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('succeeds on the third attempt after sleeping 200 then 400 ms', async () => {
    const { sleep, now, random } = createTiming();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockRejectedValueOnce(new Error('HTTP 429'))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      totalBudgetMs: 10000,
      baseDelayMs: 200,
      maxDelayMs: 1000,
      sleep,
      now,
      random,
    })).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([200, 400]);
  });

  it('gives up after three attempts and rethrows the last error unchanged', async () => {
    const { sleep, now, random } = createTiming();
    const lastError = new BawaError(2002);
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockRejectedValueOnce(new Error('Network error: boom'))
      .mockRejectedValueOnce(lastError);

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      totalBudgetMs: 10000,
      baseDelayMs: 200,
      maxDelayMs: 1000,
      sleep,
      now,
      random,
    })).rejects.toBe(lastError);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([200, 400]);
  });

  it('never retries a terminal failure', async () => {
    const { sleep, now, random } = createTiming();
    const error = new BawaError(2004);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      totalBudgetMs: 10000,
      sleep,
      now,
      random,
    })).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops retries when the operation has spent the total budget', async () => {
    const { sleep, now, random, advance } = createTiming();
    const error = new Error('HTTP 503');
    const fn = vi.fn(async () => {
      advance(100);
      throw error;
    });

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      totalBudgetMs: 100,
      baseDelayMs: 10,
      maxDelayMs: 1000,
      sleep,
      now,
      random,
    })).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('never calls the function when the signal is already aborted', async () => {
    const { sleep, now, random } = createTiming();
    const controller = new AbortController();
    const fn = vi.fn().mockResolvedValue('ok');

    controller.abort();

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      signal: controller.signal,
      sleep,
      now,
      random,
    })).rejects.toThrow();

    expect(fn).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws when the signal is aborted during sleep', async () => {
    const { now, random, advance } = createTiming();
    const controller = new AbortController();
    const sleep = vi.fn(async (delayMs: number) => {
      advance(delayMs / 2);
      await Promise.resolve();
      controller.abort();
    });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 3,
      totalBudgetMs: 10000,
      baseDelayMs: 200,
      maxDelayMs: 1000,
      signal: controller.signal,
      sleep,
      now,
      random,
    })).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([200]);
  });

  it.each([
    { maxDelayMs: 2000, expectedDelayMs: 1000 },
    { maxDelayMs: 500, expectedDelayMs: 500 },
  ])('honors retryAfterMs with maxDelayMs $maxDelayMs', async ({
    maxDelayMs,
    expectedDelayMs,
  }) => {
    const { sleep, now, random } = createTiming();
    const fn = vi.fn()
      .mockRejectedValueOnce(new BawaError(2003, { retryAfterMs: 1000 }))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, {
      operation: 'test',
      maxAttempts: 2,
      totalBudgetMs: 10000,
      baseDelayMs: 200,
      maxDelayMs,
      sleep,
      now,
      random,
    })).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([
      expectedDelayMs,
    ]);
  });
});

describe('retry telemetry', () => {
  it('publishes retry events, counts outcomes, and resets metrics', async () => {
    resetRetryMetrics();

    const { sleep, now, random } = createTiming();
    const events: RetryEvent[] = [];
    const unsubscribe = subscribeRetryEvents((event) => {
      events.push(event);
    });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValue('ok');

    try {
      await expect(withRetry(fn, {
        operation: 'test',
        maxAttempts: 2,
        totalBudgetMs: 10000,
        baseDelayMs: 200,
        maxDelayMs: 1000,
        sleep,
        now,
        random,
      })).resolves.toBe('ok');

      expect(fn).toHaveBeenCalledTimes(2);
      expect(events.map((event) => event.kind)).toEqual([
        'retry_attempt',
        'retry_success',
      ]);
      expect(events[0]).toMatchObject({
        operation: 'test',
        errorCode: null,
        delayMs: 200,
      });
      expect(events[1]).toMatchObject({
        operation: 'test',
        errorCode: null,
      });
      expect(getRetryMetrics()).toMatchObject({
        calls: 1,
        retries: 1,
        successes: 1,
      });

      resetRetryMetrics();

      expect(getRetryMetrics()).toMatchObject({
        calls: 0,
        retries: 0,
        successes: 0,
      });
    } finally {
      unsubscribe();
    }
  });
});

describe('fetchJsonWithRetry', () => {
  it('retries two HTTP 503 responses and resolves the successful JSON', async () => {
    const { sleep, now, random } = createTiming();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ a: 1 }),
      });

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJsonWithRetry(
      'https://example.test/data',
      undefined,
      10000,
      {
        maxAttempts: 3,
        totalBudgetMs: 10000,
        baseDelayMs: 200,
        maxDelayMs: 1000,
        sleep,
        now,
        random,
      },
    )).resolves.toEqual({ a: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
