You are editing one React file for the Bawa web wallet (repo at /home/boxd/workspace/bawa-multichain-d-prices, app in apps/web). You have no shell or filesystem access. EMIT ONLY the complete updated contents of `apps/web/src/screens/asset-rows.tsx` inside a single ```tsx fenced block, nothing else. No prose, no other files.

CONTEXT: the prices module `apps/web/src/wallet/prices.ts` already exists in this lane with this exact API (do not re-derive, do not change it):
- `import { fiatValueForBalance, quoteFreshnessLabel } from '../wallet/prices'; import type { PriceEntry, PriceMap } from '../wallet/prices';`
- `fiatValueForBalance(chain, balance, entry, nowMs)` returns `{ kind: 'zero' } | { kind: 'fiat', minorUnits: number, text: string } | { kind: 'unavailable' } | { kind: 'expired' } | { kind: 'error', reason } | { kind: 'balance-unavailable' }`. Its text is an exact USD string such as '$62,683.00'.
- `quoteFreshnessLabel(quote, nowMs)` returns 'Updated just now', 'Updated N min ago', or 'Updated HH:MM'.
- `PriceEntry` is `{ status: 'fresh', quote } | { status: 'expired', quote } | { status: 'unavailable', reason } | { status: 'error', reason, retryAfterMs? }`.
- `BalanceState` is `{ status: 'loading' | 'zero' | 'available' | 'unavailable' | 'error'; value?: string; reason?: string }`.
- The `AssetRow` component takes `avatar`, `symbol`, `amount` (left, under the symbol), `value` (right, big) and `detail` (right, small). `value` is optional: omit it to show no right-side big text.

CURRENT FILE (exact; keep everything not listed below byte-identical in behaviour, including the ChainLogo export, CHAIN_CHIP_COLORS, the locked-vault branch, the loading skeleton, the hide-zero filtering and the "No non-zero balances" empty states):

```tsx
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { AssetRow } from '../ui/components/asset-row';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import type { ChainId } from '../engine/boundary';

// Chain logos: Trust Wallet asset registry (trustwallet/assets, MIT,
// Copyright (c) 2019-2023 Trust Wallet) — blockchains/<chain>/info/logo.png.
// Full licence note: apps/web/README.md "Chain logos".
import bitcoinLogo from '../assets/chains/bitcoin.png';
import ethereumLogo from '../assets/chains/ethereum.png';
import tronLogo from '../assets/chains/tron.png';
import tonLogo from '../assets/chains/ton.png';

const CHAIN_LOGOS: Record<ChainId, string> = {
  btc: bitcoinLogo,
  eth: ethereumLogo,
  trx: tronLogo,
  ton: tonLogo,
};

/** Native chain logo (40px default). Decorative: the chain name is adjacent text, so alt is empty. */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
  return (
    <img
      src={CHAIN_LOGOS[chain]}
      alt=""
      width={size}
      height={size}
      className="size-10 shrink-0 rounded-full"
      style={size !== 40 ? { width: size, height: size } : undefined}
    />
  );
}

export const CHAIN_CHIP_COLORS: Record<string, string> = {
  btc: '#f7931a',
  eth: '#627eea',
  trx: '#eb0029',
  ton: '#0098ea',
};

/**
 * Real-balance asset rows, shared by the dashboard and the asset list.
 * A row appears only for a chain whose balance capability is verified
 * (availableFor('balance')). No price feed exists in this lane, so rows
 * show the native token balance only — never a fiat value or a fabricated
 * number. A failed fetch shows "unavailable", never zero.
 */
