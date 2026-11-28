// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { AssetListScreen } from './asset-list';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import type { BalanceState } from '../state/wallet-context';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', async (importOriginal) => {
  // P1 (Lane S1): the import graph loads the shared chain picker,
  // which reads SUPPORTED_CHAINS at module level — the mock must
  // carry the real module underneath the stubbed helpers.
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  const chainConfig = vi.fn();
  return {
    ...actual,
    availableFor: vi.fn(),
    chainConfig,
    // Merge fix (Lane 5 moved filterChains here from
    // chain-search-select): the mock must provide it, because this
    // screen's import graph loads the picker, which re-exports it.
    // Same rule as the real helper, driven by the mocked chainConfig.
    filterChains: (chains: readonly ChainId[], query: string): ChainId[] => {
      const needle = String(query).trim().toLowerCase();
      if (needle === '') return [...chains];
      return chains.filter((chain) => {
        const config = chainConfig(chain);
        return (
          config.displayName.toLowerCase().includes(needle) ||
          config.symbol.toLowerCase().includes(needle) ||
          chain.toLowerCase().includes(needle)
        );
      });
    },
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

function balancesFor(
  overrides: Partial<Record<ChainKey, BalanceState>>,
): Record<ChainKey, BalanceState> {
  const base: Record<ChainKey, BalanceState> = {
    btc: { status: 'unavailable', reason: 'no-adapter' },
    eth: { status: 'unavailable', reason: 'no-adapter' },
    trx: { status: 'unavailable', reason: 'no-adapter' },
    ton: { status: 'unavailable', reason: 'no-adapter' },
    sol: { status: 'unavailable', reason: 'no-adapter' },
    bsc: { status: 'unavailable', reason: 'no-adapter' },
    matic: { status: 'unavailable', reason: 'no-adapter' },
    arb: { status: 'unavailable', reason: 'no-adapter' },
    op: { status: 'unavailable', reason: 'no-adapter' },
    base: { status: 'unavailable', reason: 'no-adapter' },
    avax: { status: 'unavailable', reason: 'no-adapter' },
    gnosis: { status: 'unavailable', reason: 'no-adapter' },
    celo: { status: 'unavailable', reason: 'no-adapter' },
    linea: { status: 'unavailable', reason: 'no-adapter' },
    mantle: { status: 'unavailable', reason: 'no-adapter' },
    scroll: { status: 'unavailable', reason: 'no-adapter' },
    opbnb: { status: 'unavailable', reason: 'no-adapter' },
    metis: { status: 'unavailable', reason: 'no-adapter' },
    aurora: { status: 'unavailable', reason: 'no-adapter' },
    fantom: { status: 'unavailable', reason: 'no-adapter' },
    ltc: { status: 'unavailable', reason: 'no-adapter' },
    doge: { status: 'unavailable', reason: 'no-adapter' },
  };
  return { ...base, ...overrides };
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/assets']}>
        <AssetListScreen />
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

function stubPriceFetch(response: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  headers?: { get: (name: string) => string | null };
}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: response.ok,
      status: response.status,
      json: response.json ?? (async () => ({})),
      headers: response.headers ?? { get: () => null },
    })),
  );
}

function freshPayload(ageSeconds = 30): Record<string, { usd: number; last_updated_at: number }> {
  const lastUpdatedAt = Math.floor(Date.now() / 1000) - ageSeconds;
  return {
    bitcoin: { usd: 62683, last_updated_at: lastUpdatedAt },
    ethereum: { usd: 1774.93, last_updated_at: lastUpdatedAt },
    tron: { usd: 0.310229, last_updated_at: lastUpdatedAt },
    'the-open-network': { usd: 1.028, last_updated_at: lastUpdatedAt },
  };
}

