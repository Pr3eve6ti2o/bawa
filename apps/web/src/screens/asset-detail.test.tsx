// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AssetDetailScreen } from './asset-detail';
import { useWallet } from '../state/wallet-context';
import { usePrices } from '../wallet/prices';
import { chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import type { BalanceState, HistoryState } from '../state/wallet-context';

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
  useWallet: vi.fn(),
}));

vi.mock('../wallet/prices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../wallet/prices')>()),
  usePrices: vi.fn(),
}));

vi.mock('../wallet/token-prices', () => ({
  // Lane 1: the token price feed is stubbed idle — the detail tests
  // assert the header, never a live price, and the token route must
  // not fire real network calls from the test.
  useTokenPrices: () => ({
    state: { status: 'idle', entries: {} },
    refresh: vi.fn(),
  }),
}));

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
}));

// Lane 4 (UX-major, data): the lazy chart is stubbed here so the
// detail tests never fire a live CoinGecko market-chart fetch; the
// chart's own states are covered by price-chart.test.tsx
// (TEST-DATA-006).
vi.mock('./price-chart', () => ({
  PriceChart: () => null,
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

function perChain<T>(value: T): Record<ChainKey, T> {
  return { btc: value, eth: value, trx: value, ton: value, sol: value, bsc: value, matic: value, arb: value, op: value, base: value, avax: value, gnosis: value, celo: value, linea: value, mantle: value, scroll: value, opbnb: value, metis: value, aurora: value, fantom: value, ltc: value, doge: value };
}

const unavailablePrices = perChain({ status: 'unavailable', reason: 'missing' } as const);

function setPrices(
  entries: Record<ChainKey, unknown>,
): void {
  vi.mocked(usePrices).mockReturnValue({
    state: { status: 'ready', entries, lastFetchedAtMs: Date.now() },
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof usePrices>);
}

function setWallet(
  balances: Record<ChainKey, BalanceState>,
  history: Record<ChainKey, HistoryState>,
  overrides?: {
    vaultAddresses?: Record<ChainKey, string[]>;
    addresses?: Record<ChainKey, { index: number; address: string }[]>;
    uiState?: Record<ChainKey, string>;
    xpubs?: Record<string, { xpub: string } | null>;
    vaultState?: 'locked' | 'unlocked' | 'no-vault';
    refreshChain?: () => Promise<void>;
    refreshBalances?: () => Promise<void>;
    refreshHistory?: () => Promise<void>;
  },
): void {
  vi.mocked(useWallet).mockReturnValue({
    xpubs: overrides?.xpubs ?? {
      eth: { xpub: 'xpub6TestWallet1234567890abcdef' },
      btc: null,
      trx: null,
      ton: null,
    },
    addresses: overrides?.addresses ?? perChain([{ index: 0, address: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7' }]),
    vaultAddresses: overrides?.vaultAddresses ?? perChain([] as string[]),
    vaultState: overrides?.vaultState ?? 'unlocked',
    hydrating: false,
    uiState: (overrides?.uiState ?? perChain('loaded')) as unknown as Record<ChainKey, never>,
    errors: perChain(null),
    balances,
    history,
    refreshChain: overrides?.refreshChain ?? vi.fn(async () => {}),
    refreshBalances: overrides?.refreshBalances ?? vi.fn(async () => {}),
    refreshHistory: overrides?.refreshHistory ?? vi.fn(async () => {}),
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
          <Route path="/assets/:chain/:token" element={<AssetDetailScreen />} />
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
    (chain: ChainId) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
  );
  setPrices(unavailablePrices);
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
      vaultAddresses: perChain([] as string[]),
      hydrating: false,
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
      refreshChain: vi.fn(async () => {}),
      refreshBalances: vi.fn(async () => {}),
      refreshHistory: vi.fn(async () => {}),
      setSelectedChain: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
    // Live per-unit price for ETH: the Details block shows it, never invented.
    setPrices({
      ...unavailablePrices,
      eth: {
        status: 'fresh',
        quote: {
          chain: 'eth',
          assetId: 'eip155:1/slip44:60',
          providerAssetId: 'ethereum',
          usdPrice: '2000',
          providerUpdatedAtMs: Date.now(),
          fetchedAtMs: Date.now(),
          source: 'CoinGecko',
        },
      },
    });
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('1.5 ETH');
      expect(mounted.div.textContent).toContain('Received');
      // Lane 2: the row shows the counterparty, not the hash — the
      // hash lives one tap away on the detail screen, via this link.
      expect(
        mounted.div.querySelector('a[href="/transactions/0xabc"]'),
      ).not.toBeNull();
      expect(mounted.div.textContent).not.toContain('Demo balance');
      // The live per-unit price renders in the Details block.
      expect(mounted.div.textContent).toContain('$2,000.00');
      expect(mounted.div.textContent).toContain('per ETH');
      // Lane 2: the hero shows the holding's fiat value (1.5 ETH at
      // $2,000), not just the native amount — the same live feed as
      // the rows, so the number cannot disagree with the list.
      expect(mounted.div.textContent).toContain('$3,000.00');
      // Lane 2: the Details card carries the receiving address with
      // a copy button, and the history block links to the full list.
      expect(mounted.div.querySelector('button[aria-label="Copy address"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain('View all transactions');
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
      // Lane 2: a genuine zero is worth $0.00 in the hero too.
      expect(mounted.div.textContent).toContain('$0.00');
      expect(mounted.div.textContent).toContain('No transactions yet for this chain.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a spaced zero TON heading and a Send button for TON', async () => {
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        ton: { status: 'zero', value: '0' },
      },
      perChain(emptyHistory),
    );
    const mounted = await mountScreen('/assets/ton');
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('0 TON');
      expect(text).not.toContain('0TON');
      expect(text).not.toContain('0BTC');
      const send = mounted.div.querySelector('a[href="/send"]');
      expect(send).not.toBeNull();
      expect(send?.textContent).toContain('Send');
      const receive = mounted.div.querySelector('a[href="/receive"]');
      expect(receive).not.toBeNull();
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
      // Machine-readable reasons never reach the UI: no raw code, only
      // the human sentence.
      expect(mounted.div.textContent).not.toContain('boom');
      expect(mounted.div.textContent).toContain('Please try again later.');
      expect(mounted.div.textContent).not.toContain('1.5 ETH');
    } finally {
      await mounted.cleanup();
    }
  });

  it('never shows the raw history reason', async () => {
    // The ETH failure keeps its block (and its Retry) only because the
    // chain has a retained transaction: a failed fetch with no known
    // activity reads as the empty state instead.
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1500000000000000000' },
      },
      {
        ...perChain(emptyHistory),
        eth: {
          status: 'error',
          reason: 'no-adapter',
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
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('Could not load transactions.');
      expect(mounted.div.textContent).not.toContain('no-adapter');
      expect(mounted.div.textContent).toContain(
        'Transaction history is not connected for this chain yet.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a vault address instead of "No wallet imported"', async () => {
    setWallet(
      perChain({ status: 'unavailable', reason: 'no-adapter' }),
      perChain(emptyHistory),
      {
        vaultAddresses: {
          ...perChain([] as string[]),
          eth: ['0x27Ef5cDBe01777D62438AfFeb695e33fC2335979'],
        },
        addresses: perChain([] as { index: number; address: string }[]),
        uiState: perChain('empty'),
        xpubs: { eth: null, btc: null, trx: null, ton: null },
      },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).not.toContain('No wallet imported for this chain');
      expect(mounted.div.textContent).toContain('0x27Ef5cDBe01777D62438AfFeb695e33fC2335979');
      expect(mounted.div.textContent).toContain('Vault address');
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, an unavailable balance offers Unlock instead of a dead Retry', async () => {
    // While the vault is locked there is no derived address in state,
    // so a balance refetch can only fail again with no-address.
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'error', reason: 'no-address' },
      },
      perChain(emptyHistory),
      { vaultState: 'locked' },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('Balance unavailable');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      expect(mounted.div.textContent).toContain('Locked. Unlock to see balances.');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('retries an unavailable balance while unlocked', async () => {
    const mockRefreshBalances = vi.fn(async () => {});
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'error', reason: 'rpc-error' },
      },
      perChain(emptyHistory),
      { vaultState: 'unlocked', refreshBalances: mockRefreshBalances },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      // The mount effect already called refreshBalances once; clear it
      // so the click below is the only call counted.
      mockRefreshBalances.mockClear();
      const retry = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Retry',
      ) as HTMLButtonElement;
      expect(retry).not.toBeUndefined();
      await act(async () => {
        retry.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('while unlocked, a no-adapter balance shows no Retry', async () => {
    // Lane C (C-5): a chain with no balance adapter can never succeed
    // on refresh, so the balance section shows "Balance unavailable"
    // with no Retry — the same as the dashboard rows.
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'unavailable', reason: 'no-adapter' },
      },
      perChain(emptyHistory),
      { vaultState: 'unlocked' },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('Balance unavailable');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, unavailable history offers Unlock instead of a dead Retry', async () => {
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1500000000000000000' },
      },
      {
        ...perChain(emptyHistory),
        eth: { status: 'error', reason: 'no-address', txs: [] },
      },
      { vaultState: 'locked' },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('Could not load transactions.');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      expect(mounted.div.textContent).toContain('Locked. Unlock to see activity.');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, the sticky Refresh is replaced by Unlock', async () => {
    // Same class as the dead Retry: while the vault is locked there is no
    // derived address in state, so refreshAll can only fail again with
    // no-address. The sticky bar must offer Unlock instead of Refresh.
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'error', reason: 'no-address' },
      },
      perChain(emptyHistory),
      { vaultState: 'locked' },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      const refreshButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Refresh',
      );
      expect(refreshButtons).toHaveLength(0);
      const sticky = mounted.div.querySelector('.sticky');
      expect(sticky).not.toBeNull();
      expect(sticky?.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('while unlocked, the sticky Refresh calls refreshAll', async () => {
    const mockRefreshChain = vi.fn(async () => {});
    const mockRefreshBalances = vi.fn(async () => {});
    const mockRefreshHistory = vi.fn(async () => {});
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1500000000000000000' },
      },
      perChain(emptyHistory),
      {
        vaultState: 'unlocked',
        refreshChain: mockRefreshChain,
        refreshBalances: mockRefreshBalances,
        refreshHistory: mockRefreshHistory,
      },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      // The mount effect already called all three once; clear it so the
      // click below is the only call counted.
      mockRefreshChain.mockClear();
      mockRefreshBalances.mockClear();
      mockRefreshHistory.mockClear();
      const refresh = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Refresh',
      ) as HTMLButtonElement;
      expect(refresh).not.toBeUndefined();
      await act(async () => {
        refresh.click();
      });
      expect(mockRefreshChain).toHaveBeenCalledTimes(1);
      expect(mockRefreshBalances).toHaveBeenCalledTimes(1);
      expect(mockRefreshHistory).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps the sticky Refresh when there is no vault', async () => {
    // Watch-only xpubs can still load with no vault, so Refresh stays.
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1500000000000000000' },
      },
      perChain(emptyHistory),
      { vaultState: 'no-vault' },
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      const refreshButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Refresh',
      );
      expect(refreshButtons).toHaveLength(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the verified tick on a token detail header', async () => {
    // Lane 1: the token detail header carries the mark — USDC is a
    // curated default, so it reads Verified (Badge).
    vi.mocked(useWallet).mockReturnValue({
      xpubs: { eth: { xpub: 'xpub6TestWallet1234567890abcdef' } },
      addresses: perChain([{ index: 0, address: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7' }]),
      vaultAddresses: perChain([] as string[]),
      hydrating: false,
      uiState: perChain('loaded'),
      errors: perChain(null),
      balances: perChain({ status: 'unavailable', reason: 'no-adapter' }),
      history: perChain(emptyHistory),
      vaultState: 'unlocked',
      customTokens: [],
      tokenBalances: {
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'zero',
          value: '0',
        },
      },
      refreshTokenBalances: vi.fn(async () => {}),
      refreshChain: vi.fn(async () => {}),
      refreshBalances: vi.fn(async () => {}),
      refreshHistory: vi.fn(async () => {}),
      setSelectedChain: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen('/assets/eth/usdc');
    try {
      const heading = mounted.div.querySelector('h1');
      expect(heading?.textContent).toContain('USDC');
      expect(heading?.querySelector('[aria-label="Verified token"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Unverified on an unlisted token detail header', async () => {
    // Lane 1: a user-added token with no CoinGecko listing says
    // Unverified on its detail header.
    vi.mocked(useWallet).mockReturnValue({
      xpubs: { eth: { xpub: 'xpub6TestWallet1234567890abcdef' } },
      addresses: perChain([{ index: 0, address: '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7' }]),
      vaultAddresses: perChain([] as string[]),
      hydrating: false,
      uiState: perChain('loaded'),
      errors: perChain(null),
      balances: perChain({ status: 'unavailable', reason: 'no-adapter' }),
      history: perChain(emptyHistory),
      vaultState: 'unlocked',
      customTokens: [
        {
          chain: 'eth',
          contract: '0x00000000000000000000000000000000000000A1',
          name: 'Unlisted Token',
          symbol: 'UNL',
          decimals: 18,
          coingeckoId: null,
          addedAtMs: 1,
        },
      ],
      tokenBalances: {
        'eth:0x00000000000000000000000000000000000000a1': {
          status: 'zero',
          value: '0',
        },
      },
      refreshTokenBalances: vi.fn(async () => {}),
      refreshChain: vi.fn(async () => {}),
      refreshBalances: vi.fn(async () => {}),
      refreshHistory: vi.fn(async () => {}),
      setSelectedChain: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen(
      '/assets/eth/0x00000000000000000000000000000000000000a1',
    );
    try {
      const heading = mounted.div.querySelector('h1');
      expect(heading?.textContent).toContain('UNL');
      expect(heading?.textContent).toContain('Unverified');
      expect(heading?.querySelector('[aria-label="Verified token"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  // TEST-DATA-009 (rule: the 24 h movement shows next to the holding
  // when the feed sent one, and is omitted — never 0.00% — when it
  // did not).
  it('shows the 24h movement when the feed sent one, and omits it otherwise', async () => {
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1000000000000000000' },
      },
      perChain(emptyHistory),
    );
    setPrices({
      ...unavailablePrices,
      eth: {
        status: 'fresh',
        quote: {
          chain: 'eth',
          assetId: 'eip155:1/slip44:60',
          providerAssetId: 'ethereum',
          usdPrice: '2000',
          providerUpdatedAtMs: Date.now(),
          fetchedAtMs: Date.now(),
          source: 'CoinGecko',
          change24hPct: 2.5,
        },
      },
    });
    const mounted = await mountScreen('/assets/eth');
    try {
      expect(mounted.div.textContent).toContain('24h +2.50% · CoinGecko');
    } finally {
      await mounted.cleanup();
    }
    setPrices({
      ...unavailablePrices,
      eth: {
        status: 'fresh',
        quote: {
          chain: 'eth',
          assetId: 'eip155:1/slip44:60',
          providerAssetId: 'ethereum',
          usdPrice: '2000',
          providerUpdatedAtMs: Date.now(),
          fetchedAtMs: Date.now(),
          source: 'CoinGecko',
        },
      },
    });
    const mountedWithout = await mountScreen('/assets/eth');
    try {
      expect(mountedWithout.div.textContent).not.toContain('24h');
      expect(mountedWithout.div.textContent).not.toContain('0.00%');
    } finally {
      await mountedWithout.cleanup();
    }
  });

  it('lays Details and activity beside addresses on desktop widths', async () => {
    // Desktop layout (desktop-layout-v2): below the sticky actions,
    // Details + Recent transactions sit in the left column and Derived
    // addresses + the import source in the right one — an lg
    // two-column grid. Below lg the same sections stack in one column
    // (space-y-6, no bare grid/grid-cols-2), so the mobile layout is
    // untouched. The sticky bar itself is not part of the grid: it stays
    // full-width above it.
    setWallet(
      {
        ...perChain({ status: 'unavailable', reason: 'no-adapter' }),
        eth: { status: 'available', value: '1500000000000000000' },
      },
      {
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
    );
    const mounted = await mountScreen('/assets/eth');
    try {
      const details = mounted.div.querySelector('#asset-details-heading');
      expect(details).not.toBeNull();
      const grid = details?.closest('section')?.parentElement
        ?.parentElement as Element | null;
      expect(grid?.className).toContain('lg:grid');
      expect(grid?.className).toContain('lg:grid-cols-2');
      // Mobile stacking is preserved: the wrapper is still a vertical
      // stack below lg, with no unprefixed grid class.
      expect(grid?.className).toContain('space-y-6');
      expect(grid?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
      expect(grid?.className).not.toMatch(/(^|\s)grid(\s|$)/);
      // The sticky actions bar sits outside the grid, above it.
      const sticky = mounted.div.querySelector('.sticky');
      expect(sticky).not.toBeNull();
      expect(grid?.contains(sticky)).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });
});
