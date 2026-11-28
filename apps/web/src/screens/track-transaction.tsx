import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../ui/components/badge';
import { Link, useSearchParams } from 'react-router';
import { chainConfig, SUPPORTED_CHAINS } from '../wallet/chains';
import { CHAIN_DECIMALS, formatNativeWithSymbol } from '../wallet/chain-amount-format';
import {
  lookupTransaction,
  getRecentActivity,
  type TrackedTx,
  type TrackerLookupResult,
  type TrackerActivityResult,
} from '../wallet/tracker';
import { Button } from '../ui/components/button';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { ChainSearchSelect, readLastUsedChain } from './chain-search-select';
import { Card, CardContent } from '../ui/components/card';
import { Alert, AlertDescription } from '../ui/components/alert';
import { BawaLoading } from '../ui/components/loading';
import {
  ensureAdapters,
  ensureDevnetAdapters,
  humanReasonMessage,
  isTransientReason,
  useWallet,
} from '../state/wallet-context';

type ChainId = (typeof SUPPORTED_CHAINS)[number];
// Result states wrap the tracker result so the discriminant is always
// `kind`: the tracker unions discriminate on `status`, not `kind`.
type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; result: TrackerLookupResult };
type ActivityState =
  | { kind: 'idle' }
  | { kind: 'loading'; attempt: number }
  | { kind: 'result'; result: TrackerActivityResult };

// Item 7 (c): a single 429 used to end the address lookup at once with
// "network is busy". Transient indexer failures (429 / rate-limit, 5xx,
// timeouts, network errors — the shared isTransientReason set) are now
// retried automatically with backoff before the error is shown.
const ACTIVITY_MAX_ATTEMPTS = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function errorReason(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'An unexpected error occurred. Please try again.';
}

function amountLabel(
  amount: Parameters<typeof formatNativeWithSymbol>[0] | null,
  chain: ChainId,
): string {
  return amount === null
    ? 'Not reported by the indexer'
    : formatNativeWithSymbol(amount, CHAIN_DECIMALS[chain], chainConfig(chain).symbol);
}

function dateLabel(value: number | string | null, short = false): string {
  if (value === null) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return short
    ? date.toLocaleDateString('en-GB', { dateStyle: 'short' })
    : date.toLocaleString('en-GB');
}

function directionLabel(direction: string): string {
  if (direction === 'in' || direction === 'received') return 'Received';
  if (direction === 'out' || direction === 'sent') return 'Sent';
  return 'Self transfer';
}

// The Bitcoin genesis block's coinbase transaction — a real, public,
// verifiable transaction (the first one ever mined). Used only as the
// worked example in the guidance section below; nothing about it is
// presented as a result until the live indexer returns one.
const GENESIS_BTC_HASH =
  'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16';

// Guidance below the lookup form, collapsed by default (Phase 2, Lane D):
// the lookup is the job of this screen, so the tool comes first and the
// help sits behind one tap — a native details/summary, so it stays
// keyboard-accessible with no extra state. Lane X (Lane D #98/#99):
// the step cards and "what a result shows" list are gone — the form
// labels already say it. Only the genesis-coinbase example stays,
// with its live lookup button.
function TrackGuide({ onUseExample }: { onUseExample: () => void }) {
  return (
    <section aria-labelledby="track-guide-heading" className="space-y-4 rounded-flat-lg border border-ink bg-paper p-6">
      <h2 id="track-guide-heading" className="font-display font-semibold text-ink">
        How tracking works
      </h2>


      <div className="mt-6 rounded-flat-lg border border-ink bg-paper p-4">
        <h3 className="font-semibold text-ink">
          Try the first Bitcoin transaction
        </h3>
        <p className="mt-2 text-base text-ink">
          The first Bitcoin transaction. Try it.
        </p>
        <code className="mt-3 block break-all font-mono text-sm text-panel-text">
          {GENESIS_BTC_HASH}
        </code>
        <Button type="button" variant="secondary" className="mt-4" onClick={onUseExample}>
          Look up this example
        </Button>
      </div>
    </section>
  );
}

