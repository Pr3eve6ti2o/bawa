// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { AssetListScreen } from './asset-list';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { BalanceState } from '../state/wallet-context';

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
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
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
      // balance value: each row shows it, labelled "per <symbol>".
      // No portfolio total exists on this screen, so none may be
      // fabricated — never $0.00 standing in for a total.
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).toContain('per BTC');
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
      // unavailable) shows the per-unit price instead.
      await waitForText(mounted, '$1,774.93');
      expect(mounted.div.textContent).toContain('2.5 BTC');
      // Non-zero balances keep their fiat total: 2.5 BTC at $62,683.
      expect(mounted.div.textContent).toContain('$156,707.50');
      expect(mounted.div.textContent).toContain('per ETH');
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
});
