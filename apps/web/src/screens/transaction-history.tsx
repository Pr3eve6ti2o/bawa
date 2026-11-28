import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { humanReasonMessage, useWallet } from '../state/wallet-context';
import type { HistoryState } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import { isEvmChain } from '../wallet/watch-only-families';
import type { ChainId } from '../engine/boundary';
import type { DerivedAddress, WatchOnlyWallet } from '@bawa/contracts';
import type { AdapterTx } from '../wallet/adapters/types';
import type { TrackerActivityResult } from '../wallet/tracker';
import { Button } from '../ui/components/button';
import { ChainSearchSelect } from './chain-search-select';
import { TxRow } from './tx-row';
import { Skeleton } from '../ui/components/skeleton';

// Watch-only display programme: the live interval for the watched
// history fetch, the same 45 s as the balance poll.
const ACTIVITY_POLL_INTERVAL_MS = 45_000;

function readStoredActivityWallet(): string | null {
  try {
    return window.localStorage.getItem(ACTIVITY_WALLET_KEY);
  } catch {
    // Best-effort only.
    return null;
  }
}

type Filter = 'all' | ChainId;

interface RowTx extends AdapterTx {
  chain: ChainId;
}

function formatLastOk(lastOkAt: number): string {
  return new Date(lastOkAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const EVM_ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/;

// One entry in the Activity wallet switcher. `kind: 'vault'` is the HD
// wallet from the vault phrase; `kind: 'watch-only'` is one imported
// public address (or xpub), de-duplicated across the chains it fans out
// to — a 0x address is stored once per EVM chain, but it is one wallet.
export interface ActivityWallet {
  id: string;
  kind: 'vault' | 'watch-only';
  label: string;
  sub: string;
  chains: ChainId[];
  addressFor: (chain: ChainId) => string | undefined;
}

export function buildActivityWallets(input: {
  xpubs?: Record<string, WatchOnlyWallet | null>;
  addresses?: Record<string, DerivedAddress[]>;
  vaultAddresses?: Record<string, string[]>;
  vaultState?: string;
  vaultAccount?: { account: number; index: number };
  historyChains: ChainId[];
}): ActivityWallet[] {
  const wallets: ActivityWallet[] = [];
  const vaultAddresses = input.vaultAddresses ?? {};
  const hasVaultAddress = Object.values(vaultAddresses).some(
    (list) => Array.isArray(list) && list.length > 0,
  );
  if (input.vaultState !== 'no-vault' || hasVaultAddress) {
    const account =
      input.vaultAccount === undefined ? 1 : input.vaultAccount.account + 1;
    wallets.push({
      id: 'vault',
      kind: 'vault',
      label: 'My wallet',
      sub: `Account ${account}`,
      chains: input.historyChains,
      addressFor: (chain) => vaultAddresses[chain]?.[0],
    });
  }
  const seen = new Map<string, ActivityWallet>();
  const xpubs = input.xpubs ?? {};
  const addresses = input.addresses ?? {};
  for (const chain of Object.keys(xpubs) as ChainId[]) {
    const entry = xpubs[chain];
    if (!entry) continue;
    const value = entry.xpub.trim();
    if (value.length === 0) continue;
    const key = value.toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      if (!existing.chains.includes(chain)) existing.chains.push(chain);
      continue;
    }
    const isPlainAddress =
      chain === 'sol' ||
      chain === 'ton' ||
      EVM_ADDRESS_SHAPE.test(value);
    const customLabel = entry.label.trim();
    const wallet: ActivityWallet = {
      id: `watch:${key}`,
      kind: 'watch-only',
      // With a custom label the address is the sub-line; without one
      // the address is the label and the sub-line says what it is, so
      // the option never reads the same address twice.
      label: customLabel || truncateAddress(value),
      sub: customLabel ? truncateAddress(value) : 'Watch-only',
      chains: [chain],
      addressFor: (candidate) => {
        const derived = addresses[candidate]?.[0]?.address;
        if (derived) return derived;
        // A plain 0x address is the same address on every EVM chain
        // (the watch-only fan-out), so it is usable there even before
        // the derived-address list has been populated for that chain.
        if (isPlainAddress && isEvmChain(candidate)) return value;
        return undefined;
      },
    };
    seen.set(key, wallet);
    wallets.push(wallet);
  }
  return wallets;
}

// The tracker result for one chain, in HistoryState shape so the screen
// below can render the direct-fetch path with the same rules as the
// context-history path.
function directStateFromResult(
  result: TrackerActivityResult | { status: 'error'; reason: string },
): HistoryState {
  if (result.status === 'ok') {
    return result.data.length === 0
      ? { status: 'empty', txs: [] }
      : { status: 'loaded', txs: result.data };
  }
  if (result.status === 'unavailable') {
    return { status: 'unavailable', reason: result.reason, txs: [] };
  }
  return { status: 'error', reason: result.reason, txs: [] };
}

const ACTIVITY_WALLET_KEY = 'bawa:activity-wallet';

export function TransactionHistoryScreen() {
  const {
    history,
    refreshHistory,
    vaultState,
    xpubs,
    addresses,
    vaultAddresses,
    vaultAccount,
    devnetEnabled,
  } = useWallet();
  const [filter, setFilter] = useState<Filter>('all');
  const chains = availableFor('history');
  const walletOptions = useMemo(
    () =>
      buildActivityWallets({
        xpubs,
        addresses,
        vaultAddresses,
        vaultState,
        vaultAccount,
        historyChains: chains,
      }),
    // The context objects change identity on every provider update; the
    // option list only changes when a wallet is added or removed, so it
    // is keyed on the wallet values, not the object identities.
    [
      JSON.stringify(
        Object.values(xpubs ?? {})
          .filter((entry): entry is WatchOnlyWallet => entry !== null)
          .map((entry) => `${entry.chain}:${entry.xpub}:${entry.label}`),
      ),
      JSON.stringify(
        Object.entries(addresses ?? {}).map(
          ([chain, list]) => `${chain}:${list[0]?.address ?? ''}`,
        ),
      ),
      JSON.stringify(vaultAddresses ?? {}),
      vaultState,
      vaultAccount?.account,
    ],
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string>(() => {
    const stored = readStoredActivityWallet();
    if (stored) return stored;
    return 'vault';
  });
  const selectedWallet =
    walletOptions.find((wallet) => wallet.id === selectedWalletId) ??
    walletOptions[0];
  const selectedId = selectedWallet?.id ?? 'vault';
  const isWatchOnly = selectedWallet?.kind === 'watch-only';

  // Direct-fetch path (watch-only wallet): the context history always
  // follows the vault address when a vault exists (wallet-context
  // prefers vaultAddresses over watch-only addresses), so a watch-only
  // wallet's history has no context source at all. This path fetches it
  // directly from the history adapters, one parallel call per chain,
  // and merges each chain's result into state the moment it settles —
  // rows stream in instead of waiting behind the slowest chain.
  // The tracker + adapter chunk are dynamically imported so the
  // default (vault) path never pays for them in tests or on first paint.
  const [direct, setDirect] = useState<Record<string, HistoryState> | null>(
    null,
  );
  const [directAttempt, setDirectAttempt] = useState(0);
  const directGen = useRef(0);
  const walletsSignature = useMemo(
    () =>
      walletOptions
        .map((wallet) => `${wallet.id}:${wallet.chains.join(',')}`)
        .join('|'),
    [walletOptions],
  );
  useEffect(() => {
    if (!isWatchOnly || !selectedWallet) {
      setDirect(null);
      return;
    }
    const wallet = selectedWallet;
    const targets = wallet.chains.filter(
      (chain) => chains.includes(chain) && wallet.addressFor(chain),
    );
    const generation = ++directGen.current;
    setDirect(
      Object.fromEntries(
        targets.map((chain) => [
          chain,
          { status: 'loading', txs: [] } as HistoryState,
        ]),
      ),
    );
    let cancelled = false;
    void (async () => {
      try {
        const [{ ensureAdapters, ensureDevnetAdapters }, tracker] =
          await Promise.all([
            import('../state/wallet-context'),
            import('../wallet/tracker'),
          ]);
        if (cancelled || generation !== directGen.current) return;
        await (devnetEnabled === true
          ? ensureDevnetAdapters()
          : ensureAdapters());
        if (cancelled || generation !== directGen.current) return;
        // Parallel across chains (no shared 4-slot limiter here): each
        // chain is a different indexer host, and each result merges
        // into state on arrival, so the first chain's rows show in
        // ~1–2 s instead of after the slowest chain settles.
        await Promise.all(
          targets.map(async (chain) => {
            const address = wallet.addressFor(chain);
            if (!address) return;
            let result:
              | TrackerActivityResult
              | { status: 'error'; reason: string };
            try {
              result = await tracker.getRecentActivity(chain, address, 25, {
                devnet: devnetEnabled === true,
              });
            } catch (error: unknown) {
              result = {
                status: 'error',
                reason:
                  error instanceof Error && error.message
                    ? error.message
                    : 'Lookup failed.',
              };
            }
            if (cancelled || generation !== directGen.current) return;
            const next = directStateFromResult(result);
            setDirect((previous) =>
              previous === null ? previous : { ...previous, [chain]: next },
            );
          }),
        );
      } catch {
        if (cancelled || generation !== directGen.current) return;
        setDirect((previous) => {
          if (previous === null) return previous;
          const next: Record<string, HistoryState> = {};
          for (const [chain, state] of Object.entries(previous)) {
            next[chain] =
              state.status === 'loading'
                ? { status: 'error', reason: 'Lookup failed.', txs: [] }
                : state;
          }
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when the wallet, its chains, the devnet mode, or a manual
    // retry changes — not on every context update.
  }, [selectedId, walletsSignature, directAttempt, devnetEnabled, isWatchOnly]);

  // Watch-only display programme: the direct watch fetch polls on the
  // same 45 s live interval as the balances, so the watched history
  // stays fresh without a manual retry.
  useEffect(() => {
    if (selectedWallet === undefined || selectedWallet.kind !== 'watch-only') return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setDirectAttempt((attempt) => attempt + 1);
    }, ACTIVITY_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [selectedWallet]);

  // Watch-only display programme (audit F4/F5): Activity defaulted to
  // the vault wallet even when it was empty and a watched wallet had
  // history — a blank screen one tap in. The stored choice is never
  // overridden; only when there is NO stored choice, the vault's
  // history has settled with zero rows, and a watched wallet exists,
  // does the screen open on the first watched wallet. The switcher
  // stays visible to flip back.
  useEffect(() => {
    if (readStoredActivityWallet() !== null) return;
    if (selectedWalletId !== 'vault') return;
    if (walletOptions.length < 2) return;
    const vaultSettled = chains.every(
      (chain) =>
        history[chain] === undefined || history[chain].status !== 'loading',
    );
    if (!vaultSettled) return;
    const vaultHasRows = chains.some(
      (chain) => (history[chain]?.txs ?? []).length > 0,
    );
    if (vaultHasRows) return;
    const firstWatched = walletOptions.find(
      (option) => option.kind === 'watch-only',
    );
    if (firstWatched === undefined) return;
    setSelectedWalletId(firstWatched.id);
  }, [selectedWalletId, walletOptions, chains, history]);

  // The source of truth for the rows below: context history for the
  // vault wallet, the direct-fetch state for a watch-only wallet.
  const source: Record<ChainId, HistoryState> =
    isWatchOnly && direct !== null
      ? (direct as Record<ChainId, HistoryState>)
      : history;
  const walletChains: ChainId[] = isWatchOnly
    ? (selectedWallet?.chains.filter((chain) => chains.includes(chain)) ??
      chains)
    : chains;
  const shownChains: ChainId[] = filter === 'all' ? walletChains : [filter];

  const rows: RowTx[] = shownChains
    .flatMap((chain) =>
      (source[chain]?.txs ?? []).map((tx) => ({ ...tx, chain })),
    )
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const anyLoading = shownChains.some(
    (chain) => source[chain]?.status === 'loading',
  );
  const settledCount = shownChains.filter(
    (chain) =>
      source[chain] !== undefined && source[chain].status !== 'loading',
  ).length;
  // UX-major Lane 2: 'no-address' is not a failure — it is the initial
  // state before any fetch can run (wallet-context), so it is excluded
  // here, the same rule recent-activity uses. A chain that never tried
  // must not be named as failed in either block below.
  const failedChains = shownChains.filter(
    (chain) =>
      (source[chain]?.status === 'unavailable' ||
        source[chain]?.status === 'error') &&
      source[chain]?.reason !== 'no-address',
  );
  // Lane C: "No transactions yet" is earned only by a chain that
  // actually loaded (loaded/empty) with zero transactions. A failed
  // history is not an empty history — the two states are mutually
  // exclusive on this screen by construction: with no rows, either
  // the empty state shows (some chain loaded empty) or the
  // unavailable state shows (every shown chain failed and the
  // wallet has activity on another chain), never both — and when
  // no chain loaded and the wallet has no activity at all, nothing
  // renders below the filter. When rows exist, a failed chain is
  // disclosed in the block below the rows instead. ("Both states
  // together" is a Recent Activity behaviour, not this screen's.)
  const anyLoaded = shownChains.some(
    (chain) =>
      source[chain]?.status === 'loaded' ||
      source[chain]?.status === 'empty',
  );
  // Direct path with no fetchable chain at all (a watch-only xpub whose
  // derived addresses have not landed yet): there is nothing to wait
  // for, so the empty state is earned rather than a blank void.
  const directHasNoTargets =
    isWatchOnly && direct !== null && Object.keys(direct).length === 0;

  // Retry only when at least one failed chain has an address to refetch:
  // a chain that failed with no-address cannot load history however often
  // it is retried, so a Retry there would be dead (same gate as the
  // balance rows and the asset detail screen).
  const retryableFailed = failedChains.filter(
    (chain) => source[chain]?.reason !== 'no-address',
  );

  function retryDirect() {
    setDirectAttempt((attempt) => attempt + 1);
  }

  function changeWallet(nextId: string) {
    setSelectedWalletId(nextId);
    try {
      window.localStorage.setItem(ACTIVITY_WALLET_KEY, nextId);
    } catch {
      // Best-effort only.
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-bold tracking-tight text-panel-text">Activity</h1>
      <p className="text-sm text-panel-text-muted">
        <Link to="/track" className="text-panel-accent underline underline-offset-4">
          Look up a hash
        </Link>{' '}
        or an address.
      </p>

      {walletOptions.length > 1 && selectedWallet !== undefined && (
        // Item 7 (a): Activity had no wallet switcher — a watch-only
        // wallet's history had no UI path at all (its history is never
        // in the context state, which follows the vault address). The
        // switcher lists the vault wallet plus every imported
        // watch-only wallet; picking one fetches that wallet's history
        // directly (see the effect above).
        <div className="space-y-2">
          <label
            htmlFor="history-wallet"
            className="text-sm font-medium text-panel-text"
          >
            Wallet
          </label>
          <select
            id="history-wallet"
            value={selectedId}
            onChange={(event) => changeWallet(event.target.value)}
            className="w-full rounded-flat-lg border border-ink bg-paper px-3 py-2 text-base text-panel-text"
          >
            {walletOptions.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {`${wallet.label} — ${wallet.sub}`}
              </option>
            ))}
          </select>
          {isWatchOnly && (
            <p className="text-sm text-panel-text-muted">
              Watch-only — showing history for {selectedWallet.label}.
            </p>
          )}
        </div>
      )}

      {chains.length === 0 ? (
        <div className="space-y-3 rounded-flat-lg border border-ink bg-paper p-6 text-panel-text">
          <h2 className="font-semibold text-panel-text">No transactions yet</h2>
          <p className="text-sm leading-5 text-panel-text-muted">
            No history on any chain yet.
          </p>
          <p className="text-sm leading-5 text-panel-text-muted">
            Import a watch-only wallet, or share an address from Receive.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" size="sm" asChild>
              <Link to="/receive">Receive</Link>
            </Button>
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/*
            Lane 2: one chain picker, not a wall of chips. The old
            filter was 17 symbol-only buttons — five of them labelled
            "ETH" (Ethereum, Arbitrum One, OP Mainnet, Base, Linea,
            Scroll, Aurora…), with no way to tell which was which, and
            it ate ~40% of the phone viewport before any content. P1
            (Lane S1): the filter is the shared searchable chain
            picker now — logo + name + family grouping, with an All
            chains row. Same filter state, same "All" default — the
            control changed, the function did not.
          */}
          <ChainSearchSelect
            chains={walletChains}
            value={filter}
            onChange={setFilter}
            id="history-chain-filter"
            allowAll
          />

          {anyLoading && rows.length === 0 ? (
            // P0-6: the bare skeleton loaded for 10–35 s with no words
            // at all. The labelled skeleton carries the line
            // ("Loading your activity…") inside the box; the header
            // and the chain filter above stay visible, so the screen
            // never looks blank. Rows stream in as chains settle
            // (this branch only shows while no row has landed yet).
            // Item 7 (b): the wait itself lives in the context
            // refresher (balances first, then history, 4 concurrent,
            // results merged only when every chain settles), which
            // this screen cannot change — but the wait is now counted:
            // chains that settled (including the ones that resolved
            // at once as no-adapter / no-address) are named, so a
            // 15–20 s wait reads as progress, not a stuck spinner.
            // On the watch-only path the count is live: each chain
            // merges into state the moment its fetch lands.
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" label="Loading your activity…" />
              <p className="text-sm text-panel-text-muted">
                {`Checked ${settledCount} of ${shownChains.length} chains…`}
              </p>
            </div>
          ) : rows.length === 0 ? (
            vaultState === 'no-vault' && !isWatchOnly ? (
              // Lane 2: no vault, no addresses, no history can exist —
              // the old screen rendered nothing at all below the
              // filter here (a blank void at every viewport). Say so,
              // with the way out.
              <div className="space-y-3 rounded-flat-lg border border-ink bg-paper p-6 text-panel-text">
                <h2 className="font-semibold text-panel-text">No wallet yet</h2>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="button" size="sm" asChild>
                    <Link to="/create-wallet">Create a wallet</Link>
                  </Button>
                  <Button type="button" size="sm" variant="secondary" asChild>
                    <Link to="/import-wallet">Import wallet</Link>
                  </Button>
                </div>
              </div>
            ) : anyLoaded || directHasNoTargets ? (
              // Lane 2: the settled empty state — a title, the honest
              // line, and the Receive action (DESIGN-SYSTEM §6). The
              // old screen showed the bare line alone.
              <div className="space-y-3 rounded-flat-lg border border-ink bg-paper p-6 text-panel-text">
                <h2 className="font-semibold text-panel-text">No transactions yet</h2>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="button" size="sm" asChild>
                    <Link to="/receive">Receive</Link>
                  </Button>
                </div>
              </div>
            ) : failedChains.length > 0 &&
              walletChains.some(
                (chain) => (source[chain]?.txs ?? []).length > 0,
              ) ? (
              // UX-major Lane 2: the shown chain(s) really failed and
              // no row is shown — but the wallet HAS activity somewhere
              // (this is the filtered view: the user filtered to a
              // failed chain while another chain holds transactions).
              // The old code rendered nothing here, a blank void below
              // the filter. Lane C (merged, pinned by test) withholds
              // this block while the wallet has NO activity at all, so
              // the activity gate above keeps that rule intact. The
              // failure is named inline with the one action that can
              // help: Retry when unlocked, Unlock when locked (a Retry
              // with no address could only fail again). Chain names are
              // not repeated — the filter above already shows which
              // chain is selected.
              <div className="space-y-2 rounded-flat-lg border border-ink bg-paper p-4">
                <p className="text-base">History unavailable.</p>
                <Button
                  type="button"
                  variant="secondary"
                  asChild={vaultState === 'locked' && !isWatchOnly}
                  onClick={
                    vaultState === 'locked' && !isWatchOnly
                      ? undefined
                      : () => {
                          if (isWatchOnly) retryDirect();
                          else void refreshHistory();
                        }
                  }
                >
                  {vaultState === 'locked' && !isWatchOnly ? (
                    <Link to="/lock">Unlock</Link>
                  ) : (
                    'Retry'
                  )}
                </Button>
              </div>
            ) : vaultState === 'locked' && !isWatchOnly ? (
              // Lane A (A-8): a locked vault clears every address, so
              // no chain loaded and none failed — the old code fell
              // through to null and the screen was blank below the
              // filter. Match recent-activity: say so, with Unlock.
              <div className="space-y-2 rounded-flat-lg border border-ink bg-paper p-4">
                <p className="text-base">Locked. Unlock to see activity.</p>
                <Button type="button" variant="secondary" asChild>
                  <Link to="/lock">Unlock</Link>
                </Button>
              </div>
            ) : null
          ) : (
            <ul className="space-y-3">
              {rows.map((tx) => (
                <TxRow key={`${tx.chain}:${tx.hash}`} tx={tx} chain={tx.chain} showChainSymbol />
              ))}
            </ul>
          )}

          {/* While rows are already showing, chains still in flight are
              named instead of silently spinning — partial results with
              an honest "still checking" line (item 7 (b)). */}
          {rows.length > 0 && anyLoading && (
            <p className="text-sm text-panel-text-muted">
              {`Still checking ${shownChains.length - settledCount} more chain${shownChains.length - settledCount === 1 ? '' : 's'}…`}
            </p>
          )}

          {/* A failed history fetch is disclosed with a Retry only when
              the wallet has activity (rows loaded somewhere): a fresh
              wallet with no transactions shows "No transactions yet",
              not an error + a dead Retry for a 429 that would only 429
              again. A failed chain WITH retained transactions keeps its
              block — its rows make rows.length > 0. */}
          {rows.length > 0 && failedChains.length > 0 && (
            <div className="space-y-2 rounded-flat-lg border border-ink bg-paper p-4">
              <p className="text-base">
                {`${failedChains
                  .map((chain) => chainConfig(chain).displayName)
                  .join(', ')} history unavailable${
                  failedChains.length === 1 &&
                  failedChains[0] !== undefined &&
                  source[failedChains[0]].reason
                    ? ` ${humanReasonMessage(source[failedChains[0] as ChainId].reason, 'history')}`
                    : '.'
                }`}
              </p>
              {failedChains.map((chain) => {
                const lastOkAt = source[chain]?.fetchedAtMs;
                if (
                  (source[chain]?.txs ?? []).length === 0 ||
                  lastOkAt === undefined
                )
                  return null;
                return (
                  <p key={chain} className="text-sm text-muted-foreground">
                    Showing last known {chainConfig(chain).displayName}{' '}
                    transactions from {formatLastOk(lastOkAt)}.
                  </p>
                );
              })}
              {retryableFailed.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (isWatchOnly) retryDirect();
                    else void refreshHistory();
                  }}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
