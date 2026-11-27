// Transaction detail screen (Phase 4, Sol p6, assembled 2026-11-19).
// Real on-chain status: refreshes the adapter-backed history on mount and
// reports the status the network reported, with the check time. A hash that
// is not in the loaded history is reported as unknown — never as a
// simulated success. Sol corrections: uses the real CHAIN_DECIMALS and
// chainConfig (display name + symbol) instead of redefining them, maps
// direction codes to words, and shows the requested ID in the not-found
// state (the pre-existing test requires it).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useWallet } from '../state/wallet-context';
import { CopyButton } from '../ui/components/copy-button';
import { BawaLoading } from '../ui/components/loading';
import { Button } from '../ui/components/button';
import { availableFor, chainConfig } from '../wallet/chains';
import {
  CHAIN_DECIMALS,
  formatNativeWithSymbol,
} from '../wallet/chain-amount-format';
import {
  lookupTransaction,
  type TrackedTx,
} from '../wallet/tracker';
import type { ChainId } from '../engine/boundary';
import { TransactionDetails } from './track-transaction';

const STATUS_CLASSES = {
  pending: 'text-warning-text',
  confirmed: 'text-success-text',
  failed: 'text-destructive',
} as const;

type HistoryCheck = {
  checkedAt: Date;
  refreshFailed: boolean;
};

