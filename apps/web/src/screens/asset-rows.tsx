import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import type { BalanceState } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { fiatValueForBalance, quoteFreshnessLabel, unitPriceForChain } from '../wallet/prices';
import type { PriceEntry, PriceMap, UnitPrice } from '../wallet/prices';
import {
  DEFAULT_TOKENS,
  isDefaultToken,
  isVerifiedToken,
  shortContract,
  tokenKeyOf,
  tokenSlug,
  type TokenRecord,
} from '../wallet/tokens';
import {
  fiatValueForTokenBalance,
  type TokenPriceMap,
} from '../wallet/token-prices';
import { AssetRow } from '../ui/components/asset-row';
import { Button } from '../ui/components/button';
import { Skeleton } from '../ui/components/skeleton';
import type { ChainId } from '../engine/boundary';
import { TokenLogo, chainLogoFor } from './token-logo';

/**
 * Native chain logo (40px default), rendered through TokenLogo so the
 * asset rows, asset detail and wallet management all share one logo
 * path: a real Trust Wallet logo when registered, a readable ticker
 * badge otherwise. Chain-keyed (token discovery): Arbitrum, OP Mainnet
 * and Base have their own marks — a symbol-keyed lookup would show the
 * Ethereum logo for all three. See ./token-logo for the source and
 * attribution.
 */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
  const logo = chainLogoFor(chain);
  if (logo !== undefined) {
    return (
      <img
        src={logo}
        alt={`${chainConfig(chain).displayName} logo`}
        width={size}
        height={size}
        decoding="async"
        className="size-10 shrink-0 rounded-full"
        style={size === 40 ? undefined : { width: size, height: size }}
      />
    );
  }
  return <TokenLogo symbol={chainConfig(chain).symbol} size={size} />;
}

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
 * One asset's row — a native chain or a token — computed once and
 * rendered by either variant (list rows or the wide table). The
 * computation is the same either way, so a balance or price state can
 * never disagree between the two layouts. Only the failed row is ever
 * marked — a failure never blanks the rest of the list (layout
 * findings §4, Lane B).
 */
type AssetRowModel =
  | {
      kind: 'loading';
      key: string;
      title: string;
      subtitle: string;
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
    }
  | {
      kind: 'unavailable';
      key: string;
      title: string;
      subtitle: string;
      symbol: string;
      statusText: string;
      price: PriceCell;
      showRetry: boolean;
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      /** Token gaps, item 2: official token — show the VERIFIED tick. */
      verified?: boolean;
    }
  | {
      kind: 'ready';
      key: string;
      title: string;
      subtitle: string;
      symbol: string;
      balanceStatus: 'zero' | 'available';
      amount: string;
      valueText: string | undefined;
      detail: string;
      price: PriceCell;
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      /** Token gaps, item 2: official token — show the VERIFIED tick. */
      verified?: boolean;
    };

function RowLogo({ model }: { model: AssetRowModel }) {
  if (model.logoChain !== null) return <ChainLogo chain={model.logoChain} />;
  return <TokenLogo symbol={model.logoSymbol} />;
}

