// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { DashboardScreen } from './dashboard';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { BalanceState } from '../state/wallet-context';

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
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

const mockRefreshBalances = vi.fn();

function setWallet(balances: Record<ChainKey, BalanceState>, extra: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    balances,
    refreshBalances: mockRefreshBalances,
    vaultState: 'unlocked',
    ...extra,
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
      <MemoryRouter initialEntries={['/']}>
        <DashboardScreen />
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
  mockRefreshBalances.mockResolvedValue(undefined);
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
  );
});

describe('dashboard screen', () => {
  // The dashboard fetches prices on mount now, so every test stubs the
  // price feed with fresh prices by default — no test ever hits the real
  // CoinGecko API. Tests that need a different feed re-stub it themselves.
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = stubPriceFetch({ ok: true, status: 200, json: async () => freshPayload() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows skeletons while balances load', async () => {
    setWallet(balancesFor({ btc: { status: 'loading' } }));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('[role="status"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Loading Bitcoin balance');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows an exact zero and hides it behind the toggle', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'available', value: '1500000000000000000' },
      }),
    );
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Zero balance');
      expect(mounted.div.textContent).toContain('1.5 ETH');
      const toggle = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Hide zero balances',
      ) as HTMLButtonElement;
      expect(toggle).not.toBeUndefined();
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      await act(async () => {
        toggle.click();
      });
      const toggleAfter = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Hide zero balances',
      ) as HTMLButtonElement;
      expect(toggleAfter.getAttribute('aria-pressed')).toBe('true');
      expect(mounted.div.textContent).not.toContain('Zero balance');
      expect(mounted.div.textContent).toContain('1.5 ETH');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows unavailable, never zero, on a failed fetch', async () => {
    setWallet(balancesFor({ btc: { status: 'error', reason: 'boom' } }));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Could not load balance');
      expect(mounted.div.textContent).not.toContain('0 BTC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the empty state when no balances are available', async () => {
    vi.mocked(availableFor).mockReturnValue([]);
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain("Balances aren't available yet.");
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows no onboarding banner when there is no vault', async () => {
    // Lane C (spec §5): the locked/no-vault banners were removed from the
    // dashboard — onboarding lives on the Welcome screen now.
    setWallet(balancesFor({}), { vaultState: 'no-vault' });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).not.toContain('No wallet yet');
      expect(mounted.div.textContent).not.toContain('Create wallet');
      expect(mounted.div.textContent).not.toContain('Vault locked');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows real unit prices on failed balances without fabricating a total', async () => {
    window.localStorage.clear();
    setWallet(balancesFor({}));
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      // Failed balances must not be blamed on the price feed and no
      // fiat total may be fabricated: the hero stays Unavailable.
      expect(mounted.div.textContent).toContain('Unavailable');
      expect(mounted.div.textContent).not.toContain('No prices loaded yet');
      expect(mounted.div.textContent).not.toContain('No fresh prices');
      expect(mounted.div.textContent).not.toContain('$0.00');
      // But the live market price per unit IS real public data, not a
      // balance value: each row shows it, labelled "per <symbol>".
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).toContain('per BTC');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('fetches prices on mount without waiting for the Refresh button', async () => {
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toContain('api.coingecko.com');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows the real unit price on a zero balance, never a silent empty', async () => {
    window.localStorage.clear();
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'zero', value: '0' },
        trx: { status: 'zero', value: '0' },
        ton: { status: 'zero', value: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      // The portfolio total is honestly $0.00 (every balance is zero),
      // but each row still shows the live market price per unit.
      expect(mounted.div.textContent).toContain('$0.00');
      expect(mounted.div.textContent).toContain('Zero balance');
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).toContain('per BTC');
      expect(mounted.div.textContent).toContain('$1,774.93');
      expect(mounted.div.textContent).toContain('per ETH');
      expect(mounted.div.textContent).toContain('Updated just now');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows Price error on zero balances when the feed is rate-limited', async () => {
    window.localStorage.clear();
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'zero', value: '0' },
        trx: { status: 'zero', value: '0' },
        ton: { status: 'zero', value: '0' },
      }),
    );
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
      expect(mounted.div.textContent).toContain('$0.00');
      expect(mounted.div.textContent).not.toContain('$62,683.00');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  function stubPriceFetch(response: {
    ok: boolean;
    status: number;
    json?: () => Promise<unknown>;
    headers?: { get: (name: string) => string | null };
  }): ReturnType<typeof vi.fn> {
    const mock = vi.fn(async () => ({
      ok: response.ok,
      status: response.status,
      json: response.json ?? (async () => ({})),
      headers: response.headers ?? { get: () => null },
    }));
    vi.stubGlobal('fetch', mock);
    return mock;
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
  async function clickRefreshPrices(mounted: { div: HTMLDivElement }): Promise<void> {
    const button = [...mounted.div.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'Refresh prices',
    ) as HTMLButtonElement;
    expect(button).not.toBeUndefined();
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  // The hero total element (the big display figure), so a test can assert
  // on the hero alone without the asset rows' fiat values interfering.
  function heroAmount(mounted: { div: HTMLDivElement }): string | null {
    return mounted.div.querySelector('.text-display-lg')?.textContent ?? null;
  }

  it('shows the live portfolio total with source and freshness after refreshing prices', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).toContain('Powered by CoinGecko');
      expect(mounted.div.textContent).toContain('Updated just now');
      expect(mounted.div.textContent).toContain('· CoinGecko');
      expect(mounted.div.textContent).not.toContain('(Partial)');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows a Partial total when one balance has failed', async () => {
    // Phase 3, Lane H: one chain's failure no longer blanks the hero —
    // the loaded chains sum to a partial total and only the failed row
    // is marked Unavailable.
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'error', reason: 'rpc-error' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('$62,683.00 (Partial)');
      expect(mounted.div.textContent).toContain('Partial total');
      expect(mounted.div.textContent).toContain('Powered by CoinGecko');
      // Only the failed chain is marked; the hero itself is a total.
      expect(mounted.div.textContent).toContain('Unavailable');
      expect(mounted.div.textContent).not.toContain('Balances could not be loaded');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('persists the hide-balance toggle across mounts', async () => {
    // Phase 3, Lane H: the toggle is persisted in localStorage (Rabby
    // persists it). Clear first so no earlier test can leak a value in,
    // and clear again at the end so no later test inherits the hidden
    // state.
    window.localStorage.clear();
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(heroAmount(mounted)).toBe('$62,683.00');
      const hideButton = mounted.div.querySelector(
        'button[aria-label="Hide balance"]',
      ) as HTMLButtonElement;
      expect(hideButton).not.toBeNull();
      await act(async () => {
        hideButton.click();
      });
      // The hero total is masked; the strip amounts are masked too. The
      // asset rows below still show their fiat values — the toggle masks
      // the hero and the strip only, so assert on the hero element, not
      // on the whole page.
      expect(heroAmount(mounted)).toBe('••••••');
      expect(window.localStorage.getItem('bawa:hide-balance:v1')).toBe('1');
    } finally {
      await mounted.cleanup();
    }
    // A fresh mount reads the persisted value: the total stays hidden.
    const remounted = await mountScreen();
    try {
      await clickRefreshPrices(remounted);
      expect(heroAmount(remounted)).toBe('••••••');
      expect(
        remounted.div.querySelector('button[aria-label="Show balance"]'),
      ).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
      await remounted.cleanup();
      window.localStorage.clear();
    }
  });

  it('shows a Partial total when one price is expired', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '1500000000000000000' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    const payload = freshPayload(11 * 60);
    payload.bitcoin!.last_updated_at = Math.floor(Date.now() / 1000) - 30;
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('$62,683.00 (Partial)');
      expect(mounted.div.textContent).toContain('Partial total');
      expect(mounted.div.textContent).toContain('Powered by CoinGecko');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows expired prices as expired, never as current', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(11 * 60),
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('Price expired');
      expect(mounted.div.textContent).toContain('Unavailable');
      expect(mounted.div.textContent).not.toContain('$62,683.00');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows an honest error on a rate-limited price feed, never $0.00', async () => {
    window.localStorage.clear();
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    // No Retry-After header, so the hook's back-off is 1000 ms then
    // 2000 ms and the auto-fetch settles within the 4 s wait below.
    stubPriceFetch({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });
    const mounted = await mountScreen();
    try {
      // The auto-fetch on mount produces the error state; no click needed.
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 4_000));
      });
      expect(mounted.div.textContent).toContain('Price feed rate-limited');
      expect(mounted.div.textContent).toContain('Unavailable');
      expect(mounted.div.textContent).not.toContain('$');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('loads the portfolio total on mount without clicking', async () => {
    window.localStorage.clear();
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => freshPayload(),
    });
    const mounted = await mountScreen();
    try {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(mounted.div.textContent).toContain('$62,683.00');
      expect(mounted.div.textContent).toContain('Powered by CoinGecko');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('retries the price fetch about every minute while mounted', async () => {
    window.localStorage.clear();
    vi.useFakeTimers();
    try {
      setWallet(
        balancesFor({
          btc: { status: 'available', value: '100000000' },
          eth: { status: 'available', value: '0' },
          trx: { status: 'available', value: '0' },
          ton: { status: 'available', value: '0' },
        }),
      );
      stubPriceFetch({
        ok: true,
        status: 200,
        json: async () => freshPayload(),
      });
      const mounted = await mountScreen();
      try {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      } finally {
        await mounted.cleanup();
      }
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('shows the rate-limited line even when a balance has failed', async () => {
    window.localStorage.clear();
    setWallet(
      balancesFor({
        btc: { status: 'error', reason: 'rpc-error' },
      }),
    );
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
      expect(mounted.div.textContent).toContain(
        'Price feed rate-limited — try again shortly.',
      );
      expect(mounted.div.textContent).toContain('Unavailable');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows a missing price as unavailable, never $0.00', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '1000000000' },
      }),
    );
    const payload = freshPayload();
    delete payload['the-open-network'];
    stubPriceFetch({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    const mounted = await mountScreen();
    try {
      await clickRefreshPrices(mounted);
      expect(mounted.div.textContent).toContain('Price unavailable');
      expect(mounted.div.textContent).toContain('$62,683.00 (Partial)');
    } finally {
      vi.unstubAllGlobals();
      await mounted.cleanup();
    }
  });

  it('shows real activity on the Activity tab', async () => {
    setWallet(balancesFor({}), {
      history: {
        btc: { status: 'empty', txs: [] },
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
        trx: { status: 'empty', txs: [] },
        ton: { status: 'empty', txs: [] },
      },
      refreshHistory: vi.fn(),
    });
    const mounted = await mountScreen();
    try {
      const tab = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Activity',
      );
      expect(tab).not.toBeUndefined();
      await act(async () => {
        (tab as HTMLButtonElement).click();
      });
      expect(mounted.div.textContent).toContain('Recent activity');
      expect(mounted.div.textContent).toContain('Sent');
      expect(mounted.div.textContent).toContain('0.25 ETH');
      expect(
        mounted.div.querySelector('a[href="/transactions/0xabc"]'),
      ).not.toBeNull();
      // No NFTs tab: no NFT support exists.
      expect(mounted.div.textContent).not.toContain('NFT');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the empty activity state when there is no history', async () => {
    setWallet(balancesFor({}), {
      history: {
        btc: { status: 'empty', txs: [] },
        eth: { status: 'empty', txs: [] },
        trx: { status: 'empty', txs: [] },
        ton: { status: 'empty', txs: [] },
      },
      refreshHistory: vi.fn(),
    });
    const mounted = await mountScreen();
    try {
      const tab = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Activity',
      );
      await act(async () => {
        (tab as HTMLButtonElement).click();
      });
      expect(mounted.div.textContent).toContain('No activity yet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders the wallet real state on the layout page, never fixtures', async () => {
    // Layout-page correctness (§6 item 5): the home screen shows the
    // context's real balances and history — no demo total, no testnet label.
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'available', value: '1500000000000000000' },
      }),
      {
        history: {
          btc: { status: 'empty', txs: [] },
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
          trx: { status: 'empty', txs: [] },
          ton: { status: 'empty', txs: [] },
        },
        refreshHistory: vi.fn(),
      },
    );
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      // Real balances from the context, formatted from base units.
      expect(text).toContain('1.5 ETH');
      expect(text).toContain('Zero balance');
      // Real actions exist; no Swap/Buy (no engine/on-ramp).
      expect(text).toContain('Send');
      expect(text).toContain('Receive');
      expect(text).not.toContain('Swap');
      // No fixture or demo content anywhere on the page.
      expect(text).not.toContain('$12,480');
      expect(text).not.toContain('Testnet');
      expect(text).not.toContain('TESTNET');
      expect(text).not.toContain('demo');
      // Real history on the Activity tab, linked to the detail page.
      const tab = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Activity',
      );
      await act(async () => {
        (tab as HTMLButtonElement).click();
      });
      expect(mounted.div.textContent).toContain('0.25 ETH');
      expect(
        mounted.div.querySelector('a[href="/transactions/0xabc"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('retries a failed asset row while unlocked', async () => {
    // The hero is a Partial total here, so its button reads
    // "Refresh balances" — the only Retry on the page is the failed
    // ETH row's, and clicking it refreshes balances.
    setWallet(
      balancesFor({
        btc: { status: 'available', value: '100000000' },
        eth: { status: 'error', reason: 'rpc-error' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'available', value: '0' },
      }),
    );
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Could not load balance');
      const retry = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Retry',
      ) as HTMLButtonElement;
      expect(retry).not.toBeUndefined();
      await act(async () => {
        retry.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, failed asset rows offer Unlock instead of a dead Retry', async () => {
    // While the vault is locked there is no derived address in state,
    // so a balance refetch can only fail again with no-address: the
    // per-row Retry must not be offered, and the page must point at
    // the unlock screen instead. The hero already swaps its own
    // Retry for Unlock while locked; this covers the asset rows.
    setWallet(
      balancesFor({
        btc: { status: 'error', reason: 'no-address' },
        eth: { status: 'error', reason: 'no-address' },
        trx: { status: 'error', reason: 'no-address' },
        ton: { status: 'error', reason: 'no-address' },
      }),
      { vaultState: 'locked' },
    );
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Could not load balance');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      expect(mockRefreshBalances).not.toHaveBeenCalled();
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Locked — unlock to see balances.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('retries unavailable history while unlocked', async () => {
    // Zero balances, so no balance Retry exists: the only Retry on
    // the page is the failed history's. The failure reason is a
    // retryable one ('down'): a no-address failure has no Retry at
    // all, unlocked or not, because there is no address to fetch for.
    const mockRefreshHistory = vi.fn().mockResolvedValue(undefined);
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'zero', value: '0' },
        trx: { status: 'zero', value: '0' },
        ton: { status: 'zero', value: '0' },
      }),
      {
        history: {
          btc: { status: 'unavailable', reason: 'down', txs: [] },
          eth: { status: 'empty', txs: [] },
          trx: { status: 'empty', txs: [] },
          ton: { status: 'empty', txs: [] },
        },
        refreshHistory: mockRefreshHistory,
      },
    );
    const mounted = await mountScreen();
    try {
      const tab = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Activity',
      );
      await act(async () => {
        (tab as HTMLButtonElement).click();
      });
      expect(mounted.div.textContent).toContain('Bitcoin history unavailable');
      const retry = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Retry',
      ) as HTMLButtonElement;
      expect(retry).not.toBeUndefined();
      await act(async () => {
        retry.click();
      });
      expect(mockRefreshHistory).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, unavailable history offers Unlock instead of a dead Retry', async () => {
    // History refresh needs a derived address too, so while locked
    // it fails the same way balances do: no Retry, an Unlock prompt.
    const mockRefreshHistory = vi.fn().mockResolvedValue(undefined);
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'zero', value: '0' },
        trx: { status: 'zero', value: '0' },
        ton: { status: 'zero', value: '0' },
      }),
      {
        vaultState: 'locked',
        history: {
          btc: { status: 'unavailable', reason: 'no-address', txs: [] },
          eth: { status: 'empty', txs: [] },
          trx: { status: 'empty', txs: [] },
          ton: { status: 'empty', txs: [] },
        },
        refreshHistory: mockRefreshHistory,
      },
    );
    const mounted = await mountScreen();
    try {
      const tab = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Activity',
      );
      await act(async () => {
        (tab as HTMLButtonElement).click();
      });
      expect(mounted.div.textContent).toContain('Bitcoin history unavailable');
      const retryButtons = [...mounted.div.querySelectorAll('button')].filter(
        (candidate) => candidate.textContent === 'Retry',
      );
      expect(retryButtons).toHaveLength(0);
      expect(mockRefreshHistory).not.toHaveBeenCalled();
      expect(mounted.div.textContent).toContain('Locked — unlock to see activity.');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays the quick actions out as a vertical rail beside the hero on desktop widths', async () => {
    // Follow-up: the dashboard was md5-identical to the saved build on
    // desktop, which is what the owner reported as "still mobile
    // layout". The quick actions (Send / Receive / Activity) now run
    // as a vertical rail beside the hero at lg instead of a three-wide
    // row — the one visible desktop arrangement change on this screen.
    // Below lg they stay a three-wide row, so the mobile layout is
    // untouched.
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      const sendLink = mounted.div.querySelector('a[href="/send"]');
      expect(sendLink).not.toBeNull();
      const rail = sendLink?.parentElement;
      expect(rail?.className).toContain('grid-cols-3');
      expect(rail?.className).toContain('lg:grid-cols-1');
      expect(rail?.className).not.toMatch(/(^|\s)lg:grid-cols-3(\s|$)/);
      expect(sendLink?.className).toContain('lg:flex-row');
      // The whole rail is still three links, nothing added or removed.
      expect(rail?.querySelectorAll(':scope > a')).toHaveLength(3);
    } finally {
      await mounted.cleanup();
    }
  });
});
