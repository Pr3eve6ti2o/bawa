```tsx
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/format';
import { fiatValueForBalance, quoteFreshnessLabel } from '../wallet/prices';
import type { PriceEntry, PriceMap } from '../wallet/prices';
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
 * (availableFor('balance')). Rows show a fiat value only when the caller
 * passes a fresh price; otherwise they show the native balance only and
 * an honest price state, never a fabricated number. A failed fetch shows
 * "unavailable", never zero.
 */
export function AssetRows({ hideZero, onShowAll, prices, pricesNowMs }: { hideZero: boolean; onShowAll?: () => void; prices?: PriceMap; pricesNowMs?: number }) {
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
        const nowMs = pricesNowMs ?? Date.now();
        const entry: PriceEntry | undefined = prices?.[chain];
        let fiatText: string | undefined;
        let detail = `${config.displayName} mainnet`;

        if (entry !== undefined) {
          const fiat = fiatValueForBalance(chain, balance, entry, nowMs);
          switch (fiat.kind) {
            case 'fiat':
              if (entry.status === 'fresh') {
                fiatText = fiat.text;
                detail = `${quoteFreshnessLabel(entry.quote, nowMs)} · CoinGecko`;
              }
              break;
            case 'zero':
            case 'balance-unavailable':
              break;
            case 'expired':
              detail = 'Price expired';
              break;
            case 'unavailable':
              detail = 'Price unavailable';
              break;
            case 'error':
              detail = 'Price error';
              break;
          }
        }

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
                {...(fiatText === undefined ? {} : { value: fiatText })}
                detail={detail}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```