function getNativeRowModel(
  chain: ChainId,
  wallet: ReturnType<typeof useWallet>,
  prices: PriceMap | undefined,
  nowMs: number,
  pricesLoading: boolean | undefined,
  isLocked: boolean,
): AssetRowModel {
  const { balances } = wallet;
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
  const link = `/assets/${chain}`;

  if (balance.status === 'loading') {
    return {
      kind: 'loading',
      key: chain,
      title: config.displayName,
      subtitle: config.symbol,
      link,
      isToken: false,
      logoChain: chain,
      logoSymbol: config.symbol,
    };
  }

  if (balance.status === 'unavailable' || balance.status === 'error') {
    return {
      kind: 'unavailable',
      key: chain,
      title: config.displayName,
      subtitle: config.symbol,
      symbol: config.symbol,
      statusText:
        balance.status === 'unavailable'
          ? 'Balance unavailable'
          : 'Could not load balance',
      price: priceCell(displayUnit),
      // No Retry while locked: a refetch needs a derived address and
      // there is none in state while locked (refreshBalances resolves
      // to no-address), so Retry could only fail again. AssetRows
      // shows one Unlock prompt for the list instead.
      showRetry: !isLocked,
      link,
      isToken: false,
      logoChain: chain,
      logoSymbol: config.symbol,
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
          // Item 12: a funded row shows the current per-unit price as
          // well as its fiat value — the same "per X" line the
          // zero-balance rows already show.
          detail =
            displayUnit.kind === 'fresh'
              ? `${displayUnit.text} per ${config.symbol} · ${quoteFreshnessLabel(entry.quote, nowMs)} · ${entry.quote.source}`
              : `${quoteFreshnessLabel(entry.quote, nowMs)} · ${entry.quote.source}`;
        }
        break;
      case 'zero':
      case 'balance-unavailable':
        // No fiat value exists for a zero or unknown balance, so
        // the row shows the per-unit price instead — the feed's
        // state stays visible instead of a silent empty.
        if (displayUnit.kind === 'fresh' && entry.status === 'fresh') {
          fiatText = displayUnit.text;
          detail = `per ${config.symbol} · ${quoteFreshnessLabel(entry.quote, nowMs)} · ${entry.quote.source}`;
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
    key: chain,
    title: config.displayName,
    subtitle: config.symbol,
    symbol: config.symbol,
    balanceStatus: balance.status,
    amount: balance.status === 'zero' ? 'Zero balance' : value,
    valueText: fiatText,
    detail,
    price: priceCell(displayUnit),
    link,
    isToken: false,
    logoChain: chain,
    logoSymbol: config.symbol,
  };
}

function getTokenRowModel(
  token: TokenRecord,
  wallet: ReturnType<typeof useWallet>,
  tokenPrices: TokenPriceMap | undefined,
  nowMs: number,
  tokenPricesLoading: boolean | undefined,
  isLocked: boolean,
): AssetRowModel {
  const key = tokenKeyOf(token);
  const chainName = chainConfig(token.chain).displayName;
  const link = `/assets/${token.chain}/${tokenSlug(token)}`;
  // Token gaps, item 2: the short contract sits just below the token
  // (subtitle), and official tokens carry the VERIFIED tick.
  const subtitle = `${chainName} · ${shortContract(token.contract)}`;
  const verified = isVerifiedToken(token);
  // Before the first token refresh lands, the entry is missing: show
  // the loading skeleton, not a premature failure (same rule as
  // natives — see getNativeRowModel).
  const balance: BalanceState = wallet.tokenBalances?.[key] ?? { status: 'loading' };
  const entry: PriceEntry | undefined = tokenPrices?.[key];
  const unit = unitPriceForChain(entry, nowMs);
  const displayUnit: UnitPrice =
    tokenPricesLoading === true && unit.kind === 'unavailable'
      ? { kind: 'missing' }
      : unit;

  if (balance.status === 'loading') {
    return {
      kind: 'loading',
      key,
      title: token.symbol,
      subtitle,
      link,
      isToken: true,
      logoChain: null,
      logoSymbol: token.symbol,
    };
  }

  if (balance.status === 'unavailable' || balance.status === 'error') {
    return {
      kind: 'unavailable',
      key,
      title: token.symbol,
      subtitle,
      symbol: token.symbol,
      statusText:
        balance.status === 'unavailable'
          ? 'Balance unavailable'
          : 'Could not load balance',
      price: priceCell(displayUnit),
      showRetry: !isLocked,
      link,
      isToken: true,
      logoChain: null,
      logoSymbol: token.symbol,
      verified,
    };
  }

  const value =
    balance.value === undefined
      ? '0'
      : formatNativeWithSymbol(balance.value, token.decimals, token.symbol);
  let fiatText: string | undefined;
  let detail = `${chainName} · ${isDefaultToken(token) ? 'Default token' : 'Added token'}`;

  if (entry !== undefined) {
    const fiat = fiatValueForTokenBalance(balance, token.decimals, entry, nowMs);
    switch (fiat.kind) {
      case 'fiat':
        if (entry.status === 'fresh') {
          fiatText = fiat.text;
          // Item 12: see the native-row note above.
          detail =
            displayUnit.kind === 'fresh'
              ? `${displayUnit.text} per ${token.symbol} · ${quoteFreshnessLabel(entry.quote, nowMs)} · ${entry.quote.source}`
              : `${quoteFreshnessLabel(entry.quote, nowMs)} · ${entry.quote.source}`;
        }
        break;
      case 'zero':
      case 'balance-unavailable':
        if (displayUnit.kind === 'fresh' && entry.status === 'fresh') {
          fiatText = displayUnit.text;
          detail = `per ${token.symbol} · ${quoteFreshnessLabel(entry.quote, nowMs)} · ${entry.quote.source}`;
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
    key,
    title: token.symbol,
    subtitle,
    symbol: token.symbol,
    balanceStatus: balance.status,
    amount: balance.status === 'zero' ? 'Zero balance' : value,
    valueText: fiatText,
    detail,
    price: priceCell(displayUnit),
    link,
    isToken: true,
    logoChain: null,
    logoSymbol: token.symbol,
    verified,
  };
}

function ListRow({ model, onRetry }: { model: AssetRowModel; onRetry: () => void }) {
  if (model.kind === 'loading') {
    return (
      <li role="status" className="py-3">
        <Skeleton className="h-[68px] w-full" />
        <span className="sr-only">{`Loading ${model.title} balance…`}</span>
      </li>
    );
  }

  if (model.kind === 'unavailable') {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <RowLogo model={model} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-foreground">
            {model.title}
            {model.verified === true && (
              <span className="ml-2 text-sm font-normal" aria-label="Verified token">✓ Verified</span>
            )}
          </span>
          {' '}
          <span className="block text-xs text-muted-foreground">{model.subtitle}</span>
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
        to={model.link}
        className="block"
      >
        <AssetRow
          avatar={<RowLogo model={model} />}
          symbol={model.title}
          amount={model.amount}
          {...(model.valueText === undefined ? {} : { value: model.valueText })}
          detail={model.detail}
          {...(model.verified === true ? { verified: true } : {})}
          subline={model.isToken ? model.subtitle : undefined}
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
        <span className="sr-only">{`Loading ${model.title} balance…`}</span>
      </li>
    );
  }

  if (model.kind === 'unavailable') {
    return (
      <li>
        <div className={TABLE_GRID}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
            <RowLogo model={model} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-foreground">
                {model.title}
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
        to={model.link}
        className="block"
      >
        <div className={TABLE_GRID}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
            <RowLogo model={model} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-foreground">
                {model.title}
                {model.verified === true && (
                  <span className="ml-2 text-sm font-normal" aria-label="Verified token">✓ Verified</span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {model.subtitle}
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

export interface AssetRowsProps {
  hideZero: boolean;
  onShowAll?: () => void;
  prices?: PriceMap;
  pricesNowMs?: number;
  pricesLoading?: boolean;
  /** Token prices, keyed by tokenKey — from useTokenPrices. */
  tokenPrices?: TokenPriceMap;
  tokenPricesNowMs?: number;
  tokenPricesLoading?: boolean;
  variant?: 'list' | 'table';
}

/**
 * Real-balance asset rows, shared by the dashboard and the asset list.
 * A row appears for every enabled chain whose balance capability is
 * verified (availableFor('balance')), plus one row per enabled token
 * (the 7 defaults, then user-added tokens). A non-zero balance shows
 * its fiat value when the caller passes a fresh price. Every row also
 * shows the per-unit price ("$61,706.00", labelled "per BTC") whenever
 * a fresh price is available — including zero balances and unavailable
 * balances — so a working feed is visible and a failed one says so
 * ("Price unavailable" / "Price error" / "Price expired"), never a
 * silent empty and never a fabricated number. While the first fetch is
 * still in flight, idle entries read as unavailable, so no price state
 * is shown rather than a premature failure. While the vault is locked,
 * a failed row shows no Retry — a refetch cannot succeed without a
 * derived address — and the list shows one Unlock prompt instead.
 *
 * Token balances refresh when these rows mount (and when the vault
 * addresses change): the wallet context refreshes them on demand, not
 * at boot, so unit tests that derive real vault addresses never fire
 * live RPC calls from the provider.
 *
 * Variants: 'list' (default) is the compact row the dashboard uses.
 * 'table' is the asset list's wide layout (MetaMask's
 * `variant={isWideLayout ? 'table' : 'list'}`): a four-column
 * Asset | Balance | Price | Value table that collapses back to the
 * list shape on a narrow container, via container queries.
 */
export function AssetRows({
  hideZero,
  onShowAll,
  prices,
  pricesNowMs,
  pricesLoading,
  tokenPrices,
  tokenPricesNowMs,
  tokenPricesLoading,
  variant,
}: AssetRowsProps) {
  const wallet = useWallet();
  const { refreshBalances } = wallet;
  // Defensive defaults: the existing screen tests mock useWallet with
  // only { balances, refreshBalances, vaultState } — token fields are
  // absent there, and the rows must still render the natives.
  const customTokens = wallet.customTokens ?? [];
  const enabledChains = wallet.enabledChains;
  const refreshTokenBalances = wallet.refreshTokenBalances;

  const chains = availableFor('balance').filter(
    (chain) => enabledChains === undefined || enabledChains.includes(chain),
  );
  // A token row appears only for a chain whose balance capability is
  // verified (the same rule as the native rows) — when no chain can
  // provide balances, the list shows the empty state, not loading
  // token rows with no chain behind them.
  const tokens = [...DEFAULT_TOKENS, ...customTokens].filter(
    (token) =>
      chains.includes(token.chain)
      && (enabledChains === undefined || enabledChains.includes(token.chain)),
  );

  // Token balances load with the rows (see the doc comment above).
  // The addresses key re-runs the refresh after unlock / account switch.
  const addressesKey = useMemo(() => {
    const addresses = wallet.vaultAddresses ?? {};
    return Object.values(addresses)
      .map((list) => list[0] ?? '')
      .join('|');
  }, [wallet.vaultAddresses]);
  useEffect(() => {
    if (refreshTokenBalances === undefined) return;
    void refreshTokenBalances();
  }, [refreshTokenBalances, addressesKey]);

  if (chains.length === 0 && tokens.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Balances aren't available yet.</p>;
  }

  const isZeroBalance = (model: AssetRowModel): boolean =>
    model.kind === 'ready' && model.balanceStatus === 'zero';

  const nowMs = pricesNowMs ?? Date.now();
  const tokenNowMs = tokenPricesNowMs ?? nowMs;
  const isLocked = wallet.vaultState === 'locked';

  const models: AssetRowModel[] = [
    ...chains.map((chain) =>
      getNativeRowModel(chain, wallet, prices, nowMs, pricesLoading, isLocked),
    ),
    ...tokens.map((token) =>
      getTokenRowModel(token, wallet, tokenPrices, tokenNowMs, tokenPricesLoading, isLocked),
    ),
  ];
  const visible = hideZero ? models.filter((model) => !isZeroBalance(model)) : models;

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

  const onRetryFor = (model: AssetRowModel) => {
    if (model.isToken) {
      void refreshTokenBalances?.();
    } else {
      void refreshBalances();
    }
  };

  // While the vault is locked there is no derived address in state, so
  // a balance refetch can only fail again with no-address (see
  // refreshBalances in state/wallet-context). The per-row Retry is
  // suppressed while locked (showRetry in getRowModel) and this one
  // Unlock prompt replaces it for the whole list, using the same copy
  // as the dashboard hero's locked message. It shows only when a row
  // actually failed — a locked vault with nothing to retry gets no
  // prompt. 'no-vault' keeps its Retry: a watch-only xpub address can
  // still load, so a refetch there may succeed.
  const hasFailedRow = visible.some(
    (model) => model.kind === 'unavailable',
  );
  const lockedNotice =
    isLocked && hasFailedRow ? (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">Locked — unlock to see balances.</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/lock">Unlock</Link>
        </Button>
      </div>
    ) : null;

  if (variant === 'table') {
    return (
      <>
        {lockedNotice}
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
          {visible.map((model) => (
            <TableRow
              key={model.key}
              model={model}
              onRetry={() => onRetryFor(model)}
            />
          ))}
        </ul>
        </div>
      </>
    );
  }

  return (
    <>
      {lockedNotice}
      <ul className="divide-y divide-border">
        {visible.map((model) => (
          <ListRow
            key={model.key}
            model={model}
            onRetry={() => onRetryFor(model)}
          />
        ))}
      </ul>
    </>
  );
}
