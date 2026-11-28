import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ensureAdapters, useWallet } from '../state/wallet-context';
import type { BalanceState } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { shortenAddress } from '../wallet/address-detection';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { formatFiatUSD } from '../wallet/money';
import { fiatValueForBalance, formatChangePct, isFreshQuote, quoteFreshnessLabel, unitPriceForChain } from '../wallet/prices';
import type {
  FiatValueResult,
  PriceEntry,
  PriceMap,
  UnitPrice,
} from '../wallet/prices';
import {
  DEFAULT_TOKENS,
  isDefaultToken,
  isVerifiedToken,
  shortContract,
  tokenKeyOf,
  tokenSlug,
  verificationSourceOf,
  verifiedSourceLabel,
  type TokenRecord,
} from '../wallet/tokens';
import {
  fiatValueForTokenBalance,
  type TokenPriceMap,
} from '../wallet/token-prices';
import { AssetRow } from '../ui/components/asset-row';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import { BawaIcon } from '../ui/components/icons';
import { Skeleton } from '../ui/components/skeleton';
import type { ChainId } from '../engine/boundary';
import { ChainLogo, TokenLogo } from './token-logo';

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
 * P0-A (24h on the row): the 24 h movement from the entry's quote, when
 * the feed sent one. Fresh by the app's own 10-minute rule → plain;
 * older than that — an expired quote, or a last-good quote carried over
 * a 429 by mergePreservingFreshEntries — → the same figure with a
 * "stale" marker, never dropped and never a fabricated 0.00%. A
 * fallback quote carries no change, and an error with no previous quote
 * has none either; both omit the movement. P3-B (style B): the change
 * is coloured by direction — green up, red down, muted flat — on top
 * of the +/- sign, never instead of it (colour is never the only
 * signal). The 4-colour cap used to forbid this; DECISIONS.md §42
 * restores semantic colours.
 */
type RowChange24h = { text: string; stale: boolean; direction: 'up' | 'down' | 'flat' };

function change24hForEntry(
  entry: PriceEntry | undefined,
  nowMs: number,
): RowChange24h | undefined {
  if (entry?.status !== 'fresh' && entry?.status !== 'expired') return undefined;
  const pct = entry.quote.change24hPct;
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return undefined;
  return {
    text: `24h ${formatChangePct(pct)}`,
    stale: !isFreshQuote(entry.quote, nowMs),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  };
}

/** The change's colour class: green up, red down, muted flat. */
function change24hClass(change: RowChange24h): string | undefined {
  return change.direction === 'up'
    ? 'text-success'
    : change.direction === 'down'
      ? 'text-error'
      : undefined;
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
      /** Lane 4 (UX-major, data): the full search text — name,
          symbol, chain id and (for tokens) the whole contract
          address — so search matches more than the two lines shown. */
      searchText?: string;
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      /** Lane A: the token's resolved icon URL (null = no icon). */
      logoIconUrl?: string | null;
      /** Lane A: may the bundled symbol logo be shown (defaults only). */
      logoAllowSymbol?: boolean;
      /**
       * (3) Watch-only row: this row is a watched address's balance,
       * not the HD wallet's. It is labelled Watch-only and never
       * rendered as a link, so it can never offer Send.
       */
      watchOnly?: boolean;
    }
  | {
      kind: 'unavailable';
      key: string;
      title: string;
      subtitle: string;
      /** Lane 4 (UX-major, data): full search text (see above). */
      searchText?: string;
      symbol: string;
      statusText: string;
      price: PriceCell;
      /** P0-A: the 24 h movement for the price cell, when the feed sent one. */
      change24h?: RowChange24h;
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      logoIconUrl?: string | null;
      logoAllowSymbol?: boolean;
      /** Token gaps, item 2: official token — show the VERIFIED tick. */
      verified?: boolean;
      /** (3) Watch-only row (see the loading variant). */
      watchOnly?: boolean;
    }
  | {
      kind: 'ready';
      key: string;
      title: string;
      subtitle: string;
      /** Lane 4 (UX-major, data): full search text (see above). */
      searchText?: string;
      symbol: string;
      balanceStatus: 'zero' | 'available';
      amount: string;
      valueText: string | undefined;
      detail: string;
      price: PriceCell;
      /** P0-A: the 24 h movement for the price cell, when the feed sent one. */
      change24h?: RowChange24h;
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      logoIconUrl?: string | null;
      logoAllowSymbol?: boolean;
      /** Token gaps, item 2: official token — show the VERIFIED tick. */
      verified?: boolean;
      /** (3) Watch-only row (see the loading variant). */
      watchOnly?: boolean;
    };

function RowLogo({ model }: { model: AssetRowModel }) {
  if (model.logoChain !== null) return <ChainLogo chain={model.logoChain} />;
  return (
    <TokenLogo
      symbol={model.logoSymbol}
      iconUrl={model.logoIconUrl ?? null}
      allowSymbolLogo={model.logoAllowSymbol ?? true}
    />
  );
}

/**
 * Lane G: "no wallet for this chain" — the vault does not exist and no
 * watch-only address was imported for the chain, so no balance fetch
 * can ever run. The check is per chain, not per screen: a watch-only
 * xpub for one chain still loads real balances for that chain, while
 * the other chains show zero. The vaultState test matters — a locked
 * vault also has no addresses in state (locking clears them), and a
 * locked vault must keep its unavailable state and Unlock prompt, never
 * a zero that would hide real funds.
 */
function hasAddressForChain(
  wallet: ReturnType<typeof useWallet>,
  chain: ChainId,
): boolean {
  const vaultList = wallet.vaultAddresses?.[chain] ?? [];
  const watchList = wallet.addresses?.[chain] ?? [];
  return vaultList.length > 0 || watchList.length > 0;
}

function noWalletForChain(
  wallet: ReturnType<typeof useWallet>,
  chain: ChainId,
): boolean {
  return wallet.vaultState === 'no-vault' && !hasAddressForChain(wallet, chain);
}

/**
 * Lane G: the balance a no-wallet row renders. A balance that can never
 * be fetched — still loading before the first refresh, or unavailable
 * with no-address after it — is zero: a wallet that does not exist
 * holds nothing, and a Retry for it could only fail again (the owner
 * saw 43 of them on /assets). A devnet token with no contract is zero
 * the same way: test mode has no token contracts by construction. Any
 * other failure (a real fetch that failed, a disabled chain) keeps its
 * unavailable state and its Retry — retrying those may succeed.
 */
function noWalletBalance(balance: BalanceState): BalanceState {
  if (balance.status === 'loading') return { status: 'zero', value: '0' };
  if (
    (balance.status === 'unavailable' || balance.status === 'error') &&
    (balance.reason === 'no-address' || balance.reason === 'devnet-no-tokens')
  ) {
    return { status: 'zero', value: '0' };
  }
  return balance;
}