export function AssetRows({ hideZero, onShowAll }: { hideZero: boolean; onShowAll?: () => void }) {
  const { balances, refreshBalances, vaultState, vaultAddresses, addresses } =
    useWallet();
  const chains = availableFor('balance');

  if (chains.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No balance adapters verified yet.</p>;
  }

  const visible = chains.filter((chain) => {
    if (!hideZero) return true;
    const balance = balances[chain];
    return balance.status !== 'zero';
  });

  if (visible.length === 0) {
    if (hideZero) {
      return (
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">No non-zero balances</p>
          <Button type="button" variant="outline" onClick={() => onShowAll?.()}>
            Show all
          </Button>
        </div>
      );
    }

    return (
      <p className="p-4 text-sm text-muted-foreground">
        All balances are zero — turn off “Hide zero balances” to see them.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map((chain) => {
        const config = chainConfig(chain);
        const balance = balances[chain];
        const avatar = <ChainLogo chain={chain} />;

        if (balance.status === 'loading') {
          return (
            <li key={chain} role="status" className="py-3">
              <Skeleton className="h-[68px] w-full" />
              <span className="sr-only">Loading {config.displayName} balance…</span>
            </li>
          );
        }

        if (balance.status === 'unavailable' || balance.status === 'error') {
          const hasAddress =
            (vaultAddresses?.[chain]?.length ?? 0) > 0 ||
            (addresses?.[chain]?.length ?? 0) > 0;
          const lockedNoAddress =
            vaultState === 'locked' &&
            !hasAddress &&
            balance.status === 'unavailable';
          return (
            <li key={chain} className="flex items-center gap-3 px-4 py-3">
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-foreground">
                  {config.displayName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {lockedNoAddress
                    ? 'Unlock your wallet to see balances'
                    : balance.status === 'unavailable'
                      ? 'Balance unavailable'
                      : 'Could not load balance'}
                </span>
              </span>
              {!lockedNoAddress && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshBalances()}
                >
                  Retry
                </Button>
              )}
            </li>
          );
        }

        const value =
          balance.value === undefined
            ? '0'
            : formatNativeWithSymbol(
                balance.value,
                CHAIN_DECIMALS[chain],
                config.symbol,
              );
        return (
          <li key={chain}>
            <Link
              to={`/assets/${chain}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
            >
              <AssetRow
                avatar={avatar}
                symbol={config.symbol}
                amount={balance.status === 'zero' ? 'Zero balance' : value}
                detail={`${config.displayName} mainnet`}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

CHANGE ONLY THIS:
1. Add the prices imports above. Change the component signature to `export function AssetRows({ hideZero, onShowAll, prices, pricesNowMs }: { hideZero: boolean; onShowAll?: () => void; prices?: PriceMap; pricesNowMs?: number })`. Both new props are optional: when the caller passes no prices (the asset-list screen), rows behave exactly as today.
2. Update the file's top comment: rows show a fiat value only when the caller passes a fresh price; otherwise they show the native balance only and an honest price state, never a fabricated number.
3. In the final (available/zero) row branch only, compute the fiat display when prices are passed: `const nowMs = pricesNowMs ?? Date.now(); const entry: PriceEntry | undefined = prices?.[chain];` then, only when entry is defined, `const fiat = fiatValueForBalance(chain, balance, entry, nowMs);` and map it to AssetRow props as follows (amount stays exactly as today: 'Zero balance' for a zero balance, otherwise the native formatted value):
   - fiat kind 'fiat' with entry.status === 'fresh': pass `value={fiat.text}` and `detail={`${quoteFreshnessLabel(entry.quote, nowMs)} · CoinGecko`}`.
   - fiat kind 'zero': pass no `value` prop and `detail={`${config.displayName} mainnet`}` (a zero balance is exactly $0.00 with any price, so no fiat line is shown at all).
   - fiat kind 'expired': pass no `value` prop and `detail="Price expired"`.
   - fiat kind 'unavailable': pass no `value` prop and `detail="Price unavailable"`.
   - fiat kind 'error': pass no `value` prop and `detail="Price error"`.
   - fiat kind 'balance-unavailable': pass no `value` prop and `detail={`${config.displayName} mainnet`}`.
   - When no prices were passed (entry undefined): pass no `value` prop and `detail={`${config.displayName} mainnet`}` (exactly today's rendering).
   Never pass a fiat `value` unless the entry is fresh. Never render '$0.00' for a nonzero balance. Never render a price without its freshness label and the CoinGecko source.
4. Do not touch the loading branch, the unavailable/error branch, the empty states, the logo code, or the hide-zero logic. Do not add fetching, polling, intervals, or a refresh button here (the dashboard hero owns price refresh). Do not import anything else new.

CONSTRAINTS: TypeScript strict, no `any`, no new dependencies, no AVOID-list names anywhere, no fake prices, no localStorage, no broadcast/send code.
