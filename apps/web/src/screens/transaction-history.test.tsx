// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { TransactionHistoryScreen } from './transaction-history';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { HistoryState } from '../state/wallet-context';
import type { AdapterTx } from '../wallet/adapters/types';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
}));

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

function setWallet(history: Record<ChainKey, HistoryState>): void {
  vi.mocked(useWallet).mockReturnValue({
    history,
    refreshHistory: mockRefreshHistory,
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
  mockRefreshHistory.mockResolvedValue(undefined);
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
  );
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
  ltc: emptyHistory,
  doge: emptyHistory,
});

describe('transaction history screen', () => {
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

  it('filters by chain when a pill is clicked', async () => {
    setWallet({
      ...perChainEmpty(),
      eth: { status: 'loaded', txs: [tx('0xeth1', 'eth', 'in', '1000000000000000000')] },
      btc: { status: 'loaded', txs: [tx('btctx1', 'btc', 'out', '50000')] },
    });
    const mounted = await mountScreen();
    try {
      const pill = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.textContent === 'ETH',
      );
      expect(pill).toBeDefined();
      await act(async () => {
        pill?.click();
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
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unavailable note and a retry for a failed chain', async () => {
    setWallet({
      ...perChainEmpty(),
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

  it('shows the empty state when no transaction history is available', async () => {
    vi.mocked(availableFor).mockReturnValue([]);
    setWallet(perChainEmpty());
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain("Transaction history isn't available for this network yet.");
    } finally {
      await mounted.cleanup();
    }
  });
});
