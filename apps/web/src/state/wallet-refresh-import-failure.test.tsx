// @vitest-environment jsdom
// Refresh import-failure behaviour (repo-study Phase 3, item 28). These
// began as characterisation tests pinning the pre-split behaviour (the
// refresh rejected and the empty catch at wallet-context.tsx:440-441
// swallowed it), and were updated with the split to assert the NEW
// behaviour:
//
// - When the adapter chunk fails to load, refreshBalances /
//   refreshHistory RESOLVE with a failure report (one entry per chain,
//   reason 'adapter-load-failed') instead of rejecting. The per-chain
//   state is left exactly as it was.
//
// Merge 1 (Lane B) adaptation: these tests used to drive the behaviour
// through the WalletProvider (createVault + unlockVault, reports read
// from refreshReports in context state, and the first test asserted the
// unlock itself still completed). The merged context does NOT wire
// wallet-refresh.ts (Lane A), has no refreshReports and no unlockVault,
// so the provider path cannot run them. The behaviour asserted here
// lives in wallet-refresh.ts (createRefresh), so the remaining test now
// drives that module directly with a local RefreshDeps harness: same
// report assertions, no vault, no lock, no provider. The first test
// ('unlock still completes while the adapter chunk fails to load') is
// DELETED, not adapted: it fundamentally tested the provider's unlock
// completing during a refresh failure, and there is no unlock any more;
// its module-level content (failure report + untouched state) is fully
// covered by the surviving test. The context re-wire is a deferred
// follow-up, not part of this merge.
//
// This file is separate from wallet-refresh-characterisation.test.tsx
// because it needs a throwing adapters mock, which cannot share a file
// with the real adapters module.
import { describe, expect, it, vi } from 'vitest';
import type { ChainId } from '@bawa/contracts';
import {
  createRefresh,
  type BalanceState,
  type HistoryState,
  type RefreshDeps,
} from './wallet-refresh';

// The adapter chunk fails to load: registerAllAdapters throws, so the
// ensureAdapters() promise rejects. Everything else is a no-op.
vi.mock('../wallet/adapters', () => ({
  getAdapter: () => undefined,
  registerAdapter: () => {},
  registeredChains: () => [],
  registerAllAdapters: () => {
    throw new Error('adapter chunk failed to load');
  },
}));

vi.mock('../wallet/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  return {
    ...actual,
    availableFor: () => ['btc', 'eth', 'trx', 'ton'],
  };
});

/** Local RefreshDeps harness, seeded with the no-adapter initial state. */
function makeDeps(): {
  deps: RefreshDeps;
  balances: Map<string, BalanceState>;
  history: Map<string, HistoryState>;
} {
  const balances = new Map<string, BalanceState>();
  const history = new Map<string, HistoryState>();
  for (const chain of ['btc', 'eth', 'trx', 'ton']) {
    balances.set(chain, { status: 'unavailable', reason: 'no-adapter' });
    history.set(chain, {
      status: 'unavailable',
      reason: 'no-adapter',
      txs: [],
    });
  }
  return {
    deps: {
      getAddress: () => 'test',
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

describe('wallet refresh — adapter import failure (post-split behaviour)', () => {
  it('a direct refresh resolves with a failure report and leaves the state untouched', async () => {
    const { deps, balances, history } = makeDeps();
    const refresh = createRefresh(deps);

    // No rejection anymore: the outcome is a report, not a throw.
    const balancesReport = await refresh.refreshBalances();
    expect(balancesReport.operation).toBe('refresh-balances');
    expect(balancesReport.failures).toHaveLength(4);
    expect(balancesReport.failures.map((failure) => failure.chain).sort()).toEqual([
      'btc',
      'eth',
      'ton',
      'trx',
    ]);
    for (const failure of balancesReport.failures) {
      expect(failure.operation).toBe('refresh-balances');
      expect(failure.reason).toBe('adapter-load-failed');
      expect(failure.attempts).toBe(1);
      expect(failure.exhausted).toBe(false);
    }
    const historyReport = await refresh.refreshHistory();
    expect(historyReport.operation).toBe('refresh-history');
    expect(historyReport.failures).toHaveLength(4);
    for (const failure of historyReport.failures) {
      expect(failure.operation).toBe('refresh-history');
      expect(failure.reason).toBe('adapter-load-failed');
      expect(failure.attempts).toBe(1);
      expect(failure.exhausted).toBe(false);
    }
    // The per-chain state is left exactly as it was.
    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      expect(balances.get(chain)).toEqual({
        status: 'unavailable',
        reason: 'no-adapter',
      });
      expect(history.get(chain)).toEqual({
        status: 'unavailable',
        reason: 'no-adapter',
        txs: [],
      });
    }
  });
});
