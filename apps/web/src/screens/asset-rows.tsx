import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import type { BalanceState } from '../state/wallet-context';
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
 * Per-unit price cell: a fresh per-unit price, a price-feed state label,
 * or nothing (while the first price fetch is still in flight, idle
 * entries read as unavailable, so no price state is shown rather than a
 * premature failure).
 */
type PriceCell =
  | { kind: 'fresh'; text: string }
  | { kind: 'state'; text: 'Price expired' | 'Price unavailable' | 'Price error' }
  | { kind: 'missing' };

function priceCell(displayUnit: UnitPrice): PriceCell {
  if (displayUnit.kind === 'fresh') return { kind: 'fresh', text: displayUnit.text };
  if (displayUnit.kind === 'expired') return { kind: 'state', text: 'Price expired' };
  if (displayUnit.kind === 'unavailable') return { kind: 'state', text: 'Price unavailable' };
  if (displayUnit.kind === 'error') return { kind: 'state', text: 'Price error' };
  return { kind: 'missing' };
}

/**
 * One chain's row, computed once and rendered by either variant (list
 * rows or the wide table). The computation is the same either way, so a
 * balance or price state can never disagree between the two layouts.
 * Only the failed row is ever marked — a failure never blanks the rest
 * of the list (layout findings §4, Lane B).
 */
type AssetRowModel =
  | { kind: 'loading'; chain: ChainId; displayName: string }
  | {
      kind: 'unavailable';
      chain: ChainId;
      displayName: string;
      symbol: string;
      statusText: string;
      price: PriceCell;
      showRetry: boolean;
    }
  | {
      kind: 'ready';
      chain: ChainId;
      displayName: string;
      symbol: string;
      balanceStatus: 'zero' | 'available';
      amount: string;
      valueText: string | undefined;
      detail: string;
      price: PriceCell;
    };

function getRowModel(
  chain: ChainId,
  wallet: ReturnType<typeof useWallet>,
  prices: PriceMap | undefined,
  nowMs: number,
  pricesLoading: boolean | undefined,
): AssetRowModel {
  const { balances, vaultState, vaultAddresses, addresses } = wallet;
  const config = chainConfig(chain);
  const balance: BalanceState = balances[chain];
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
    return { kind: 'loading', chain, displayName: config.displayName };
  }

  if (balance.status === 'unavailable' || balance.status === 'error') {
    const hasAddress =
      (vaultAddresses?.[chain]?.length ?? 0) > 0 ||
      (addresses?.[chain]?.length ?? 0) > 0;
    const lockedNoAddress =
      vaultState === 'locked' &&
      !hasAddress &&
      balance.status === 'unavailable';
    return {
      kind: 'unavailable',
      chain,
      displayName: config.displayName,
      symbol: config.symbol,
      statusText: lockedNoAddress
        ? 'Unlock your wallet to see balances'
        : balance.status === 'unavailable'
          ? 'Balance unavailable'
          : 'Could not load balance',
      price: priceCell(displayUnit),
      showRetry: !lockedNoAddress,
    };
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

  return {
    kind: 'ready',
    chain,
    displayName: config.displayName,
    symbol: config.symbol,
    balanceStatus: balance.status,
    amount: balance.status === 'zero' ? 'Zero balance' : value,
    valueText: fiatText,
    detail,
    price: priceCell(displayUnit),
  };
}