function formatTransactionDate(
  timestamp: number | string | null | undefined,
): string {
  if (timestamp == null) return 'Pending';

  const numericTimestamp = Number(timestamp);
  // Accept Unix seconds as well as millisecond timestamps.
  const date = Number.isFinite(numericTimestamp)
    ? new Date(
        Math.abs(numericTimestamp) < 1_000_000_000_000
          ? numericTimestamp * 1_000
          : numericTimestamp,
      )
    : new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function directionLabel(direction: 'in' | 'out' | 'self'): string {
  if (direction === 'in') return 'Received';
  if (direction === 'out') return 'Sent';
  return 'Self transfer';
}

function CheckedAt({ check }: { check: HistoryCheck | null }) {
  if (check === null) {
    return <span>Checking network history…</span>;
  }

  // P0-6: the time alone ("Checked at 08:18:24") said nothing about
  // which day was checked, or what was checked. Date + time, and the
  // not-found panel below names the check.
  return (
    <span>
      Checked at{' '}
      <time dateTime={check.checkedAt.toISOString()}>
        {check.checkedAt.toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </time>
    </span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-base">{children}</dd>
    </div>
  );
}

type TrackerLookupOutcome =
  | { status: 'loading' }
  | { status: 'found'; data: TrackedTx; chain: ChainId }
  | { status: 'not-found' }
  | { status: 'error'; reason: string }
  | { status: 'malformed' };

// P0-6: a hash's shape says which chains it can belong to, before any
// network call — a 64-hex hash is shared by Bitcoin, Litecoin, Dogecoin
// and TRON, a 0x-prefixed one is EVM-shaped. Anything else is not a
// transaction hash at all, and no refetch can fix it (so it gets no
// Retry). The lookup below tries Bitcoin then TRON for a 64-hex hash —
// the wallet has no indexer lookup for Litecoin/Dogecoin yet, so those
// two are offered as explorer links only (see explorerUrlsFor).
function hashChainHint(id: string): 'btc' | 'eth' | null {
  if (/^[0-9a-fA-F]{64}$/.test(id)) return 'btc';
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) return 'eth';
  return null;
}

// The public explorers for a hash whose shape names its chain(s). A
// 0x hash names one chain family, so it gets one link. A 64-hex hash is
// shared by Bitcoin, Litecoin, Dogecoin and TRON — no single explorer
// is right, so every candidate is offered and none is guessed: a
// Litecoin or Dogecoin hash used to get a dead Bitcoin explorer link
// (T1-3). Each URL is the chain's own canonical explorer, already used
// for that chain's history elsewhere in the wallet. An unshaped hash
// has no explorer to link to, and Track is the way to try other chains.
function explorerUrlsFor(
  id: string,
): ReadonlyArray<{ label: string; url: string }> {
  if (/^[0-9a-fA-F]{64}$/.test(id)) {
    return [
      { label: 'Bitcoin explorer', url: `https://mempool.space/tx/${id}` },
      { label: 'Litecoin explorer', url: `https://litecoinspace.org/tx/${id}` },
      { label: 'Dogecoin explorer', url: `https://dogechain.info/tx/${id}` },
      { label: 'TRON explorer', url: `https://tronscan.org/#/transaction/${id}` },
    ];
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return [
      { label: 'View on explorer', url: `https://eth.blockscout.com/tx/${id}` },
    ];
  }
  return [];
}

export function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { history, refreshHistory } = useWallet();
  const [check, setCheck] = useState<HistoryCheck | null>(null);
  const checkPromiseRef = useRef<Promise<HistoryCheck> | null>(null);
  // P0-6: the not-found state used to be a dead end even for a real,
  // confirmed hash. Once the wallet-history check is done and the
  // hash is not in it, the same public-indexer lookup Track uses runs
  // here (BTC, then TRON, for a 64-hex hash; Ethereum for a 0x one)
  // and a found transaction renders Track's own result card.
  const [lookup, setLookup] = useState<TrackerLookupOutcome | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const lookupKeyRef = useRef<string | null>(null);
  // T1-2: the hash in the URL can change without a remount (Back /
  // Forward, direct URL edit). Remember the last hash so the mount
  // effect below can drop the previous hash's check/lookup instead of
  // painting them under the new hash's "Requested ID" for a frame.
  const prevIdRef = useRef<string | undefined>(id);

  function handleRetry(): void {
    // Re-run both checks: the mount refresh (reset its cached promise
    // so it really refetches) and the indexer lookup (via retryNonce).
    checkPromiseRef.current = null;
    setCheck(null);
    setLookup(null);
    setRetryNonce((nonce) => nonce + 1);
  }

  useEffect(() => {
    let active = true;

    // T1-2: a new hash drops the previous hash's check/lookup and
    // refetches — the lookup effect below is keyed to id, but without
    // this reset the old result paints under the new "Requested ID".
    if (prevIdRef.current !== id) {
      prevIdRef.current = id;
      checkPromiseRef.current = null;
      setCheck(null);
      setLookup(null);
    }

    // Reuse the mount refresh during Strict Mode effect replays and rerenders.
    if (checkPromiseRef.current === null) {
      checkPromiseRef.current = (async (): Promise<HistoryCheck> => {
        let refreshFailed = false;

        try {
          await refreshHistory();
        } catch {
          refreshFailed = true;
        }

        return {
          checkedAt: new Date(),
          refreshFailed,
        };
      })();
    }

    void checkPromiseRef.current.then((result) => {
      if (active) setCheck(result);
    });

    return () => {
      active = false;
    };
  }, [id, refreshHistory, retryNonce]);

  const found = (() => {
    if (!id) return null;
    // Lane J: look up the hash on every history-verified chain, not
    // just the original four. refreshHistory loads history for all of
    // these (SOL, LTC and DOGE included), and transaction-history.tsx
    // already lists the same set — a Dogecoin transaction in loaded
    // history used to report "not in the loaded history" here.
    for (const chain of availableFor('history')) {
      const tx = history[chain]?.txs.find((candidate) => candidate.hash === id);
      if (tx) return { tx, chain };
    }
    return null;
  })();

  useEffect(() => {
    if (check === null || found !== null || !id) return;
    const key = `${id}:${retryNonce}`;
    if (lookupKeyRef.current === key) return;
    lookupKeyRef.current = key;
    const hint = hashChainHint(id);
    if (hint === null) {
      setLookup({ status: 'malformed' });
      return;
    }
    let cancelled = false;
    setLookup({ status: 'loading' });
    void (async () => {
      // TON needs an account address, so it is not tried here — its
      // lookup lives on Track, linked below. Other chains likewise:
      // the Track link carries the hash, so the user can try them.
      const chains: ChainId[] = hint === 'btc' ? ['btc', 'trx'] : ['eth'];
      let lastError: string | null = null;
      for (const lookupChain of chains) {
        const result = await lookupTransaction(lookupChain, id);
        if (cancelled) return;
        if (result.status === 'ok') {
          setLookup({ status: 'found', data: result.data, chain: lookupChain });
          return;
        }
        if (result.status === 'error') lastError = result.reason;
      }
      if (cancelled) return;
      setLookup(
        lastError !== null
          ? { status: 'error', reason: lastError }
          : { status: 'not-found' },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [check, found, id, retryNonce]);

  // P0-6: the Track link carries the hash (and the chain its shape
  // names, so Track opens on the right network); the explorer links
  // go to the public explorers for that shape. Computed once, so
  // the render below stays readable.
  const trackHref = (() => {
    if (id === undefined) return '/track';
    const hint = hashChainHint(id);
    const params = new URLSearchParams();
    if (hint !== null) params.set('chain', hint);
    params.set('hash', id);
    return `/track?${params.toString()}`;
  })();
  const explorerUrls = id === undefined ? [] : explorerUrlsFor(id);

  return (
    // Desktop layout (desktop-layout-v2): the detail lays out in two
    // columns at lg (the wrapper below), so the outer cap no longer
    // constrains it there. Below lg it stays a single max-w-2xl
    // column, so the mobile layout is untouched.
    <div className="mx-auto w-full max-w-2xl px-4 py-8 text-foreground lg:max-w-none">
      <header className="mb-6">
        <Link
          to="/transactions"
          className="text-base font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          ← Transactions
        </Link>
        <h1 className="mt-3 font-bold">Transaction details</h1>
      </header>

      {check?.refreshFailed && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-warning-border bg-warning-surface p-4 text-base text-warning-text"
        >
          Couldn&apos;t refresh — showing loaded history.
        </p>
      )}

      {found ? (
        // Two detail columns at lg (left: chain/direction/amount/
        // counterparty; right: date/status/hash/explorer). Below lg the
        // wrapper carries the card chrome and the two lists read as
        // one continuous card — the same 1px separators as the single
        // list it replaces — so the mobile layout is untouched.
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card lg:grid lg:grid-cols-2 lg:gap-6 lg:divide-y-0 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent">
          <dl className="divide-y divide-border lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card">
            <DetailRow label="Chain">
              {`${chainConfig(found.chain).displayName} mainnet`}
            </DetailRow>

            <DetailRow label="Direction">
              <span className="capitalize">
                {directionLabel(found.tx.direction)}
              </span>
            </DetailRow>

            <DetailRow label="Amount">
              <span className="font-semibold">
                {formatNativeWithSymbol(
                  found.tx.amountBaseUnits,
                  CHAIN_DECIMALS[found.chain],
                  chainConfig(found.chain).symbol,
                )}
              </span>
            </DetailRow>

            <DetailRow label="Counterparty">
              <span className="break-all font-mono">
                {found.tx.counterparty || '—'}
              </span>
            </DetailRow>
          </dl>

          <dl className="divide-y divide-border lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card">
            <DetailRow label="Date">
              {formatTransactionDate(found.tx.timestamp)}
            </DetailRow>

            <DetailRow label="Status">
              <div aria-live="polite">
                <p
                  className={`font-medium ${STATUS_CLASSES[found.tx.status]}`}
                >
                  {`${found.tx.status} as reported by the network.`}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <CheckedAt check={check} />
                </p>
              </div>
            </DetailRow>

            <DetailRow label="Transaction hash">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-all font-mono">{found.tx.hash}</span>
                <CopyButton value={found.tx.hash} label="Copy transaction hash" />
              </span>
            </DetailRow>

            {found.tx.explorerUrl && (
              <DetailRow label="Explorer">
                <a
                  href={found.tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  View on explorer
                </a>
              </DetailRow>
            )}
          </dl>
        </div>
      ) : lookup !== null && lookup.status === 'found' ? (
        // P0-6: a real hash resolves here now, via the same public-
        // indexer lookup Track uses — the transaction is shown with
        // its on-chain status instead of the "unknown" dead end.
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {`Found on ${chainConfig(lookup.chain).displayName} via the public indexer — this transaction is not in this wallet's loaded history.`}
          </p>
          <TransactionDetails
            data={lookup.data}
            chain={lookup.chain}
            checkedAt={new Date(lookup.data.fetchedAt).toLocaleTimeString('en-GB')}
          />
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5 lg:grid lg:grid-cols-2 lg:gap-6">
          <div>
            <p>
              Not in loaded history — status unknown.
            </p>
            <dl className="mt-3 space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">
                Requested ID
              </dt>
              <dd className="break-all">
                <code className="text-sm">{id ?? 'No ID supplied'}</code>
              </dd>
            </dl>
            {lookup !== null && lookup.status === 'loading' && (
              <div className="mt-4">
                <BawaLoading label="Looking up this transaction…" />
              </div>
            )}
            {lookup !== null && lookup.status === 'error' && (
              <p role="alert" className="mt-4 text-base text-ink">
                {`The public indexer could not be reached: ${lookup.reason}`}
              </p>
            )}
            {lookup !== null && lookup.status === 'malformed' && (
              <p className="mt-4 text-sm text-muted-foreground">
                This doesn&rsquo;t look like a transaction hash — check it
                and try again.
              </p>
            )}
          </div>
          <div>
            <p className="mt-3 text-xs text-muted-foreground lg:mt-0">
              <CheckedAt check={check} />
            </p>
            {/* P0-6: the dead end is gone. Look it up on Track (the
                hash rides along, with the chain its shape names), check
                the explorer, or retry both checks — except for a
                malformed hash, where a refetch cannot succeed. */}
            {lookup !== null && lookup.status !== 'loading' && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to={trackHref}
                  className="text-base font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  Look it up on Track
                </Link>
                {lookup.status !== 'malformed' &&
                  explorerUrls.map((explorer) => (
                    <a
                      key={explorer.url}
                      href={explorer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      {explorer.label}
                    </a>
                  ))}
                {lookup.status !== 'malformed' && (
                  <Button type="button" variant="secondary" onClick={handleRetry}>
                    Retry
                  </Button>
                )}
              </div>
            )}
            <Link
              to="/transactions"
              className="mt-5 inline-block text-base font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Back to transactions
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
