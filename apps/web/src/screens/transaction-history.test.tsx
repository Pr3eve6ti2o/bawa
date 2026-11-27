// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { TransactionHistoryScreen } from './transaction-history';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import type { HistoryState } from '../state/wallet-context';
import type { AdapterTx } from '../wallet/adapters/types';

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', async (importOriginal) => {
  // P1 (Lane S1): the chain filter is the shared search picker now,
  // which reads the real filterChains and SUPPORTED_CHAINS — only
  // chainConfig and availableFor stay stubbed.
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  return {
    ...actual,
    availableFor: vi.fn(),
    chainConfig: vi.fn(),
  };
});

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const CHAINS = {
  btc: { displayName: 'Bitcoin', symbol: 'BTC' },
  eth: { displayName: 'Ethereum', symbol: 'ETH' },
  trx: { displayName: 'TRON', symbol: 'TRX' },
  ton: { displayName: 'TON', symbol: 'TON' },
  sol: { displayName: 'Solana', symbol: 'SOL' },
  bsc: { displayName: 'BNB Smart Chain', symbol: 'BNB' },
  matic: { displayName: 'Polygon', symbol: 'POL' },
  arb: { displayName: 'Arbitrum One', symbol: 'ETH' },
  op: { displayName: 'OP Mainnet', symbol: 'ETH' },
  base: { displayName: 'Base', symbol: 'ETH' },
  avax: { displayName: 'Avalanche C-Chain', symbol: 'AVAX' },
  gnosis: { displayName: 'Gnosis', symbol: 'XDAI' },
  celo: { displayName: 'Celo', symbol: 'CELO' },
  linea: { displayName: 'Linea', symbol: 'ETH' },
  mantle: { displayName: 'Mantle', symbol: 'MNT' },
  scroll: { displayName: 'Scroll', symbol: 'ETH' },
  opbnb: { displayName: 'opBNB', symbol: 'BNB' },
  metis: { displayName: 'Metis', symbol: 'METIS' },
  aurora: { displayName: 'Aurora', symbol: 'ETH' },
  fantom: { displayName: 'Fantom', symbol: 'FTM' },
  ltc: { displayName: 'Litecoin', symbol: 'LTC' },
  doge: { displayName: 'Dogecoin', symbol: 'DOGE' },
} as const;

type ChainKey = keyof typeof CHAINS;

const mockRefreshHistory = vi.fn();

function tx(
  hash: string,
  chain: ChainKey,
  direction: AdapterTx['direction'],
  amount: string,
): AdapterTx {
  return {
    hash,
    chain,
    networkId: 'test',
    direction,
    amountBaseUnits: amount,
    counterparty: null,
    timestamp: 1700000000000,
    status: 'confirmed',
    explorerUrl: null,
  };
}

