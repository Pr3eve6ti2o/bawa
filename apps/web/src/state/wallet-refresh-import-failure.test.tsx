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
//   state is left exactly as it was, and the report lands in
//   refreshReports, so the failure is visible.
// - The unlock still completes while the adapter chunk fails to load.
//
// This file is separate from wallet-refresh-characterisation.test.tsx
// because it needs a throwing adapters mock, which cannot share a file
// with the real adapters module.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import type { WalletContextValue } from './wallet-context';
import { createVault, deleteVault, lock } from '../wallet/vault';
import { TEST_VAULT_PROFILE_IDS } from './test-helpers';

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

beforeEach(() => {
  localStorage.clear();
  lock();
  deleteVault();
  latest = undefined;
});

describe('wallet refresh — adapter import failure (post-split behaviour)', () => {
  it('unlock still completes while the adapter chunk fails to load', async () => {
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      // The background refresh failed and its report landed in state;
      // the unlock itself still completed and the state is untouched.
      expect(latest?.vaultState).toBe('unlocked');
      for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
        expect(latest?.balances[chain]).toEqual({
          status: 'unavailable',
          reason: 'no-adapter',
        });
        expect(latest?.history[chain]).toEqual({
          status: 'unavailable',
          reason: 'no-adapter',
          txs: [],
        });
      }
      // Let the background refresh finish and record its report.
      await act(async () => {
        for (let i = 0; i < 50 && latest?.refreshReports.balances === null; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });
      const report = latest?.refreshReports.balances;
      expect(report?.operation).toBe('refresh-balances');
      expect(report?.failures).toHaveLength(4);
      for (const failure of report?.failures ?? []) {
        expect(failure.reason).toBe('adapter-load-failed');
        expect(failure.attempts).toBe(1);
        expect(failure.exhausted).toBe(false);
      }
    } finally {
      await mounted.cleanup();
    }
  });

  it('a direct refresh resolves with a failure report and leaves the state untouched', async () => {
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      // No rejection anymore: the outcome is a report in state.
      await act(async () => {
        await latest?.refreshBalances();
      });
      await act(async () => {
        await latest?.refreshHistory();
      });
      const balancesReport = latest?.refreshReports.balances;
      expect(balancesReport?.failures).toHaveLength(4);
      expect(
        balancesReport?.failures.map((failure) => failure.chain).sort(),
      ).toEqual(['btc', 'eth', 'ton', 'trx']);
      for (const failure of balancesReport?.failures ?? []) {
        expect(failure.operation).toBe('refresh-balances');
        expect(failure.reason).toBe('adapter-load-failed');
      }
      const historyReport = latest?.refreshReports.history;
      expect(historyReport?.failures).toHaveLength(4);
      for (const failure of historyReport?.failures ?? []) {
        expect(failure.operation).toBe('refresh-history');
        expect(failure.reason).toBe('adapter-load-failed');
      }
      for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
        expect(latest?.balances[chain]).toEqual({
          status: 'unavailable',
          reason: 'no-adapter',
        });
        expect(latest?.history[chain].txs).toEqual([]);
      }
    } finally {
      await mounted.cleanup();
    }
  });
});
