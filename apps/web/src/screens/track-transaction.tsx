import { useEffect, useRef, useState } from 'react';
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
import { Card, CardContent } from '../ui/components/card';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Skeleton } from '../ui/components/skeleton';

type ChainId = (typeof SUPPORTED_CHAINS)[number];
// Result states wrap the tracker result so the discriminant is always
// `kind`: the tracker unions discriminate on `status`, not `kind`.
type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; result: TrackerLookupResult };
type ActivityState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; result: TrackerActivityResult };

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
// keyboard-accessible with no extra state. The content is unchanged:
// three steps, what a result shows, and the genesis-coinbase example
// with its live lookup button.
function TrackGuide({ onUseExample }: { onUseExample: () => void }) {
  return (
    <details className="rounded-[20px] border border-panel-border bg-panel-surface-raised p-6">
      <summary className="cursor-pointer text-xl font-semibold text-panel-text">
        How tracking works
      </summary>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-panel-text-muted">
          <li>Pick a chain above.</li>
          <li>Paste the transaction hash.</li>
          <li>Look it up to see its status.</li>
        </ol>

        <div>
          <h3 className="font-semibold text-panel-text">What a result shows</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-panel-text-muted">
            <li>Status and confirmations</li>
            <li>Block</li>
            <li>From and to addresses</li>
            <li>Amount and fee</li>
            <li>Time</li>
            <li>The indexer it came from</li>
            <li>A link to the explorer</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 space-y-2 text-sm text-panel-text-muted">
        <p>Results come from public indexers and may lag behind the chain.</p>
        <p>A TON lookup also needs the account address.</p>
      </div>

      <div className="mt-6 rounded-xl border border-panel-border bg-panel-surface p-4">
        <h3 className="font-semibold text-panel-text">
          Try a real one — the first Bitcoin transaction
        </h3>
        <p className="mt-2 text-sm text-panel-text-muted">
          This is a real public Bitcoin transaction: the coinbase transaction
          of the genesis block. Looking it up fetches the live result from
          the indexer — nothing here is a pre-filled answer.
        </p>
        <code className="mt-3 block break-all font-mono text-sm text-panel-text">
          {GENESIS_BTC_HASH}
        </code>
        <Button type="button" variant="outline" className="mt-4" onClick={onUseExample}>
          Look up this example
        </Button>
      </div>
    </details>
  );
}

