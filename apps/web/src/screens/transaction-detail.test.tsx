// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TransactionDetailScreen } from './transaction-detail';
import { useWallet } from '../state/wallet-context';
import { chainConfig } from '../wallet/chains';
import type { HistoryState } from '../state/wallet-context';

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

const emptyHistory: HistoryState = { status: 'empty', txs: [] };

function setWallet(
  history: Record<ChainKey, HistoryState>,
  refreshHistory: () => Promise<void> = () => Promise.resolve(),
): void {
  vi.mocked(useWallet).mockReturnValue({
    history,
    refreshHistory,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountScreen(path: string) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/transactions/:id" element={<TransactionDetailScreen />} />
        </Routes>
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
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
  );
});

describe('transaction detail screen', () => {
  it('shows the transaction found in loaded history', async () => {
    setWallet({
      btc: emptyHistory,
      eth: {
        status: 'loaded',
        txs: [
          {
            hash: '0xabc',
            chain: 'eth',
            networkId: 'eip155:1',
            direction: 'out',
            amountBaseUnits: '250000000000000000',
            counterparty: '0xRecipient',
            timestamp: 1700000000000,
            status: 'confirmed',
            explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
          },
        ],
      },
      trx: emptyHistory,
      ton: emptyHistory,
      sol: { status: 'empty', txs: [] },
      bsc: { status: 'empty', txs: [] },
      matic: { status: 'empty', txs: [] },
      arb: { status: 'empty', txs: [] },
      op: { status: 'empty', txs: [] },
      base: { status: 'empty', txs: [] },
      avax: { status: 'empty', txs: [] },
      ltc: { status: 'empty', txs: [] },
      doge: { status: 'empty', txs: [] },
    });
    const mounted = await mountScreen('/transactions/0xabc');
    try {
      expect(mounted.div.textContent).toContain('Ethereum mainnet');
      expect(mounted.div.textContent).toContain('Sent');
      expect(mounted.div.textContent).toContain('0.25 ETH');
      expect(mounted.div.textContent).toContain('0xRecipient');
      const explorerLink = mounted.div.querySelector(
        'a[href="https://eth.blockscout.com/tx/0xabc"]',
      );
      expect(explorerLink).not.toBeNull();
      expect(explorerLink?.textContent).toContain('View on explorer');
      expect(mounted.div.textContent).toContain('confirmed as reported by the network');
      expect(mounted.div.textContent).toContain('Checked at');
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports a hash that is not in the loaded history', async () => {
    setWallet({
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
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      expect(mounted.div.textContent).toContain('not in the loaded history');
      expect(mounted.div.textContent).toContain('0xmissing');
      expect(mounted.div.textContent).toContain('Its status is unknown');
      expect(mounted.div.textContent).toContain('Checked at');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a refresh-failed banner when the network refresh fails', async () => {
    setWallet(
      {
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
      },
      () => Promise.reject(new Error('network down')),
    );
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      expect(mounted.div.textContent).toContain('History could not be refreshed');
      expect(mounted.div.textContent).toContain('Checked at');
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays the detail out in two columns on desktop widths', async () => {
    // Follow-up: the v2 wider cap (672 -> 768px) was invisible, so the
    // detail now lays out in two columns at lg. Below lg it stays a
    // single max-w-2xl column, so the mobile layout is untouched.
    setWallet({
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
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      const main = mounted.div.querySelector('main');
      expect(main?.className).toContain('max-w-2xl');
      expect(main?.className).toContain('lg:max-w-none');
      expect(main?.className).not.toContain('lg:max-w-3xl');
      const section = mounted.div.querySelector('section');
      expect(section?.className).toContain('lg:grid');
      expect(section?.className).toContain('lg:grid-cols-2');
    } finally {
      await mounted.cleanup();
    }
  });

  it('splits a found transaction into two detail columns on desktop widths', async () => {
    setWallet({
      btc: emptyHistory,
      eth: {
        status: 'loaded',
        txs: [
          {
            hash: '0xabc',
            chain: 'eth',
            networkId: 'eip155:1',
            direction: 'out',
            amountBaseUnits: '250000000000000000',
            counterparty: '0xRecipient',
            timestamp: 1700000000000,
            status: 'confirmed',
            explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
          },
        ],
      },
      trx: emptyHistory,
      ton: emptyHistory,
      sol: { status: 'empty', txs: [] },
      bsc: { status: 'empty', txs: [] },
      matic: { status: 'empty', txs: [] },
      arb: { status: 'empty', txs: [] },
      op: { status: 'empty', txs: [] },
      base: { status: 'empty', txs: [] },
      avax: { status: 'empty', txs: [] },
      ltc: { status: 'empty', txs: [] },
      doge: { status: 'empty', txs: [] },
    });
    const mounted = await mountScreen('/transactions/0xabc');
    try {
      const lists = mounted.div.querySelectorAll('dl');
      expect(lists.length).toBe(2);
      const wrapper = lists[0]?.parentElement;
      expect(wrapper?.className).toContain('lg:grid');
      expect(wrapper?.className).toContain('lg:grid-cols-2');
    } finally {
      await mounted.cleanup();
    }
  });
});