function ListRow({ model, onRetry }: { model: AssetRowModel; onRetry: () => void }) {
  if (model.kind === 'loading') {
    return (
      <li role="status" className="py-3">
        <Skeleton className="h-[68px] w-full" />
        <span className="sr-only">{`Loading ${model.displayName} balance…`}</span>
      </li>
    );
  }

  if (model.kind === 'unavailable') {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <ChainLogo chain={model.chain} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-foreground">
            {model.displayName}
          </span>
          {' '}
          <span className="block text-xs text-muted-foreground">{model.statusText}</span>
        </span>
        {model.price.kind === 'fresh' ? (
          <span className="text-right">
            <span className="block text-[15px] font-bold text-foreground">
              {model.price.text}
            </span>
            <span className="block text-xs text-muted-foreground">
              {`per ${model.symbol}`}
            </span>
          </span>
        ) : model.price.kind === 'state' ? (
          <span className="shrink-0 text-xs text-muted-foreground">{model.price.text}</span>
        ) : null}
        {model.showRetry && (
          <Button type="button" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={`/assets/${model.chain}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <AssetRow
          avatar={<ChainLogo chain={model.chain} />}
          symbol={model.symbol}
          amount={model.amount}
          {...(model.valueText === undefined ? {} : { value: model.valueText })}
          detail={model.detail}
        />
      </Link>
    </li>
  );
}

// Wide-table row grid (MetaMask's list→table switch): two columns on a
// narrow container — asset | value, then balance | price underneath —
// and four aligned columns (Asset | Balance | Price | Value) once the
// container is wide. The switch keys off the container, not the
// viewport, so the same screen gets the table when its column is wide
// (e.g. a collapsed sidebar) and the list when it is narrow.
const TABLE_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3 @md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] @md:items-center';

function TablePriceCell({ price, symbol }: { price: PriceCell; symbol: string }) {
  // No alignment here: the parent cell aligns the price (right in the
  // wide table, right in the narrow right-hand column, left under the
  // name on a failed row).
  if (price.kind === 'fresh') {
    return (
      <span>
        <span className="block text-[15px] font-bold text-foreground">{price.text}</span>
        <span className="block text-xs text-muted-foreground">{`per ${symbol}`}</span>
      </span>
    );
  }
  if (price.kind === 'state') {
    return <span className="text-xs text-muted-foreground">{price.text}</span>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function TableRow({ model, onRetry }: { model: AssetRowModel; onRetry: () => void }) {
  if (model.kind === 'loading') {
    return (
      <li role="status" className="py-3">
        <Skeleton className="h-[68px] w-full" />
        <span className="sr-only">{`Loading ${model.displayName} balance…`}</span>
      </li>
    );
  }

  if (model.kind === 'unavailable') {
    return (
      <li>
        <div className={TABLE_GRID}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
            <ChainLogo chain={model.chain} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-foreground">
                {model.displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {model.statusText}
              </span>
            </span>
          </span>
          <span className="hidden text-sm text-muted-foreground @md:col-start-auto @md:row-start-auto @md:block">
            —
          </span>
          <span className="col-start-1 row-start-2 @md:col-start-auto @md:row-start-auto @md:text-right">
            <TablePriceCell price={model.price} symbol={model.symbol} />
          </span>
          {model.showRetry && (
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="col-start-2 row-start-1 justify-self-end @md:col-start-auto @md:row-start-auto"
            >
              Retry
            </Button>
          )}
        </div>
      </li>
    );
  }

  // No fiat value exists for a zero balance, so the Value column shows
  // "—" there — the per-unit price already has its own Price column.
  const valueText = model.balanceStatus === 'zero' ? undefined : model.valueText;

  return (
    <li>
      <Link
        to={`/assets/${model.chain}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <div className={TABLE_GRID}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
            <ChainLogo chain={model.chain} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-foreground">
                {model.displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {model.symbol}
              </span>
            </span>
          </span>
          <span className="col-start-1 row-start-2 truncate text-sm text-muted-foreground @md:col-start-auto @md:row-start-auto @md:text-right @md:text-[15px] @md:font-semibold @md:text-foreground">
            {model.amount}
          </span>
          <span className="col-start-2 row-start-2 text-right @md:col-start-auto @md:row-start-auto">
            <TablePriceCell price={model.price} symbol={model.symbol} />
          </span>
          <span className="col-start-2 row-start-1 text-right @md:col-start-auto @md:row-start-auto">
            {valueText === undefined ? (
              <span className="text-[15px] font-semibold text-muted-foreground">—</span>
            ) : (
              <>
                <span className="block text-[15px] font-bold text-foreground">
                  {valueText}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {model.detail}
                </span>
              </>
            )}
          </span>
        </div>
      </Link>
    </li>
  );
}

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
 *
 * Variants: 'list' (default) is the compact row the dashboard uses.
 * 'table' is the asset list's wide layout (MetaMask's
 * `variant={isWideLayout ? 'table' : 'list'}`): a four-column
 * Asset | Balance | Price | Value table that collapses back to the
 * list shape on a narrow container, via container queries.
 */
export function AssetRows({ hideZero, onShowAll, prices, pricesNowMs, pricesLoading, variant }: { hideZero: boolean; onShowAll?: () => void; prices?: PriceMap; pricesNowMs?: number; pricesLoading?: boolean; variant?: 'list' | 'table' }) {
  const wallet = useWallet();
  const { balances, refreshBalances } = wallet;
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

  const onRetry = () => {
    void refreshBalances();
  };
  const nowMs = pricesNowMs ?? Date.now();

  if (variant === 'table') {
    return (
      <div className="@container">
        <div
          aria-hidden="true"
          className="hidden gap-x-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground @md:grid @md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]"
        >
          <span>Asset</span>
          <span className="text-right">Balance</span>
          <span className="text-right">Price</span>
          <span className="text-right">Value</span>
        </div>
        <ul className="divide-y divide-border">
          {visible.map((chain) => (
            <TableRow
              key={chain}
              model={getRowModel(chain, wallet, prices, nowMs, pricesLoading)}
              onRetry={onRetry}
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map((chain) => (
        <ListRow
          key={chain}
          model={getRowModel(chain, wallet, prices, nowMs, pricesLoading)}
          onRetry={onRetry}
        />
      ))}
    </ul>
  );
}
