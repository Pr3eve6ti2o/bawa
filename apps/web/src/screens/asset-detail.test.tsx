// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AssetDetailScreen } from './asset-detail';
import { useWallet } from '../state/wallet-context';
import { chainConfig } from '../wallet/chains';
import type { BalanceState, HistoryState } from '../state/wallet-context';

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
} as const;

type ChainKey = keyof typeof CHAINS;

function perChain<T>(value: T): Record<ChainKey, T> {
  return { btc: value, eth: value, trx: value, ton: value };
}

function setWallet(
  balances: Record<ChainKey, BalanceState>,
  history: Record<ChainKey, HistoryState>,
): void {
  vi.mocked(useWallet).mockReturnValue({
    xpubs: {
      eth: { xpub: 'xpub6TestWallet1234567890abcdef' },
      btc: null,
      trx: null,
      ton: null,
    },
    addresses: perChain([{ index: 0, address: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7' }]),
    uiState: perChain('loaded'),
    errors: perChain(null),
    balances,
    history,
    refreshChain: vi.fn(),
    refreshBalances: vi.fn(),
    refreshHistory: vi.fn(),
    setSelectedChain: vi.fn(),
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
          <Route path="/assets/:chain" element={<AssetDetailScreen />} />
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

const emptyHistory: HistoryState = { status: 'empty', txs: [] };

describe('asset detail screen', () => {
  it('shows the real balance and the top transactions', async () => {
    vi.mocked(useWallet).mockReturnValue({
      xpubs: {
        eth: { xpub: 'xpub6TestWallet1234567890abcdef' },
        btc: null,
        trx: null,
        ton: null,
      },
      addresses: perChain([{ index: 0, address: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7' }]),
      uiState: perChain('loaded'),
      errors: perChain(null),
      balances: {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1500000000000000000' },
      },
      history: {
        ...perChain(emptyHistory),
        eth: {
          status: 'loaded',
          txs: [
            {
              hash: '0xabc',
              chain: 'eth',
              networkId: 'eip155:1',
              direction: 'in',
              amountBaseUnits: '1000000000000000000',
              counterparty: '0xSender',
              timestamp: 1700000000000,
              status: 'confirmed',
              explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
            },
          ],
        },
      },
      refreshChain: vi.fn(),
      refreshBalances: vi.fn(),
      refreshHistory: vi.fn(),
      setSelectedChain: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('1.5 ETH');
      expect(mounted.div.textContent).toContain('Received');
      expect(mounted.div.textContent).toContain('0xabc');
      expect(mounted.div.textContent).not.toContain('Demo balance');
      expect(mounted.div.textContent).not.toContain('$12,480');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows an exact zero balance and the empty history state', async () => {
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        btc: { status: 'zero', value: '0' },
      },
      perChain(emptyHistory),
    );
    const mounted = await mountScreen('/assets/btc');
    try {
      expect(mounted.div.textContent).toContain('0 BTC');
      expect(mounted.div.textContent).toContain('Zero balance');
      expect(mounted.div.textContent).toContain('No transactions yet for this chain.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows unavailable, never zero, on a failed balance fetch', async () => {
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'error', reason: 'boom' },
      },
      perChain(emptyHistory),
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('Balance unavailable');
      expect(mounted.div.textContent).toContain('boom');
      expect(mounted.div.textContent).not.toContain('1.5 ETH');
    } finally {
      await mounted.cleanup();
    }
  });
});
