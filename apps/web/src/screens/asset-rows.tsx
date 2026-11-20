import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { fiatValueForBalance, quoteFreshnessLabel, unitPriceForChain } from '../wallet/prices';
import type { PriceEntry, PriceMap, UnitPrice } from '../wallet/prices';
import { AssetRow } from '../ui/components/asset-row';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import type { ChainId } from '../engine/boundary';
import { TokenLogo } from './token-logo';

/**
 * Native chain logo (40px default), rendered through TokenLogo so the
 * asset rows, asset detail and wallet management all share one logo
 * path: a real Trust Wallet logo when registered, a readable ticker
 * badge otherwise. See ./token-logo for the source and attribution.
 */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
  return <TokenLogo symbol={chainConfig(chain).symbol} size={size} />;
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
 * (availableFor('balance')). A non-zero balance shows its fiat value
 * when the caller passes a fresh price. Every row also shows the
 * per-unit price ("$61,706.00", labelled "per BTC") whenever a fresh
 * price is available — including zero balances and locked/unavailable
 * balances — so a working feed is visible and a failed one says so
 * ("Price unavailable" / "Price error" / "Price expired"), never a
 * silent empty and never a fabricated number. While the first fetch is
 * still in flight, idle entries read as unavailable, so no price state
 * is shown rather than a premature failure.
 */
export function AssetRows({ hideZero, onShowAll, prices, pricesNowMs, pricesLoading }: { hideZero: boolean; onShowAll?: () => void; prices?: PriceMap; pricesNowMs?: number; pricesLoading?: boolean }) {
  const { balances, refreshBalances, vaultState, vaultAddresses, addresses } =
    useWallet();
  const chains = availableFor('balance');

  if (chains.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Balances aren't available yet.</p>;
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
        const nowMs = pricesNowMs ?? Date.now();
        const entry: PriceEntry | undefined = prices?.[chain];
        const unit = unitPriceForChain(entry, nowMs);
        // While the first fetch is still in flight, idle entries read as
        // 'unavailable' — show nothing rather than a premature failure.
        // A refetch keeps the last settled entries, so those still show.
        const displayUnit: UnitPrice =
          pricesLoading === true && unit.kind === 'unavailable'
            ? { kind: 'missing' }
            : unit;

        if (balance.status === 'loading') {
          return (
            <li key={chain} role="status" className="py-3">
              <Skeleton className="h-[68px] w-full" />
              <span className="sr-only">{`Loading ${config.displayName} balance…`}</span>
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
                {' '}
                <span className="block text-xs text-muted-foreground">
                  {lockedNoAddress
                    ? 'Unlock your wallet to see balances'
                    : balance.status === 'unavailable'
                      ? 'Balance unavailable'
                      : 'Could not load balance'}
                </span>
              </span>
              {displayUnit.kind === 'fresh' ? (
                <span className="text-right">
                  <span className="block text-[15px] font-bold text-foreground">
                    {displayUnit.text}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {`per ${config.symbol}`}
                  </span>
                </span>
              ) : displayUnit.kind === 'expired' ? (
                <span className="shrink-0 text-xs text-muted-foreground">Price expired</span>
              ) : displayUnit.kind === 'unavailable' ? (
                <span className="shrink-0 text-xs text-muted-foreground">Price unavailable</span>
              ) : displayUnit.kind === 'error' ? (
                <span className="shrink-0 text-xs text-muted-foreground">Price error</span>
              ) : null}
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
              // No fiat value exists for a zero or unknown balance, so
              // the row shows the per-unit price instead — the feed's
              // state stays visible instead of a silent empty.
              if (displayUnit.kind === 'fresh' && entry.status === 'fresh') {
                fiatText = displayUnit.text;
                detail = `per ${config.symbol} · ${quoteFreshnessLabel(entry.quote, nowMs)} · CoinGecko`;
              } else if (displayUnit.kind === 'expired') {
                detail = 'Price expired';
              } else if (displayUnit.kind === 'unavailable') {
                detail = 'Price unavailable';
              } else if (displayUnit.kind === 'error') {
                detail = 'Price error';
              }
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