// P0-6: exported so the transaction-detail route can render the same
// lookup result Track shows (one home for the lookup-result UI).
export function TransactionDetails({ data, chain, checkedAt }: {
  data: TrackedTx;
  chain: ChainId;
  checkedAt: string;
}) {
  const rows: [string, string][] = [
    ['Block', data.blockHeight?.toLocaleString('en-GB') ?? 'Not in a block yet'],
    ['From', data.from ?? 'Unknown'],
    ['To', data.to ?? 'Unknown'],
    ['Amount', amountLabel(data.amountBaseUnits, chain)],
    ['Fee', amountLabel(data.feeBaseUnits, chain)],
    ['Time', dateLabel(data.timestamp)],
  ];

  return (
    <Card>
      <CardContent className='space-y-4 pt-6'>
        <p className='font-medium'>
          {data.statusLabel}{' — '}
          {data.confirmations === null
            ? 'Confirmations unknown. The indexer reports no block number'
            : `${data.confirmations.toLocaleString('en-GB')} confirmations`}
        </p>
        <p className='text-sm text-muted-foreground'>
          Confirmations shown — not a finality guarantee.
        </p>
        <dl className='space-y-2 text-base'>
          {rows.map(([label, value]) => (
            <div key={label} className='grid grid-cols-[5rem_minmax(0,1fr)] gap-4'>
              <dt className='text-muted-foreground'>{label}</dt>
              {/* No truncate: on a phone there is no hover to reveal a
                  cut-off address, so From/To wrap in full (break-all)
                  instead of showing only their start. */}
              <dd className='min-w-0 break-all' title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className='text-sm text-muted-foreground'>
          {`Source: ${data.source}, checked at ${checkedAt}`}
        </p>
        <a
          href={data.explorerUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='text-base underline underline-offset-4'
        >
          View on explorer
        </a>
      </CardContent>
    </Card>
  );
}

export function TrackTransactionScreen() {
  const { devnetEnabled, xpubs: xpubsRaw, addresses: addressesRaw } = useWallet();
  // Older mocked contexts may not provide the new fields; default them
  // so the screen still renders.
  const xpubs = xpubsRaw ?? {};
  const addresses = addressesRaw ?? {};
  const [searchParams] = useSearchParams();
  // P1 (Lane S1): the chain starts at the last-used chain — the
  // shared last-used pick — unless the URL names one (?chain=).
  const [chain, setChain] = useState<ChainId>(
    () =>
      SUPPORTED_CHAINS.find((id) => id === searchParams.get('chain')) ??
      readLastUsedChain(SUPPORTED_CHAINS) ??
      'btc',
  );
  const [hash, setHash] = useState(() => searchParams.get('hash') ?? '');
  const [tonAddress, setTonAddress] = useState('');
  // Watch-only display programme (audit F12): the address starts at
  // ?address= when the URL names one, and is prefilled from the first
  // watched wallet below — /track used to open on a blank generic
  // lookup (Bitcoin) that ignored the watched wallet entirely.
  const [address, setAddress] = useState(() => searchParams.get('address') ?? '');
  const [addressTouched, setAddressTouched] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [activity, setActivity] = useState<ActivityState>({ kind: 'idle' });
  const lookupRequest = useRef(0);
  const activityRequest = useRef(0);
  // The first watched address, if any — the watched wallet's address
  // for its first chain in registry order. The memo's value is the
  // address string; the context objects change identity on every
  // provider update, so the effect below guards on the value, not the
  // object identity.
  const firstWatchedAddress = useMemo(() => {
    for (const id of SUPPORTED_CHAINS) {
      if (xpubs[id] === null || xpubs[id] === undefined) continue;
      const watched = addresses[id]?.[0]?.address;
      if (typeof watched === 'string' && watched !== '') {
        return { chain: id, address: watched };
      }
    }
    return null;
  }, [xpubs, addresses]);
  const autoRanFor = useRef('');
  // The hash alone is enough to submit: a TON lookup without an address
  // is answered honestly by the tracker itself ('unsupported' + reason),
  // so the form never blocks the user from seeing that explanation.
  const canLookup = Boolean(hash.trim());

  useEffect(() => () => {
    lookupRequest.current += 1;
    activityRequest.current += 1;
  }, []);

  function changeChain(next: ChainId) {
    if (next === chain) return;
    lookupRequest.current += 1;
    activityRequest.current += 1;
    setChain(next);
    setLookup({ kind: 'idle' });
    setActivity({ kind: 'idle' });
  }

  // Watch-only display programme (audit F12): /track opens on the
  // watched wallet's recent activity instead of a blank lookup. The
  // URL wins (?address=, ?chain=); otherwise the first watched
  // address is prefilled and its activity runs once. A 0x address
  // with no ?chain= runs on Ethereum — the address is valid on every
  // EVM chain, and the last-used chain may be a non-EVM one. A typed
  // address is never overwritten, and the run happens once per
  // address (the ref), not on every context update.
  useEffect(() => {
    const paramAddress = searchParams.get('address');
    const target =
      paramAddress !== null && paramAddress.trim() !== ''
        ? {
            address: paramAddress.trim(),
            chain: searchParams.get('chain'),
          }
        : firstWatchedAddress;
    if (target === null) return;
    const key = `${target.chain ?? ''}:${target.address}`;
    if (autoRanFor.current === key) return;
    autoRanFor.current = key;
    // ?chain= wins; a 0x address with no ?chain= runs on Ethereum
    // (valid on every EVM chain, and the last-used chain may be a
    // non-EVM one); otherwise the watched wallet's own chain.
    const paramChain = searchParams.get('chain');
    const targetChain =
      paramChain !== null
        ? (SUPPORTED_CHAINS.find((id) => id === paramChain) ?? chain)
        : target.address.startsWith('0x')
          ? 'eth'
          : target.chain !== null && target.chain !== undefined
            ? (SUPPORTED_CHAINS.find((id) => id === target.chain) ?? chain)
            : chain;
    if (paramAddress === null && !addressTouched && address.trim() === '') {
      setAddress(target.address);
    }
    if (targetChain !== chain) setChain(targetChain);
    void runActivity(target.address, targetChain);
    // runActivity reads the render's state; the effect's own guards
    // (the ref key, the touched/empty checks) are what prevent a
    // second run, so it is intentionally not a dependency.
  }, [firstWatchedAddress, addressTouched, address, chain, searchParams]);

  async function runLookup(hashOverride?: string, chainOverride?: ChainId) {
    const value = (hashOverride ?? hash).trim();
    const lookupChain = chainOverride ?? chain;
    if (!value) return;
    const request = ++lookupRequest.current;
    const addressForTon = lookupChain === 'ton' ? tonAddress.trim() : undefined;
    setLookup({ kind: 'loading' });
    try {
      const result = await lookupTransaction(lookupChain, value, { address: addressForTon, devnet: devnetEnabled });
      if (request === lookupRequest.current) setLookup({ kind: 'result', result });
    } catch (error: unknown) {
      if (request === lookupRequest.current) {
        setLookup({ kind: 'result', result: { status: 'error', reason: errorReason(error) } });
      }
    }
  }

  // Fills the form with the real genesis-transaction example and runs a
  // live lookup against the indexer; the result is whatever the indexer
  // returns, shown in the lookup area above.
  function useExample() {
    setChain('btc');
    setHash(GENESIS_BTC_HASH);
    setTonAddress('');
    void runLookup(GENESIS_BTC_HASH, 'btc');
    document.getElementById('transaction-hash')?.scrollIntoView?.();
  }

  async function runActivity(addressOverride?: string, chainOverride?: ChainId) {
    const value = (addressOverride ?? address).trim();
    if (!value) return;
    const activityChain = chainOverride ?? chain;
    const request = ++activityRequest.current;
    // P0-6: the history adapters load lazily — on a cold visit to
    // /track nothing has registered them yet, so the activity call
    // would fail at once with "No history adapter…", and a Retry
    // would fail the same way. Load them first so the lookup
    // actually runs and a Retry can succeed.
    try {
      await (devnetEnabled ? ensureDevnetAdapters() : ensureAdapters());
    } catch (error: unknown) {
      if (request === activityRequest.current) {
        setActivity({
          kind: 'result',
          result: { status: 'error', reason: errorReason(error) },
        });
      }
      return;
    }
    let lastResult: TrackerActivityResult | null = null;
    for (let attempt = 0; attempt < ACTIVITY_MAX_ATTEMPTS; attempt += 1) {
      if (request !== activityRequest.current) return;
      setActivity({ kind: 'loading', attempt });
      try {
        const result = await getRecentActivity(activityChain, value, 10, {
          devnet: devnetEnabled,
        });
        if (request !== activityRequest.current) return;
        // Only a transient failure is worth another attempt: a
        // permanent one ('unavailable' — no adapter for the chain, or
        // a non-transient error) settles at once, exactly as before.
        if (
          result.status !== 'error' ||
          !isTransientReason(result.reason) ||
          attempt === ACTIVITY_MAX_ATTEMPTS - 1
        ) {
          setActivity({ kind: 'result', result });
          return;
        }
        lastResult = result;
      } catch (error: unknown) {
        if (request !== activityRequest.current) return;
        const reason = errorReason(error);
        if (
          !isTransientReason(reason) ||
          attempt === ACTIVITY_MAX_ATTEMPTS - 1
        ) {
          setActivity({ kind: 'result', result: { status: 'error', reason } });
          return;
        }
        lastResult = { status: 'error', reason };
      }
      // Transient failure, attempts left: back off (1 s, then 2 s —
      // the fetchWithRetry shape) and try again instead of handing
      // the user a dead end on a 429.
      await sleep(1000 * (attempt + 1));
    }
    // Unreachable in practice — the loop always settles a result — but
    // a terminal state beats leaving the spinner up if it ever is.
    if (request === activityRequest.current && lastResult !== null) {
      setActivity({ kind: 'result', result: lastResult });
    }
  }

  return (
    <div className='space-y-6 lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 lg:space-y-0 xl:grid-cols-[2fr_1fr]'>
      <header className='space-y-2 lg:col-span-2'>
        <h1 className=' font-bold'>Track a transaction</h1>
        <p className='text-sm text-muted-foreground'>
          Look up a hash, or recent activity for an address.
        </p>
        <p>
          <Badge>Indexers may lag</Badge>
        </p>
      </header>

      <div className='space-y-6'>
        {/* Lane 6 redesign: the chain choice was an 84-button wall
            (the hash input sat ~2,100 px down at 390 px). It is now
            the same search picker Receive and Import already use —
            search by name, symbol or id, with the chains actually
            used kept in a Recent row. Same selection, same clearing
            of the results on change; nothing else about the lookup
            changes. */}
        <ChainSearchSelect
          chains={SUPPORTED_CHAINS}
          value={chain}
          onChange={changeChain}
          id='track-chain'
        />

        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            void runLookup();
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='transaction-hash'>Transaction hash</Label>
            <Input
              id='transaction-hash'
              placeholder='Paste a transaction hash'
              value={hash}
              onChange={(event) => setHash(event.target.value)}
              required
            />
          </div>
          {chain === 'ton' && (
            <div className='space-y-2'>
              <Label htmlFor='ton-account-address'>Account address (required for TON)</Label>
              <Input
                id='ton-account-address'
                placeholder='EQ… or UQ… address'
                value={tonAddress}
                onChange={(event) => setTonAddress(event.target.value)}
                aria-describedby='ton-address-note'
              />
              <p id='ton-address-note' className='text-sm text-muted-foreground'>
                TON needs the account address too.
              </p>
            </div>
          )}
          <Button type='submit' disabled={lookup.kind === 'loading'}>
            Look up
          </Button>
        </form>

        {lookup.kind === 'loading' && (
          <BawaLoading label="Looking up…" />
        )}
        {lookup.kind === 'result' && lookup.result.status === 'ok' && (
          <TransactionDetails
            data={lookup.result.data}
            chain={chain}
            checkedAt={new Date(lookup.result.data.fetchedAt).toLocaleTimeString('en-GB')}
          />
        )}
        {lookup.kind === 'result' && lookup.result.status === 'not-found' && (
          <Alert>
            <AlertDescription className='space-y-2'>
              <p>Transaction not found.</p>
              {lookup.result.note && <p>{lookup.result.note}</p>}
              <p>Check the hash and chain, or try again later. Indexers can lag.</p>
            </AlertDescription>
          </Alert>
        )}
        {lookup.kind === 'result' && lookup.result.status === 'unsupported' && (
          <Alert>
            <AlertDescription>{humanReasonMessage(lookup.result.reason, 'track')}</AlertDescription>
          </Alert>
        )}
        {lookup.kind === 'result' && lookup.result.status === 'error' && (
          <Alert variant='destructive'>
            <AlertDescription className='space-y-2'>
              <p>Could not look up this transaction.</p>
              <p>{humanReasonMessage(lookup.result.reason, 'track')}</p>
              <Button type='button' variant='secondary' disabled={!canLookup} onClick={() => void runLookup()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

      </div>

      <section aria-labelledby='recent-activity-heading' className='space-y-4 border-t pt-6 lg:border-t-0 lg:pt-0'>
        <h2 id='recent-activity-heading' className=' font-semibold'>
          Recent activity for an address
        </h2>
        {/* The activity lookup reuses the chain picked above; name it
            here, because the picker is a screen away once scrolled. */}
        <p className='text-sm text-muted-foreground'>
          On {chainConfig(chain).displayName}.
        </p>
        <form
          className='space-y-3'
          onSubmit={(event) => {
            event.preventDefault();
            void runActivity();
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='activity-address'>Address</Label>
            <Input
              id='activity-address'
              value={address}
              onChange={(event) => {
                setAddressTouched(true);
                setAddress(event.target.value);
              }}
              required
            />
          </div>
          <Button
            type='submit'
            disabled={!address.trim() || activity.kind === 'loading'}
          >
            Show recent activity
          </Button>
          {/* P0-6: a disabled button with no reason reads as broken.
              Say what unblocks it. */}
          {!address.trim() && activity.kind !== 'loading' && (
            <p className='text-sm text-muted-foreground'>
              Enter an address above to see its recent activity.
            </p>
          )}
        </form>

        {activity.kind === 'loading' && (
          <BawaLoading
            label={
              activity.attempt > 0
                ? `Loading recent activity… Retrying, attempt ${activity.attempt + 1} of ${ACTIVITY_MAX_ATTEMPTS}.`
                : 'Loading recent activity…'
            }
          />
        )}
        {activity.kind === 'result' && activity.result.status === 'ok' && activity.result.data.length === 0 && (
          <div className='space-y-1 text-base'>
            <p>No transactions found for this address.</p>
          </div>
        )}
        {activity.kind === 'result' && activity.result.status === 'ok' && activity.result.data.length > 0 && (
          <>
            <ul className='space-y-2'>
              {activity.result.data.slice(0, 10).map((tx) => (
                <li key={tx.hash}>
                  <Link
                    to={`/transactions/${encodeURIComponent(tx.hash)}`}
                    className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-base hover:bg-panel-hover'
                  >
                    <span className='font-medium'>{directionLabel(tx.direction)}</span>
                    {' '}
                    <span>{amountLabel(tx.amountBaseUnits, chain)}</span>
                    {' '}
                    <span className='text-muted-foreground'>{dateLabel(tx.timestamp, true)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Partials fix (2026-11-28): name the history source
                under the list, as the lookup above already does —
                and carry Routescan's free-plan "Powered by
                Routescan.io APIs" mention when it answered. */}
            <p className='text-sm text-muted-foreground'>
              {`Source: ${activity.result.source}`}
              {activity.result.source === 'routescan'
                ? ' — Powered by Routescan.io APIs'
                : ''}
            </p>
          </>
        )}
        {activity.kind === 'result' && (activity.result.status === 'unavailable' || activity.result.status === 'error') && (
          <Alert variant='destructive'>
            <AlertDescription className='space-y-2'>
              <p>{humanReasonMessage(activity.result.reason, 'track')}</p>
              <p>Recent activity could not be loaded.</p>
              {/* Item 7 (c): a transient failure was already retried
                  automatically (up to 3 attempts with backoff) before
                  this error showed — say so, so the user knows the
                  Retry below is a fresh cycle, not the first try. */}
              {activity.result.status === 'error' &&
                isTransientReason(activity.result.reason) && (
                  <p>
                    Tried {ACTIVITY_MAX_ATTEMPTS} times — the indexer
                    stayed unreachable.
                  </p>
                )}
              {/* P0-6: the lookup error on this screen has a Retry;
                  the activity error had none — same failure, same
                  action. Gated like the lookup Retry: disabled with
                  no address, since a refetch cannot run without one.
                  And only for a real failure ('error'): an
                  'unavailable' result means the chain has no history
                  adapter at all, so a refetch cannot succeed and no
                  Retry is shown. */}
              {activity.result.status === 'error' && (
                <Button type='button' variant='secondary' disabled={!address.trim()} onClick={() => void runActivity()}>
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </section>

      <div className='lg:col-span-2'>
        <TrackGuide onUseExample={useExample} />
      </div>
    </div>
  );
}
