import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useWallet } from '../state/wallet-context';
import type { BalanceState } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { fiatValueForBalance, quoteFreshnessLabel, unitPriceForChain } from '../wallet/prices';
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
import { Button } from '../ui/components/button';
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
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      logoIconUrl?: string | null;
      logoAllowSymbol?: boolean;
      /** Token gaps, item 2: official token — show the VERIFIED tick. */
      verified?: boolean;
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
      link: string;
      isToken: boolean;
      logoChain: ChainId | null;
      logoSymbol: string;
      logoIconUrl?: string | null;
      logoAllowSymbol?: boolean;
      /** Token gaps, item 2: official token — show the VERIFIED tick. */
      verified?: boolean;
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
 * balance). The DETAIL is always the per-unit price line ("$61,706.00
 * per BTC") when the feed is fresh, or the price state label ("Price
 * expired" / "Price unavailable" / "Price error") when it is not.
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
  symbol: string,
  devnet: boolean,
  isGenuineZero: boolean,
): { fiatText: string | undefined; detail: string } {
  const effectiveFiat =
    devnet && fiat.kind === 'fiat' ? { kind: 'zero' as const } : fiat;
  // The per-unit price line, or the price state when the feed is not fresh.
  const priceLine =
    displayUnit.kind === 'fresh'
      ? `${displayUnit.text} per ${symbol}`
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

/** Shared loading row for the list and the wide table: same skeleton. */
function RowLoadingStatus({ title }: { title: string }) {
  return (
    <li role="status" className="py-3">
      <Skeleton className="h-[68px] w-full" />
      <span className="sr-only">{`Loading ${title} balance…`}</span>
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
): AssetRowModel {
  const { balances } = wallet;
  const config = chainConfig(chain);
  // Lane G: no wallet for this chain — a balance that can never be
  // fetched renders as zero, never as "Balance unavailable" + Retry.
  const rawBalance: BalanceState = balances[chain];
  const balance: BalanceState = noWalletForChain(wallet, chain)
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
  const link = `/assets/${chain}`;

  if (balance.status === 'loading') {
    return {
      kind: 'loading',
      key: chain,
      title: config.displayName,
      subtitle: config.symbol,
      // Lane 4 (UX-major, data): a row still loading is searchable
      // too — the chain id is in the search text from the start.
      searchText: `${config.displayName} ${config.symbol} ${chain}`,
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
      // Lane 4 (UX-major, data): search matches the chain id too —
      // typing "btc" finds Bitcoin even though the id is not shown.
      searchText: `${config.displayName} ${config.symbol} ${chain}`,
      symbol: config.symbol,
      statusText:
        balance.status === 'unavailable'
          ? 'Balance unavailable'
          : 'Could not load balance',
      price: priceCell(displayUnit),
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
    ({ fiatText, detail } = fiatDetail(
      detail,
      fiat,
      displayUnit,
      config.symbol,
      devnet,
      balance.status === 'zero',
    ));
  }

  return {
    kind: 'ready',
    key: chain,
    title: config.displayName,
    subtitle: config.symbol,
    searchText: `${config.displayName} ${config.symbol} ${chain}`,
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
  devnet = false,
): AssetRowModel {
  const key = tokenKeyOf(token);
  const chainName = chainConfig(token.chain).displayName;
  const link = `/assets/${token.chain}/${tokenSlug(token)}`;
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
  const rawBalance: BalanceState = wallet.tokenBalances?.[key] ?? { status: 'loading' };
  const balance: BalanceState = noWalletForChain(wallet, token.chain)
    ? noWalletBalance(rawBalance)
    : rawBalance;
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
    };
  }

  if (balance.status === 'unavailable' || balance.status === 'error') {
    return {
      kind: 'unavailable',
      key,
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
      link,
      isToken: true,
      logoChain: null,
      logoSymbol: token.symbol,
      logoIconUrl: token.iconUrl ?? null,
      logoAllowSymbol: isDefaultToken(token),
      verified,
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
      token.symbol,
      devnet,
      balance.status === 'zero',
    ));
  }

  return {
    kind: 'ready',
    key,
    title: token.name,
    subtitle,
    searchText: `${token.name} ${token.symbol} ${chainName} ${token.chain} ${token.contract}`,
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
    logoIconUrl: token.iconUrl ?? null,
    logoAllowSymbol: isDefaultToken(token),
    verified,
  };
}

function ListRow({ model }: { model: AssetRowModel }) {
  if (model.kind === 'loading') {
    return <RowLoadingStatus title={model.title} />;
  }

  if (model.kind === 'unavailable') {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <RowLogo model={model} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-foreground">
            {model.title}
            {/* Lane 4: the tick never splits from its label — "✓" on
                one line and "Verified" on the next was the cramped
                mobile row the owner saw. Lane 1: the verified mark
                on a failed row too — a token that cannot load still
                shows whether it is verified. */}
            {model.verified === true ? (
              <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Verified token">✓ Verified</span>
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
          {...(model.isToken ? { verified: model.verified === true } : {})}
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

function TableRow({ model }: { model: AssetRowModel }) {
  if (model.kind === 'loading') {
    return <RowLoadingStatus title={model.title} />;
  }

  if (model.kind === 'unavailable') {
    return (
      <li>
        <div className={TABLE_GRID}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 @md:col-start-auto @md:row-start-auto">
            <RowLogo model={model} />
            <span className="min-w-0">
              {/* Lane 4: the name wraps instead of truncating — the
                  narrow table used to ellipsise chain names ("Ethere…")
                  and hide the rest of the name. */}
              <span className="block text-[15px] font-bold text-foreground">
                {model.title}
                {/* Lane 1: the wide table's failed row had no mark at
                    all — the list variant already showed it. Merge: the
                    tick never splits from its label, as on the other
                    rows. */}
                {model.verified === true ? (
                  <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Verified token">✓ Verified</span>
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
            <TablePriceCell price={model.price} symbol={model.symbol} />
          </span>
        </div>
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
              {/* Lane 4: the name wraps instead of truncating — the
                  narrow table used to ellipsise chain names ("Ethere…")
                  and hide the rest of the name. */}
              <span className="block text-[15px] font-bold text-foreground">
                {model.title}
                {/* Lane 4: the tick never splits from its label (see
                    the list row above). Lane 1: an unverified token
                    reads "Unverified" instead of silence. */}
                {model.verified === true ? (
                  <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Verified token">✓ Verified</span>
                ) : model.verified === false ? (
                  <span className="ml-2 whitespace-nowrap text-sm font-normal" aria-label="Unverified token">Unverified</span>
                ) : null}
              </span>
              <span className="block text-xs text-muted-foreground">
                {model.subtitle}
              </span>
            </span>
          </span>
          <span className="col-start-1 row-start-2 truncate text-sm text-muted-foreground @md:col-start-auto @md:row-start-auto @md:text-right @md:text-[15px] @md:font-semibold @md:text-foreground">
            {model.balanceStatus === 'zero' ? (
              <>
                <span className="block">{`0 ${model.symbol}`}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Zero balance
                </span>
              </>
            ) : (
              model.amount
            )}
          </span>
          <span className="col-start-2 row-start-2 text-right @md:col-start-auto @md:row-start-auto">
            <TablePriceCell price={model.price} symbol={model.symbol} />
          </span>
          <span className="col-start-2 row-start-1 min-w-0 text-right @md:col-start-auto @md:row-start-auto">
            {valueText === undefined ? (
              <span className="text-[15px] font-semibold text-muted-foreground">—</span>
            ) : (
              <span className="text-[15px] font-bold text-foreground">
                {valueText}
              </span>
            )}
          </span>
        </div>
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
): string | null {
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
  return `${quoteFreshnessLabel(newest.quote, nowMs)} · ${sources.join(', ')}`;
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
  /**
   * Lane 2: client-side search text from the asset list's filter bar
   * (matches name, symbol or chain, case-insensitive). Undefined on
   * the dashboard, which has no search — the rows are unfiltered.
   */
  query?: string;
  /** Lane 2: clears the search from the no-match empty state. */
  onClearQuery?: () => void;
}

/**
 * Real-balance asset rows, shared by the dashboard and the asset list.
 * A row appears for every enabled chain whose balance capability is
 * verified (availableFor('balance')), plus one row per enabled token
 * (the 7 defaults, then user-added tokens). Lane 2: one meaning per
 * column — the value is always the holding's fiat value ($0.00 for a
 * zero balance, the computed fiat value for a funded row), and the
 * per-unit price ("$61,706.00", labelled "per BTC") sits beside it:
 * under the value in the list variant, in its own Price column in the
 * table variant. A zero row never headlines the per-unit price. The
 * price freshness + source ("Updated just now · CoinGecko") is stated
 * once above the list, not repeated on 43 rows; a failed feed still
 * says so per row ("Price unavailable" / "Price error" / "Price
 * expired"), never a silent empty and never a fabricated number.
 * While the first fetch is still in flight, idle entries read as
 * unavailable, so no price state is shown rather than a premature
 * failure. A failed row never shows a per-row Retry (Lane J, MetaMask
 * pattern): the fetch layer already retries silently with backoff and
 * keeps the last good value, so a row button could only fail again —
 * the Dogecoin row proved it. The retry path is the single list-level
 * Refresh on the hosting screen. The row
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

  if (chains.length === 0 && tokens.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Balances aren't available yet.</p>;
  }

  const isZeroBalance = (model: AssetRowModel): boolean =>
    model.kind === 'ready' && model.balanceStatus === 'zero';

  const nowMs = pricesNowMs ?? Date.now();
  const tokenNowMs = tokenPricesNowMs ?? nowMs;
  const isLocked = wallet.vaultState === 'locked';
  const devnet = wallet.devnetEnabled === true;

  const models: AssetRowModel[] = [
    ...chains.map((chain) =>
      getNativeRowModel(chain, wallet, prices, nowMs, pricesLoading, devnet),
    ),
    ...tokens.map((token) =>
      getTokenRowModel(token, wallet, tokenPrices, tokenNowMs, tokenPricesLoading, devnet),
    ),
  ];
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

  if (visible.length === 0) {
    if (normalizedQuery !== '') {
      return (
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">
            {`No assets match “${query?.trim()}” — try Add token to search by name or contract address.`}
          </p>
          <Button type="button" variant="outline" onClick={() => onClearQuery?.()}>
            Show all assets
          </Button>
        </div>
      );
    }
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
        {searchCount}
        {provenance !== null ? (
          <p className="px-4 pt-3 pb-1 text-right text-xs text-muted-foreground">
            {provenance}
          </p>
        ) : null}
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
            <TableRow key={model.key} model={model} />
          ))}
        </ul>
        </div>
      </>
    );
  }

  return (
    <>
      {lockedNotice}
      {searchCount}
      {provenance !== null ? (
        <p className="px-4 pt-3 pb-1 text-right text-xs text-muted-foreground">
          {provenance}
        </p>
      ) : null}
      <ul className="divide-y divide-border">
        {visible.map((model) => (
          <ListRow key={model.key} model={model} />
        ))}
      </ul>
    </>
  );
}