// The screen auto-fetches on mount; poll until the expected text lands
// (or 5 s passes, leaving the following assertion to fail plainly).
async function waitForText(mounted: { div: HTMLDivElement }, text: string): Promise<void> {
  const started = Date.now();
  while (
    !(mounted.div.textContent ?? '').includes(text) &&
    Date.now() - started < 5000
  ) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // The price hook loads cached prices from localStorage; clear it so
  // each test starts from idle entries and its own stubbed fetch.
  window.localStorage.clear();
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainId) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
  );
  vi.mocked(useWallet).mockReturnValue({
    balances: balancesFor({}),
    refreshBalances: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useWallet>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('asset list screen', () => {
  it('shows unavailable balances with real unit prices, never a fabricated total', async () => {
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      expect(mounted.div.textContent).toContain('Balance unavailable');
      // The live market price per unit IS real public data, not a
      // balance value: each row shows it in the Price column (the
      // column header says Price, so no "per <symbol>" label —
      // P0-A, Lane D #49). No portfolio total exists on this screen,
      // so none may be fabricated — never $0.00 standing in for a total.
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).not.toContain('per BTC');
      expect(mounted.div.textContent).not.toContain('$0.00');
      expect(mounted.div.textContent).not.toContain('Demo figures');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a formatted native balance with its fiat total when available', async () => {
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'available', value: '250000000' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      // The BTC row shows its fiat total; the ETH row (balance
      // unavailable) shows the per-unit price instead — in the Price
      // column, without a "per <symbol>" label (P0-A, Lane D #49).
      await waitForText(mounted, '$1,774.93');
      expect(mounted.div.textContent).toContain('2.5 BTC');
      // Non-zero balances keep their fiat total: 2.5 BTC at $62,683.
      expect(mounted.div.textContent).toContain('$156,707.50');
      expect(mounted.div.textContent).not.toContain('per ETH');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Price error, never a fabricated price, when the feed is rate-limited', async () => {
    // No Retry-After header, so the hook's back-off is 1000 ms then
    // 2000 ms and the auto-fetch settles within the 4 s wait below.
    stubPriceFetch({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });
    const mounted = await mountScreen();
    try {
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 4_000));
      });
      expect(mounted.div.textContent).toContain('Price error');
      expect(mounted.div.textContent).not.toContain('$62,683.00');
      expect(mounted.div.textContent).not.toContain('$0.00');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the price source on zero-balance table rows, including a DexScreener fallback (Lane C)', async () => {
    // Lane C, Part 1: the fallback chain is only trustworthy if the
    // row says where its price came from. The table variant used to
    // render the source (model.detail) only under a fiat value, so a
    // zero-balance row showed "$0.02973 per FTM" with no source at
    // all — the DexScreener fallback was invisible on /assets.
    // (P0-A: the price now renders at 4 decimals, "$0.0297", and
    // without the "per FTM" label — the Price column header says it.)
    vi.mocked(availableFor).mockReturnValue(['btc', 'fantom']);
    // Explicit return type: the multi-branch stub literals otherwise
    // trip TS7023 on the inline `headers.get` (same as
    // prices.test.tsx's StubPriceResponse).
    type StubFetchResponse = {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
      headers: { get: (name: string) => string | null };
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string): Promise<StubFetchResponse> => {
        if (String(url).includes('api.coingecko.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => freshPayload(),
            headers: { get: () => null },
          };
        }
        if (String(url).includes('api.dexscreener.com')) {
          // WFTM top pair is BOO/WFTM (quote-side): priceUsd is
          // BOO's price, so the implied WFTM price is 0.02610/0.8779.
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                chainId: 'fantom',
                pairAddress: '0x1a3b5b202e1a6d2b9d5f4a3b2c1d0e9f8a7b6c5d',
                baseToken: {
                  address: '0x841FAD6EAe12c286d1Fd18d1d525DFfA6Ce6eBEB',
                  symbol: 'BOO',
                },
                quoteToken: {
                  address: '0x21be370d5312f44cB42ce377BC9b8a0cEF1A4C83',
                  symbol: 'WFTM',
                },
                priceNative: '0.8779',
                priceUsd: '0.02610',
                liquidity: { usd: 54000 },
              },
            ],
            headers: { get: () => null },
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => [],
          headers: { get: () => null },
        };
      }),
    );
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'zero', value: '0' },
        fantom: { status: 'zero', value: '0' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      await waitForText(mounted, '$0.0297');
      expect(mounted.div.textContent).toContain('CoinGecko');
      expect(mounted.div.textContent).toContain('DexScreener');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows no per-row Retry for a failed balance; the list Refresh re-fetches', async () => {
    // Lane J (MetaMask pattern: unavailable data is standardised in
    // the token list, with one list-level refresh — a per-row Retry on
    // a rate-limited provider only fails again, e.g. the Dogecoin row
    // on SoChain 429s with a CORS-blocked BlockCypher fallback). The
    // fetch layer already retries silently with backoff and keeps the
    // last good value; the row itself offers no dead button.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: mockRefreshBalances,
      vaultState: 'unlocked',
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      expect(mounted.div.textContent).toContain('Balance unavailable');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      const refresh = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Refresh balances',
      ) as HTMLButtonElement;
      expect(refresh).not.toBeUndefined();
      await act(async () => {
        refresh.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a list-level N balances failed — Retry for real failures', async () => {
    // P1 (Lane S4, P0-C follow-up): the deferred list-level retry —
    // one line naming how many balances failed, with a Retry that
    // re-fetches them. Only real fetch failures count: a chain with
    // no adapter is never a failure (its rows stay 'Balance
    // unavailable' with no retry, as in the test above).
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    const mockRefreshTokens = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        eth: { status: 'error', reason: 'timeout' },
        btc: { status: 'unavailable', reason: 'rate-limited' },
      }),
      tokenBalances: {
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'error',
          reason: 'timeout',
        },
      },
      refreshBalances: mockRefreshBalances,
      refreshTokenBalances: mockRefreshTokens,
      vaultState: 'unlocked',
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      expect(mounted.div.textContent).toContain('3 balances failed');
      const retry = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Retry',
      ) as HTMLButtonElement;
      expect(retry).not.toBeUndefined();
      await act(async () => {
        retry.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalled();
      expect(mockRefreshTokens).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a busy Refresh while the refetch is in flight', async () => {
    // Aceternity Stateful Button pattern (structure only): an async
    // action shows its loading state, then settles — no fake success,
    // the rows settle visibly when the refetch lands. The button is
    // disabled while busy so it cannot be double-clicked.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    let resolveRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    const mockRefreshBalances = vi.fn(() => refreshGate);
    const mockRefreshTokens = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: mockRefreshBalances,
      refreshTokenBalances: mockRefreshTokens,
      vaultState: 'unlocked',
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      const refresh = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Refresh balances',
      ) as HTMLButtonElement;
      expect(refresh).not.toBeUndefined();
      await act(async () => {
        refresh.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalled();
      const busy = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Refreshing…',
      ) as HTMLButtonElement;
      expect(busy).not.toBeUndefined();
      expect(busy.disabled).toBe(true);
      await act(async () => {
        resolveRefresh();
      });
      const done = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Refresh balances',
      ) as HTMLButtonElement;
      expect(done).not.toBeUndefined();
      expect(done.disabled).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, failed balances offer Unlock instead of a dead Retry', async () => {
    // While the vault is locked there is no derived address in state,
    // so a balance refetch can only fail again with no-address: the
    // per-row Retry must not be offered, and the page must point at
    // the unlock screen instead.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: mockRefreshBalances,
      vaultState: 'locked',
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      expect(mounted.div.textContent).toContain('Balance unavailable');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      expect(mockRefreshBalances).not.toHaveBeenCalled();
      const unlock = mounted.div.querySelector('a[href="/lock"]');
      expect(unlock).not.toBeNull();
      expect(unlock?.textContent).toContain('Unlock');
      expect(mounted.div.textContent).toContain('Locked. Unlock to see balances.');
      // The no-wallet empty state is strictly no-vault: a locked vault
      // never shows "No wallet yet".
      expect(mounted.div.textContent).not.toContain('No wallet yet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('with no vault and no address, the list is hidden and only the empty state shows', async () => {
    // P0-A (plan P0-5, Lane A F4): a wallet that does not exist is
    // not a wallet of zeros — the 43 rows of $0.00 are gone, not
    // bannered over. One headline, one line, two ways in (Create /
    // Import), and a link to the live prices. A locked vault keeps
    // its unavailable state and Unlock prompt (previous test); only
    // the no-vault state hides the list.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'unavailable', reason: 'no-address' },
        eth: { status: 'unavailable', reason: 'no-address' },
        trx: { status: 'unavailable', reason: 'no-address' },
        ton: { status: 'unavailable', reason: 'no-address' },
      }),
      refreshBalances: mockRefreshBalances,
      vaultState: 'no-vault',
      customTokens: [],
      tokenBalances: {},
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'Zero balances');
      expect(mounted.div.textContent).not.toContain('Balance unavailable');
      expect(mounted.div.textContent).not.toContain('Could not load balance');
      // Lane X (Lane D #44): the line is "Zero balances — no wallet yet."
      expect(mounted.div.textContent).toContain('Zero balances — no wallet yet.');
      // No rows at all — no $0.00 values, no per-unit prices, no
      // filter bar, no per-row Retry.
      expect(mounted.div.textContent).not.toContain('$0.00');
      expect(mounted.div.textContent).not.toContain('per BTC');
      expect(mounted.div.querySelectorAll('li')).toHaveLength(0);
      expect(mounted.div.querySelector('input[type="search"]')).toBeNull();
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      // The two ways in, plus the live prices.
      expect(mounted.div.querySelector('a[href="/create-wallet"]')?.textContent).toBe('Create a wallet');
      expect(mounted.div.querySelector('a[href="/import-wallet"]')?.textContent).toBe('Import a wallet');
      expect(mounted.div.querySelector('a[href="/assets/btc"]')?.textContent).toBe('See live prices');
    } finally {
      await mounted.cleanup();
    }
  });

  it('with no vault, shows the no-wallet empty state with Create, Import and live prices', async () => {
    // P0-A: RESEARCH.md §11 (Aceternity Empty States) — illustration
    // + one plain line + the two ways in (Create / Import) + a link
    // to the live prices. The rows are hidden, so the line no longer
    // says "these are zero balances".
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'unavailable', reason: 'no-address' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
      vaultState: 'no-vault',
      customTokens: [],
      tokenBalances: {},
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'Zero balances');
      // Lane X (Lane D #44): the line is "Zero balances — no wallet yet."
      expect(mounted.div.textContent).toContain(
        'Zero balances — no wallet yet.',
      );
      expect(mounted.div.querySelector('a[href="/create-wallet"]')?.textContent).toBe('Create a wallet');
      expect(mounted.div.querySelector('a[href="/import-wallet"]')?.textContent).toBe('Import a wallet');
      expect(mounted.div.querySelector('a[href="/assets/btc"]')?.textContent).toBe('See live prices');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the 24h change on the table rows', async () => {
    // P0-A (plan P0-2, Lane A F2): the movement the feed already
    // carries shows on the table's Price cell — no extra row height,
    // no new fetch. The sign carries it; the palette cap allows no
    // green/red class in the app.
    const lastUpdatedAt = Math.floor(Date.now() / 1000) - 30;
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => ({
        bitcoin: { usd: 62683, last_updated_at: lastUpdatedAt, usd_24h_change: 2.5 },
        ethereum: { usd: 1774.93, last_updated_at: lastUpdatedAt, usd_24h_change: -1 },
        tron: { usd: 0.310229, last_updated_at: lastUpdatedAt },
        'the-open-network': { usd: 1.028, last_updated_at: lastUpdatedAt },
      }),
    });
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      const rows = [...mounted.div.querySelectorAll('li')];
      const btc = rows.find((row) => row.textContent?.includes('Bitcoin'));
      expect(btc).not.toBeUndefined();
      expect(btc?.textContent).toContain('24h +2.50%');
      const eth = rows.find((row) => row.textContent?.includes('Ethereum'));
      expect(eth).not.toBeUndefined();
      expect(eth?.textContent).toContain('24h -1.00%');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows "0 BTC" with no "Zero balance" subline on zero table rows', async () => {
    // P0-A double-zero (Lane A asset-list audit, Lane D #49): one
    // balance line per row — "0 BTC" as the amount. Lane X drops the
    // "Zero balance" subline entirely (Lane D #49).
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'zero', value: '0' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
      vaultState: 'unlocked',
      customTokens: [],
      tokenBalances: {},
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      const rows = [...mounted.div.querySelectorAll('li')];
      const btc = rows.find((row) => row.textContent?.includes('Bitcoin'));
      expect(btc).not.toBeUndefined();
      expect(btc?.textContent).toContain('0 BTC');
      expect(btc?.textContent).not.toContain('Zero balance');
      expect(btc?.textContent).not.toContain('per BTC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the verified tick and short contract on token rows', async () => {
    // Token gaps, item 2: official tokens get a VERIFIED tick beside
    // them, with the short contract just below the token.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
      vaultState: 'unlocked',
      customTokens: [],
      tokenBalances: {
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'zero',
          value: '0',
        },
      },
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'USDC');
      expect(mounted.div.textContent).toContain('USDC');
      expect(mounted.div.querySelector('[aria-label="Verified token"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain('0xA0b8…eB48');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the full token name on token rows, never truncated (Lane 4)', async () => {
    // Owner report: the complete token name was not displayed on the
    // mobile homepage — rows showed only the symbol. The table variant
    // also ellipsised long names ("Ethere…"). The row title is the
    // full name and wraps instead of truncating; the symbol stays in
    // the subline with the chain and the short contract.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
      vaultState: 'unlocked',
      customTokens: [],
      tokenBalances: {
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'zero',
          value: '0',
        },
        'eth:0xdac17f958d2ee523a2206206994597c13d831ec7': {
          status: 'zero',
          value: '0',
        },
      },
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'USDC');
      const titles = [...mounted.div.querySelectorAll('span')].filter(
        (candidate) =>
          candidate.className.includes('text-base') &&
          candidate.className.includes('font-bold'),
      );
      const usdcTitle = titles.find((candidate) =>
        (candidate.textContent ?? '').includes('USD Coin'),
      );
      expect(usdcTitle).not.toBeUndefined();
      expect(usdcTitle?.className).not.toContain('truncate');
      const usdtTitle = titles.find((candidate) =>
        (candidate.textContent ?? '').includes('Tether USD'),
      );
      expect(usdtTitle).not.toBeUndefined();
      expect(usdtTitle?.className).not.toContain('truncate');
      expect(mounted.div.textContent).toContain('USDC · Ethereum · 0xA0b8…eB48');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Unverified on a user-added token row with no CoinGecko listing', async () => {
    // Lane 1: an unlisted token says Unverified on its row — and the
    // verified default beside it keeps its tick.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
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
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'zero',
          value: '0',
        },
        'eth:0x00000000000000000000000000000000000000a1': {
          status: 'zero',
          value: '0',
        },
      },
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'UNL');
      const row = [...mounted.div.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('UNL'),
      );
      expect(row?.textContent).toContain('Unverified');
      expect(row?.querySelector('[aria-label="Verified token"]')).toBeNull();
      const usdcRow = [...mounted.div.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('USDC'),
      );
      expect(usdcRow?.querySelector('[aria-label="Verified token"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the verified tick on a failed token row in the wide table', async () => {
    // Lane 1: the wide table's failed row had no mark at all — the
    // list variant already showed it. A default token that cannot
    // load still shows its tick.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
      vaultState: 'unlocked',
      customTokens: [],
      tokenBalances: {
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'unavailable',
          reason: 'no-adapter',
        },
      },
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'Balance unavailable');
      const row = [...mounted.div.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('USDC'),
      );
      expect(row?.textContent).toContain('USDC');
      expect(row?.querySelector('[aria-label="Verified token"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('links every asset row in every state in the wide table, so the row count never drops on a failed fetch', async () => {
    // Lane 2 (dashboard row count): the settled linked-row count varied
    // 41–43 live because failed rows rendered as a plain <li> with no
    // link — a Dogecoin 429 and a TRON USDT 429 left them unlinked.
    // Every main-list row is a link in every state now (ready, failed,
    // still loading), in the table variant as on the dashboard, so the
    // count is the full list whatever the network does. The mock's 4
    // balance chains + the 9 default tokens on them = 13 rows; the
    // default mock leaves every native failed and every token loading.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({}),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
      vaultState: 'unlocked',
      customTokens: [],
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, 'Balance unavailable');
      const links = [...mounted.div.querySelectorAll('ul.divide-y a[href^="/assets/"]')];
      expect(links).toHaveLength(13);
      // The failed row links to its detail page (which shows the same
      // honest failure), and a still-loading token row links too.
      expect(mounted.div.querySelector('a[href="/assets/btc"]')).not.toBeNull();
      expect(mounted.div.querySelector('a[href="/assets/eth/usdc"]')).not.toBeNull();
      expect(mounted.div.querySelector('a[href="/assets/eth/weth"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('filters the list by search text and offers to clear a no-match search', async () => {
    // Lane 2: 43 rows are unscannable without a filter — the filter
    // bar's search narrows by name, symbol or chain, and a search
    // that matches nothing says so with one way out.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'zero', value: '0' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Ethereum');
      const search = mounted.div.querySelector(
        'input[aria-label="Search assets"]',
      ) as HTMLInputElement | null;
      expect(search).not.toBeNull();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(search, 'bit');
        search?.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).not.toContain('Ethereum');
      // A search that matches nothing is an honest empty state, not
      // a blank list — with one clear action.
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(search, 'zzz');
        search?.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(mounted.div.textContent).toContain('No assets match “zzz”');
      const clear = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Show all assets',
      ) as HTMLButtonElement | undefined;
      expect(clear).not.toBeUndefined();
      await act(async () => {
        clear?.click();
      });
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Ethereum');
    } finally {
      await mounted.cleanup();
    }
  });

  // TEST-DATA-007 (rule: search covers name, symbol, chain id and the
  // whole contract address across chains and tokens, with a real match
  // count; a pasted contract finds its token even while its row is
  // still loading).
  it('finds a token by full contract address and a chain by id, with a match count', async () => {
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '$62,683.00');
      const search = mounted.div.querySelector(
        'input[aria-label="Search assets"]',
      ) as HTMLInputElement | null;
      expect(search).not.toBeNull();
      const type = async (value: string) => {
        await act(async () => {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          setter?.call(search, value);
          search?.dispatchEvent(new Event('input', { bubbles: true }));
        });
      };
      await type('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
      expect(mounted.div.textContent).toContain('USD Coin');
      expect(mounted.div.textContent).not.toContain('Bitcoin');
      expect(mounted.div.textContent).toMatch(/1 of \d+ assets match/);
      expect(mounted.div.textContent).toContain(
        'Searching name, symbol, chain or contract address.',
      );
      await type('trx');
      expect(mounted.div.textContent).toContain('TRON');
      expect(mounted.div.textContent).not.toContain('Bitcoin');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the per-chain allocation for a watched wallet with no vault of its own', async () => {
    // Watch-only display programme: in the watch-only-only state the
    // main rows already ARE the watched wallet, so the allocation
    // reads the main balances — before this fix the allocation only
    // rendered inside the watch section, which is empty without a
    // vault, and the watched wallet had no allocation view at all.
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    vi.mocked(useWallet).mockReturnValue({
      vaultState: 'no-vault',
      addresses: {
        eth: [{ address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' }],
      },
      balances: balancesFor({
        eth: { status: 'available', value: '1000000000000000000' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      await waitForText(mounted, '100.0%');
      expect(
        mounted.div.querySelector('[aria-label="Allocation by chain"]'),
      ).not.toBeNull();
      expect(mounted.div.textContent).toContain('Watch-only');
      expect(mounted.div.textContent).toContain('Ethereum');
      expect(mounted.div.textContent).toContain('$1,774.93');
    } finally {
      await mounted.cleanup();
    }
  });
});
