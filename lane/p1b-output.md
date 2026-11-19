```ts
import Decimal from 'decimal.js';

export async function fetchPrices(
  fetchFn: typeof fetch,
  nowMs?: number,
): Promise<PriceMap> {
  const chains = ['btc', 'eth', 'trx', 'ton'] as const;
  const allError = (
    entry: Extract<PriceEntry, { status: 'error' }>,
  ): PriceMap =>
    Object.fromEntries(chains.map((chain) => [chain, { ...entry }])) as PriceMap;
  const isAbortError = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError';

  const resolvedNowMs = nowMs ?? Date.now();
  const headers: Record<string, string> = { Accept: 'application/json' };
  const demoKey: unknown = (
    import.meta as ImportMeta & {
      env?: { VITE_COINGECKO_DEMO_KEY?: unknown };
    }
  ).env?.VITE_COINGECKO_DEMO_KEY;
  if (typeof demoKey === 'string' && demoKey.length > 0) {
    headers['x-cg-demo-api-key'] = demoKey;
  }

  const ids = Object.values(PRICE_IDS).join(',');
  const url =
    `${PRICE_PROVIDER_BASE_URL}/simple/price?ids=${ids}` +
    '&vs_currencies=usd&include_last_updated_at=true';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRICE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const seconds =
        retryAfter !== null && retryAfter.trim() !== ''
          ? Number(retryAfter)
          : NaN;
      const retryAfterMs = seconds * 1000;
      return allError({
        status: 'error',
        reason: 'rate-limited',
        ...(Number.isFinite(retryAfterMs) && retryAfterMs >= 0
          ? { retryAfterMs }
          : {}),
      });
    }
    if (!response.ok) {
      return allError({ status: 'error', reason: 'provider' });
    }

    try {
      return parsePriceResponse(await response.json(), resolvedNowMs);
    } catch (error: unknown) {
      return allError({
        status: 'error',
        reason: isAbortError(error) ? 'timeout' : 'provider',
      });
    }
  } catch (error: unknown) {
    return allError({
      status: 'error',
      reason: isAbortError(error) ? 'timeout' : 'network',
    });
  } finally {
    clearTimeout(timer);
  }
}

export function usdPriceToMinorUnitsPerWhole(usdPrice: string): string {
  const invalidMessage =
    'Invalid USD price: expected a finite decimal string greater than zero.';
  let price: Decimal;
  try {
    price = new Decimal(usdPrice);
  } catch {
    throw new Error(invalidMessage);
  }
  if (!price.isFinite() || !price.gt('0')) {
    throw new Error(invalidMessage);
  }

  const ExactDecimal = Decimal.clone({
    precision: Math.max(Decimal.precision, price.precision() + 2),
  });
  return new ExactDecimal(usdPrice)
    .times('100')
    .toFixed(0, Decimal.ROUND_HALF_UP);
}
```