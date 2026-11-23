import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import type { ChainId } from '../engine/boundary';
import { chainConfig } from '../wallet/chains';
import { devnetChainConfigOrUndefined } from '../wallet/devnet-endpoints';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { unitPriceForChain, usePrices } from '../wallet/prices';
import { useTokenPrices } from '../wallet/token-prices';
import { DEFAULT_TOKENS, tokenKeyOf, tokenSlug, type TokenRecord } from '../wallet/tokens';
import { ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Button } from '../ui/components/button';
import { Card, CardContent } from '../ui/components/card';
import { BawaLoading } from '../ui/components/loading';

const DERIVATION_PATHS = {
  btc: "m/84'/0'/0'/0/i",
  eth: "m/44'/60'/0'/0/i",
  trx: "m/44'/195'/0'/0/i",
} as const;

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
  // strip and the asset list (usePrices pattern: auto-fetch on mount,
  // refresh about every 60 seconds). No price is ever invented: a
  // missing/expired/failed feed reads as such in the Details block.
  const { state: pricesState, refresh: refreshPrices } = usePrices();
  useEffect(() => {
    if (pricesState.status === 'idle') {
      refreshPrices();
    }
  }, [pricesState.status, refreshPrices]);
  const refreshPricesRef = useRef(refreshPrices);
  useEffect(() => {
    refreshPricesRef.current = refreshPrices;
  });
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPricesRef.current();
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

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
        <h1 className="text-2xl font-semibold">Unknown chain</h1>
      </div>
    );
  }

  if (tokenParam !== undefined && tokenRecord === undefined) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Unknown token</h1>
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
  const showHistoryList =
    chainHistory.status === 'loaded'
    || (chainHistory.status === 'loading' && recentTxs.length > 0);
  const displaySymbol = tokenRecord !== undefined ? tokenRecord.symbol : config.symbol;
  const displayDecimals = tokenRecord !== undefined ? tokenRecord.decimals : CHAIN_DECIMALS[chainId];
  const displayTitle = tokenRecord !== undefined ? tokenRecord.symbol : config.displayName;
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
  const detailsBalance =
    balance.status === 'loading'
      ? 'Loading…'
      : balance.status === 'zero'
        ? `0 ${displaySymbol}`
        : balance.status === 'available'
          ? formatNativeWithSymbol(
              balance.value ?? '0',
              displayDecimals,
              displaySymbol,
            )
          : 'Balance unavailable';
  const detailsBalanceStale =
    (balance.status === 'available' || balance.status === 'zero') && balance.stale === true
      ? ' (stale)'
      : '';

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
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Link>

      <div className="space-y-4 rounded-bawa border-2 border-ink bg-paper p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="inline-flex size-12 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-ink">
            <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 rotate-3">
              <path d="M24 4C35 3 44 13 43 24C45 35 34 45 24 43C12 45 3 35 5 24C3 13 13 3 24 4Z" fill="none" stroke="currentColor" strokeWidth={2} />
              <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontFamily="Baloo 2, Inter, sans-serif" fontSize={24}>{displaySymbol}</text>
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink">{displayTitle}</h1>
            <p className="text-sm text-ink">{displaySubtitle}</p>
          </div>
        </div>
        {balance.status === 'loading' ? (
          <BawaLoading label="Loading balance…" />
        ) : balance.status === 'zero' ? (
          <>
            <p className="text-[32px] font-semibold leading-10 text-ink">
              {`0 ${displaySymbol}`}
            </p>
            <p className="text-sm text-ink">Zero balance</p>
          </>
        ) : balance.status === 'available' ? (
          <p className="text-[32px] font-semibold leading-10 text-panel-text">
            {formatNativeWithSymbol(
              balance.value ?? '0',
              displayDecimals,
              displaySymbol,
            )}
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold text-panel-text">Balance unavailable</p>
            <p className="text-sm text-panel-text-muted">
              {balance.status === 'error'
                ? 'Could not load the balance.'
                : 'Balance unavailable for this network.'}
              {balance.reason ? ` ${humanReasonMessage(balance.reason, 'balance')}` : ''}
            </p>
            {vaultState === 'locked' ? (
              <>
                <p className="text-sm text-panel-text-muted">Locked. Unlock to see balances.</p>
                <Button type="button" variant="outline" asChild>
                  <Link to="/lock">Unlock</Link>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void (isToken ? refreshTokenBalances() : refreshBalances())}
              >
                Retry
              </Button>
            )}
          </>
        )}
        {(balance.status === 'available' || balance.status === 'zero') && balance.stale === true ? (
          <p className="text-sm text-panel-text-muted">
            Showing the last loaded balance — it may be out of date.
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
          <Button asChild className="h-11">
            <Link to="/send" onClick={() => setSelectedChain(chainId)}>
              Send
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11">
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
          <Button asChild variant="outline" className="h-11">
            <Link to="/lock">Unlock</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={state === 'loading'}
            onClick={refreshAll}
            className="h-11"
          >
            Refresh
          </Button>
        )}
      </div>

      {/*
        Details block, in MetaMask's market position (after the actions,
        before activity). The per-unit price comes from the same live
        price feed as the dashboard strip and the asset list; the
        other rows are the on-chain details the screen already had
        (balance, network).
      */}
      <section aria-labelledby="asset-details-heading" className="space-y-3">
        <h2 id="asset-details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="font-semibold">
                  {detailsBalance}
                  {detailsBalanceStale}
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
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="recent-transactions-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-transactions-heading" className="text-lg font-semibold">
            Recent transactions
          </h2>
          <Link
            to={`/track?chain=${chain}`}
            className="text-sm text-panel-accent underline underline-offset-4"
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
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Transaction history is not connected for this token yet.
        </p>
      ) : chainHistory.status === 'loading' && recentTxs.length === 0 ? (
          <BawaLoading label="Loading transactions…" />
        ) : showHistoryList ? (
          <>
            {chainHistory.status === 'loading' ? (
              <p className="text-sm text-muted-foreground">Updating transactions…</p>
            ) : null}
            <ul className="space-y-3">
              {recentTxs.map((tx) => (
                <li key={tx.hash} className="rounded-lg border p-3">
                  <Link
                    to={`/transactions/${tx.hash}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {tx.direction === 'in'
                          ? 'Received'
                          : tx.direction === 'out'
                            ? 'Sent'
                            : 'Self transfer'}
                      </span>
                      {' '}
                      <span className="text-sm font-semibold">
                        {formatNativeWithSymbol(
                          tx.amountBaseUnits,
                          CHAIN_DECIMALS[chainId],
                          config.symbol,
                        )}
                      </span>
                    </span>
                    <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                      {tx.hash}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {tx.timestamp === null
                        ? 'Pending'
                        : new Date(tx.timestamp).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                      {tx.status === 'failed' ? ' · Failed' : tx.status === 'pending' ? ' · Pending' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : chainHistory.status === 'empty' ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No transactions yet for this chain.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm">
              {chainHistory.status === 'error'
                ? 'Could not load transactions.'
                : 'Transaction history is unavailable for this chain.'}
              {chainHistory.reason ? ` ${humanReasonMessage(chainHistory.reason, 'history')}` : ''}
            </p>
            {vaultState === 'locked' ? (
              <>
                <p className="text-sm text-panel-text-muted">Locked. Unlock to see activity.</p>
                <Button type="button" variant="outline" asChild>
                  <Link to="/lock">Unlock</Link>
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => void refreshHistory()}>
                Retry
              </Button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="derived-addresses-heading" className="space-y-3">
        <h2 id="derived-addresses-heading" className="text-lg font-semibold">
          {chain === 'ton' ? 'Imported address' : 'Derived addresses'}
        </h2>
        {hasWallet ? (
          <ul className="space-y-3">
            {vaultList.map((address) => (
              <li key={`vault:${address}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">Vault</span>
                {' '}
                <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Copy vault address"
                  onClick={() => void copyAddress(address)}
                >
                  Copy
                </Button>
              </li>
            ))}
            {addresses[chainId].map(({ index, address }) => (
              <li key={`${index}:${address}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">{`Index ${index}`}</span>
                {' '}
                <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Copy address at index ${index}`}
                  onClick={() => void copyAddress(address)}
                >
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        ) : state === 'loading' ? (
          <BawaLoading label="Loading derived addresses…" />
        ) : state === 'empty' ? (
          <div className="space-y-2 rounded-lg border p-4">
            <p>No wallet imported for this chain</p>
            <Link to="/import-wallet" className="font-medium underline underline-offset-4">
              Import wallet
            </Link>
          </div>
        ) : state === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errors[chainId] ?? 'Unable to load derived addresses.'}
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            {addresses[chainId].map(({ index, address }) => (
              <li key={`${index}:${address}`} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">{`Index ${index}`}</span>
                {' '}
                <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Copy address at index ${index}`}
                  onClick={() => void copyAddress(address)}
                >
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>
      </section>

      {/*
        Import source, last: the xpub / derivation behind the addresses
        above. Moved after the addresses (it documented the import
        before the addresses it describes were shown).
      */}
      <Card className="rounded-xl">
        <CardContent className="pt-6">
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
              <dd className="break-all text-sm">
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
        </CardContent>
      </Card>
    </div>
  );
}
