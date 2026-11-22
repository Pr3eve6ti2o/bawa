import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import type { ChainId } from '../engine/boundary';
import { chainConfig } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import { unitPriceForChain, usePrices } from '../wallet/prices';
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
  const { chain } = useParams<{ chain: string }>();
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
    devnetEnabled,
  } = useWallet();
  const [copyStatus, setCopyStatus] = useState('');

  // Per-unit price from the same live CoinGecko feed as the dashboard
  // strip and the asset list (usePrices pattern: auto-fetch on mount,
  // refresh about every 60 seconds). No price is ever invented: a
  // missing/expired/failed feed reads as such in the Details block.
  const { state: pricesState, refresh: refreshPrices } = usePrices({ devnet: devnetEnabled });
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

  // Mount / chain refresh (Lane G, Phase 3): a direct load or a move to
  // another chain re-fetches for that chain. Gated on hydration so the
  // first call has the rehydrated addresses — without an address a fetch
  // cannot run and Retry would be dead. The provider also refreshes once
  // after hydration; this covers later :chain changes.
  useEffect(() => {
    if (chain !== 'btc' && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') return;
    if (hydrating) return;
    void refreshChain(chain as ChainId);
    // Promise.resolve: the real refreshBalances always returns a promise,
    // but a mocked context may not — history must still run after balances.
    void Promise.resolve(refreshBalances()).finally(() => {
      void refreshHistory();
    });
  }, [chain, hydrating, refreshChain, refreshBalances, refreshHistory]);

  if (chain !== 'btc' && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Unknown chain</h1>
      </div>
    );
  }

  const config = chainConfig(chain);
  const xpub = xpubs[chain]?.xpub;
  const state = uiState[chain];
  const balance = balances[chain];
  const chainHistory = history[chain];
  const recentTxs = [...chainHistory.txs]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 5);
  // Single source of truth for "is there a wallet for this chain" (Lane G,
  // Phase 3; Rabby's one-account-list pattern): the union of the vault's
  // derived addresses and the watch-only xpub's derived addresses. "Not
  // imported" only when BOTH are empty for the chain — the xpub record
  // alone is a watch-only detail, not the wallet-existence test.
  const vaultList = vaultAddresses?.[chain] ?? [];
  const hasVaultAddress = vaultList.length > 0;
  const firstVaultAddress = vaultList[0];
  const hasWallet = hasVaultAddress || (addresses[chain]?.length ?? 0) > 0;
  const showHistoryList =
    chainHistory.status === 'loaded'
    || (chainHistory.status === 'loading' && recentTxs.length > 0);
  const unitPrice = unitPriceForChain(pricesState.entries[chain], Date.now());
  const detailsBalance =
    balance.status === 'loading'
      ? 'Loading…'
      : balance.status === 'zero'
        ? `0 ${config.symbol}`
        : balance.status === 'available'
          ? formatNativeWithSymbol(
              balance.value ?? '0',
              CHAIN_DECIMALS[chain as ChainId],
              config.symbol,
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
    void refreshChain(chain as ChainId);
    void Promise.resolve(refreshBalances()).finally(() => {
      void refreshHistory();
    });
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
              <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontFamily="Caveat, cursive" fontSize={24}>{config.symbol}</text>
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink">{config.displayName}</h1>
            <p className="text-sm text-ink">{`${config.displayName} mainnet`}</p>
          </div>
        </div>
        {balance.status === 'loading' ? (
          <BawaLoading label="Loading balance…" />
        ) : balance.status === 'zero' ? (
          <>
            <p className="text-[32px] font-semibold leading-10 text-ink">
              {`0 ${config.symbol}`}
            </p>
            <p className="text-sm text-ink">Zero balance</p>
          </>
        ) : balance.status === 'available' ? (
          <p className="text-[32px] font-semibold leading-10 text-panel-text">
            {formatNativeWithSymbol(
              balance.value ?? '0',
              CHAIN_DECIMALS[chain as ChainId],
              config.symbol,
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
                <p className="text-sm text-panel-text-muted">Locked — unlock to see balances.</p>
                <Button type="button" variant="outline" asChild>
                  <Link to="/lock">Unlock</Link>
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => void refreshBalances()}>
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
        <Button asChild className="h-11">
          <Link to="/send" onClick={() => setSelectedChain(chain)}>
            Send
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link to="/receive" onClick={() => setSelectedChain(chain)}>
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
        CoinGecko feed as the dashboard strip and the asset list; the
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
                        {`per ${config.symbol} · CoinGecko`}
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
                <dd className="font-semibold">{`${config.displayName} mainnet`}</dd>
              </div>
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
        {chainHistory.status === 'loading' && recentTxs.length === 0 ? (
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
                          CHAIN_DECIMALS[chain as ChainId],
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
                <p className="text-sm text-panel-text-muted">Locked — unlock to see activity.</p>
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
            {addresses[chain].map(({ index, address }) => (
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
              {errors[chain] ?? 'Unable to load derived addresses.'}
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            {addresses[chain].map(({ index, address }) => (
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
                  'No derivation — single imported address (TON path m/44\'/607\'/0\' is fully hardened).'
                ) : (
                  <code>{DERIVATION_PATHS[chain]}</code>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