function TransactionDetails({ data, chain, checkedAt }: {
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
            ? 'Confirmations unknown — the indexer reports no block number'
            : `${data.confirmations.toLocaleString('en-GB')} confirmations`}
        </p>
        <p className='text-sm text-muted-foreground'>
          Included transactions are shown with their confirmation count. This is not a finality guarantee.
        </p>
        <dl className='space-y-2 text-sm'>
          {rows.map(([label, value]) => (
            <div key={label} className='grid grid-cols-[5rem_minmax(0,1fr)] gap-4'>
              <dt className='text-muted-foreground'>{label}</dt>
              <dd className='min-w-0 truncate break-all' title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className='text-sm text-muted-foreground'>
          {`Source: ${data.source}, checked at ${checkedAt}`}
        </p>
        <a
          href={data.explorerUrl}
          target='_blank'
          rel='noreferrer'
          className='text-sm underline underline-offset-4'
        >
          View on explorer
        </a>
      </CardContent>
    </Card>
  );
}

export function TrackTransactionScreen() {
  const [searchParams] = useSearchParams();
  const [chain, setChain] = useState<ChainId>(
    () => SUPPORTED_CHAINS.find((id) => id === searchParams.get('chain')) ?? 'btc',
  );
  const [hash, setHash] = useState(() => searchParams.get('hash') ?? '');
  const [tonAddress, setTonAddress] = useState('');
  const [address, setAddress] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [activity, setActivity] = useState<ActivityState>({ kind: 'idle' });
  const lookupRequest = useRef(0);
  const activityRequest = useRef(0);
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

  async function runLookup(hashOverride?: string, chainOverride?: ChainId) {
    const value = (hashOverride ?? hash).trim();
    const lookupChain = chainOverride ?? chain;
    if (!value) return;
    const request = ++lookupRequest.current;
    const addressForTon = lookupChain === 'ton' ? tonAddress.trim() : undefined;
    setLookup({ kind: 'loading' });
    try {
      const result = await lookupTransaction(lookupChain, value, { address: addressForTon });
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

  async function runActivity() {
    if (!address.trim()) return;
    const request = ++activityRequest.current;
    setActivity({ kind: 'loading' });
    try {
      const result = await getRecentActivity(chain, address.trim(), 10);
      if (request === activityRequest.current) setActivity({ kind: 'result', result });
    } catch (error: unknown) {
      if (request === activityRequest.current) {
        setActivity({ kind: 'result', result: { status: 'error', reason: errorReason(error) } });
      }
    }
  }

  return (
    <div className='space-y-6 lg:grid lg:grid-cols-[7fr_5fr] lg:gap-6 lg:space-y-0 xl:grid-cols-[2fr_1fr]'>
      <header className='space-y-2 lg:col-span-2'>
        <h1 className='text-2xl font-semibold'>Track a transaction</h1>
        <p className='text-sm text-muted-foreground'>
          Look up any transaction by its hash, or see recent activity for an address. Results come from public indexers and may lag behind the chain.
        </p>
      </header>

      <div className='space-y-6'>
        <div role='group' aria-label='Chain' className='flex flex-wrap gap-2'>
          {SUPPORTED_CHAINS.map((id) => (
            <Button
              key={id}
              type='button'
              variant={chain === id ? 'default' : 'outline'}
              aria-pressed={chain === id}
              onClick={() => changeChain(id)}
            >
              {chainConfig(id).displayName}
            </Button>
          ))}
        </div>

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
                TonCenter identifies a transaction by account, lt and hash, so a TON lookup needs the account address as well as the hash.
              </p>
            </div>
          )}
          <Button type='submit' disabled={lookup.kind === 'loading'}>
            Look up
          </Button>
        </form>

        {lookup.kind === 'loading' && (
          <div role='status' className='space-y-2'>
            <Skeleton className='h-32 w-full' />
            <p className='text-sm'>Looking up…</p>
          </div>
        )}
        {lookup.kind === 'result' && lookup.result.status === 'ok' && (
          <TransactionDetails
            data={lookup.result.data}
            chain={chain}
            checkedAt={new Date(lookup.result.data.fetchedAt).toLocaleTimeString('en-GB')}
          />
        )}
        {lookup.kind === 'result' && lookup.result.status === 'not-found' && (
          <Alert className='border-amber-500/50 bg-amber-500/10'>
            <AlertDescription className='space-y-2'>
              <p>Transaction not found.</p>
              {lookup.result.note && <p>{lookup.result.note}</p>}
              <p>Check the hash and chain, or try again later — indexers can lag.</p>
            </AlertDescription>
          </Alert>
        )}
        {lookup.kind === 'result' && lookup.result.status === 'unsupported' && (
          <Alert className='border-sky-500/50 bg-sky-500/10'>
            <AlertDescription>{lookup.result.reason}</AlertDescription>
          </Alert>
        )}
        {lookup.kind === 'result' && lookup.result.status === 'error' && (
          <Alert className='border-red-500/50 bg-red-500/10'>
            <AlertDescription className='space-y-2'>
              <p>Could not look up this transaction.</p>
              <p>{lookup.result.reason}</p>
              <Button type='button' variant='outline' disabled={!canLookup} onClick={() => void runLookup()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

      </div>

      <section aria-labelledby='recent-activity-heading' className='space-y-4 border-t pt-6 lg:border-t-0 lg:pt-0'>
        <h2 id='recent-activity-heading' className='text-xl font-semibold'>
          Recent activity for an address
        </h2>
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
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </div>
          <Button type='submit' disabled={!address.trim() || activity.kind === 'loading'}>
            Show recent activity
          </Button>
        </form>

        {activity.kind === 'loading' && (
          <div role='status'>
            <Skeleton className='h-24 w-full' />
            <span className='sr-only'>Loading recent activity…</span>
          </div>
        )}
        {activity.kind === 'result' && activity.result.status === 'ok' && activity.result.data.length === 0 && (
          <div className='space-y-1 text-sm'>
            <p>No transactions found for this address.</p>
            <p className='text-muted-foreground'>Indexed results may lag behind the chain.</p>
          </div>
        )}
        {activity.kind === 'result' && activity.result.status === 'ok' && activity.result.data.length > 0 && (
          <ul className='space-y-2'>
            {activity.result.data.slice(0, 10).map((tx) => (
              <li key={tx.hash}>
                <Link
                  to={`/transactions/${encodeURIComponent(tx.hash)}`}
                  className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm hover:bg-panel-hover'
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
        )}
        {activity.kind === 'result' && (activity.result.status === 'unavailable' || activity.result.status === 'error') && (
          <Alert className='border-red-500/50 bg-red-500/10'>
            <AlertDescription className='space-y-2'>
              <p>{activity.result.reason}</p>
              <p>Recent activity could not be loaded.</p>
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
