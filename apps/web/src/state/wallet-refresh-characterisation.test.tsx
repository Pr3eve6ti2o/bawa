// @vitest-environment jsdom
// Refresh behaviour tests (repo-study Phase 3, item 28). These began as
// characterisation tests pinning the pre-split behaviour, and were
// updated with the split to assert the NEW behaviour:
//
// - A per-chain adapter failure KEEPS the last good value (balances) /
//   transactions (history) with its lastOkAt, and reports the failure
//   in the RefreshReport. A failure is never presented as zero/empty.
// - A second refresh for the same addresses while one is in flight
//   joins the in-flight fetch (one adapter call, not two).
// - A refresh for different addresses invalidates the in-flight one:
//   the old fetch's late answer is dropped by the request counter.
//
// Merge 1 (Lane B) adaptation: these tests used to drive the behaviour
// through the WalletProvider (createVault + unlockVault, reports read
// from refreshReports in context state). The merged context does NOT
// wire wallet-refresh.ts (Lane A: the module covers 4 chains while the
// tree is 13, and its BalanceState/HistoryState shapes differ from the
// context's), has no refreshReports and no unlockVault — so the provider
// path cannot run them. The behaviour asserted here lives in
// wallet-refresh.ts (createRefresh), so the tests now drive that module
// directly with a local RefreshDeps harness: same assertions, no vault,
// no lock, no provider. The context re-wire is a deferred follow-up,
// not part of this merge. The import-failure half lives in
// wallet-refresh-import-failure.test.tsx, which needs a throwing
// adapters mock and so cannot share this file's real adapters module.
import { describe, expect, it, vi } from 'vitest';
import type { ChainId } from '@bawa/contracts';
import {
  createRefresh,
  type BalanceState,
  type HistoryState,
  type RefreshDeps,
} from './wallet-refresh';
import { registerAdapter } from '../wallet/adapters';
import type {
  AdapterBalance,
  AdapterResult,
  AdapterTx,
  ChainAdapter,
} from '../wallet/adapters/types';

// The capability registry is mocked to verified so the adapter path is
// exercised; the no-adapter gate itself is covered by wallet-context.test.tsx.
vi.mock('../wallet/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  return {
    ...actual,
    availableFor: () => ['btc', 'eth', 'trx', 'ton'],
  };
});

