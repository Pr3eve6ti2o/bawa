import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import type { ChainId } from '../engine/boundary';
import { chainConfig } from '../wallet/chains';
import { devnetChainConfigOrUndefined } from '../wallet/devnet-endpoints';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { TxRow } from './tx-row';
import {
  PRICE_IDS,
  fiatValueForBalance,
  formatChangePct,
  unitPriceForChain,
  usePrices,
} from '../wallet/prices';
import { fiatValueForTokenBalance, useTokenPrices } from '../wallet/token-prices';
import {
  DEFAULT_TOKENS,
  iconSourceLabel,
  isDefaultToken,
  isVerifiedToken,
  tokenKeyOf,
  tokenSlug,
  verificationSourceOf,
  verifiedSourceLabel,
  type TokenRecord,
} from '../wallet/tokens';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import { BawaIcon } from '../ui/components/icons';
import { Card, CardContent } from '../ui/components/card';
import { CopyButton } from '../ui/components/copy-button';
import { Skeleton } from '../ui/components/skeleton';
import { usePriceFeedAutoRefresh } from './use-live-prices';
import { ChainLogo, TokenLogo } from './token-logo';
import { recordLastUsedChain } from './chain-search-select';
import type { BalanceState } from '../state/wallet-context';

// Lane 4 (UX-major, data): the 7-day price chart is lazy-loaded —
// its code (and its market-chart fetch) only exists once the asset
// screen mounts, never in the main bundle.
const PriceChart = lazy(() => import('./price-chart').then((module) => ({ default: module.PriceChart })));

const DERIVATION_PATHS = {
  btc: "m/84'/0'/0'/0/i",
  eth: "m/44'/60'/0'/0/i",
  trx: "m/44'/195'/0'/0/i",
} as const;

/**
 * One derived-address list item, shared by the vault-address list and
 * the plain list below it.
 */
function DerivedAddressItems({
  addresses,
  copyAddress,
}: {
  addresses: Array<{ index: number; address: string }>;
  copyAddress: (address: string) => Promise<void>;
}) {
  return (
    <>
      {addresses.map(({ index, address }) => (
        <li
          key={`${index}:${address}`}
          className="flex flex-wrap items-center gap-3 rounded-bawa border-2 border-ink bg-paper p-3"
        >
          <span className="text-sm text-muted-foreground">{`Index ${index}`}</span>
          {' '}
          <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
          <Button
            type="button"
            variant="secondary"
            aria-label={`Copy address at index ${index}`}
            onClick={() => void copyAddress(address)}
          >
            Copy
          </Button>
        </li>
      ))}
    </>
  );
}

/**
 * Locked-state vs retry action shared by the balance and history
 * sections: a locked vault shows the unlock action, an unlocked one
 * shows Retry for the section's refresh. Lane G: with no vault and no
 * address for the chain there is no Retry to offer — the balance
 * section shows zero instead (see effectiveBalance below) and the
 * history section shows its empty state — so this never renders a
 * dead Retry in the no-wallet state. Lane C (C-5): the balance
 * section passes hideRetry when the reason is 'no-adapter' — a
 * chain with no balance adapter can never succeed on refresh, so
 * it gets no Retry (the dashboard rows show "Balance unavailable"
 * with no Retry either).
 */
function LockedOrRetry({
  lockedMessage,
  onRetry,
  hideRetry = false,
}: {
  lockedMessage: string;
  onRetry: () => void;
  // Lane C (C-5): a refresh that can never succeed gets no Retry.
  // Set for the balance section on a chain with no balance adapter
  // (reason 'no-adapter'): the balance is blocked, never faked, so
  // retrying only spins back to the same message. The locked branch
  // still offers Unlock — that is not a Retry.
  hideRetry?: boolean;
}) {
  const { vaultState } = useWallet();
  if (vaultState === 'locked') {
    return (
      <>
        <p className="text-sm text-panel-text-muted">{lockedMessage}</p>
        <Button type="button" variant="secondary" asChild>
          <Link to="/lock">Unlock</Link>
        </Button>
      </>
    );
  }
  if (hideRetry) return null;
  return (
    <Button type="button" variant="secondary" onClick={onRetry}>
      Retry
    </Button>
  );
}

