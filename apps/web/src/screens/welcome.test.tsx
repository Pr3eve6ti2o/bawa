// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { WelcomeScreen } from './welcome';
import { useWallet } from '../state/wallet-context';
import { idlePriceEntries, usePrices } from '../wallet/prices';
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

describe('welcome screen \u2014 Popular chains strip removed (Lane J)', () => {
  it('shows no Popular chains strip when there is no vault', async () => {
    const refresh = vi.fn();
    setWallet('no-vault', balancesFor({}));
    setPrices(
      { status: 'idle', entries: idlePriceEntries(), lastFetchedAtMs: null },
      refresh,
    );
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('Popular chains');
      expect(
        mounted.div.querySelector('[aria-labelledby="popular-chains-title"]'),
      ).toBeNull();
      // No chain cards: the strip's links are gone with it.
      expect(mounted.div.querySelectorAll('a[href="/assets/btc"]')).toHaveLength(0);
      expect(mounted.div.querySelectorAll('a[href="/assets/eth"]')).toHaveLength(0);
      expect(mounted.div.querySelectorAll('a[href="/assets/trx"]')).toHaveLength(0);
      expect(mounted.div.querySelectorAll('a[href="/assets/ton"]')).toHaveLength(0);
      // Marketing-fix Lane 3: the welcome offers both ways in without
      // scrolling the desktop layout — the Create card (reversing Lane C
      // item 9, which had removed it: a fresh user choosing a wallet
      // must be able to start from the first screen) and the Import
      // card.
      expect(text).toContain('Create a wallet');
      expect(text).toContain('Import a wallet');
      // The welcome makes no price fetch of its own.
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows no strip balances with a vault and fresh prices', async () => {
    // The dashboard owns balances; the welcome screen (reachable at
    // /welcome even with a vault) shows the intro and the two ways in,
    // never the strip's balances.
    setWallet(
      'unlocked',
      balancesFor({
        btc: { status: 'available', value: '12300000' },
        eth: { status: 'zero' },
        trx: { status: 'loading' },
        ton: { status: 'unavailable', reason: 'no-adapter' },
      }),
    );
    const entries = idlePriceEntries();
    entries.btc = freshQuote('btc', '61706');
    entries.eth = freshQuote('eth', '1741.66');
    entries.trx = freshQuote('trx', '0.306439');
    entries.ton = freshQuote('ton', '1.02');
    setPrices({ status: 'ready', entries, lastFetchedAtMs: Date.now() });
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('Popular chains');
      expect(text).not.toContain('0.123 BTC');
      expect(text).not.toContain('Zero balance');
      expect(text).not.toContain('per ETH');
      expect(text).toContain('Welcome to Bawa');
      expect(text).toContain('Create a wallet');
      expect(text).toContain('Import a wallet');
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane J: the strip is gone from the homepage entirely — the
  // dashboard owns balances, and the welcome keeps the intro plus the
  // Create and Import ways in.
});

describe('welcome screen — introduction (Lane C, item 9)', () => {
  async function mountIntro() {
    setWallet('no-vault', balancesFor({}));
    setPrices(
      { status: 'idle', entries: idlePriceEntries(), lastFetchedAtMs: null },
      () => {},
    );
    return mountScreen();
  }

  it('explains what Bawa is and what it is for', async () => {
    const mounted = await mountIntro();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Welcome to Bawa');
      // Marketing-fix Lane 3: the wallet leads, the guide follows.
      // The guide sentence stays (Lane C item 9's positioning), but
      // the first thing a choosing user reads is the wallet itself.
      expect(text).toContain(
        'Bawa is a self-custodial wallet that runs in your browser',
      );
      expect(text).toContain('84 chains');
      expect(text).toContain('Bawa is also a guide for humans and AI agents');
      expect(text).toContain('What this wallet does');
      expect(text).toContain('Receive on 84 chains');
      expect(text).toContain('Real balances and prices');
      expect(text).toContain('Watch any wallet');
      expect(text).toContain('Add tokens');
      // Sending is off by default, and the welcome says so plainly.
      expect(text).toContain(
        'Sending is switched off until it is separately approved',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('has a create-wallet call to action', async () => {
    // Marketing-fix Lane 3: reverses Lane C item 9. A fresh user
    // choosing a wallet must be able to start from the first screen —
    // on mobile there is no Create entry in the bottom nav, so the
    // welcome carries both ways in: Create and Import.
    const mounted = await mountIntro();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Create a wallet');
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector('a[href="/import-wallet"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
