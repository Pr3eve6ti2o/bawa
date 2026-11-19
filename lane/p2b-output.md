```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchPrices } from './prices';

describe('fetchPrices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches all four fresh prices in one batch without a demo key', async () => {
    vi.stubEnv('VITE_COINGECKO_DEMO_KEY', '');
    try {
      const calls: Array<{ url: string; init: unknown }> = [];
      const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return {
          ok: true,
          status: 200,
          json: async () => freshPayload(),
          headers: { get: () => null },
        };
      });
      const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

      expect(calls).toHaveLength(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(calls[0]!.url).toBe(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tron,the-open-network&vs_currencies=usd&include_last_updated_at=true',
      );
      const headers = (
        calls[0]!.init as { headers: Record<string, string> }
      ).headers;
      expect(headers['Accept']).toBe('application/json');
      expect(headers).not.toHaveProperty('x-cg-demo-api-key');
      expect(Object.values(prices)).toHaveLength(4);
      for (const price of Object.values(prices)) {
        expect(price).toMatchObject({ status: 'fresh' });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('reads and sends the demo key at call time', async () => {
    vi.stubEnv('VITE_COINGECKO_DEMO_KEY', 'demo-key-123');
    try {
      const fetchFn = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: async () => freshPayload(),
        headers: { get: () => null },
      }));
      await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

      const headers = fetchFn.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers['x-cg-demo-api-key']).toBe('demo-key-123');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('maps 429 with Retry-After seconds without retrying', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === 'Retry-After' ? '120' : null) },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(4);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        error: 'rate-limited',
        retryAfterMs: 120_000,
      });
    }
  });

  it('maps 429 without Retry-After to an undefined retry delay', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: () => null },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(4);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        error: 'rate-limited',
      });
      expect((price as { retryAfterMs?: number }).retryAfterMs).toBeUndefined();
    }
  });

  it('maps HTTP 500 to provider errors', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(4);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        error: 'provider',
      });
    }
  });

  it('maps a thrown fetch to network errors', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('down');
    });
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(4);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        error: 'network',
      });
    }
  });

  it('maps an AbortError to timeout errors', async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(4);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        error: 'timeout',
      });
    }
  });

  it('maps a successful response with invalid JSON to provider errors', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
      headers: { get: () => null },
    }));
    const prices = await fetchPrices(fetchFn as unknown as typeof fetch, NOW_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(Object.values(prices)).toHaveLength(4);
    for (const price of Object.values(prices)) {
      expect(price).toMatchObject({
        status: 'error',
        error: 'provider',
      });
    }
  });
});
```