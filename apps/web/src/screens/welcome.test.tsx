// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { WelcomeScreen } from './welcome';
import { useWallet } from '../state/wallet-context';
import { usePrices } from '../wallet/prices';
import type { BalanceState } from '../state/wallet-context';
import type { PriceEntry, PricesState } from '../wallet/prices';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

// The strip reads prices through the real helpers (fiat values, unit
// prices, freshness labels); only the hook itself is stubbed, so no test
// ever hits the real CoinGecko API.
vi.mock('../wallet/prices', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../wallet/prices')>();
  return { ...actual, usePrices: vi.fn() };
});

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type ChainKey =
  | 'btc'
  | 'eth'
  | 'trx'
  | 'ton'
  | 'sol'
  | 'bsc'
  | 'matic'
  | 'arb'
  | 'op'
  | 'base'
  | 'avax'
  | 'ltc'
  | 'doge'
  | 'gnosis'
  | 'celo'
  | 'linea'
  | 'mantle'
  | 'scroll'
  | 'opbnb'
  | 'metis'
  | 'aurora'
  | 'fantom';

const ALL_CHAINS: readonly ChainKey[] = [
  'btc',
  'eth',
  'trx',
  'ton',
  'sol',
  'bsc',
  'matic',
  'arb',
  'op',
  'base',
  'avax',
  'ltc',
  'doge',
  'gnosis',
  'celo',
  'linea',
  'mantle',
  'scroll',
  'opbnb',
  'metis',
  'aurora',
  'fantom',
];

function balancesFor(
  overrides: Partial<Record<ChainKey, BalanceState>>,
): Record<ChainKey, BalanceState> {
  const base = {} as Record<ChainKey, BalanceState>;
  for (const chain of ALL_CHAINS) {
    base[chain] = { status: 'unavailable', reason: 'no-adapter' };
  }
  return { ...base, ...overrides };
}

function idleEntries(): Record<ChainKey, PriceEntry> {
  const entries = {} as Record<ChainKey, PriceEntry>;
  for (const chain of ALL_CHAINS) {
    entries[chain] = { status: 'unavailable', reason: 'missing' };
  }
  return entries;
}

function freshQuote(
  chain: ChainKey,
  usdPrice: string,
): PriceEntry {
  const now = Date.now();
  return {
    status: 'fresh',
    quote: {
      chain,
      assetId: chain,
      providerAssetId: chain,
      usdPrice,
      providerUpdatedAtMs: now,
      fetchedAtMs: now,
      source: 'CoinGecko',
    },
  };
}

function setPrices(
  state: PricesState,
  refresh: () => void = () => {},
): void {
  vi.mocked(usePrices).mockReturnValue({ state, refresh });
}

function setWallet(
  vaultState: 'no-vault' | 'unlocked',
  balances: Record<ChainKey, BalanceState>,
): void {
  vi.mocked(useWallet).mockReturnValue({
    balances,
    refreshBalances: vi.fn(),
    vaultState,
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
        <WelcomeScreen />
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

describe('welcome screen — Popular chains strip (Lane A)', () => {
  it('shows the strip as navigation with dashes when there is no vault', async () => {
    const refresh = vi.fn();
    setWallet('no-vault', balancesFor({}));
    setPrices(
      { status: 'idle', entries: idleEntries(), lastFetchedAtMs: null },
      refresh,
    );
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Popular chains');
      expect(text).toContain('Bitcoin');
      expect(text).toContain('Ethereum');
      expect(text).toContain('TRON');
      expect(text).toContain('TON');
      expect(text).toContain('All networks');
      // Fixed registry order, not value-sorted: BTC before ETH before TRX.
      const strip = mounted.div.querySelector(
        '[aria-labelledby="popular-chains-title"]',
      );
      expect(strip).not.toBeNull();
      const stripText = strip?.textContent ?? '';
      expect(stripText.indexOf('Bitcoin')).toBeLessThan(
        stripText.indexOf('Ethereum'),
      );
      expect(stripText.indexOf('Ethereum')).toBeLessThan(
        stripText.indexOf('TRON'),
      );
      expect(stripText.indexOf('TRON')).toBeLessThan(stripText.indexOf('TON'));
      // No vault: every entry shows a dash, never a fabricated balance.
      expect(mounted.div.querySelectorAll('a[href="/assets/btc"]')).toHaveLength(1);
      expect(mounted.div.querySelectorAll('a[href="/assets/eth"]')).toHaveLength(1);
      expect(mounted.div.querySelectorAll('a[href="/assets/trx"]')).toHaveLength(1);
      expect(mounted.div.querySelectorAll('a[href="/assets/ton"]')).toHaveLength(1);
      expect(
        mounted.div.querySelectorAll('a[href="/networks"]'),
      ).not.toHaveLength(0);
      // The no-vault strip makes no price fetch.
      expect(refresh).not.toHaveBeenCalled();
      // Lane C, item 9: the Create card is gone from the welcome
      // section — the page still offers a way in without scrolling the
      // desktop layout: the Import card stays.
      expect(text).not.toContain('Create a wallet');
      expect(text).toContain('Import a wallet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows real balances and fiat values with a vault and fresh prices', async () => {
    setWallet(
      'unlocked',
      balancesFor({
        btc: { status: 'available', value: '12300000' },
        eth: { status: 'zero' },
        trx: { status: 'loading' },
        ton: { status: 'unavailable', reason: 'no-adapter' },
      }),
    );
    const entries = idleEntries();
    entries.btc = freshQuote('btc', '61706');
    entries.eth = freshQuote('eth', '1741.66');
    entries.trx = freshQuote('trx', '0.306439');
    entries.ton = freshQuote('ton', '1.02');
    setPrices({ status: 'ready', entries, lastFetchedAtMs: Date.now() });
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('0.123 BTC');
      // A real fiat value, never $0.00 for a missing value.
      expect(text).toMatch(/\$\d[\d,]*\.\d{2}/);
      expect(text).not.toContain('$0.00');
      // Zero balance keeps the asset-row wording and the per-unit price.
      expect(text).toContain('Zero balance');
      expect(text).toContain('per ETH');
      // A loading balance shows the loading indicator, never a blank or a zero.
      expect(mounted.div.querySelector('[role="status"]')).not.toBeNull();
      // An unavailable balance says so.
      expect(text).toContain('Unavailable');
    } finally {
      await mounted.cleanup();
    }
  });

  // Vault-lock removal: the strip used to point at unlocking when the
  // vault was locked. There is no locked state any more — an existing
  // vault always shows its balances, so no such test remains.
});

describe('welcome screen — introduction (Lane C, item 9)', () => {
  async function mountIntro() {
    setWallet('no-vault', balancesFor({}));
    setPrices(
      { status: 'idle', entries: idleEntries(), lastFetchedAtMs: null },
      () => {},
    );
    return mountScreen();
  }

  it('explains what Bawa is and what it is for', async () => {
    const mounted = await mountIntro();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Welcome to Bawa');
      expect(text).toContain(
        'Bawa is a guide for humans and AI agents',
      );
      expect(text).toContain('crypto wallets');
      expect(text).toContain('web wallets');
      expect(text).toContain('Android wallets');
      expect(text).toContain('HD wallets');
      expect(text).toContain('smart contracts');
      expect(text).toContain('What you can do with Bawa');
    } finally {
      await mounted.cleanup();
    }
  });

  it('has no create-wallet call to action', async () => {
    const mounted = await mountIntro();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('Create a wallet');
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).toBeNull();
      expect(
        mounted.div.querySelector('a[href="/import-wallet"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