function stubAdapter(
  chain: ChainAdapter['chain'],
  balance: StubBalance,
  txs: AdapterResult<AdapterTx[]>,
): ChainAdapter {
  return {
    chain,
    networkId: 'test',
    getBalance: async () => {
      if (balance.status !== 'ok') return balance;
      return {
        status: 'ok',
        data: {
          chain,
          address: 'test',
          networkId: 'test',
          valueBaseUnits: balance.value,
          decimals: 18,
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      };
    },
    getHistory: async () => txs,
    estimateFee: async () => ({
      status: 'unavailable',
      reason: 'stub',
    }),
    getTxInputs: async () => ({
      status: 'unavailable',
      reason: 'stub',
    }),
    broadcast: async () => {
      throw new Error('Broadcast is disabled until separately authorised.');
    },
  };
}

type StubBalance =
  | { status: 'ok'; value: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

const okBalance = (value: string): StubBalance => ({ status: 'ok', value });
const okTxs = (txs: AdapterTx[]) =>
  ({ status: 'ok' as const, data: txs, source: 'stub', fetchedAt: 0 });

const okResult = (value: string): AdapterResult<AdapterBalance> => ({
  status: 'ok' as const,
  data: {
    chain: 'eth' as const,
    address: 'test',
    networkId: 'test',
    valueBaseUnits: value,
    decimals: 18,
    source: 'stub',
    fetchedAt: 0,
  },
  source: 'stub',
  fetchedAt: 0,
});

/** Local RefreshDeps harness: state lives in maps, addresses are mutable. */
function makeDeps(addresses: Record<string, string | undefined>): {
  deps: RefreshDeps;
  balances: Map<string, BalanceState>;
  history: Map<string, HistoryState>;
} {
  const balances = new Map<string, BalanceState>();
  const history = new Map<string, HistoryState>();
  return {
    deps: {
      getAddress: (chain: ChainId) => addresses[chain],
      getBalance: (chain: ChainId) =>
        balances.get(chain) ?? { status: 'unavailable', reason: 'no-address' },
      getHistory: (chain: ChainId) =>
        history.get(chain) ?? {
          status: 'unavailable',
          reason: 'no-address',
          txs: [],
        },
      setBalance: (chain: ChainId, state: BalanceState) => {
        balances.set(chain, state);
      },
      setHistory: (chain: ChainId, state: HistoryState) => {
        history.set(chain, state);
      },
    },
    balances,
    history,
  };
}

const ADDRESSES: Record<string, string | undefined> = {
  btc: 'btc-test',
  eth: 'eth-test',
  trx: 'trx-test',
  ton: 'ton-test',
};

describe('wallet refresh — post-split behaviour (item 28)', () => {
  it('an adapter error keeps the last good value and reports the failure', async () => {
    const { deps, balances } = makeDeps({ ...ADDRESSES });
    registerAdapter(stubAdapter('eth', okBalance('5'), okTxs([])));
    registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
    const refresh = createRefresh(deps);

    const first = await refresh.refreshBalances();
    expect(first.failures).toHaveLength(0);
    expect(balances.get('eth')).toMatchObject({
      status: 'available',
      value: '5',
    });
    const lastOkAt = balances.get('eth')?.lastOkAt;
    expect(typeof lastOkAt).toBe('number');

    // The adapter now fails. The good value and its timestamp are
    // kept; the failure is a status + reason + a report entry, never
    // a zero.
    registerAdapter(
      stubAdapter('eth', { status: 'error', reason: 'boom' }, okTxs([])),
    );
    const report = await refresh.refreshBalances();
    expect(balances.get('eth')?.status).toBe('error');
    expect(balances.get('eth')?.reason).toBe('boom');
    expect(balances.get('eth')?.value).toBe('5');
    expect(balances.get('eth')?.lastOkAt).toBe(lastOkAt);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toEqual({
      operation: 'refresh-balances',
      chain: 'eth',
      attempts: 1,
      exhausted: false,
      reason: 'unknown',
    });
  });

  it('a second concurrent refresh for the same addresses joins the in-flight fetch', async () => {
    const { deps, balances } = makeDeps({ ...ADDRESSES });
    const resolvers: Array<
      (result: AdapterResult<AdapterBalance>) => void
    > = [];
    const deferredAdapter: ChainAdapter = {
      ...stubAdapter('eth', okBalance('0'), okTxs([])),
      getBalance: () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    };
    registerAdapter(deferredAdapter);
    registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
    const refresh = createRefresh(deps);

    // Two explicit refreshes for the same addresses: the second joins
    // the first instead of starting another fetch (proven below by the
    // single deferred getBalance call, not by promise identity —
    // joinInflight wraps the first call's promise in a finally).
    const first = refresh.refreshBalances();
    const second = refresh.refreshBalances();
    // Wait for the first run to reach the deferred getBalance (it runs
    // after the dynamic adapter import resolves).
    for (let i = 0; i < 100 && resolvers.length < 1; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(resolvers.length).toBe(1);
    resolvers[0]!(okResult('2'));
    await first;
    await second;
    expect(balances.get('eth')).toMatchObject({
      status: 'available',
      value: '2',
    });
  });

  it('a refresh for different addresses invalidates the in-flight one', async () => {
    const addresses = { ...ADDRESSES };
    const { deps, balances } = makeDeps(addresses);
    const resolvers: Array<
      (result: AdapterResult<AdapterBalance>) => void
    > = [];
    const deferredAdapter: ChainAdapter = {
      ...stubAdapter('eth', okBalance('0'), okTxs([])),
      getBalance: () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    };
    registerAdapter(deferredAdapter);
    registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
    const refresh = createRefresh(deps);

    const first = refresh.refreshBalances();
    for (let i = 0; i < 100 && resolvers.length < 1; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(resolvers.length).toBe(1);
    const oldResolve = resolvers[0]!;

    // Switch the address: new addresses, so the next refresh starts
    // fresh and the in-flight one becomes stale.
    addresses.eth = 'eth-test-2';
    const second = refresh.refreshBalances();
    for (let i = 0; i < 100 && resolvers.length < 2; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(resolvers.length).toBe(2);
    const newResolve = resolvers[1]!;
    newResolve(okResult('2'));
    await second;
    expect(balances.get('eth')?.value).toBe('2');
    oldResolve(okResult('1'));
    await first;
    // The old fetch's late answer must not overwrite the new one.
    expect(balances.get('eth')).toMatchObject({
      status: 'available',
      value: '2',
    });
  });
});