/**
 * Shared fiat/detail computation for the native and token row models.
 * Lane 2 (redesign): one meaning per column, everywhere. The VALUE is
 * always the holding's fiat value — "$0.00" for a genuine zero balance
 * (0 x any price is $0.00, even with a stale feed), the computed fiat
 * value for a funded row, nothing when the value is genuinely unknown
 * (failed balance, stale price on a funded row, valueless devnet
 * balance). The DETAIL is always the bare per-unit price ("$61,706.00",
 * Lane D #49: no "per <symbol>" label) when the feed is fresh, or
 * the price state label ("Price expired" / "Price unavailable" /
 * "Price error") when it is not.
 * The old shape put the per-unit price in the value slot for zero rows
 * (so a zero BTC row headlined $59,090.00 on the dashboard while the
 * asset table headlined $0.00 for the same row) and repeated the
 * freshness + source ("per BTC · Updated just now · CoinGecko") on
 * every row; that provenance now lives once above the list (see
 * priceProvenanceLine), not on 43 rows.
 * Devnet stays the exception it was: a funded test balance is
 * valueless, so its value slot shows the live per-unit price instead
 * (isGenuineZero false + devnet-forced zero), exactly as before.
 */
function fiatDetail(
  initialDetail: string,
  fiat: FiatValueResult,
  displayUnit: UnitPrice,
  devnet: boolean,
  isGenuineZero: boolean,
): { fiatText: string | undefined; detail: string } {
  const effectiveFiat =
    devnet && fiat.kind === 'fiat' ? { kind: 'zero' as const } : fiat;
  // The per-unit price line, or the price state when the feed is not fresh.
  const priceLine =
    displayUnit.kind === 'fresh'
      ? displayUnit.text
      : displayUnit.kind === 'expired'
        ? 'Price expired'
        : displayUnit.kind === 'unavailable'
          ? 'Price unavailable'
          : displayUnit.kind === 'error'
            ? 'Price error'
            : initialDetail;
  switch (effectiveFiat.kind) {
    case 'fiat':
      return { fiatText: effectiveFiat.text, detail: priceLine };
    case 'zero':
      // A genuine zero balance is worth $0.00 whatever the feed says;
      // a devnet-funded balance forced into this branch keeps the old
      // shape — the live per-unit price in the value slot.
      if (isGenuineZero) {
        return { fiatText: '$0.00', detail: priceLine };
      }
      return {
        fiatText:
          displayUnit.kind === 'fresh' ? displayUnit.text : undefined,
        detail: priceLine,
      };
    case 'balance-unavailable':
      return { fiatText: undefined, detail: priceLine };
    case 'expired':
      return { fiatText: undefined, detail: 'Price expired' };
    case 'unavailable':
      return { fiatText: undefined, detail: 'Price unavailable' };
    case 'error':
      return { fiatText: undefined, detail: 'Price error' };
  }
}

/**
 * Shared loading row for the list and the wide table: same skeleton.
 * Lane 2 (dashboard row count): a row still loading is still a row —
 * with a link it navigates to its asset detail like a settled row, so
 * the linked-row count is the full list from the first paint, not only
 * after the slowest fetch lands. Watch-only rows pass no link (see
 * ListRow / TableRow): a watched address can never send, so its rows
 * are never links, in any state.
 */
function RowLoadingStatus({ title, link }: { title: string; link?: string }) {
  const inner = (
    <>
      <Skeleton className="h-[68px] w-full" />
      <span className="sr-only">{`Loading ${title} balance…`}</span>
    </>
  );
  return (
    <li role="status" className="py-3">
      {link === undefined ? (
        inner
      ) : (
        <Link to={link} className="block">
          {inner}
        </Link>
      )}
    </li>
  );
}

