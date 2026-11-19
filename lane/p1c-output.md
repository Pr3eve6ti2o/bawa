```ts
import { useCallback, useRef, useState } from 'react';
import type { BalanceState } from '../state/wallet-context';
import { CHAIN_DECIMALS } from './format';
import { fiatMinorUnits, formatFiatUSD, sumFiatUSD } from './money';

export function fiatValueForBalance(
  chain: ChainId,
  balance: BalanceState,
  entry: PriceEntry,
  nowMs: number,
):
  | { kind: 'zero' }
  | { kind: 'fiat'; minorUnits: number; text: string }
  | { kind: 'unavailable' }
  | { kind: 'expired' }
  | {
      kind: 'error';
      reason: 'rate-limited' | 'network' | 'provider' | 'timeout';
    }
  | { kind: 'balance-unavailable' } {
  if (
    balance.status === 'loading' ||
    balance.status === 'unavailable' ||
    balance.status === 'error'
  ) {
    return { kind: 'balance-unavailable' };
  }

  if (
    balance.status === 'zero' ||
    (balance.status === 'available' && balance.value === '0')
  ) {
    return { kind: 'zero' };
  }
  if (balance.value === undefined) {
    return { kind: 'balance-unavailable' };
  }

  if (entry.status === 'error') {
    return { kind: 'error', reason: entry.reason };
  }
  if (entry.status === 'unavailable') {
    return { kind: 'unavailable' };
  }
  if (entry.status === 'expired' || !isFreshQuote(entry.quote, nowMs)) {
    return { kind: 'expired' };
  }

  const minorUnits = fiatMinorUnits(
    balance.value,
    CHAIN_DECIMALS[chain],
    usdPriceToMinorUnitsPerWhole(entry.quote.usdPrice),
  );
  return { kind: 'fiat', minorUnits, text: formatFiatUSD(minorUnits) };
}

export function portfolioTotal(
  balances: Record<ChainId, BalanceState>,
  entries: PriceMap,
  nowMs: number,
): {
  status: 'zero' | 'total' | 'partial' | 'unavailable';
  text: string;
  partial: boolean;
} {
  const chains: ChainId[] = ['btc', 'eth', 'trx', 'ton'];
  const list = chains.map((chain) => balances[chain]);
  if (
    list.some(
      ({ status }) =>
        status === 'loading' || status === 'unavailable' || status === 'error',
    )
  ) {
    return { status: 'unavailable', text: 'Unavailable', partial: false };
  }
  if (
    list.every(
      ({ status, value }) =>
        status === 'zero' || (status === 'available' && value === '0'),
    )
  ) {
    return { status: 'zero', text: '$0.00', partial: false };
  }

  const contributed: number[] = [];
  let partial = false;
  for (const chain of chains) {
    const balance = balances[chain];
    if (balance.status === 'zero' || balance.value === '0') {
      continue;
    }
    const entry = entries[chain];
    if (
      balance.value === undefined ||
      entry.status !== 'fresh' ||
      !isFreshQuote(entry.quote, nowMs)
    ) {
      partial = true;
      continue;
    }
    contributed.push(
      fiatMinorUnits(
        balance.value,
        CHAIN_DECIMALS[chain],
        usdPriceToMinorUnitsPerWhole(entry.quote.usdPrice),
      ),
    );
  }
  if (contributed.length === 0) {
    return { status: 'unavailable', text: 'Unavailable', partial: false };
  }
  return {
    status: partial ? 'partial' : 'total',
    text: sumFiatUSD(contributed),
    partial,
  };
}

export function quoteFreshnessLabel(quote: PriceQuote, nowMs: number): string {
  const ageMs = nowMs - quote.providerUpdatedAtMs;
  if (ageMs < 60_000) {
    return 'Updated just now';
  }
  if (ageMs < 3_600_000) {
    return `Updated ${Math.max(1, Math.floor(ageMs / 60_000))} min ago`;
  }
  const time = new Date(quote.providerUpdatedAtMs).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Updated ${time}`;
}

function idleEntries(): PriceMap {
  return {
    btc: { status: 'unavailable', reason: 'missing' },
    eth: { status: 'unavailable', reason: 'missing' },
    trx: { status: 'unavailable', reason: 'missing' },
    ton: { status: 'unavailable', reason: 'missing' },
  };
}

export function usePrices(): { state: PricesState; refresh: () => void } {
  const [state, setState] = useState<PricesState>(() => ({
    status: 'idle',
    entries: idleEntries(),
    lastFetchedAtMs: null,
  }));
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (state.status === 'loading' || inFlight.current) return;
    const networkError: PricesState = {
      status: 'ready',
      entries: {
        btc: { status: 'error', reason: 'network' },
        eth: { status: 'error', reason: 'network' },
        trx: { status: 'error', reason: 'network' },
        ton: { status: 'error', reason: 'network' },
      },
      lastFetchedAtMs: null,
    };
    if (typeof globalThis.fetch !== 'function') {
      setState(networkError);
      return;
    }

    inFlight.current = true;
    setState((previous) => ({ ...previous, status: 'loading' }));
    void (async () => {
      try {
        const entries = await fetchPrices(globalThis.fetch, Date.now());
        setState({
          status: 'ready',
          entries,
          lastFetchedAtMs: Date.now(),
        });
      } catch {
        setState(networkError);
      } finally {
        inFlight.current = false;
      }
    })();
  }, [state.status]);

  return { state, refresh };
}
```