function setWallet(history: Record<ChainKey, HistoryState>, vaultState?: string): void {
  vi.mocked(useWallet).mockReturnValue({
    history,
    refreshHistory: mockRefreshHistory,
    ...(vaultState === undefined ? {} : { vaultState }),
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/transactions']}>
        <TransactionHistoryScreen />
      </MemoryRouter>,
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
  vi.clearAllMocks();
  // P1 (Lane S1): the filter starts at the last-used chain now, so a
  // pick in one test must not leak into the next.
  localStorage.clear();
  mockRefreshHistory.mockResolvedValue(undefined);
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation((chain: ChainId) => {
    const known = CHAINS[chain as ChainKey];
    if (known) return known as unknown as ReturnType<typeof chainConfig>;
    // The filter is the shared picker over all 87 chains now; chains
    // outside this test's 22 get a plain label.
    return {
      displayName: chain,
      symbol: chain.toUpperCase(),
    } as unknown as ReturnType<typeof chainConfig>;
  });
});

const emptyHistory: HistoryState = { status: 'empty', txs: [] };
const perChainEmpty = (): Record<ChainKey, HistoryState> => ({
  btc: emptyHistory,
  eth: emptyHistory,
  trx: emptyHistory,
  ton: emptyHistory,
  sol: emptyHistory,
  bsc: emptyHistory,
  matic: emptyHistory,
  arb: emptyHistory,
  op: emptyHistory,
  base: emptyHistory,
  avax: emptyHistory,
  gnosis: emptyHistory,
  celo: emptyHistory,
  linea: emptyHistory,
  mantle: emptyHistory,
  scroll: emptyHistory,
  opbnb: emptyHistory,
  metis: emptyHistory,
  aurora: emptyHistory,
  fantom: emptyHistory,
  ltc: emptyHistory,
  doge: emptyHistory,
});

describe('transaction history screen', () => {
  it('names the wait while history loads, with the header visible', async () => {
    // P0-6: the loading state was one bare skeleton, no words at all.
    const loading: HistoryState = { status: 'loading', txs: [] };
    setWallet({
      ...perChainEmpty(),
      btc: loading,
      eth: loading,
      trx: loading,
      ton: loading,
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Activity');
      expect(mounted.div.textContent).toContain('Loading your activity…');
      expect(mounted.div.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('lists transactions across chains, newest first', async () => {
    setWallet({
      ...perChainEmpty(),
      eth: { status: 'loaded', txs: [tx('0xeth1', 'eth', 'in', '1000000000000000000')] },
      btc: { status: 'loaded', txs: [tx('btctx1', 'btc', 'out', '50000')] },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('0xeth1');
      expect(mounted.div.textContent).toContain('btctx1');
      expect(mounted.div.textContent).toContain('1 ETH');
      expect(mounted.div.textContent).toContain('0.0005 BTC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('filters by chain when the chain picker changes', async () => {
    setWallet({
      ...perChainEmpty(),
      eth: { status: 'loaded', txs: [tx('0xeth1', 'eth', 'in', '1000000000000000000')] },
      btc: { status: 'loaded', txs: [tx('btctx1', 'btc', 'out', '50000')] },
    });
    const mounted = await mountScreen();
    try {
      // P1 (Lane S1): the filter is the shared search picker now, not
      // a native select — open it and pick Ethereum by label; the
      // Bitcoin row must go.
      const input = mounted.div.querySelector<HTMLInputElement>(
        '#history-chain-filter',
      );
      expect(input).not.toBeNull();
      await act(async () => {
        input?.focus();
        input?.click();
      });
      const option = [...mounted.div.querySelectorAll('[role="option"]')].find(
        (candidate) =>
          candidate
            .querySelector('[data-chain-option-name]')
            ?.textContent?.startsWith('Ethereum '),
      );
      expect(option).not.toBeUndefined();
      await act(async () => {
        (option as HTMLElement).click();
      });
      expect(mounted.div.textContent).toContain('0xeth1');
      expect(mounted.div.textContent).not.toContain('btctx1');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the empty state when every chain has no transactions', async () => {
    setWallet(perChainEmpty());
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No transactions yet');
      expect(mounted.div.textContent).toContain('Your history will appear here after your first transaction.');
      expect(mounted.div.querySelector('a[href="/receive"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the no-wallet empty state when there is no vault', async () => {
    // Lane 2: with no vault every chain fails with no-address, and the
    // old screen rendered nothing below the filter — a blank void.
    // Now it says so, with the way out.
    setWallet(
      {
        ...perChainEmpty(),
        btc: { status: 'unavailable', reason: 'no-address', txs: [] },
        eth: { status: 'unavailable', reason: 'no-address', txs: [] },
        trx: { status: 'unavailable', reason: 'no-address', txs: [] },
        ton: { status: 'unavailable', reason: 'no-address', txs: [] },
      },
      'no-vault',
    );
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No wallet yet');
      expect(mounted.div.textContent).toContain('No wallet on this device yet');
      expect(mounted.div.querySelector('a[href="/create-wallet"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unavailable note and a retry for a failed chain when the wallet has activity', async () => {
    // The Retry appears because the wallet HAS activity (a loaded BTC
    // transaction), so the failed TRON fetch is a real failure worth
    // retrying.
    setWallet({
      ...perChainEmpty(),
      btc: { status: 'loaded', txs: [tx('btctx1', 'btc', 'out', '50000')] },
      trx: { status: 'unavailable', reason: 'down', txs: [] },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('TRON history unavailable');
      expect(mounted.div.textContent).toContain('Retry');
    } finally {
      await mounted.cleanup();
    }
  });

  it('never shows "No transactions yet" when every shown chain failed (Lane C, merged)', async () => {
    // Merged (Lane C + marketing-fix): a failed history is not an empty
    // history, so the empty message must not show - and the unavailable
    // block is withheld while the wallet has no activity, so neither
    // state shows here.
    setWallet({
      ...perChainEmpty(),
      btc: { status: 'unavailable', reason: 'down', txs: [] },
      eth: { status: 'unavailable', reason: 'down', txs: [] },
      trx: { status: 'error', reason: 'down', txs: [] },
      ton: { status: 'unavailable', reason: 'down', txs: [] },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).not.toContain('No transactions yet');
      expect(mounted.div.textContent).not.toContain('history unavailable');
      expect(mounted.div.textContent).not.toContain('Retry');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows neither state when filtered to a failed chain with no activity (Lane C, merged)', async () => {
    // Merged: filtered to the failed chain, nothing loaded - no empty
    // message (nothing earned it) and no unavailable block (no activity).
    setWallet({
      ...perChainEmpty(),
      eth: { status: 'unavailable', reason: 'down', txs: [] },
    });
    const mounted = await mountScreen();
    try {
      // P1 (Lane S1): the filter is the shared search picker now, not
      // a native select — open it and pick Ethereum by label.
      const input = mounted.div.querySelector<HTMLInputElement>(
        '#history-chain-filter',
      );
      expect(input).not.toBeNull();
      await act(async () => {
        input?.focus();
        input?.click();
      });
      const option = [...mounted.div.querySelectorAll('[role="option"]')].find(
        (candidate) =>
          candidate
            .querySelector('[data-chain-option-name]')
            ?.textContent?.startsWith('Ethereum '),
      );
      expect(option).not.toBeUndefined();
      await act(async () => {
        (option as HTMLElement).click();
      });
      expect(mounted.div.textContent).not.toContain('No transactions yet');
      expect(mounted.div.textContent).not.toContain('history unavailable');
      expect(mounted.div.textContent).not.toContain('Retry');
    } finally {
      await mounted.cleanup();
    }
  });

  // NOTE (merge): Lane C's "shows both states when one chain loaded empty
  // and another failed" is dropped - on this screen the two states are
  // mutually exclusive by construction (the empty message renders only
  // when rows.length === 0; the unavailable block only when rows.length
  // > 0). The same scenario is covered by the test below, which asserts
  // only the empty state. "Both states together" is a Recent Activity
  // behaviour, where the gates are independent.
  it('shows only the empty state for a failed chain when the wallet has no activity', async () => {
    // Marketing fix, Lane 1: a fresh wallet with no transactions shows
    // "No transactions yet", not "history unavailable" + a dead Retry.
    setWallet({
      ...perChainEmpty(),
      trx: { status: 'unavailable', reason: 'down', txs: [] },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No transactions yet');
      expect(mounted.div.textContent).not.toContain('history unavailable');
      expect(mounted.div.textContent).not.toContain('Retry');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the last-known time from fetchedAtMs for a failed chain with cached transactions', async () => {
    setWallet({
      ...perChainEmpty(),
      trx: {
        status: 'error',
        reason: 'down',
        txs: [tx('0xtrx1', 'trx', 'in', '1000000')],
        stale: true,
        fetchedAtMs: 1700000000000,
      },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('TRON history unavailable');
      expect(mounted.div.textContent).toContain('Showing last known TRON transactions from');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the empty state when no transaction history is available', async () => {
    vi.mocked(availableFor).mockReturnValue([]);
    setWallet(perChainEmpty());
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain("Transaction history isn't available on any chain yet.");
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unlock prompt when the vault is locked and no chain loaded (A-8)', async () => {
    // Locked vault: every chain fails with no-address and none loads,
    // so the old screen rendered nothing below the filter.
    setWallet(
      {
        ...perChainEmpty(),
        btc: { status: 'unavailable', reason: 'no-address', txs: [] },
        eth: { status: 'unavailable', reason: 'no-address', txs: [] },
        trx: { status: 'unavailable', reason: 'no-address', txs: [] },
        ton: { status: 'unavailable', reason: 'no-address', txs: [] },
      },
      'locked',
    );
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Locked. Unlock to see activity.');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