function getNativeRowModel(
  chain: ChainId,
  wallet: ReturnType<typeof useWallet>,
  prices: PriceMap | undefined,
  nowMs: number,
  pricesLoading: boolean | undefined,
  devnet = false,
  // (3) A watched address's own row: its balance is fetched directly
  // (see the watch section in AssetRows) because refreshBalances is
  // vault-shadowed — balances[chain] is the HD wallet's while a vault
  // exists. The watch row keeps the same price + 24 h change as the
  // HD row, is labelled Watch-only, and is never linked (see ListRow
  // / TableRow), so it can never offer Send.
  watch?: { address: string; balance: BalanceState },
): AssetRowModel {
  const { balances } = wallet;
  const config = chainConfig(chain);
  // Lane G: no wallet for this chain — a balance that can never be
  // fetched renders as zero, never as "Balance unavailable" + Retry.
  // (5a) A chain missing from the balances map entirely renders as
  // loading, never throws: one missing entry must not take the whole
  // list down through the app error boundary.
  const rawBalance: BalanceState =
    watch !== undefined
      ? watch.balance
      : (balances[chain] ?? { status: 'loading' });
  const balance: BalanceState =
    watch !== undefined
      ? rawBalance
      : noWalletForChain(wallet, chain)
        ? noWalletBalance(rawBalance)
        : rawBalance;
  const entry: PriceEntry | undefined = prices?.[chain];
  const unit = unitPriceForChain(entry, nowMs);
  // While the first fetch is still in flight, idle entries read as
  // 'unavailable' — show nothing rather than a premature failure.
  // A refetch keeps the last settled entries, so those still show.
  const displayUnit: UnitPrice =
    pricesLoading === true && unit.kind === 'unavailable'
      ? { kind: 'missing' }
      : unit;
  // A watch row is never a link: it points at /wallets (the section
  // header links there), and ListRow / TableRow never wrap it in one.
  const link = watch !== undefined ? '/wallets' : `/assets/${chain}`;
  // P0-A: the 24 h movement for this row, computed once — the ready
  // detail line and the price cells share it.
  const change24h = change24hForEntry(entry, nowMs);
  // (3) The watch label carries the watched address, so a row never
  // reads as the HD wallet's. The subtitle is the row's own line for
  // tokens and for watch rows (see ListRow's subline rule).
  const subtitle =
    watch !== undefined
      ? `Watch-only · ${shortenAddress(watch.address)}`
      : config.symbol;
  const searchText =
    watch !== undefined
      ? `${config.displayName} ${config.symbol} ${chain} watch-only ${watch.address}`
      : `${config.displayName} ${config.symbol} ${chain}`;

  if (balance.status === 'loading') {
    return {
      kind: 'loading',
      key: watch !== undefined ? `watch:${chain}` : chain,
      title: config.displayName,
      subtitle,
      // Lane 4 (UX-major, data): a row still loading is searchable
      // too — the chain id is in the search text from the start.
      searchText,
      link,
      isToken: false,
      logoChain: chain,
      logoSymbol: config.symbol,
      ...(watch !== undefined ? { watchOnly: true as const } : {}),
    };
  }

  if (balance.status === 'unavailable' || balance.status === 'error') {
    return {
      kind: 'unavailable',
      key: watch !== undefined ? `watch:${chain}` : chain,
      title: config.displayName,
      subtitle,
      // Lane 4 (UX-major, data): search matches the chain id too —
      // typing "btc" finds Bitcoin even though the id is not shown.
      searchText,
      symbol: config.symbol,
      statusText:
        balance.status === 'unavailable'
          ? 'Balance unavailable'
          : 'Could not load balance',
      price: priceCell(displayUnit),
      ...(change24h === undefined ? {} : { change24h }),
      link,
      isToken: false,
      logoChain: chain,
      logoSymbol: config.symbol,
      ...(watch !== undefined ? { watchOnly: true as const } : {}),
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
    ({ fiatText, detail } = fiatDetail(
      detail,
      fiat,
      displayUnit,
      devnet,
      balance.status === 'zero',
    ));
    // P0-A + P3-B: the 24 h movement rides on the detail line's own
    // coloured span (AssetRow's change24h prop) — no extra row
    // height, and the colour comes from the direction, not the
    // string. It is NOT appended to `detail` any more: a coloured
    // span cannot live inside a plain string.
  }

  return {
    kind: 'ready',
    key: watch !== undefined ? `watch:${chain}` : chain,
    title: config.displayName,
    subtitle,
    searchText,
    symbol: config.symbol,
    balanceStatus: balance.status,
    // P0-A (double-zero): the amount is always the figure — "0 BTC"
    // for a zero balance, never the words "Zero balance". The words
    // survive only as the subline (ListRow), as in the table variant.
    amount: value,
    valueText: fiatText,
    detail,
    price: priceCell(displayUnit),
    ...(change24h === undefined ? {} : { change24h }),
    link,
    isToken: false,
    logoChain: chain,
    logoSymbol: config.symbol,
    ...(watch !== undefined ? { watchOnly: true as const } : {}),
  };
}

function getTokenRowModel(
  token: TokenRecord,
  wallet: ReturnType<typeof useWallet>,
  tokenPrices: TokenPriceMap | undefined,
  nowMs: number,
  tokenPricesLoading: boolean | undefined,
  devnet = false,
  // Watch-only display programme: a watched address's own token row
  // — the ~$354k of watched WETH/USDC/USDT that was invisible in
  // State A (audit F3). Same shape as the native watch row: labelled
  // Watch-only, never linked, same price + 24 h change as the HD row.
  // The subtitle keeps the contract (the copycat check); the badge
  // carries the watch label (see ListRow's subline rule).
  watch?: { address: string; balance: BalanceState },
): AssetRowModel {
  const key = tokenKeyOf(token);
  const chainName = chainConfig(token.chain).displayName;
  const link = watch !== undefined ? '/wallets' : `/assets/${token.chain}/${tokenSlug(token)}`;
  // Token gaps, item 2: official tokens carry the VERIFIED tick.
  // Lane 2 (redesign): the short contract STAYS in the subtitle
  // ("USDC · Ethereum · 0xA0b8…eB48") — the verified-tick and Lane 4
  // tests pin it on the row, and it is the copycat check next to the
  // tick. The row-height win comes from dropping the per-row
  // provenance subline instead (see priceProvenanceLine): a token row
  // is now title + subtitle + value, not four lines.
  const subtitle = `${token.symbol} · ${chainName} · ${shortContract(token.contract)}`;
  const verified = isVerifiedToken(token);
  // Before the first token refresh lands, the entry is missing: show
  // the loading skeleton, not a premature failure (same rule as
  // natives — see getNativeRowModel). Lane G: no wallet for this
  // chain — a balance that can never be fetched renders as zero.
  const rawBalance: BalanceState =
    watch !== undefined
      ? watch.balance
      : (wallet.tokenBalances?.[key] ?? { status: 'loading' });
  const balance: BalanceState =
    watch !== undefined
      ? rawBalance
      : noWalletForChain(wallet, token.chain)
        ? noWalletBalance(rawBalance)
        : rawBalance;
  const entry: PriceEntry | undefined = tokenPrices?.[key];
  const unit = unitPriceForChain(entry, nowMs);
  const displayUnit: UnitPrice =
    tokenPricesLoading === true && unit.kind === 'unavailable'
      ? { kind: 'missing' }
      : unit;
  // P0-A: the 24 h movement for this row, computed once (see the
  // native model above).
  const change24h = change24hForEntry(entry, nowMs);

  if (balance.status === 'loading') {
    return {
      kind: 'loading',
      key: watch !== undefined ? `watch:${key}` : key,
      // Lane 4: the row title is the full token name ("USD Coin"),
      // not just the symbol — the owner reported the complete token
      // name was not displayed on the mobile homepage.
      title: token.name,
      subtitle,
      // Lane 4 (UX-major, data): a token still loading is searchable
      // by its whole contract address too, not only once loaded.
      searchText: `${token.name} ${token.symbol} ${chainName} ${token.chain} ${token.contract}`,
      link,
      isToken: true,
      logoChain: null,
      logoSymbol: token.symbol,
      logoIconUrl: token.iconUrl ?? null,
      logoAllowSymbol: isDefaultToken(token),
      ...(watch !== undefined ? { watchOnly: true as const } : {}),
    };
  }

  if (balance.status === 'unavailable' || balance.status === 'error') {
    return {
      kind: 'unavailable',
      key: watch !== undefined ? `watch:${key}` : key,
      title: token.name,
      subtitle,
      // Lane 4 (UX-major, data): search matches the whole contract
      // address, not just the shortened form in the subtitle — a
      // pasted contract finds its token.
      searchText: `${token.name} ${token.symbol} ${chainName} ${token.chain} ${token.contract}`,
      symbol: token.symbol,
      statusText:
        balance.status === 'unavailable'
          ? 'Balance unavailable'
          : 'Could not load balance',
      price: priceCell(displayUnit),
      ...(change24h === undefined ? {} : { change24h }),
      link,
      isToken: true,
      logoChain: null,
      logoSymbol: token.symbol,
      logoIconUrl: token.iconUrl ?? null,
      logoAllowSymbol: isDefaultToken(token),
      verified,
      ...(watch !== undefined ? { watchOnly: true as const } : {}),
    };
  }

  const value =
    balance.value === undefined
      ? '0'
      : formatNativeWithSymbol(balance.value, token.decimals, token.symbol);
  let fiatText: string | undefined;
  // Lane A: the row detail names who verified the token, so a
  // Verified tick is never a mystery ("Verified (CoinGecko)").
  const verifiedSource = verificationSourceOf(token);
  let detail = `${chainName} · ${isDefaultToken(token) ? 'Default token' : 'Added token'}${
    verifiedSource !== null ? ` · Verified (${verifiedSourceLabel(verifiedSource)})` : ''
  }`;

  if (entry !== undefined) {
    const fiat = fiatValueForTokenBalance(balance, token.decimals, entry, nowMs);
    ({ fiatText, detail } = fiatDetail(
      detail,
      fiat,
      displayUnit,
      devnet,
      balance.status === 'zero',
    ));
    // P0-A + P3-B: the 24 h movement rides on the detail line's own
    // coloured span (AssetRow's change24h prop) — see the native
    // model above. Not appended to `detail`.
  }

  return {
    kind: 'ready',
    key: watch !== undefined ? `watch:${key}` : key,
    title: token.name,
    subtitle,
    searchText: `${token.name} ${token.symbol} ${chainName} ${token.chain} ${token.contract}`,
    symbol: token.symbol,
    balanceStatus: balance.status,
    // P0-A (double-zero): the amount is always the figure — "0 USDC"
    // for a zero balance, never the words "Zero balance" (see the
    // native model above).
    amount: value,
    valueText: fiatText,
    detail,
    price: priceCell(displayUnit),
    ...(change24h === undefined ? {} : { change24h }),
    link,
    isToken: true,
    logoChain: null,
    logoSymbol: token.symbol,
    logoIconUrl: token.iconUrl ?? null,
    logoAllowSymbol: isDefaultToken(token),
    verified,
    ...(watch !== undefined ? { watchOnly: true as const } : {}),
  };
}

function ListRow({ model }: { model: AssetRowModel }) {
  if (model.kind === 'loading') {
    return (
      <RowLoadingStatus
        title={model.title}
        {...(model.watchOnly === true ? {} : { link: model.link })}
      />
    );
  }

  if (model.kind === 'unavailable') {
    // Lane 2 (dashboard row count): a failed row is still a row — it
    // links to its asset detail like a settled row (the detail page
    // shows the same honest failure, never a fabricated balance), so
    // the linked-row count stays the full list even when a balance
    // fetch 429s. A watch-only row is never a link (see below).
    const inner = (
      <div className="flex items-center gap-3 px-4 py-3">
        <RowLogo model={model} />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-foreground">
            {model.title}
            {/* (3) A watch-only row is labelled on every state — a
                failed watched balance must still read as watched. */}
            {model.watchOnly === true ? (
              <Badge size="sm" className="ml-2 whitespace-nowrap" aria-label="Watch-only">Watch-only</Badge>
            ) : null}
            {/* Lane 4: the tick never splits from its label — "✓" on
                one line and "Verified" on the next was the cramped
                mobile row the owner saw. Lane 1: the verified mark
                on a failed row too — a token that cannot load still
                shows whether it is verified. */}
            {model.verified === true ? (
              <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">Verified</Badge>
            ) : model.verified === false ? (
              <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Unverified token">Unverified</span>
            ) : null}
          </span>
          {' '}
          <span className="block text-xs text-muted-foreground">{model.subtitle}</span>
          {' '}
          <span className="block text-xs text-muted-foreground">{model.statusText}</span>
        </span>
        {model.price.kind === 'fresh' ? (
          <span className="text-right">
            <span className="block text-base font-bold text-foreground">
              {model.price.text}
            </span>
            {/* P0-A: no "per <symbol>" label here — the price stands
                alone, with the 24 h movement under it when the feed
                sent one (same shape as the table price cell). */}
            {model.change24h !== undefined ? (
              <span className={`block text-xs ${change24hClass(model.change24h) ?? 'text-muted-foreground'}`}>
                {model.change24h.text}
                {model.change24h.stale ? ' · stale' : ''}
              </span>
            ) : null}
          </span>
        ) : model.price.kind === 'state' ? (
          <span className="shrink-0 text-xs text-muted-foreground">{model.price.text}</span>
        ) : null}
      </div>
    );
    if (model.watchOnly === true) {
      return <li>{inner}</li>;
    }
    return (
      <li>
        <Link
          to={model.link}
          className="block"
        >
          {inner}
        </Link>
      </li>
    );
  }

  // (3) A watch-only row is never a link: the asset detail page
  // offers Send, and a watched address can never send. The row
  // renders the same AssetRow, unlinked, with its watch label as
  // the subline.
  const inner = (
    <AssetRow
      avatar={<RowLogo model={model} />}
      symbol={model.title}
      amount={model.amount}
      {...(model.valueText === undefined ? {} : { value: model.valueText })}
      detail={model.detail}
      {...(model.change24h === undefined ? {} : { change24h: model.change24h })}
      {...(model.isToken ? { verified: model.verified === true } : {})}
      // Lane X (Lane D #49): no "Zero balance" subline — the
      // amount ("0 BTC") + $0.00 already say it. A token row
      // keeps its contract subtitle here (the copycat check), so
      // its zero state reads from the "0 USDC" amount + $0.00.
      // A watch row keeps its watch label here for the same reason:
      // the label must survive on the row itself, not only in the
      // section header above it.
      subline={model.isToken || model.watchOnly === true ? model.subtitle : undefined}
    />
  );
  if (model.watchOnly === true) {
    return <li>{inner}</li>;
  }
  return (
    <li>
      <Link
        to={model.link}
        className="block"
      >
        {inner}
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

// Lane X (Lane D #49): the Value column is $0.00 on every row while
// no row has a real value — the grid drops to three columns then.
const TABLE_GRID_NO_VALUE =
  'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3 @md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)] @md:items-center';

function TablePriceCell({ price, change }: { price: PriceCell; change?: RowChange24h }) {
  // No alignment here: the parent cell aligns the price (right in the
  // wide table, right in the narrow right-hand column, left under the
  // name on a failed row). P0-A: no "per <symbol>" label — the column
  // header says Price (Lane D #49). The 24 h movement sits on the
  // existing subline instead, so the cell stays two lines tall.
  if (price.kind === 'fresh') {
    return (
      <span>
        <span className="block text-base font-bold text-foreground">{price.text}</span>
        {change !== undefined ? (
          <span className={`block text-xs ${change24hClass(change) ?? 'text-muted-foreground'}`}>
            {change.text}
            {change.stale ? ' · stale' : ''}
          </span>
        ) : null}
      </span>
    );
  }
  if (price.kind === 'state') {
    return <span className="text-xs text-muted-foreground">{price.text}</span>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function TableRow({ model, hideValue }: { model: AssetRowModel; hideValue?: boolean }) {
  if (model.kind === 'loading') {
    return (
      <RowLoadingStatus
        title={model.title}
        {...(model.watchOnly === true ? {} : { link: model.link })}
      />
    );
  }

  if (model.kind === 'unavailable') {
    // Lane 2 (dashboard row count): a failed row is still a row — it
    // links to its asset detail like a settled row (see ListRow).
    const inner = (
      <div className={hideValue === true ? TABLE_GRID_NO_VALUE : TABLE_GRID}>
        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
          <RowLogo model={model} />
          <span className="min-w-0">
            {/* Lane 4: the name wraps instead of truncating — the
                narrow table used to ellipsise chain names ("Ethere…")
                and hide the rest of the name. */}
            <span className="block text-base font-bold text-foreground">
              {model.title}
              {/* (3) A watch-only row is labelled on every state. */}
              {model.watchOnly === true ? (
                <Badge size="sm" className="ml-2 whitespace-nowrap" aria-label="Watch-only">Watch-only</Badge>
              ) : null}
              {/* Lane 1: the wide table's failed row had no mark at
                  all — the list variant already showed it. Merge: the
                  tick never splits from its label, as on the other
                  rows. */}
              {model.verified === true ? (
                <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">Verified</Badge>
              ) : model.verified === false ? (
                <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Unverified token">Unverified</span>
              ) : null}
            </span>
            {/* Merge: the subtitle (symbol · chain · contract) stays
                visible on a failed table row too — the ListRow already
                shows it, and without it the symbol appears nowhere on
                the row once the title is the full token name. */}
            <span className="block text-xs text-muted-foreground">
              {model.subtitle}
            </span>
            <span className="block text-xs text-muted-foreground">
              {model.statusText}
            </span>
          </span>
        </span>
        <span className="hidden text-sm text-muted-foreground @md:col-start-auto @md:row-start-auto @md:block">
          —
        </span>
        <span className="col-start-1 row-start-2 @md:col-start-auto @md:row-start-auto @md:text-right">
          <TablePriceCell price={model.price} change={model.change24h} />
        </span>
      </div>
    );
    if (model.watchOnly === true) {
      return <li>{inner}</li>;
    }
    return (
      <li>
        <Link
          to={model.link}
          className="block"
        >
          {inner}
        </Link>
      </li>
    );
  }

  // Lane 2 (redesign): the Value column is just the value. A zero
  // balance shows $0.00 (0 x any price is $0.00 — Lane G) and a funded
  // row its fiat value; an unknown balance still shows a dash, its
  // value genuinely is not known. The per-unit price lives in the
  // Price column and the freshness + source line lives once above the
  // list (priceProvenanceLine) — the old shape repeated "per BTC ·
  // Updated just now · CoinGecko" under the value as well, so the same
  // "per BTC" appeared in two columns on every row.
  const valueText = model.valueText;

  // (3) A watch-only row is never a link (see ListRow): the asset
  // detail page offers Send, and a watched address can never send.
  const inner = (
    <div className={hideValue === true ? TABLE_GRID_NO_VALUE : TABLE_GRID}>
      <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
        <RowLogo model={model} />
        <span className="min-w-0">
          {/* Lane 4: the name wraps instead of truncating — the
              narrow table used to ellipsise chain names ("Ethere…")
              and hide the rest of the name. */}
          <span className="block text-base font-bold text-foreground">
            {model.title}
            {/* (3) A watch-only row is labelled on every state. */}
            {model.watchOnly === true ? (
              <Badge size="sm" className="ml-2 whitespace-nowrap" aria-label="Watch-only">Watch-only</Badge>
            ) : null}
            {/* Lane 4: the tick never splits from its label (see
                the list row above). Lane 1: an unverified token
                reads "Unverified" instead of silence. */}
            {model.verified === true ? (
              <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">Verified</Badge>
            ) : model.verified === false ? (
              <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Unverified token">Unverified</span>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">
            {model.subtitle}
          </span>
        </span>
      </span>
      <span className="col-start-1 row-start-2 truncate text-sm text-muted-foreground @md:col-start-auto @md:row-start-auto @md:text-right @md:text-base @md:font-semibold @md:text-foreground">
        {model.balanceStatus === 'zero' ? `0 ${model.symbol}` : model.amount}
      </span>
      <span className="col-start-2 row-start-2 text-right @md:col-start-auto @md:row-start-auto">
        <TablePriceCell price={model.price} change={model.change24h} />
      </span>
      {hideValue === true ? null : (
        <span className="col-start-2 row-start-1 min-w-0 text-right @md:col-start-auto @md:row-start-auto">
          {valueText === undefined ? (
            <span className="text-base font-semibold text-muted-foreground">—</span>
          ) : (
            <span className="text-base font-bold text-foreground">
              {valueText}
            </span>
          )}
        </span>
      )}
    </div>
  );
  if (model.watchOnly === true) {
    return <li>{inner}</li>;
  }
  return (
    <li>
      <Link
        to={model.link}
        className="block"
      >
        {inner}
      </Link>
    </li>
  );
}

/**
 * Lane 2: the price provenance, stated once per list instead of once
 * per row. The freshness label comes from the freshest quote across
 * the native + token feeds; the sources are the distinct sources of
 * the fresh quotes ("Updated just now · CoinGecko, CoinLore"). Rows
 * with a stale feed still carry their own state label. No fresh quote
 * anywhere → no line (the rows say so instead).
 */
function priceProvenanceLine(
  prices: PriceMap | undefined,
  tokenPrices: TokenPriceMap | undefined,
  nowMs: number,
): { label: string; sources: string } | null {
  const fresh = [
    ...Object.values(prices ?? {}),
    ...Object.values(tokenPrices ?? {}),
  ].filter(
    (entry): entry is Extract<PriceEntry, { status: 'fresh' }> =>
      entry?.status === 'fresh',
  );
  if (fresh.length === 0) return null;
  const newest = fresh.reduce((a, b) =>
    b.quote.fetchedAtMs > a.quote.fetchedAtMs ? b : a,
  );
  const sources = [...new Set(fresh.map((entry) => entry.quote.source))];
  return { label: quoteFreshnessLabel(newest.quote, nowMs), sources: sources.join(', ') };
}

interface AssetRowsProps {
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
  /**
   * Lane 2: client-side search text from the asset list's filter bar
   * (matches name, symbol or chain, case-insensitive). Undefined on
   * the dashboard, which has no search — the rows are unfiltered.
   */
  query?: string;
  /** Lane 2: clears the search from the no-match empty state. */
  onClearQuery?: () => void;
  /**
   * Watch-only display programme: which wallet's rows to show. The
   * dashboard's hero switcher drives it — 'all' (both wallets),
   * 'vault' (the HD wallet only), or one watched wallet (its rows
   * only). Undefined is 'all': the asset list and every existing
   * caller keep showing everything.
   */
  walletFilter?: 'all' | 'vault' | { kind: 'watch'; address: string };
}

/**
 * Real-balance asset rows, shared by the dashboard and the asset list.
 * A row appears for every enabled chain whose balance capability is
 * verified (availableFor('balance')), plus one row per enabled token
 * (the 7 defaults, then user-added tokens). Lane 2: one meaning per
 * column — the value is always the holding's fiat value ($0.00 for a
 * zero balance, the computed fiat value for a funded row), and the
 * bare per-unit price ("$61,706.00") sits beside it: under the value
 * in the list variant, in its own Price column in the table variant.
 * A zero row never headlines the per-unit price. The price freshness
 * ("Updated just now") is stated once above the list, with the
 * sources behind a "Price sources" disclosure, not repeated on 43
 * rows; a failed feed still
 * says so per row ("Price unavailable" / "Price error" / "Price
 * expired"), never a silent empty and never a fabricated number.
 * While the first fetch is still in flight, idle entries read as
 * unavailable, so no price state is shown rather than a premature
 * failure. A failed row never shows a per-row Retry (Lane J, MetaMask
 * pattern): the fetch layer already retries silently with backoff and
 * keeps the last good value, so a row button could only fail again —
 * the Dogecoin row proved it. The retry path is the single list-level
 * Refresh on the hosting screen. Lane 2 (dashboard row count): every
 * main-list row IS a link to its asset detail in every state — ready,
 * failed, or still loading — so the linked-row count is the full list
 * (43 on the dashboard: 22 natives + 21 default tokens) whatever the
 * network does; a 429 that fails a balance can no longer drop the
 * count to 41–42. Only watch-only rows are never links (a watched
 * address can never send). The row
 * model itself is Ivy Wallet's feature/accounts pattern (icon + name +
 * balance + one status line, no Retry — patterns only, GPL-3.0, no code
 * copied), and a failed row is an Aceternity Empty States shape
 * (real logo, one plain line, one action — the action being the
 * list-level Refresh). While the vault is locked, a failed row shows
 * no retry affordance at all and the list shows one Unlock prompt
 * instead.
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
 *
 * Watch-only (3): below the main list, one section per watched
 * address set — the funded, failed and loading rows for chains whose
 * watched address differs from the vault's. The balances are fetched
 * directly per chain (refreshBalances is vault-shadowed), each row is
 * labelled Watch-only, and no watch row is ever a link, so it can
 * never offer Send. Zero watch balances collapse into one count
 * line; /wallets holds the full list. In the watch-only-only state
 * (no vault) this section is empty — the main rows already are the
 * watch balances there.
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
  query,
  onClearQuery,
  walletFilter = 'all',
}: AssetRowsProps) {
  const wallet = useWallet();
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

  // (3) Watch-only balances: refreshBalances is vault-shadowed —
  // while a vault exists, balances[chain] is the HD wallet's, so a
  // watched address's balances never reach the main rows (Lane E
  // §3a). The chains below are the ones with a vault address AND a
  // watched address that differs from it. The vault-address
  // requirement is the point: in the watch-only-only state (no
  // vault) the main rows already ARE the watch balances, because
  // refreshBalances reads the watched addresses when there is no
  // vault address — so the list is empty there and the section can
  // never duplicate the main list. Devnet has no watch-only mode,
  // so the section stays off there.
  const watchedChains = useMemo(() => {
    if (wallet.devnetEnabled === true) return [] as Array<{ chain: ChainId; address: string }>;
    const vault = wallet.vaultAddresses ?? {};
    const watch = wallet.addresses ?? {};
    const list: Array<{ chain: ChainId; address: string }> = [];
    for (const chain of availableFor('balance')) {
      if (enabledChains !== undefined && !enabledChains.includes(chain)) continue;
      const watchAddress = watch[chain]?.[0]?.address;
      if (typeof watchAddress !== 'string' || watchAddress === '') continue;
      const vaultAddress = vault[chain]?.[0];
      if (typeof vaultAddress !== 'string' || vaultAddress === '') continue;
      if (vaultAddress === watchAddress) continue;
      list.push({ chain, address: watchAddress });
    }
    return list;
  }, [enabledChains, wallet.addresses, wallet.devnetEnabled, wallet.vaultAddresses]);

  // Watch-only display programme: the hero switcher filters these
  // rows — 'vault' hides the watch section, one watched wallet shows
  // only its chains. In the watch-only-only state the main rows
  // already ARE the watched wallet, so a watch filter keeps them.
  const hasVault = wallet.vaultState !== 'no-vault';
  const showMain =
    walletFilter === 'all' ||
    walletFilter === 'vault' ||
    (typeof walletFilter === 'object' && !hasVault);
  const showWatch = walletFilter !== 'vault';
  const visibleWatchedChains =
    typeof walletFilter === 'object'
      ? watchedChains.filter(
          (entry) => entry.address.toLowerCase() === walletFilter.address.toLowerCase(),
        )
      : watchedChains;

  // Watch-only display programme: in the watch-only-only state the
  // main rows already ARE the watched wallet (watchedChains is empty
  // there by design — it needs a vault address to differ from), so
  // the allocation below reads the main balances instead of the
  // watch maps. Without this the watched wallet has no allocation
  // view at all in the state where it is the whole portfolio.
  const watchOnlyOnly =
    wallet.devnetEnabled !== true &&
    !hasVault &&
    Object.values(wallet.addresses ?? {}).some(
      (list) => (list?.length ?? 0) > 0,
    );

  // (3) The watched balances. The context serves them now
  // (refreshBalances reads the watched address alongside the vault's
  // — see state/wallet-context), so the direct fetch below is only
  // the fallback for older mocked contexts that do not provide
  // watchBalances. Fetch-on-mount and on watched-set / retry; a
  // failed row keeps its honest error state (5a), and the section's
  // Retry re-runs the fetch with the adapters' own backoff. The
  // adapter chunk loads lazily here, as everywhere else — no watch
  // addresses means no fetch and no chunk load.
  const [watchAttempt, setWatchAttempt] = useState(0);
  const [watchBalances, setWatchBalances] = useState<Record<string, BalanceState>>({});
  const contextWatchBalances = wallet.watchBalances;
  const effectiveWatchBalances: Record<string, BalanceState> =
    contextWatchBalances ?? watchBalances;
  useEffect(() => {
    if (contextWatchBalances !== undefined) {
      setWatchBalances({});
      return;
    }
    if (watchedChains.length === 0) {
      setWatchBalances({});
      return;
    }
    let cancelled = false;
    setWatchBalances(() => {
      const next: Record<string, BalanceState> = {};
      for (const { chain } of watchedChains) next[chain] = { status: 'loading' };
      return next;
    });
    void (async () => {
      // Older mocked contexts have no ensureAdapters (the
      // asset-list tests mock wallet-context with useWallet only):
      // without it the rows report unavailable instead of throwing.
      if (typeof ensureAdapters !== 'function') {
        if (!cancelled) {
          setWatchBalances(() => {
            const next: Record<string, BalanceState> = {};
            for (const { chain } of watchedChains) {
              next[chain] = { status: 'unavailable', reason: 'no-adapter' };
            }
            return next;
          });
        }
        return;
      }
      let adapters: Awaited<ReturnType<typeof ensureAdapters>>;
      try {
        adapters = await ensureAdapters();
      } catch {
        if (cancelled) return;
        setWatchBalances(() => {
          const next: Record<string, BalanceState> = {};
          for (const { chain } of watchedChains) {
            next[chain] = { status: 'error', reason: 'Balance adapters could not be loaded.' };
          }
          return next;
        });
        return;
      }
      const results = await Promise.all(
        watchedChains.map(async ({ chain, address }) => {
          const adapter = adapters.getAdapter(chain);
          if (adapter === undefined) {
            return { chain, state: { status: 'unavailable', reason: 'no-adapter' } as BalanceState };
          }
          let result: Awaited<ReturnType<typeof adapter.getBalance>>;
          try {
            result = await adapter.getBalance(address);
          } catch {
            return { chain, state: { status: 'error', reason: 'Could not load balance.' } as BalanceState };
          }
          if (result.status !== 'ok') {
            return { chain, state: { status: 'error', reason: result.reason } as BalanceState };
          }
          const fetchedAtMs = Date.now();
          return {
            chain,
            state: (result.data.valueBaseUnits === '0'
              ? { status: 'zero', value: '0', fetchedAtMs }
              : { status: 'available', value: result.data.valueBaseUnits, fetchedAtMs }) as BalanceState,
          };
        }),
      );
      if (cancelled) return;
      setWatchBalances(() => {
        const next: Record<string, BalanceState> = {};
        for (const { chain, state } of results) next[chain] = state;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [watchedChains, watchAttempt, contextWatchBalances]);

  if (chains.length === 0 && tokens.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Balances aren't available yet.</p>;
  }

  const isZeroBalance = (model: AssetRowModel): boolean =>
    model.kind === 'ready' && model.balanceStatus === 'zero';

  const nowMs = pricesNowMs ?? Date.now();
  const tokenNowMs = tokenPricesNowMs ?? nowMs;
  const isLocked = wallet.vaultState === 'locked';
  const devnet = wallet.devnetEnabled === true;

  // Watch-only display programme: the hero switcher hides the main
  // (vault) rows when one watched wallet is viewed — the watched
  // rows below are the list then. 'all' and 'vault' keep them.
  const models: AssetRowModel[] = showMain
    ? [
        ...chains.map((chain) =>
          getNativeRowModel(chain, wallet, prices, nowMs, pricesLoading, devnet),
        ),
        ...tokens.map((token) =>
          getTokenRowModel(token, wallet, tokenPrices, tokenNowMs, tokenPricesLoading, devnet),
        ),
      ]
    : [];
  // Lane 2: the search query (asset list only) filters the same models
  // — name, symbol or chain, case-insensitive — after the zero filter,
  // so the two compose ("hide zero" + "usd" shows funded stablecoins).
  // Lane 4 (UX-major, data): the match runs against the model's full
  // search text — chain id and the whole contract address included —
  // so a pasted contract or a chain id finds its row.
  const normalizedQuery = query?.trim().toLowerCase() ?? '';
  let visible = hideZero ? models.filter((model) => !isZeroBalance(model)) : models;
  if (normalizedQuery !== '') {
    visible = visible.filter((model) =>
      (model.searchText ?? `${model.title} ${model.subtitle}`)
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }
  // (3) The watch rows: same prices + 24 h change as the HD rows,
  // built from the context's watch balances (or the direct fetch
  // fallback). Zero watch balances collapse into one count line (an
  // EVM watch import fans out to 59 chains): the section lists
  // funded, failed and loading rows only. The same search query
  // filters both lists.
  // Watch-only display programme: the watched TOKENS ride here too —
  // the WETH/USDC/USDT the watched address holds, from the context's
  // watchTokenBalances, one row per token per watched chain. Without
  // the context (older mocked contexts) there are no watch token
  // rows, exactly as before.
  const watchModels: AssetRowModel[] = showWatch
    ? [
        ...visibleWatchedChains.map(({ chain, address }) =>
          getNativeRowModel(
            chain,
            wallet,
            prices,
            nowMs,
            pricesLoading,
            devnet,
            { address, balance: effectiveWatchBalances[chain] ?? { status: 'loading' } },
          ),
        ),
        ...(wallet.watchTokenBalances === undefined
          ? []
          : visibleWatchedChains.flatMap(({ chain, address }) =>
              tokens
                .filter((token) => token.chain === chain)
                .map((token) =>
                  getTokenRowModel(
                    token,
                    wallet,
                    tokenPrices,
                    tokenNowMs,
                    tokenPricesLoading,
                    devnet,
                    {
                      address,
                      balance:
                        (wallet.watchTokenBalances ?? {})[tokenKeyOf(token)] ??
                        { status: 'loading' },
                    },
                  ),
                ),
            )),
      ]
    : [];
  let watchFiltered = watchModels;
  if (normalizedQuery !== '') {
    watchFiltered = watchFiltered.filter((model) =>
      (model.searchText ?? `${model.title} ${model.subtitle}`)
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }
  const watchZeroCount = watchFiltered.filter(isZeroBalance).length;
  const watchVisible = watchFiltered.filter((model) => !isZeroBalance(model));
  // Watch-only display programme: the per-chain allocation (OKX +
  // Zerion's pattern) — one watched wallet's total, then each chain's
  // subtotal and share of it. Only priced holdings count; an unpriced
  // funded holding is listed in the rows below, never in the total.
  const watchAllocation = useMemo(() => {
    // State A: the watch maps, per watched chain. State B (no vault):
    // the main maps — the main rows ARE the watched wallet there.
    const allocationEntries =
      visibleWatchedChains.length > 0
        ? visibleWatchedChains
        : watchOnlyOnly
          ? availableFor('balance')
              .filter(
                (chain) =>
                  (enabledChains === undefined ||
                    enabledChains.includes(chain)) &&
                  (wallet.addresses?.[chain]?.[0]?.address ?? '') !== '',
              )
              .map((chain) => ({
                chain,
                address: wallet.addresses?.[chain]?.[0]?.address ?? '',
              }))
          : [];
    const allocationNatives =
      visibleWatchedChains.length > 0
        ? effectiveWatchBalances
        : (wallet.balances ?? {});
    const allocationTokens =
      visibleWatchedChains.length > 0
        ? wallet.watchTokenBalances
        : wallet.tokenBalances;
    if (allocationEntries.length === 0) {
      return {
        totalMinorUnits: 0,
        chains: [] as Array<{
          chain: ChainId;
          label: string;
          minorUnits: number;
          sharePct: number;
        }>,
      };
    }
    const perChain = new Map<ChainId, number>();
    const add = (chain: ChainId, minorUnits: number | null) => {
      if (minorUnits === null) return;
      perChain.set(chain, (perChain.get(chain) ?? 0) + minorUnits);
    };
    for (const { chain } of allocationEntries) {
      const balance = allocationNatives[chain];
      if (
        balance !== undefined &&
        balance.status === 'available' &&
        balance.value !== undefined &&
        balance.value !== '0'
      ) {
        const entry = prices?.[chain];
        const fiat =
          entry === undefined
            ? null
            : fiatValueForBalance(chain, balance, entry, nowMs);
        add(chain, fiat !== null && fiat.kind === 'fiat' ? fiat.minorUnits : null);
      }
      if (allocationTokens !== undefined) {
        for (const token of tokens) {
          if (token.chain !== chain) continue;
          const tokenBalance = allocationTokens[tokenKeyOf(token)];
          if (
            tokenBalance === undefined ||
            tokenBalance.status !== 'available' ||
            tokenBalance.value === undefined ||
            tokenBalance.value === '0'
          ) {
            continue;
          }
          const entry = tokenPrices?.[tokenKeyOf(token)];
          const fiat = fiatValueForTokenBalance(
            tokenBalance,
            token.decimals,
            entry,
            tokenNowMs,
          );
          add(chain, fiat.kind === 'fiat' ? fiat.minorUnits : null);
        }
      }
    }
    const list = [...perChain.entries()]
      .filter(([, minorUnits]) => minorUnits > 0)
      .map(([chain, minorUnits]) => ({
        chain,
        label: chainConfig(chain).displayName,
        minorUnits,
      }))
      .sort((a, b) => b.minorUnits - a.minorUnits);
    const totalMinorUnits = list.reduce((sum, entry) => sum + entry.minorUnits, 0);
    return {
      totalMinorUnits,
      chains: list.map((entry) => ({
        ...entry,
        sharePct:
          totalMinorUnits > 0 ? (entry.minorUnits / totalMinorUnits) * 100 : 0,
      })),
    };
  }, [
    visibleWatchedChains,
    watchOnlyOnly,
    effectiveWatchBalances,
    wallet.watchTokenBalances,
    wallet.balances,
    wallet.tokenBalances,
    wallet.addresses,
    enabledChains,
    prices,
    tokenPrices,
    tokens,
    nowMs,
    tokenNowMs,
  ]);
  // Lane X (Lane D #49): hide the Value column while every visible
  // row is worth $0.00 — the column adds nothing then.
  const allZeroValue =
    visible.length > 0 &&
    visible.every(
      (model) => model.kind === 'ready' && model.valueText === '$0.00',
    );
  const provenance = priceProvenanceLine(prices, tokenPrices, nowMs);
  // Lane 4 (UX-major, data): the match count, next to the provenance
  // line — both counts are real (visible rows of all rows), so a
  // search that finds nothing still says how big the list is.
  const searchCount =
    normalizedQuery !== '' ? (
      <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
        {`${visible.length} of ${models.length} assets match “${query?.trim()}”`}
      </p>
    ) : null;

  // (3) The watch-only section: labelled, never linked, with its own
  // retry for failed rows (5a) and a pointer at /wallets for the full
  // list. Under an active search with no watch match it stays hidden
  // — the no-match empty state owns that screen instead.
  const watchFailedCount = watchVisible.filter(
    (model) => model.kind === 'unavailable',
  ).length;
  const watchLoading = watchVisible.some((model) => model.kind === 'loading');
  const watchAllZeroValue =
    watchVisible.length > 0 &&
    watchVisible.every(
      (model) => model.kind === 'ready' && model.valueText === '$0.00',
    );
  // Watch-only display programme: the per-chain allocation — each
  // chain's share of the watched total, largest first. Shared by the
  // watch section (State A) and the standalone section below (State
  // B, where there is no watch section because the main rows ARE the
  // watched wallet).
  const allocationBlock =
    watchAllocation.chains.length > 0 ? (
      <>
        <ul className="space-y-1 px-4 pt-2" aria-label="Allocation by chain">
          {watchAllocation.chains.slice(0, 5).map((entry) => (
            <li key={entry.chain} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate text-ink">{entry.label}</span>
              <span className="h-2 min-w-0 flex-1 rounded-full bg-sun" aria-hidden="true">
                <span
                  className="block h-2 rounded-full bg-coral"
                  style={{ width: `${Math.max(2, entry.sharePct)}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right text-panel-text-muted">
                {`${entry.sharePct.toFixed(1)}%`}
              </span>
            </li>
          ))}
        </ul>
        {watchAllocation.chains.length > 5 ? (
          <p className="px-4 pt-1 text-xs text-muted-foreground">
            {`And ${watchAllocation.chains.length - 5} more chain${watchAllocation.chains.length - 5 === 1 ? '' : 's'} — see the rows below.`}
          </p>
        ) : null}
      </>
    ) : null;
  // State B only: the watched wallet's allocation has nowhere else
  // to live — the watch section above is null there, and the main
  // rows below it are the watched wallet itself.
  const watchOnlyOnlyAllocation =
    watchOnlyOnly && watchAllocation.chains.length > 0 ? (
      <section aria-label="Watch-only allocation" className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4">
          <h3 className="text-base font-semibold text-ink">Watch-only</h3>
          {watchAllocation.totalMinorUnits > 0 ? (
            <p className="text-base font-semibold text-ink">
              {formatFiatUSD(watchAllocation.totalMinorUnits)}
            </p>
          ) : null}
        </div>
        {allocationBlock}
      </section>
    ) : null;
  const watchSection =
    !showWatch ||
    visibleWatchedChains.length === 0 ||
    (normalizedQuery !== '' && watchFiltered.length === 0) ? null : (
      <section aria-label="Watch-only balances" className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4">
          <h3 className="text-base font-semibold text-ink">Watch-only</h3>
          {watchAllocation.totalMinorUnits > 0 ? (
            <p className="text-base font-semibold text-ink">
              {formatFiatUSD(watchAllocation.totalMinorUnits)}
            </p>
          ) : null}
        </div>
        <p className="px-4 pt-1 text-sm text-muted-foreground">
          Balances for addresses you watch. Watch-only wallets can’t send — manage them in{' '}
          <Link to="/wallets" className="font-semibold underline underline-offset-4">
            Wallets
          </Link>
          .
        </p>
        {allocationBlock}
        {watchFailedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-2" role="status">
            <p className="text-base text-ink">
              {watchFailedCount === 1
                ? '1 watched balance failed'
                : `${watchFailedCount} watched balances failed`}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={watchLoading}
              onClick={() => {
                // The context serves the watch balances now: retry
                // there. The direct-fetch fallback keeps its own
                // retry (older mocked contexts).
                if (contextWatchBalances !== undefined) {
                  void wallet.refreshBalances?.();
                  void wallet.refreshTokenBalances?.();
                } else {
                  setWatchAttempt((count) => count + 1);
                }
              }}
            >
              {watchLoading ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : null}
        {watchVisible.length > 0 ? (
          variant === 'table' ? (
            <div className="@container">
              <ul className="divide-y divide-border">
                {watchVisible.map((model) => (
                  <TableRow key={model.key} model={model} hideValue={watchAllZeroValue} />
                ))}
              </ul>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {watchVisible.map((model) => (
                <ListRow key={model.key} model={model} />
              ))}
            </ul>
          )
        ) : (
          <p className="px-4 pt-2 text-sm text-muted-foreground">
            No funded watched balances yet.
          </p>
        )}
        {watchZeroCount > 0 ? (
          <p className="px-4 pt-2 text-xs text-muted-foreground">
            {`${watchZeroCount} watched chain${watchZeroCount === 1 ? '' : 's'} at zero — see Wallets for the full list.`}
          </p>
        ) : null}
      </section>
    );

  // The hide-zero empty state, shared by the early return below and
  // the variant returns: when the main list is empty but funded watch
  // rows exist, the screen shows this note above the watch section
  // instead of the empty state alone.
  const hideZeroEmpty = (
    <div className="space-y-2 p-4">
      <p className="text-sm text-muted-foreground">No non-zero balances</p>
      <Button type="button" variant="secondary" onClick={() => onShowAll?.()}>
        Show all
      </Button>
    </div>
  );

  if (visible.length === 0 && watchFiltered.length === 0) {
    if (normalizedQuery !== '') {
      return (
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">
            {`No assets match “${query?.trim()}” — try Add token to search by name or contract address.`}
          </p>
          <Button type="button" variant="secondary" onClick={() => onClearQuery?.()}>
            Show all assets
          </Button>
        </div>
      );
    }
    if (hideZero) {
      return hideZeroEmpty;
    }

    return (
      <p className="p-4 text-sm text-muted-foreground">
        All zero — turn off Hide zero balances.
      </p>
    );
  }

  // While the vault is locked there is no derived address in state, so
  // a balance refetch can only fail again with no-address (see
  // refreshBalances in state/wallet-context). This one Unlock prompt
  // replaces any retry affordance for the whole list, using the same copy
  // as the dashboard hero's locked message. It shows only when a row
  // actually failed — a locked vault with nothing to retry gets no
  // prompt.
  const hasFailedRow = visible.some(
    (model) => model.kind === 'unavailable',
  );
  const lockedNotice =
    isLocked && hasFailedRow ? (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">Locked. Unlock to see balances.</p>
        <Button type="button" variant="secondary" asChild>
          <Link to="/lock">Unlock</Link>
        </Button>
      </div>
    ) : null;

  if (variant === 'table') {
    return (
      <>
        {lockedNotice}
        {/* Watch-only display programme: the watched holdings sit at
            the TOP of the list (audit F4 — they were ~5½ phone-screens
            down), with their allocation, so they are found at 0 taps. */}
        {watchOnlyOnlyAllocation}
        {watchSection}
        <div className="@container">
        {searchCount}
        {provenance !== null ? (
          <div className="px-4 pt-3 pb-1 text-right">
            <p className="text-xs text-muted-foreground">{provenance.label}</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Price sources</summary>
              <p>{provenance.sources}</p>
            </details>
          </div>
        ) : null}
        {visible.length === 0 && normalizedQuery === '' ? hideZeroEmpty : null}
        {visible.length === 0 ? null : (
          <div
            aria-hidden="true"
            className={
              allZeroValue
                ? 'hidden gap-x-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground @md:grid @md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)]'
                : 'hidden gap-x-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground @md:grid @md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]'
            }
          >
            <span>Asset</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Price</span>
            {allZeroValue ? null : <span className="text-right">Value</span>}
          </div>
        )}
        <ul className="divide-y divide-border">
          {visible.map((model) => (
            <TableRow key={model.key} model={model} hideValue={allZeroValue} />
          ))}
        </ul>
        </div>
      </>
    );
  }

  return (
    <>
      {lockedNotice}
      {/* Watch-only display programme: the watched holdings sit at
          the TOP of the list (audit F4 — they were ~5½ phone-screens
          down), with their allocation, so they are found at 0 taps. */}
      {watchOnlyOnlyAllocation}
      {watchSection}
      {searchCount}
      {provenance !== null ? (
        <div className="px-4 pt-3 pb-1 text-right">
          <p className="text-xs text-muted-foreground">{provenance.label}</p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Price sources</summary>
            <p>{provenance.sources}</p>
          </details>
        </div>
      ) : null}
      {visible.length === 0 && normalizedQuery === '' ? hideZeroEmpty : null}
      <ul className="divide-y divide-border">
        {visible.map((model) => (
          <ListRow key={model.key} model={model} />
        ))}
      </ul>
    </>
  );
}
