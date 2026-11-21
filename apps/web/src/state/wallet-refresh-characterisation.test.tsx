// @vitest-environment jsdom
// Refresh behaviour tests (repo-study Phase 3, item 28). These began as
// characterisation tests pinning the pre-split behaviour, and were
// updated with the split to assert the NEW behaviour:
//
// - A per-chain adapter failure KEEPS the last good value (balances) /
//   transactions (history) with its lastOkAt, and reports the failure
//   in refreshReports. A failure is never presented as zero/empty.
// - A second refresh for the same addresses while one is in flight
//   joins the in-flight fetch (one adapter call, not two).
// - A refresh for different addresses invalidates the in-flight one:
//   the old fetch's late answer is dropped by the request counter.
//
// The harness (Probe, mountProvider, stubAdapter, test constants) is
// copied from wallet-provider-balances.test.tsx. The import-failure
// half lives in wallet-refresh-import-failure.test.tsx, which needs a
// throwing adapters mock and so cannot share this file's real adapters
// module.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import type { WalletContextValue } from './wallet-context';
import { createVault, deleteVault, lock } from '../wallet/vault';
import { registerAdapter } from '../wallet/adapters';
import type {
  AdapterBalance,
  AdapterResult,
  AdapterTx,
  ChainAdapter,
} from '../wallet/adapters/types';
import { TEST_VAULT_PROFILE_IDS } from './test-helpers';

// The capability registry is mocked to verified so the adapter path is
// exercised; the no-adapter gate itself is covered by wallet-context.test.tsx.
vi.mock('../wallet/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  return {
    ...actual,
    availableFor: () => ['btc', 'eth', 'trx', 'ton'],
  };
});

// Standard public BIP-39 test vector — disposable test data, never a real secret.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PASSWORD = 'correct horse battery staple';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let latest: WalletContextValue | undefined;

function Probe() {
  latest = useWallet();
  return null;
}

async function mountProvider() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <WalletProvider>
        <Probe />
      </WalletProvider>,
    );
  });
  return {
    div,
    cleanup: async () => {
      try {
        await act(async () => {
          root.unmount();
        });
      } finally {
        div.remove();
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
}

type StubBalance =
  | { status: 'ok'; value: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

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

beforeEach(() => {
  localStorage.clear();
  lock();
  deleteVault();
  latest = undefined;
});

describe('wallet refresh — post-split behaviour (item 28)', () => {
  it('an adapter error keeps the last good value and reports the failure', async () => {
    const mounted = await mountProvider();
    try {
      registerAdapter(stubAdapter('eth', okBalance('5'), okTxs([])));
      registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
      registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
      registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      expect(latest?.balances.eth.status).toBe('available');
      expect(latest?.balances.eth.value).toBe('5');

      // Settle any in-flight background refresh before swapping the
      // adapter: an explicit refresh joins it while the addresses
      // match (the first adapter-chunk import can be slow in tests),
      // so after it resolves no background run is still in flight and
      // the report below is stored.
      await act(async () => {
        await latest?.refreshBalances();
      });
      expect(latest?.refreshReports.balances).not.toBeNull();
      const lastOkAt = latest?.balances.eth.lastOkAt;
      expect(typeof lastOkAt).toBe('number');

      // The adapter now fails. The good value and its timestamp are
      // kept; the failure is a status + reason + a report entry, never
      // a zero.
      registerAdapter(
        stubAdapter('eth', { status: 'error', reason: 'boom' }, okTxs([])),
      );
      await act(async () => {
        await latest?.refreshBalances();
      });
      expect(latest?.balances.eth.status).toBe('error');
      expect(latest?.balances.eth.reason).toBe('boom');
      expect(latest?.balances.eth.value).toBe('5');
      expect(latest?.balances.eth.lastOkAt).toBe(lastOkAt);
      const report = latest?.refreshReports.balances;
      expect(report?.failures).toHaveLength(1);
      expect(report?.failures[0]).toEqual({
        operation: 'refresh-balances',
        chain: 'eth',
        attempts: 1,
        exhausted: false,
        reason: 'unknown',
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it('a second concurrent refresh for the same addresses joins the in-flight fetch', async () => {
    const mounted = await mountProvider();
    try {
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
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      // Wait for the unlock's background refresh to queue its deferred
      // getBalance (it runs after the dynamic adapter import resolves).
      await act(async () => {
        for (let i = 0; i < 100 && resolvers.length < 1; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      const backgroundCount = resolvers.length;
      expect(backgroundCount).toBeGreaterThanOrEqual(1);

      // Two explicit refreshes for the same addresses: the second joins
      // the first instead of starting another fetch.
      let first: Promise<void> | undefined;
      let second: Promise<void> | undefined;
      await act(async () => {
        first = latest?.refreshBalances();
        second = latest?.refreshBalances();
      });
      expect(resolvers.length).toBe(backgroundCount);
      await act(async () => {
        resolvers[backgroundCount - 1]!(okResult('2'));
        await first;
        await second;
      });
      expect(latest?.balances.eth.status).toBe('available');
      expect(latest?.balances.eth.value).toBe('2');
    } finally {
      await mounted.cleanup();
    }
  });

  it('a refresh for different addresses invalidates the in-flight one', async () => {
    const mounted = await mountProvider();
    try {
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
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      await act(async () => {
        for (let i = 0; i < 100 && resolvers.length < 1; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      const backgroundCount = resolvers.length;
      expect(backgroundCount).toBeGreaterThanOrEqual(1);
      const oldResolve = resolvers[backgroundCount - 1]!;

      // Switch the vault account: new addresses, so the next refresh
      // starts fresh and the in-flight one becomes stale.
      await act(async () => {
        await latest?.setVaultAccount(1, 0);
      });
      await act(async () => {
        for (let i = 0; i < 100 && resolvers.length < backgroundCount + 1; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(resolvers.length).toBe(backgroundCount + 1);
      const newResolve = resolvers[backgroundCount]!;
      await act(async () => {
        newResolve(okResult('2'));
      });
      expect(latest?.balances.eth.value).toBe('2');
      await act(async () => {
        oldResolve(okResult('1'));
      });
      // The old fetch's late answer must not overwrite the new one.
      expect(latest?.balances.eth.status).toBe('available');
      expect(latest?.balances.eth.value).toBe('2');
    } finally {
      await mounted.cleanup();
    }
  });
});