export function AssetDetailScreen() {
  const { chain, token: tokenParam } = useParams<{ chain: string; token?: string }>();
  // useParams types chain as string | undefined (the optional token
  // param widens it). After the unknown-chain early return below it
  // is a valid registry chain; chainId carries that assertion once.
  const chainId = chain as ChainId;
  const {
    xpubs,
    addresses,
    vaultAddresses,
    hydrating,
    uiState,
    errors,
    balances,
    history,
    vaultState,
    refreshChain,
    refreshBalances,
    refreshHistory,
    setSelectedChain,
    customTokens,
    tokenBalances,
    refreshTokenBalances,
    devnetEnabled,
  } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');

  // The registry is the source of truth for "known chain": chainConfig
  // throws on an unknown chain (the screen tests mock it to return
  // undefined instead), so both shapes read as unknown here. This
  // replaces the old hardcoded 4-chain guard — all 13 chains have a
  // detail screen now.
  const config = (() => {
    try {
      return chainConfig(chainId);
    } catch {
      return undefined;
    }
  })();

  // Token route (/assets/:chain/:token): the slug is the lowercased
  // symbol for a default token, the lowercased contract for a
  // user-added one (see tokenSlug). An unknown slug is "Unknown token".
  const tokenRecord: TokenRecord | undefined = useMemo(() => {
    if (tokenParam === undefined || config === undefined) return undefined;
    return [...DEFAULT_TOKENS, ...(customTokens ?? [])].find(
      (candidate) => candidate.chain === chain && tokenSlug(candidate) === tokenParam,
    );
  }, [tokenParam, config, customTokens, chain]);
  const isToken = tokenRecord !== undefined;

  // Per-unit price from the same live price feed as the dashboard
  // strip and the asset list. No price is ever invented: a
  // missing/expired/failed feed reads as such in the Details block.
  const { state: pricesState, refresh: refreshPrices } = usePrices();
  usePriceFeedAutoRefresh(pricesState.status, refreshPrices);

  // Token price (token route only): the same price feed, one call
  // for the single token. Gated on the token existing — native routes
  // never fetch here.
  const tokenList = useMemo(
    () => (tokenRecord === undefined ? [] : [tokenRecord]),
    [tokenRecord],
  );
  const { state: tokenPricesState, refresh: refreshTokenPrices } = useTokenPrices(tokenList);
  useEffect(() => {
    if (tokenRecord === undefined || tokenPricesState.status !== 'idle') return;
    refreshTokenPrices();
  }, [tokenRecord, tokenPricesState.status, refreshTokenPrices]);

  // Mount / chain refresh (Lane G, Phase 3): a direct load or a move to
  // another chain re-fetches for that chain. Gated on hydration so the
  // first call has the rehydrated addresses — without an address a fetch
  // cannot run and Retry would be dead. The provider also refreshes once
  // after hydration; this covers later :chain changes. Token routes
  // also refresh the token balance.
  useEffect(() => {
    if (config === undefined) return;
    if (hydrating) return;
    void refreshChain(chainId);
    // Promise.resolve: the real refreshBalances always returns a promise,
    // but a mocked context may not — history must still run after balances.
    void Promise.resolve(refreshBalances()).finally(() => {
      void refreshHistory();
    });
    if (tokenRecord !== undefined) {
      void refreshTokenBalances();
    }
  }, [chain, config, hydrating, refreshChain, refreshBalances, refreshHistory, tokenRecord, refreshTokenBalances]);

  if (config === undefined) {
    return (
      <div>
        <h1 className="font-bold">Unknown chain</h1>
      </div>
    );
  }

  if (tokenParam !== undefined && tokenRecord === undefined) {
    return (
      <div>
        <h1 className="font-bold">Unknown token</h1>
      </div>
    );
  }

  const xpub = xpubs[chainId]?.xpub;
  const state = uiState[chainId];
  // Token routes show the token balance; native routes show the chain
  // balance. A missing token entry (before the first refresh) reads as
  // loading, never as a premature failure.
  const balance = tokenRecord !== undefined
    ? ((tokenBalances ?? {})[tokenKeyOf(tokenRecord)] ?? { status: 'loading' as const })
    : balances[chainId];
  const chainHistory = history[chainId];
  const recentTxs = [...chainHistory.txs]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 5);
  // Single source of truth for "is there a wallet for this chain" (Lane G,
  // Phase 3; Rabby's one-account-list pattern): the union of the vault's
  // derived addresses and the watch-only xpub's derived addresses. "Not
  // imported" only when BOTH are empty for the chain — the xpub record
  // alone is a watch-only detail, not the wallet-existence test.
  const vaultList = vaultAddresses?.[chainId] ?? [];
  const hasVaultAddress = vaultList.length > 0;
  const firstVaultAddress = vaultList[0];
  const hasWallet = hasVaultAddress || (addresses[chainId]?.length ?? 0) > 0;
  // Lane G: with no vault and no address for this chain, a balance
  // that can never be fetched renders as zero — the same rule as the
  // asset rows. A locked vault also has no addresses in state, so the
  // vaultState test is load-bearing: locked keeps "Balance
  // unavailable" with its Unlock prompt, never a zero that would hide
  // real funds. A watch-only address keeps the real fetch (and its
  // Retry on a genuine failure).
  const noWallet =
    vaultState === 'no-vault' && !hasWallet;
  const effectiveBalance: BalanceState =
    noWallet &&
    (balance.status === 'loading' ||
      ((balance.status === 'unavailable' || balance.status === 'error') &&
        (balance.reason === 'no-address' ||
          balance.reason === 'devnet-no-tokens')))
      ? { status: 'zero', value: '0' }
      : balance;
  const showHistoryList =
    chainHistory.status === 'loaded'
    || (chainHistory.status === 'loading' && recentTxs.length > 0);
  const displaySymbol = tokenRecord !== undefined ? tokenRecord.symbol : config.symbol;
  const displayDecimals = tokenRecord !== undefined ? tokenRecord.decimals : CHAIN_DECIMALS[chainId];
  const displayTitle = tokenRecord !== undefined ? tokenRecord.symbol : config.displayName;
  // Lane A: the header tick names who verified the token, so a
  // Verified tick is never a mystery ("Verified (CoinGecko)").
  const verifiedDetailSource =
    tokenRecord !== undefined ? verificationSourceOf(tokenRecord) : null;
  const verifiedDetailLabel =
    verifiedDetailSource !== null
      ? `Verified (${verifiedSourceLabel(verifiedDetailSource)})`
      : 'Verified';
  // Round 2, item 6: in devnet mode the network is the test network, not
  // mainnet — the label must say so, now that live prices show here too.
  const devnetConfig = devnetEnabled
    ? devnetChainConfigOrUndefined(chainId)
    : undefined;
  const networkLabel =
    devnetConfig !== undefined
      ? devnetConfig.devnetName
      : `${config.displayName} mainnet`;
  const displaySubtitle =
    tokenRecord !== undefined
      ? `${tokenRecord.name} on ${config.displayName}`
      : networkLabel;
  const unitPrice = tokenRecord !== undefined
    ? unitPriceForChain(tokenPricesState.entries[tokenKeyOf(tokenRecord)], Date.now())
    : unitPriceForChain(pricesState.entries[chainId], Date.now());
  // The row label names the quote's real source (CoinGecko for listed
  // tokens, DexScreener / TonAPI for unlisted ones — see token-prices);
  // it only renders when the quote is fresh, so the entry is fresh here.
  const priceEntryForSource =
    tokenRecord !== undefined
      ? tokenPricesState.entries[tokenKeyOf(tokenRecord)]
      : pricesState.entries[chainId];
  const priceSource =
    priceEntryForSource?.status === 'fresh' ? priceEntryForSource.quote.source : 'CoinGecko';
  // Lane 4 (UX-major, data): the 24 h movement, when the feed sent
  // one — a fallback quote carries none, and the line is omitted
  // rather than showing a fabricated 0.00%.
  const change24hPct =
    priceEntryForSource?.status === 'fresh'
      ? priceEntryForSource.quote.change24hPct
      : undefined;
  // Lane 4 (UX-major, data): the chart's CoinGecko id — the native
  // asset's PRICE_IDS id, or the token's CoinGecko id when it has one.
  // No id means no chart data, and the chart says so honestly.
  const chartCoingeckoId =
    tokenRecord !== undefined
      ? (tokenRecord.coingeckoId ?? null)
      : (PRICE_IDS[chainId] ?? null);
  const detailsBalance =
    effectiveBalance.status === 'loading'
      ? 'Loading…'
      : effectiveBalance.status === 'zero'
        ? `0 ${displaySymbol}`
        : effectiveBalance.status === 'available'
          ? formatNativeWithSymbol(
              effectiveBalance.value ?? '0',
              displayDecimals,
              displaySymbol,
            )
          : 'Balance unavailable';
  const detailsBalanceStale =
    (effectiveBalance.status === 'available' || effectiveBalance.status === 'zero') && effectiveBalance.stale === true
      ? ' (stale)'
      : '';

  // Lane 2: the hero shows what the holding is worth, from the same
  // live price feed as the rows (the same helpers, so the number can
  // never disagree with the list). Zero shows $0.00; a funded devnet
  // balance shows the per-unit price instead — test tokens are
  // valueless, as on the rows; a stale feed shows no fiat line at all,
  // and Details carries the state. The old hero showed the native
  // amount only, so the dollar value took a scroll to find.
  const heroFiatText: string | undefined = (() => {
    if (effectiveBalance.status === 'zero') return '$0.00';
    if (effectiveBalance.status !== 'available') return undefined;
    if (devnetEnabled) {
      return unitPrice.kind === 'fresh'
        ? `${unitPrice.text} per ${displaySymbol}`
        : undefined;
    }
    if (priceEntryForSource === undefined) return undefined;
    const fiat =
      tokenRecord !== undefined
        ? fiatValueForTokenBalance(
            effectiveBalance,
            tokenRecord.decimals,
            priceEntryForSource,
            Date.now(),
          )
        : fiatValueForBalance(
            chainId,
            effectiveBalance,
            priceEntryForSource,
            Date.now(),
          );
    return fiat.kind === 'fiat' ? fiat.text : undefined;
  })();

  // Lane 2: the first address for this chain — vault first, then the
  // watch-only derived address — for the Details card's Address row,
  // so copying it does not need a scroll past history. The full
  // derived-address list stays below, unchanged.
  const firstAddress =
    firstVaultAddress ?? addresses[chainId]?.[0]?.address;

  async function copyAddress(address: string) {
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus('Address copied.');
    } catch {
      setCopyStatus('Unable to copy the address. Please copy it manually.');
    }
  }

  function refreshAll() {
    void refreshChain(chainId);
    void Promise.resolve(refreshBalances()).finally(() => {
      void refreshHistory();
    });
    if (isToken) {
      void refreshTokenBalances();
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/assets"
        aria-label="Back to assets"
        className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
      >
        <BawaIcon name="arrow-left" className="size-5" aria-hidden="true" />
      </Link>

      <div className="space-y-4 rounded-bawa border-2 border-ink bg-paper p-4">
        <div className="flex items-center gap-3">
          {/* Lane G: the real chain/token mark — the hand-drawn blob
              with the ticker text inside rendered as a crossed-out
              logo. The bordered tile stays (the brand frame). */}
          <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
            {isToken && tokenRecord !== undefined ? (
              <TokenLogo
                symbol={displaySymbol}
                size={40}
                iconUrl={tokenRecord.iconUrl ?? null}
                allowSymbolLogo={isDefaultToken(tokenRecord)}
              />
            ) : (
              <ChainLogo chain={chainId} size={40} />
            )}
          </span>
          <div>
            <h1 className="font-bold text-ink">
              {displayTitle}
              {/* Lane 1: the verified mark on the token detail — the
                  token header says whether it is verified or not. */}
              {tokenRecord !== undefined &&
                (isVerifiedToken(tokenRecord) ? (
                  <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">
                    {verifiedDetailLabel}
                  </Badge>
                ) : (
                  <span className="ml-2 text-sm font-normal" aria-label="Unverified token">Unverified</span>
                ))}
            </h1>
            <p className="text-base text-ink">{displaySubtitle}</p>
          </div>
        </div>
        {effectiveBalance.status === 'loading' ? (
          // UX-major Lane 2 (DESIGN-SYSTEM §1.7): loading is a skeleton
          // shaped like the hero number, never a spinner and never
          // blank. A plain placeholder div, NOT the shared Skeleton —
          // measured first-hand (probe): Skeleton drew a ~105 px
          // BawaLoading inside its box, so it overflowed at every
          // height used here (h-10 +59 px, h-20 +19 px, h-24 +3 px;
          // the "Loading…" label straddled the card edge on screen).
          // P0-6: the box alone is still wordless, so the line sits
          // under it in plain text — the shape stays, and the wait is
          // named ("Loading balance…"). The labelled Skeleton (compact
          // loader) is what the taller boxes below use now.
          <div role="status" className="space-y-2">
            <div
              aria-hidden="true"
              className="h-10 w-48 rounded-bawa border-2 border-ink bg-paper"
            />
            <p className="text-sm text-panel-text-muted">Loading balance…</p>
          </div>
        ) : effectiveBalance.status === 'zero' ? (
          <>
            {/* break-words (Lane 2): a long native amount wraps inside
                the 390 px card instead of clipping past its edge. */}
            <p className="break-words text-4xl font-semibold leading-10 text-ink">
              {`0 ${displaySymbol}`}
            </p>
            <p className="text-base font-semibold text-ink">
              {heroFiatText}
            </p>
            <p className="text-base text-ink">Zero balance</p>
          </>
        ) : effectiveBalance.status === 'available' ? (
          <>
            <p className="break-words text-4xl font-semibold leading-10 text-panel-text">
              {formatNativeWithSymbol(
                effectiveBalance.value ?? '0',
                displayDecimals,
                displaySymbol,
              )}
            </p>
            {heroFiatText !== undefined ? (
              <p className="text-base font-semibold text-panel-text">
                {heroFiatText}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-panel-text">Balance unavailable</p>
            <p className="text-sm text-panel-text-muted">
              {effectiveBalance.status === 'error'
                ? 'Could not load the balance.'
                : 'Balance unavailable for this network.'}
              {effectiveBalance.reason ? ` ${humanReasonMessage(effectiveBalance.reason, 'balance')}` : ''}
            </p>
            <LockedOrRetry
              lockedMessage="Locked. Unlock to see balances."
              onRetry={() => void (isToken ? refreshTokenBalances() : refreshBalances())}
              hideRetry={effectiveBalance.reason === 'no-adapter'}
            />
          </>
        )}
        {/* Lane 4 (UX-major, data): the 24 h movement next to the
            holding, from the same live feed as the per-unit price.
            Omitted when the feed did not send one — never 0.00%. */}
        {change24hPct !== undefined ? (
          <p className="text-base text-ink">
            {`24h ${formatChangePct(change24hPct)} · ${priceSource}`}
          </p>
        ) : null}
        {(effectiveBalance.status === 'available' || effectiveBalance.status === 'zero') && effectiveBalance.stale === true ? (
          <p className="text-sm text-panel-text-muted">
            Last loaded balance — may be out of date.
          </p>
        ) : null}
      </div>

      {/*
        Sticky actions (MetaMask's asset-sticky-actions.tsx): Send /
        Receive / Refresh stay pinned to the top of the viewport while
        the transactions and addresses below scroll, using the same
        translucent panel treatment as the app's sticky bottom nav.
        Order and behaviour are unchanged — layout only.
      */}
      <div className="sticky top-0 z-10 -mx-2 flex flex-wrap gap-3 rounded-bawa border-2 border-ink bg-paper px-2 py-2">
        {/* No Send for tokens: no token send exists in this wallet. */}
        {!isToken && (
          <Button asChild size="sm">
            <Link
              to="/send"
              onClick={() => {
                setSelectedChain(chainId);
                recordLastUsedChain(chainId);
              }}
            >
              Send
            </Link>
          </Button>
        )}
        <Button asChild variant="secondary" size="sm">
          <Link to="/receive" onClick={() => setSelectedChain(chainId)}>
            Receive
          </Link>
        </Button>
        {/*
          While locked there is no derived address in state, so refreshAll
          can only land back on unavailable/no-address — the same dead
          refetch the balance/history Retries already replace with Unlock.
        */}
        {vaultState === 'locked' ? (
          <Button asChild variant="secondary" size="sm">
            <Link to="/lock">Unlock</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={state === 'loading'}
            onClick={refreshAll}
            size="sm"
          >
            Refresh
          </Button>
        )}
      </div>

      {/* Lane 4 (UX-major, data): the 7-day price chart, lazy-loaded
          (see the lazy import above) — real CoinGecko history only,
          with its honest empty/error states inside the component. */}
      {/* Lane 4 (UX-major, data): the fallback is a labelled Skeleton,
          not a wordless box — the old plain placeholder carried the
          wait in an sr-only span only. The label reads "Loading price
          chart…", never the bare "Loading…" the Lane F
          first-navigation regression test (app-routing.test.tsx)
          asserts never appears on the first render of this screen.
          The detail itself stays eager; only the chart area waits for
          its chunk. */}
      <Suspense
        fallback={
          <Skeleton className="h-[120px] w-full" label="Loading price chart…" />
        }
      >
        <PriceChart coingeckoId={chartCoingeckoId} label={displayTitle} />
      </Suspense>

      {/*
        Desktop layout (desktop-layout-v2): below the sticky actions,
        Details + Recent transactions sit in the left column and
        Derived addresses + the import source in the right one. The
        wrapper is still a single-column stack below lg (space-y-6, no
        bare grid class), so the mobile layout is untouched. The sticky
        bar stays outside the grid, full-width above it, so its pinning
        behaviour is unchanged.
      */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
        <div className="space-y-6">
      {/*
        Details block, in MetaMask's market position (after the actions,
        before activity). The per-unit price comes from the same live
        price feed as the dashboard strip and the asset list; the
        other rows are the on-chain details the screen already had
        (balance, network).
      */}
      <section aria-labelledby="asset-details-heading" className="space-y-3">
        <h2 id="asset-details-heading" className="font-semibold">
          Details
        </h2>
        <Card radius="xl">
          <CardContent className="pt-6">
            <dl className="space-y-2 text-base">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="font-semibold">
                  {detailsBalance}
                  {detailsBalanceStale}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="flex min-w-0 items-center justify-end gap-2">
                  {firstAddress !== undefined ? (
                    <>
                      <code className="min-w-0 truncate font-mono text-xs font-semibold">
                        {`${firstAddress.slice(0, 10)}…${firstAddress.slice(-8)}`}
                      </code>
                      <CopyButton value={firstAddress} label="Copy address" />
                    </>
                  ) : (
                    <span className="font-semibold">Not imported</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Price</dt>
                <dd className="text-right font-semibold">
                  {unitPrice.kind === 'fresh' ? (
                    <>
                      <span>{unitPrice.text}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {`per ${displaySymbol} · ${priceSource}`}
                      </span>
                    </>
                  ) : unitPrice.kind === 'expired' ? (
                    'Price expired'
                  ) : unitPrice.kind === 'error' ? (
                    'Price error'
                  ) : (
                    'Price unavailable'
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Network</dt>
                <dd className="font-semibold">{networkLabel}</dd>
              </div>
              {tokenRecord !== undefined && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Contract</dt>
                    <dd className="min-w-0 break-all font-mono text-xs font-semibold">
                      {tokenRecord.contract}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Decimals</dt>
                    <dd className="font-semibold">{tokenRecord.decimals}</dd>
                  </div>
                  {verifiedDetailSource !== null && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Verified by</dt>
                      <dd className="font-semibold">
                        {verifiedSourceLabel(verifiedDetailSource)}
                      </dd>
                    </div>
                  )}
                  {tokenRecord.iconSource !== undefined && tokenRecord.iconSource !== null && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Icon from</dt>
                      <dd className="font-semibold">{iconSourceLabel(tokenRecord.iconSource)}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="recent-transactions-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-transactions-heading" className="font-semibold">
            Recent transactions
          </h2>
          <Link
            to={`/track?chain=${chain}`}
            className="text-base text-panel-accent underline underline-offset-4"
          >
            Track a transaction
          </Link>
        </div>
      {/*
        Token history: no token-history adapter exists yet, so the token
        route shows an honest note instead of the native history list.
        Never a fabricated or empty-state list.
      */}
      {isToken ? (
        <p className="rounded-bawa border-2 border-ink bg-paper p-4 text-sm text-muted-foreground">
          No history for this token yet.
        </p>
      ) : chainHistory.status === 'loading' && recentTxs.length === 0 ? (
          // P0-6: the history wait was a wordless bordered box. The
          // labelled Skeleton names it inside the box.
          <Skeleton className="h-20 w-full" label="Loading transactions…" />
        ) : showHistoryList ? (
          <>
            {chainHistory.status === 'loading' ? (
              <p className="text-sm text-muted-foreground">Updating transactions…</p>
            ) : null}
            <ul className="space-y-3">
              {recentTxs.map((tx) => (
                <TxRow key={tx.hash} tx={tx} chain={chainId} />
              ))}
            </ul>
            <Link
              to="/transactions"
              className="inline-block text-base text-panel-accent underline underline-offset-4"
            >
              View all transactions
            </Link>
          </>
        ) : chainHistory.status === 'empty' ||
          (vaultState !== 'locked' && recentTxs.length === 0) ? (
          // No known transactions for this chain (and the vault open):
          // a failed history fetch is not an error the user can act on,
          // so this reads as the empty state, never as "history
          // unavailable" + a dead Retry. Only while locked does the
          // failure surface — with an Unlock prompt, not a Retry — and
          // only a chain with known transactions keeps its Retry.
          <p className="rounded-bawa border-2 border-ink bg-paper p-4 text-sm text-muted-foreground">
            No transactions yet for this chain.
          </p>
        ) : (
          <div className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4">
            <p className="text-base">
              {chainHistory.status === 'error'
                ? 'Could not load transactions.'
                : 'Transaction history is unavailable for this chain.'}
              {chainHistory.reason ? ` ${humanReasonMessage(chainHistory.reason, 'history')}` : ''}
            </p>
            <LockedOrRetry
              lockedMessage="Locked. Unlock to see activity."
              onRetry={() => void refreshHistory()}
            />
          </div>
        )}
      </section>

        </div>
        <div className="space-y-6">
      <section aria-labelledby="derived-addresses-heading" className="space-y-3">
        <h2 id="derived-addresses-heading" className="font-semibold">
          {chain === 'ton' ? 'Imported address' : 'Derived addresses'}
        </h2>
        {hasWallet ? (
          <ul className="space-y-3">
            {vaultList.map((address) => (
              <li key={`vault:${address}`} className="flex flex-wrap items-center gap-3 rounded-bawa border-2 border-ink bg-paper p-3">
                <span className="text-sm text-muted-foreground">Vault</span>
                {' '}
                <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Copy vault address"
                  onClick={() => void copyAddress(address)}
                >
                  Copy
                </Button>
              </li>
            ))}
            <DerivedAddressItems addresses={addresses[chainId]} copyAddress={copyAddress} />
          </ul>
        ) : state === 'loading' ? (
          // P0-6: the addresses wait was a wordless bordered box. The
          // labelled Skeleton names it inside the box.
          <Skeleton className="h-20 w-full" label="Loading derived addresses…" />
        ) : state === 'empty' ? (
          <div className="space-y-2 rounded-bawa border-2 border-ink bg-paper p-4">
            <p>No wallet imported for this chain</p>
            <Button asChild variant="secondary" size="md">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </div>
        ) : state === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errors[chainId] ?? 'Unable to load derived addresses.'}
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            <DerivedAddressItems addresses={addresses[chainId]} copyAddress={copyAddress} />
          </ul>
        )}
        <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>
      </section>

      {/*
        Import source + Derivation, last: the xpub / vault address
        behind the addresses above, with the path. Lane X #56 deleted
        the import-source card on the premise it duplicated the
        address shown above — it did not: the xpub is shown nowhere
        else, so with several imports there was no way to tell which
        xpub a chain's addresses came from (T1-12). The row is
        restored here, inside the disclosure, truncated like before.
      */}
      <details className="rounded-bawa border-2 border-ink bg-paper">
        <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-ink">Import source &amp; derivation</summary>
        <div className="px-4 pb-4">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">{xpub ? (chain === 'ton' ? 'Imported TON address' : 'Imported xpub') : hasVaultAddress ? 'Vault address' : (chain === 'ton' ? 'Imported TON address' : 'Imported xpub')}</dt>
              <dd className="break-all font-mono text-sm">
                {xpub
                  ? `${xpub.slice(0, 12)}…${xpub.slice(-8)}`
                  : hasVaultAddress && firstVaultAddress !== undefined
                    ? `${firstVaultAddress.slice(0, 12)}…${firstVaultAddress.slice(-8)}`
                    : 'Not imported'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Derivation</dt>
              <dd className="break-all text-base">
                {chain === 'ton' ? (
                  'Single imported address, no derivation. TON path m/44\'/607\'/0\' is fully hardened.'
                ) : (
                  // The three documented templates first; every other
                  // chain falls back to its registry path (account 0,
                  // index 0) so the row is never blank.
                  <code>
                    {(DERIVATION_PATHS as Partial<Record<ChainId, string>>)[chainId]
                      ?? config.pathFor(0, 0)}
                  </code>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </details>
        </div>
      </div>
    </div>
  );
}
