// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { ReceiveScreen } from './receive';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', () => {
  const chainConfig = vi.fn();
  return {
    availableFor: vi.fn(),
    chainConfig,
    // Merge fix (Lane 5 moved filterChains here from
    // chain-search-select): the mock must provide it, because Receive
    // imports the picker, which re-exports it. Same rule as the real
    // helper, driven by the mocked chainConfig.
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
    // Lane A: every chain rotates, SOL and TON included.
    canRotateReceiveAddress: () => true,
    SUPPORTED_CHAINS: [
      'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge',
    ],
    // payment-links.ts (EIP-681) reads evmChainId off CHAINS.
    CHAINS: {
      btc: { evmChainId: null },
      eth: { evmChainId: 1 },
      trx: { evmChainId: null },
      ton: { evmChainId: null },
      sol: { evmChainId: null },
      bsc: { evmChainId: 56 },
      matic: { evmChainId: 137 },
      arb: { evmChainId: 42161 },
      op: { evmChainId: 10 },
      base: { evmChainId: 8453 },
      avax: { evmChainId: 43114 },
      gnosis: { evmChainId: 100 },
      celo: { evmChainId: 42220 },
      linea: { evmChainId: 59144 },
      mantle: { evmChainId: 5000 },
      scroll: { evmChainId: 534352 },
      opbnb: { evmChainId: 204 },
      metis: { evmChainId: 1088 },
      aurora: { evmChainId: 1313161554 },
      fantom: { evmChainId: 250 },
      ltc: { evmChainId: null },
      doge: { evmChainId: null },
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

const VAULT_ETH = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

// The current setWallet mock's setSelectedChain, so a test can assert
// a pick landed on it (the mock never updates selectedChain itself).
let mockSetSelectedChain: ReturnType<typeof vi.fn> = vi.fn();

function setWallet(overrides: Record<string, unknown> = {}): void {
  mockSetSelectedChain = vi.fn();
  vi.mocked(useWallet).mockReturnValue({
    addresses: {
      btc: [],
      eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
      trx: [],
      ton: [],
    },
    vaultAddresses: {
      btc: [],
      eth: [VAULT_ETH],
      trx: [],
      ton: [],
    },
    selectedChain: 'eth',
    setSelectedChain: mockSetSelectedChain,
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
}

async function clickButton(div: HTMLDivElement, text: string): Promise<void> {
  const button = [...div.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  expect(button).not.toBeUndefined();
  await act(async () => {
    button?.click();
  });
}

async function fillInput(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Lane X (Lane D #70): the Buy panel is one select bar now — pick a
// provider from it before asserting that provider's copy or button.
async function selectBuyProvider(div: HTMLDivElement, id: string): Promise<void> {
  const select = div.querySelector('#buy-provider') as HTMLSelectElement | null;
  expect(select).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )?.set;
    setter?.call(select as HTMLSelectElement, id);
    select?.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const ALL_CHAINS: ChainKey[] = [
  'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base',
  'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll',
  'opbnb', 'metis', 'aurora', 'fantom',
];

// P1 (Lane S4, item 11): pick a chain in the shared picker —
// click the search field to open it, then the option row. The
// picker records the pick as last-used, like the real flow.
async function pickChain(div: HTMLDivElement, chain: string): Promise<void> {
  const input = div.querySelector('#receive-chain') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  await act(async () => {
    input?.click();
  });
  const option = div.querySelector(
    `#receive-chain-option-${chain}`,
  ) as HTMLElement | null;
  expect(option).not.toBeNull();
  await act(async () => {
    (option as HTMLElement).click();
  });
}

// Item 20: drive the stepped flow to the details step — pick the
// Ethereum chain, then its native asset.
async function reachDetails(div: HTMLDivElement): Promise<void> {
  await pickChain(div, 'eth');
  await clickButton(div, 'Ethereum · ETH');
}

async function mountScreen(entry = '/receive') {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ReceiveScreen />
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
  // P1 (Lane S4): the screen reads the shared last-used chain on
  // entry — clear it so every test starts on the chain step.
  localStorage.clear();
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainId) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
  );
});

describe('receive screen', () => {
  it('shows the vault-derived address and its QR, with no watch-only alert', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      expect(mounted.div.textContent).toContain(VAULT_ETH);
      expect(mounted.div.querySelector('svg')).not.toBeNull();
      expect(mounted.div.textContent).not.toContain('Watch-only account');
      expect(mounted.div.textContent).toContain('Mainnet only');
    } finally {
      await mounted.cleanup();
    }
  });

  it('opens straight on the QR with the asset pre-selected from the asset-detail shortcut', async () => {
    // Lane P2-C (F7): /receive?chain=&token= lands on the details
    // step with the token pre-selected — no chain or token step first.
    // The QR card pairs the address with its identicon (M6).
    setWallet();
    const mounted = await mountScreen('/receive?chain=eth&token=usdc');
    try {
      expect(mounted.div.querySelector('[data-testid="qr-card"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain(VAULT_ETH);
      expect(mounted.div.textContent).toContain('Ethereum · USDC');
      expect(mounted.div.textContent).toContain('Amount (optional) — USDC');
      expect(
        mounted.div.querySelector('svg[data-testid="address-identicon"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('falls back to the native coin on an unknown token slug', async () => {
    setWallet();
    const mounted = await mountScreen('/receive?chain=eth&token=nope');
    try {
      expect(mounted.div.querySelector('[data-testid="qr-card"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Ethereum · ETH');
      expect(mounted.div.textContent).not.toContain('USDC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the Buy panel for ?buy=1 with the honest unconfigured state', async () => {
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): Coinbase's copy shows once it is picked.
      await selectBuyProvider(mounted.div, 'coinbase');
      expect(mounted.div.textContent).toContain('Buy crypto');
      expect(mounted.div.textContent).toContain("Buy isn't set up yet");
      expect(mounted.div.textContent).toContain(
        'Coinbase Onramp onboarding and API keys',
      );
      expect(
        [...mounted.div.querySelectorAll('button')].find(
          (candidate) => candidate.textContent === 'Buy with Coinbase',
        ),
      ).toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  it('opens the real Onramp URL in a pop-up from the Buy panel', async () => {
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', 'test-app-id');
    const popup = {
      location: { href: '' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as WindowProxy);
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): pick Coinbase from the select bar first.
      await selectBuyProvider(mounted.div, 'coinbase');
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Buy with Coinbase',
      );
      expect(button).not.toBeUndefined();
      // The vault address wins over the watch-only one (Receive's
      // own resolution: receive, then vault, then watch-only).
      expect(mounted.div.textContent).toContain(VAULT_ETH);
      await act(async () => {
        button?.click();
      });
      // The URL is built first and the pop-up opens directly onto it
      // (no blank-then-navigate): the opened URL is the call's first
      // argument, not a location assigned afterwards.
      expect(openSpy).toHaveBeenCalledTimes(1);
      const openedUrl = openSpy.mock.calls[0]?.[0] as string;
      expect(openSpy).toHaveBeenCalledWith(
        openedUrl,
        '_blank',
        'noopener,width=430,height=600',
      );
      const url = new URL(openedUrl);
      expect(url.origin).toBe('https://pay.coinbase.com');
      expect(url.pathname).toBe('/buy/select-asset');
      expect(url.searchParams.get('appId')).toBe('test-app-id');
      expect(url.searchParams.get('addresses')).toBe(
        `{"${VAULT_ETH}":["ethereum"]}`,
      );
      expect(mounted.div.textContent).toContain(
        'Pop-up opened — complete your purchase in the Coinbase window.',
      );
    } finally {
      openSpy.mockRestore();
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('disables the Buy button once a pop-up is open, so a repeat click cannot open a duplicate', async () => {
    // The old "reports a blocked pop-up" test is gone on purpose:
    // with noopener, window.open returns null even when the pop-up
    // opened, so the Coinbase path can no longer report "blocked"
    // (see onramp.test.ts). What the panel can still promise is
    // that one click opens exactly one pop-up.
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', 'test-app-id');
    const popup = {
      location: { href: '' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as WindowProxy);
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): pick Coinbase from the select bar first.
      await selectBuyProvider(mounted.div, 'coinbase');
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Buy with Coinbase',
      );
      expect(button).not.toBeUndefined();
      expect(button?.disabled).toBe(false);
      await act(async () => {
        button?.click();
      });
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(button?.disabled).toBe(true);
      await act(async () => {
        button?.click();
      });
      expect(openSpy).toHaveBeenCalledTimes(1);
    } finally {
      openSpy.mockRestore();
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('lists every Buy destination, not just the first one', async () => {
    // Bug-hunt v2 (H V5): the panel showed only the first (Bitcoin)
    // destination as THE delivery address while the URL carried up
    // to ten. The row now lists each address with its networks.
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', 'test-app-id');
    const VAULT_BTC = 'bc1qtestbtcaddress0000000000000000000000000';
    setWallet({
      vaultAddresses: {
        btc: [VAULT_BTC],
        eth: [VAULT_ETH],
        trx: [],
        ton: [],
      },
    });
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): pick Coinbase from the select bar first.
      await selectBuyProvider(mounted.div, 'coinbase');
      expect(mounted.div.textContent).toContain('Deliver to');
      expect(mounted.div.textContent).toContain(VAULT_BTC);
      expect(mounted.div.textContent).toContain(VAULT_ETH);
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Ethereum');
    } finally {
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('asks for unlock on the Buy panel when the vault is locked', async () => {
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', 'test-app-id');
    setWallet({ vaultState: 'locked' });
    const mounted = await mountScreen('/receive?buy=1');
    try {
      expect(mounted.div.textContent).toContain('Unlock your wallet to buy');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  // Lane B (providers Phase 2): the Buy provider picker.
  // Lane X (Lane D #70): the panel is one select bar now — the seven
  // providers are the select's options in rank order, and each
  // provider's setup copy shows only when it is selected.
  it('shows all seven providers in rank order, none offering a fake Buy', async () => {
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      const select = mounted.div.querySelector(
        '#buy-provider',
      ) as HTMLSelectElement | null;
      expect(select).not.toBeNull();
      const options = [...(select?.querySelectorAll('option') ?? [])].map(
        (option) => option.textContent?.trim(),
      );
      expect(options).toEqual([
        '1. Ramp',
        '2. MoonPay',
        '3. Onramper',
        '4. Banxa',
        '5. Transak',
        '6. Mercuryo',
        '7. Coinbase',
      ]);
      // The default (Ramp) row carries its own setup copy, and no
      // provider offers a Buy button while nothing is configured.
      expect(mounted.div.textContent).toContain('Not set up yet');
      expect(mounted.div.textContent).toContain('hostApiKey');
      expect(mounted.div.textContent).toContain('Fees are indicative.');
      expect(
        [...mounted.div.querySelectorAll('button')].find((candidate) =>
          candidate.textContent?.startsWith('Buy with'),
        ),
      ).toBeUndefined();
      // Each other provider's setup copy appears when it is selected.
      await selectBuyProvider(mounted.div, 'moonpay');
      expect(mounted.div.textContent).toContain('sk_live_');
      await selectBuyProvider(mounted.div, 'banxa');
      expect(mounted.div.textContent).toContain('partnerRef');
      await selectBuyProvider(mounted.div, 'transak');
      expect(mounted.div.textContent).toContain('Needs a backend');
      expect(mounted.div.textContent).toContain(
        'API key plus an API secret that must stay server-side.',
      );
      await selectBuyProvider(mounted.div, 'mercuryo');
      expect(mounted.div.textContent).toContain('widget_id');
      await selectBuyProvider(mounted.div, 'coinbase');
      expect(mounted.div.textContent).toContain(
        'Coinbase Onramp onboarding and API keys',
      );
      expect(
        [...mounted.div.querySelectorAll('button')].find((candidate) =>
          candidate.textContent?.startsWith('Buy with'),
        ),
      ).toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  it('opens the Ramp widget pre-filled with the vault address and asset', async () => {
    vi.stubEnv('VITE_RAMP_HOST_API_KEY', 'test-ramp-key');
    const popup = {
      location: { href: '' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as WindowProxy);
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      expect(mounted.div.textContent).toContain(
        'Not available in Louisiana',
      );
      await clickButton(mounted.div, 'Buy with Ramp');
      // The URL is opened directly (no blank-then-navigate): read it
      // from the window.open call, not from a pop-up location.
      expect(openSpy).toHaveBeenCalledTimes(1);
      const openedUrl = openSpy.mock.calls[0]?.[0] as string;
      expect(openSpy).toHaveBeenCalledWith(
        openedUrl,
        '_blank',
        'noopener,width=430,height=600',
      );
      const url = new URL(openedUrl);
      expect(url.origin).toBe('https://app.ramp.network');
      expect(url.searchParams.get('hostApiKey')).toBe('test-ramp-key');
      expect(url.searchParams.get('userAddress')).toBe(VAULT_ETH);
      expect(url.searchParams.get('enabledCryptoAssets')).toBe('ETH');
      expect(url.searchParams.get('variant')).toBe('hosted-auto');
      expect(url.searchParams.get('defaultFlow')).toBe('ONRAMP');
      expect(mounted.div.textContent).toContain(
        'Pop-up opened — complete your purchase in the Ramp window.',
      );
    } finally {
      openSpy.mockRestore();
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('opens MoonPay without a pre-filled address and says so plainly', async () => {
    vi.stubEnv('VITE_MOONPAY_API_KEY', 'pk_live_test');
    const popup = {
      location: { href: '' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as WindowProxy);
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): pick MoonPay from the select bar first.
      await selectBuyProvider(mounted.div, 'moonpay');
      expect(mounted.div.textContent).toContain(
        'paste your own address inside MoonPay',
      );
      await clickButton(mounted.div, 'Buy with MoonPay');
      const openedUrl = openSpy.mock.calls[0]?.[0] as string;
      const url = new URL(openedUrl);
      expect(url.origin).toBe('https://buy.moonpay.com');
      expect(url.searchParams.get('apiKey')).toBe('pk_live_test');
      expect(url.searchParams.get('defaultCurrencyCode')).toBe('eth');
      expect(url.searchParams.has('walletAddress')).toBe(false);
      expect(url.searchParams.has('signature')).toBe(false);
      expect(mounted.div.textContent).toContain(
        'Pop-up opened — complete your purchase in the MoonPay window.',
      );
    } finally {
      openSpy.mockRestore();
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('opens Banxa pre-filled with the vault address, coin and chain', async () => {
    vi.stubEnv('VITE_BANXA_PARTNER_REF', 'bawa');
    const popup = {
      location: { href: '' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as WindowProxy);
    setWallet();
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): pick Banxa from the select bar first.
      await selectBuyProvider(mounted.div, 'banxa');
      expect(mounted.div.textContent).toContain(
        'A plain redirect — no quote in Bawa',
      );
      await clickButton(mounted.div, 'Buy with Banxa');
      const openedUrl = openSpy.mock.calls[0]?.[0] as string;
      const url = new URL(openedUrl);
      expect(url.origin).toBe('https://bawa.banxa.com');
      expect(url.searchParams.get('walletAddress')).toBe(VAULT_ETH);
      expect(url.searchParams.get('coinType')).toBe('ETH');
      expect(url.searchParams.get('blockchain')).toBe('ETH');
    } finally {
      openSpy.mockRestore();
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('offers TON on Ramp but not on Coinbase for a TON-only wallet', async () => {
    vi.stubEnv('VITE_RAMP_HOST_API_KEY', 'test-ramp-key');
    vi.stubEnv('VITE_COINBASE_ONRAMP_APP_ID', 'test-app-id');
    const popup = {
      location: { href: '' },
      close: vi.fn(),
      closed: false,
    };
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue(popup as unknown as WindowProxy);
    const TON_ADDRESS = 'UQTestTonAddress1234567890';
    setWallet({
      addresses: { btc: [], eth: [], trx: [], ton: [] },
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [TON_ADDRESS] },
    });
    const mounted = await mountScreen('/receive?buy=1');
    try {
      // Lane X (Lane D #70): pick Coinbase from the select bar first.
      await selectBuyProvider(mounted.div, 'coinbase');
      expect(mounted.div.textContent).toContain(
        'No address on a network Coinbase delivers to.',
      );
      expect(
        [...mounted.div.querySelectorAll('button')].find(
          (candidate) => candidate.textContent === 'Buy with Coinbase',
        ),
      ).toBeUndefined();
      // Lane X (Lane D #70): Ramp's button shows once Ramp is picked.
      await selectBuyProvider(mounted.div, 'ramp');
      await clickButton(mounted.div, 'Buy with Ramp');
      const openedUrl = openSpy.mock.calls[0]?.[0] as string;
      const url = new URL(openedUrl);
      expect(url.searchParams.get('userAddress')).toBe(TON_ADDRESS);
      expect(url.searchParams.get('enabledCryptoAssets')).toBe('TON_GRAM');
    } finally {
      openSpy.mockRestore();
      vi.unstubAllEnvs();
      await mounted.cleanup();
    }
  });

  it('says no address to deliver to when no provider covers the wallet', async () => {
    setWallet({
      addresses: { btc: [], eth: [], trx: [], ton: [], fantom: [] },
      vaultAddresses: {
        btc: [],
        eth: [],
        trx: [],
        ton: [],
        fantom: ['0xFantomAddress000000000000000000'],
      },
    });
    const mounted = await mountScreen('/receive?buy=1');
    try {
      expect(mounted.div.textContent).toContain('No address to deliver to');
      expect(mounted.div.textContent).toContain(
        'no address on a network any Buy provider delivers to',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders no empty status line before any copy action (P8 dead-space fix)', async () => {
    // Reverify lane 1: the owner kept the 40 px Receive fix
    // (2026-11-23), but the UI/UX rework of this screen reintroduced
    // the always-rendered empty status <p> under the buttons — the
    // exact dead space P8 removed on desktop-layout-v2. The status
    // line must exist only once a copy/share action reports something.
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      expect(mounted.div.querySelector('[role="status"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the status line once a copy action reports', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      // Lane 4: the standalone 'Copy address' button is gone — the
      // card's own Copy button (in context beside the address) is the
      // one copy control now.
      const copyButton = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.getAttribute('aria-label') === 'Copy receiving address',
      );
      expect(copyButton).not.toBeUndefined();
      await act(async () => {
        copyButton?.click();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const status = mounted.div.querySelector('[role="status"]');
      expect(status).not.toBeNull();
      expect(status?.textContent?.length).toBeGreaterThan(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the watch-only alert when falling back to an imported address', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
    });
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      expect(mounted.div.textContent).toContain('0xWatchOnlyEthAddress0000000000000000000');
      // Lane X (Lane D #61): "Watch-only: can receive, can't send."
      expect(mounted.div.textContent).toContain(
        "Watch-only: can receive, can't send.",
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('lists only chains whose receive capability is verified', async () => {
    vi.mocked(availableFor).mockReturnValue(['eth', 'ton']);
    setWallet();
    const mounted = await mountScreen();
    try {
      // P1 (Lane S4, item 11): the chain step is the shared picker —
      // its options render only once it is opened.
      const input = mounted.div.querySelector(
        '#receive-chain',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();
      await act(async () => {
        input.click();
      });
      expect(mounted.div.textContent).toContain('ETH');
      expect(mounted.div.textContent).toContain('TON');
      // 'Bitcoin' (not 'BTC' — the token list's WBTC contains those letters).
      expect(mounted.div.textContent).not.toContain('Bitcoin');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unavailable state when no receive chain is verified', async () => {
    vi.mocked(availableFor).mockReturnValue([]);
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        "Receive isn't available for this network yet.",
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects an invalid amount and keeps the plain-address QR', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const input = mounted.div.querySelector('#receive-amount') as HTMLInputElement;
      expect(input).not.toBeNull();
      await act(async () => {
        // Simulate typing by setting the value and firing input.
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(input, 'abc');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(mounted.div.textContent).toContain('Enter a valid amount.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the full token list with verified ticks and short contracts', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      // Defaults on eth + trx (the mocked receive chains) are listed.
      expect(mounted.div.textContent).toContain('USD Coin');
      expect(mounted.div.textContent).toContain('Tether USD');
      expect(mounted.div.textContent).toContain('ChainLink Token');
      // Verified tick + short contract under the token.
      expect(mounted.div.textContent).toContain('Verified');
      expect(mounted.div.textContent).toContain('0xA0b8…eB48');
      expect(mounted.div.textContent).toContain('Add token');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Unverified on an unlisted token in the picker', async () => {
    // Lane 1: a user-added token with no CoinGecko listing says
    // Unverified on its picker row — the filter results carry the
    // mark too, since they render the same rows.
    setWallet({
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
    });
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      const row = [...mounted.div.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('Unlisted Token'),
      );
      expect(row?.textContent).toContain('Unverified');
      expect(row?.querySelector('[aria-label="Verified token"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays the address list beside the QR card on desktop widths', async () => {
    // Desktop layout (desktop-layout-v2): the heading spans both
    // columns, the pickers sit left and, on the details step, the
    // amount + QR card sit right, sticky while the left column
    // scrolls. Below lg the same blocks stack in one column in the
    // same order (space-y-3, no bare grid-cols-2), so the mobile
    // layout is untouched. Adapted from the tag's test: HEAD's
    // stepped flow only renders the QR card on the details step,
    // so the test drives there with reachDetails first.
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const root = mounted.div.firstElementChild as Element | null;
      expect(root?.className).toContain('lg:grid');
      expect(root?.className).toContain('lg:grid-cols-2');
      expect(root?.className).toContain('space-y-3');
      expect(root?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
      const heading = mounted.div.querySelector('h1');
      expect(heading?.className).toContain('lg:col-span-2');
      const qrColumn = [...mounted.div.querySelectorAll('div')].find((el) =>
        el.className.includes('lg:sticky'),
      );
      expect(qrColumn).not.toBeUndefined();
      expect(qrColumn?.querySelector('#receive-amount')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('filters the token list by ticker', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      const input = mounted.div.querySelector('#receive-token-filter') as HTMLInputElement;
      expect(input).not.toBeNull();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(input, 'link');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(mounted.div.textContent).toContain('ChainLink Token');
      expect(mounted.div.textContent).not.toContain('USD Coin');
    } finally {
      await mounted.cleanup();
    }
  });

  it('says so honestly when the filter resolves to no token', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      const input = mounted.div.querySelector('#receive-token-filter') as HTMLInputElement;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(input, 'NOTATOKEN');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(mounted.div.textContent).toContain('No token found for “NOTATOKEN”');
    } finally {
      await mounted.cleanup();
    }
  });

  it('selecting a token switches the amount to that token and encodes an EIP-681 transfer QR', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      const usdcButton = [...mounted.div.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('USD Coin'),
      );
      expect(usdcButton).not.toBeUndefined();
      await act(async () => {
        usdcButton?.dispatchEvent(new Event('click', { bubbles: true }));
      });
      const amountInput = mounted.div.querySelector('#receive-amount') as HTMLInputElement;
      expect(amountInput.placeholder).toContain('USDC');
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(amountInput, '25');
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // The QR encodes the EIP-681 transfer URI (readable via its title).
      const title = mounted.div.querySelector('svg title');
      expect(title?.textContent).toBe(
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979&uint256=25000000',
      );
      // The share link carries chain, address, amount and token.
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link?.textContent).toContain('chain=eth');
      expect(link?.textContent).toContain('to=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979');
      expect(link?.textContent).toContain('amount=25');
      expect(link?.textContent).toContain('token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane 3 (token Receive): an SPL token encodes a Solana Pay URI
  // with the mint — the amount is USDC, never SOL.
  it('selecting an SPL token encodes a Solana Pay URI with spl-token', async () => {
    const solAddress = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet({
      selectedChain: 'sol',
      addresses: {
        btc: [],
        eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
        trx: [],
        ton: [],
        sol: [{ index: 0, address: solAddress }],
      },
      vaultAddresses: {
        btc: [],
        eth: [VAULT_ETH],
        trx: [],
        ton: [],
        sol: [solAddress],
      },
    });
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'sol');
      await clickButton(mounted.div, 'USD Coin');
      const amountInput = mounted.div.querySelector('#receive-amount') as HTMLInputElement;
      expect(amountInput.placeholder).toContain('USDC');
      // No amount yet: the payment request still names the token.
      expect(mounted.div.querySelector('svg title')?.textContent).toBe(
        `solana:${solAddress}?spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
      );
      await fillInput(amountInput, '25');
      // The QR encodes the Solana Pay SPL transfer URI (readable via
      // its title) — the amount is 25 USDC, not 25 SOL.
      const title = mounted.div.querySelector('svg title');
      expect(title?.textContent).toBe(
        `solana:${solAddress}?amount=25&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
      );
      // The share link carries chain, address, amount and token.
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link?.textContent).toContain('chain=sol');
      expect(link?.textContent).toContain(`to=${solAddress}`);
      expect(link?.textContent).toContain('amount=25');
      expect(link?.textContent).toContain(
        'token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane 3 (token Receive): a Jetton encodes a ton://transfer URI
  // with the master — the amount is USDT, never TON.
  it('selecting a Jetton encodes a ton://transfer URI with jetton', async () => {
    const tonAddress = 'UQDYzZmfsrGzhObKJUw4gzdeIxEai3jAFbiGKGwxvxHinf4K';
    setWallet({
      selectedChain: 'ton',
      addresses: {
        btc: [],
        eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
        trx: [],
        ton: [{ index: 0, address: tonAddress }],
        sol: [],
      },
      vaultAddresses: {
        btc: [],
        eth: [VAULT_ETH],
        trx: [],
        ton: [tonAddress],
        sol: [],
      },
    });
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'ton');
      await clickButton(mounted.div, 'Tether USD');
      const amountInput = mounted.div.querySelector('#receive-amount') as HTMLInputElement;
      expect(amountInput.placeholder).toContain('USD₮');
      // No amount yet: the payment request still names the Jetton.
      expect(mounted.div.querySelector('svg title')?.textContent).toBe(
        `ton://transfer/${tonAddress}?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`,
      );
      await fillInput(amountInput, '25');
      // The QR encodes the Jetton transfer URI — 25 USDT in the
      // Jetton's smallest units (6 decimals), not 25 TON.
      const title = mounted.div.querySelector('svg title');
      expect(title?.textContent).toBe(
        `ton://transfer/${tonAddress}?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs&amount=25000000`,
      );
      // The share link carries chain, address, amount and token.
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link?.textContent).toContain('chain=ton');
      expect(link?.textContent).toContain(`to=${tonAddress}`);
      expect(link?.textContent).toContain('amount=25');
      expect(link?.textContent).toContain(
        'token=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane 3 (token Receive): TRON has no payment-request URI standard,
  // so a TRC-20 token's QR stays the plain TRON address (the same
  // address receives TRC-20 tokens) and the share link carries the
  // amount + token.
  it('selecting a TRC-20 token keeps the plain-address QR and links the token', async () => {
    const trxAddress = 'THK4PqR8JzXv7QmNn2bVcXfGdHsJkLpW3a';
    setWallet({
      selectedChain: 'trx',
      addresses: {
        btc: [],
        eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
        trx: [{ index: 0, address: trxAddress }],
        ton: [],
        sol: [],
      },
      vaultAddresses: {
        btc: [],
        eth: [VAULT_ETH],
        trx: [trxAddress],
        ton: [],
        sol: [],
      },
    });
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'trx');
      await clickButton(mounted.div, 'Tether USD');
      const amountInput = mounted.div.querySelector('#receive-amount') as HTMLInputElement;
      expect(amountInput.placeholder).toContain('USDT');
      await fillInput(amountInput, '10');
      // The main QR is the plain TRON address — TRON has no payment
      // URI — and the screen says so honestly.
      expect(mounted.div.querySelector('svg title')?.textContent).toBe(trxAddress);
      expect(mounted.div.textContent).toContain(
        'Requested amount: 10 USDT (shown as text',
      );
      // The share link still carries chain, address, amount and token.
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link?.textContent).toContain('chain=trx');
      expect(link?.textContent).toContain(`to=${trxAddress}`);
      expect(link?.textContent).toContain('amount=10');
      expect(link?.textContent).toContain('token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    } finally {
      await mounted.cleanup();
    }
  });

  it('steps chain, then token, then amount with QR and address', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // Item 20, step 1: chains only — no amount input, no QR yet.
      // The shared picker shows the current chain (Ethereum) in its
      // search field; the QR appears only on the details step.
      expect(mounted.div.querySelector('#receive-amount')).toBeNull();
      expect(mounted.div.querySelector('#receive-qr')).toBeNull();
      expect(
        (mounted.div.querySelector('#receive-chain') as HTMLInputElement)
          .value,
      ).toBe('Ethereum');
      await pickChain(mounted.div, 'eth');
      // Step 2: tokens for that chain — still no amount or QR.
      expect(mounted.div.textContent).toContain('USD Coin');
      expect(mounted.div.querySelector('#receive-amount')).toBeNull();
      expect(mounted.div.querySelector('#receive-qr')).toBeNull();
      await clickButton(mounted.div, 'Ethereum · ETH');
      // Step 3: amount above the QR, address, and actions.
      expect(mounted.div.querySelector('#receive-amount')).not.toBeNull();
      expect(mounted.div.querySelector('#receive-qr')).not.toBeNull();
      expect(mounted.div.textContent).toContain(VAULT_ETH);
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps every step compact: searchable picker, 216 px full QR card, truncated share link', async () => {
    // P1 (Lane S4, item 11): the chain step is the shared searchable
    // picker, not a 22-button grid; the QR card's code is 216 px, and
    // the long share link shows as one truncated line. Layout heights
    // are asserted in CDP.
    //
    // Lane 5 (2026-11-24): the 136 px value was Lane E's fold fix
    // (the template row sat 55 px below the fold at 192) — the
    // owner has since ordered the full card with a large QR, so
    // 216 is the size now (UX-major Lane 1 grew the B code 200 -> 216
    // toward Bitget's 62%-of-card share) and the template picker
    // sits behind the Customise disclosure instead of below the card.
    setWallet();
    const mounted = await mountScreen();
    try {
      const chainSection = mounted.div.querySelector(
        'section[aria-labelledby="receive-addresses-heading"]',
      );
      expect(chainSection).not.toBeNull();
      expect(chainSection?.querySelector('#receive-chain')).not.toBeNull();
      await reachDetails(mounted.div);
      const qrSvg = mounted.div.querySelector('#receive-qr svg');
      expect(qrSvg).not.toBeNull();
      expect(qrSvg?.getAttribute('width')).toBe('216');
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link).not.toBeNull();
      expect(link?.className).toContain('truncate');
      expect(link?.textContent).toContain('chain=eth');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows three QR templates and swaps the main QR on a segment tap', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // A token with no amount has no payment request, so the main QR
      // starts as the plain address.
      await pickChain(mounted.div, 'eth');
      await clickButton(mounted.div, 'USD Coin');
      const mainBefore = mounted.div.querySelector('svg title')?.textContent;
      expect(mainBefore).toBe(VAULT_ETH);
      // Lane 7 (Lane X, Lane D #69): the heading is just "QR type"
      // now — the shown template is the marked segment below, and the
      // unavailable payment template says why instead of sitting
      // there as a dead box. Lane 4: the segments are compact labels
      // now — the 64 px mini-QR thumbnails are gone (all three looked
      // identical at that size and no 64 px code is scannable).
      // Lane H (COSS Segmented Control): the switcher is one control
      // with all three templates as segments — the active one is
      // marked, not missing from the row.
      const switcher = mounted.div.querySelector(
        '[role="group"][aria-label="QR type"]',
      );
      expect(switcher).not.toBeNull();
      const addressSegment = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.getAttribute('aria-label') === 'Show address QR',
      );
      expect(addressSegment).not.toBeUndefined();
      expect(addressSegment?.getAttribute('aria-pressed')).toBe('true');
      expect(addressSegment?.className).toContain('bg-sun');
      // Lane H (checklist: badges reflow without clipping): the
      // longest segment label fits on one line at 390 px, so the
      // control stays one row tall.
      const paymentSegment = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show payment request QR',
      );
      expect(paymentSegment?.textContent).toContain('Payment request');
      // Lane 4: labels are 12 px semibold (the old 10 px labels sat
      // below the readability floor); the reason line under a disabled
      // segment is 12 px too.
      expect(paymentSegment?.querySelector('span:first-child')?.className).toContain(
        'font-semibold',
      );
      expect(paymentSegment?.querySelector('span:last-child')?.className).toContain(
        'text-xs',
      );
      const linkQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show share link QR',
      );
      expect(linkQr).not.toBeUndefined();
      // Lane 4: no thumbnail SVG in the segment — the label does the work.
      expect(linkQr?.querySelector('svg')).toBeNull();
      expect(linkQr?.textContent).toContain('Share link');
      const paymentQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show payment request QR',
      );
      expect(paymentQr).not.toBeUndefined();
      expect((paymentQr as HTMLButtonElement).disabled).toBe(true);
      expect(paymentQr?.textContent).toContain('Needs amount');
      expect(mounted.div.textContent).toContain(
        'Payment request needs an amount',
      );
      await act(async () => {
        linkQr?.click();
      });
      // Tapping the Share link segment swaps it into the main slot.
      const mainAfter = mounted.div.querySelector('svg title')?.textContent;
      expect(mainAfter).not.toBe(mainBefore);
      expect(mainAfter).toContain('chain=eth');
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(linkQr?.getAttribute('aria-pressed')).toBe('true');
      const addressQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show address QR',
      );
      expect(addressQr).not.toBeUndefined();
      expect(addressQr?.querySelector('svg')).toBeNull();
      expect(addressQr?.textContent).toContain('Address');
    } finally {
      await mounted.cleanup();
    }
  });

  it('enables the payment-request template once a token amount is typed', async () => {
    // Lane 7: for a token the payment request needs an amount — with
    // none typed the template is disabled with the reason. Typing an
    // amount makes it the main QR (it is the default when available);
    // tapping away to Address and back proves the tap-to-swap path.
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      await clickButton(mounted.div, 'USD Coin');
      const findSmall = (label: string) =>
        [...mounted.div.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label') === label,
        );
      const paymentQr = findSmall('Show payment request QR');
      expect(paymentQr).not.toBeUndefined();
      expect((paymentQr as HTMLButtonElement).disabled).toBe(true);
      const amountInput = mounted.div.querySelector(
        '#receive-amount',
      ) as HTMLInputElement;
      expect(amountInput).not.toBeNull();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(amountInput, '25');
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // The amount makes the payment request the main QR: its segment
      // is now the marked one in the switcher (Lane H — the active
      // template stays in the control, marked, instead of leaving
      // the row), and the hint goes away with it.
      const paymentSegment = findSmall('Show payment request QR');
      expect(paymentSegment).not.toBeUndefined();
      expect(paymentSegment?.getAttribute('aria-pressed')).toBe('true');
      expect(paymentSegment?.className).toContain('bg-sun');
      expect(mounted.div.textContent).not.toContain(
        'Payment request needs an amount',
      );
      // Lane X (Lane D #69): the active template is the marked segment above.
      const paymentTitle = mounted.div.querySelector('svg title');
      expect(paymentTitle?.textContent).toBe(
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979&uint256=25000000',
      );
      // Tap away to Address, then back to Payment request.
      const addressQr = findSmall('Show address QR');
      expect(addressQr).not.toBeUndefined();
      await act(async () => {
        addressQr?.click();
      });
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(addressQr?.getAttribute('aria-pressed')).toBe('true');
      const paymentQrAgain = findSmall('Show payment request QR');
      expect(paymentQrAgain).not.toBeUndefined();
      expect((paymentQrAgain as HTMLButtonElement).disabled).toBe(false);
      await act(async () => {
        paymentQrAgain?.click();
      });
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(paymentQrAgain?.getAttribute('aria-pressed')).toBe('true');
      const title = mounted.div.querySelector('svg title');
      expect(title?.textContent).toBe(
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979&uint256=25000000',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('lists non-zero tokens above zero balances', async () => {
    // Item 20: DAI holds a balance, USDC does not — DAI must sort
    // above USDC even though the registry lists USDC first.
    setWallet({
      balances: {
        eth: { status: 'available', value: '1000000000000000000' },
      },
      tokenBalances: {
        'eth:0x6b175474e89094c44da98b954eedeac495271d0f': {
          status: 'available',
          value: '1000000000000000000',
        },
      },
    });
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      const list = mounted.div.querySelector(
        'section[aria-labelledby="receive-tokens-heading"] ul',
      );
      expect(list).not.toBeNull();
      const rows = [...(list as HTMLUListElement).querySelectorAll('li')].map(
        (li) => li.textContent ?? '',
      );
      const dai = rows.findIndex((text) => text.includes('Dai Stablecoin'));
      const usdc = rows.findIndex((text) => text.includes('USD Coin'));
      expect(dai).toBeGreaterThanOrEqual(0);
      expect(usdc).toBeGreaterThanOrEqual(0);
      expect(dai).toBeLessThan(usdc);
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane C, item 8 — HD receive rotation, adapted to the item-20
  // stepped flow: the QR card and New address button live on the
  // details step, so each test drives the flow there first.

  it('shows the HD receive address and its number, with a New address button', async () => {
    // Lane C, item 8: the QR card shows the HD receiving address — the
    // fresh address for the next payment — not the account address.
    const HD_ETH = '0xHdReceiveAddress000000000000000000000000000001';
    setWallet({
      receiveAddresses: { eth: HD_ETH },
      receiveIndices: { eth: 2 },
      nextReceiveAddress: vi.fn(async () => {}),
    });
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      // The QR encodes the EIP-681 payment URI for the HD address.
      const qrTitle = mounted.div.querySelector('svg title')?.textContent;
      expect(qrTitle).toContain(HD_ETH);
      expect(qrTitle).not.toContain(VAULT_ETH);
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link?.textContent).toContain(`to=${HD_ETH}`);
      // Lane X (Lane D #67): "Address 3."
      expect(mounted.div.textContent).toContain('Address 3.');
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'New address',
      );
      expect(button).not.toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });


  it('New address advances the rotation for the selected chain', async () => {
    const nextReceiveAddress = vi.fn(async () => {});
    setWallet({
      receiveAddresses: { eth: '0xHdReceiveAddress000000000000000000000000000001' },
      receiveIndices: { eth: 0 },
      nextReceiveAddress,
    });
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'New address',
      ) as HTMLButtonElement;
      await act(async () => {
        button.click();
      });
      expect(nextReceiveAddress).toHaveBeenCalledWith('eth');
    } finally {
      await mounted.cleanup();
    }
  });


  it('shows New address for Solana now that it rotates (Lane A)', async () => {
    vi.mocked(availableFor).mockReturnValue(['sol', 'eth']);
    setWallet({
      selectedChain: 'sol',
      addresses: {
        btc: [],
        eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
        trx: [],
        ton: [],
        sol: [],
      },
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [], sol: ['DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'] },
      receiveAddresses: { sol: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK' },
      receiveIndices: { sol: 0 },
      nextReceiveAddress: vi.fn(async () => {}),
    });
    const mounted = await mountScreen();
    try {
      // P1 (Lane S4, item 11): the shared picker lists every
      // receivable chain — Solana is one search away, no toggle.
      await pickChain(mounted.div, 'sol');
      await clickButton(mounted.div, 'Solana · SOL');
      // Lane X (Lane D #67): "Address 1."
      expect(mounted.div.textContent).toContain('Address 1.');
      expect(
        [...mounted.div.querySelectorAll('button')].some(
          (candidate) => candidate.textContent === 'New address',
        ),
      ).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });


  it('hides New address for a watch-only address', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
      receiveAddresses: {},
      receiveIndices: {},
      nextReceiveAddress: vi.fn(async () => {}),
    });
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      // Lane X (Lane D #61): "Watch-only: can receive, can't send."
      expect(mounted.div.textContent).toContain(
        "Watch-only: can receive, can't send.",
      );
      expect(
        [...mounted.div.querySelectorAll('button')].some(
          (candidate) => candidate.textContent === 'New address',
        ),
      ).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen — network picker (shared picker, P1 Lane S4)', () => {
  it('uses the shared picker: every receivable chain listed, grouped, no second picker', async () => {
    // P1 (Lane S4, item 11): the chain step is the one shared
    // ChainSearchSelect — search, family grouping, logos, Recent —
    // not the old Popular / All-networks picker.
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#receive-chain',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Ethereum');
      await act(async () => {
        input.click();
      });
      // All 22 chains are one search away — Fantom is listed, not
      // behind a toggle.
      expect(mounted.div.textContent).toContain('Fantom');
      expect(mounted.div.querySelector('#receive-chain-listbox')).not.toBeNull();
      // Picking a chain still advances the flow.
      await pickChain(mounted.div, 'fantom');
      expect(mounted.div.textContent).toContain('Step 2 of 3: Token');
    } finally {
      await mounted.cleanup();
    }
  });

  it('searches all 22 networks by name, symbol or id', async () => {
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#receive-chain',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();
      await fillInput(input, 'sol');
      expect(mounted.div.textContent).toContain('Solana');
      expect(mounted.div.textContent).not.toContain('Bitcoin');
      await fillInput(input, 'zzz-no-such-chain');
      expect(mounted.div.textContent).toContain('No chains match');
      // Clearing the search lists every chain again.
      await fillInput(input, '');
      expect(mounted.div.textContent).toContain('Fantom');
      expect(mounted.div.textContent).toContain('Bitcoin');
    } finally {
      await mounted.cleanup();
    }
  });

  it('picks the first match with Enter', async () => {
    // The shared picker's combobox keys: typing filters, Enter picks
    // the first match (keyboard behaviour is covered in depth in
    // chain-search-select.test.tsx; this proves it is wired here).
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#receive-chain',
      ) as HTMLInputElement;
      await fillInput(input, 'sol');
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
      });
      expect(mounted.div.textContent).toContain('Step 2 of 3: Token');
      // The pick landed on Solana: the screen's chain derives from
      // the context selection, and this mock's setSelectedChain is a
      // no-op (its selectedChain stays 'eth'), so the token heading
      // still says Ethereum here — the call is the proof the pick
      // landed. The live preview shows the heading following the
      // pick, where the real context updates.
      expect(mockSetSelectedChain).toHaveBeenCalledWith('sol');
    } finally {
      await mounted.cleanup();
    }
  });

  it('clears the chain search with Escape', async () => {
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#receive-chain',
      ) as HTMLInputElement;
      await fillInput(input, 'sol');
      expect(mounted.div.querySelector('#receive-chain-listbox')).not.toBeNull();
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      });
      // Closed, the field shows the selected chain again.
      expect(mounted.div.querySelector('#receive-chain-listbox')).toBeNull();
      expect(input.value).toBe('Ethereum');
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps the picked chain in Recent on the next visit to the picker', async () => {
    // The shared picker records every pick — the chain just used is
    // one tap away when the user comes back to change networks.
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'sol');
      await clickButton(mounted.div, 'Back');
      const input = mounted.div.querySelector(
        '#receive-chain',
      ) as HTMLInputElement;
      await act(async () => {
        input.click();
      });
      expect(mounted.div.textContent).toContain('Recent');
      const recent = mounted.div.querySelector(
        '[aria-labelledby="receive-chain-recent-label"]',
      );
      expect(recent?.textContent).toContain('Solana');
    } finally {
      await mounted.cleanup();
    }
  });

  it('uses SVG chevrons on the picker, never a text glyph', async () => {
    // Lane H (ui-ux-pro-max checklist): SVG icons only — the old
    // '›' text chevron is an inline SVG now.
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      const chainSection = mounted.div.querySelector(
        'section[aria-labelledby="receive-addresses-heading"]',
      );
      expect(chainSection).not.toBeNull();
      expect(chainSection?.textContent).not.toContain('›');
      expect(chainSection?.querySelector('svg')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen — open on the last-used QR (P1 Lane S4, item 11)', () => {
  it('opens straight on the QR for the last-used chain, with no chain step', async () => {
    // Item 11: the common case needs no chain step — Receive opens
    // on the QR for the chain the wallet last used.
    localStorage.setItem('bawa:last-used-chain', JSON.stringify('eth'));
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('#receive-qr')).not.toBeNull();
      expect(mounted.div.querySelector('#receive-amount')).not.toBeNull();
      expect(mounted.div.querySelector('#receive-chain')).toBeNull();
      expect(mounted.div.textContent).toContain(VAULT_ETH);
    } finally {
      await mounted.cleanup();
    }
  });

  it('falls back to the chain step with no last-used chain', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('#receive-qr')).toBeNull();
      expect(mounted.div.querySelector('#receive-chain')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('says the network warning once', async () => {
    // Item 11: one warning line — the alert above the card is gone,
    // the paragraph below the card carries it.
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      expect(mounted.div.textContent).not.toContain('Send only on');
      const warnings = (mounted.div.textContent ?? '').split('Mainnet only')
        .length - 1;
      expect(warnings).toBe(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps the template picker behind a Customise disclosure', async () => {
    // Item 11: the 7 card styles and 3 QR types sit behind Share —
    // one tap to customise, zero scroll to the QR.
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const summary = [...mounted.div.querySelectorAll('summary')].find(
        (candidate) => candidate.textContent === 'Customise card',
      );
      expect(summary).not.toBeUndefined();
      // The pickers are in the DOM (behind the disclosure), and still
      // switch the card when picked.
      const group = mounted.div.querySelector('[aria-label="Card style"]');
      expect(group).not.toBeNull();
      const buttons = [...group!.querySelectorAll('button')];
      await act(async () => {
        buttons[1]?.click();
      });
      expect(
        mounted.div
          .querySelector('[data-testid="qr-card"]')
          ?.getAttribute('data-template'),
      ).toBe('a');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen — sharing the QR as an image (UI/UX fixes, item 4)', () => {
  // jsdom has no canvas and its Image never loads: install the fakes
  // the production QR renderer uses, per test. jsdom's
  // URL.createObjectURL also rejects Node-realm Blobs (its _buffer),
  // so the blob-URL pair is stubbed too — the browser has one realm
  // and needs none of this.
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  function stubQrRendering(): void {
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:fake-qr',
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: () => {},
      configurable: true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalCompositeOperation: 'source-over',
      fillRect: () => {},
      drawImage: () => {},
      // The card renderer measures and draws text; jsdom's canvas
      // has neither, so the fake measures 10px a character. The
      // card also draws circles, rounded rects and clips (QR-cards
      // Lane E), so those are no-ops here too.
      fillText: () => {},
      measureText: (text: string) => ({ width: text.length * 10 }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arcTo: () => {},
      arc: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      save: () => {},
      restore: () => {},
      clip: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: (blob: Blob | null) => void) => {
        callback(new Blob(['png-bytes'], { type: 'image/png' }));
      },
    );
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 192;
      height = 192;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);
  }

  function clickButtonByText(root: ParentNode, text: string): void {
    const button = [...root.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    expect(button).not.toBeUndefined();
    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  function stubNavigatorShare(share: unknown, canShare: unknown): void {
    Object.defineProperty(window.navigator, 'share', {
      value: share,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'canShare', {
      value: canShare,
      configurable: true,
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      configurable: true,
    });
    delete (window.navigator as unknown as Record<string, unknown>)['share'];
    delete (window.navigator as unknown as Record<string, unknown>)['canShare'];
  });

  it('shares the QR as a PNG image file when the platform supports file sharing', async () => {
    setWallet();
    stubQrRendering();
    const share = vi.fn(
      async (_args: {
        files: File[];
        title: string;
        text: string;
        url: string;
      }) => {},
    );
    stubNavigatorShare(share, vi.fn(() => true));
    const mounted = await mountScreen();
    try {
      // Item 20: Share/Download live on the details step.
      await reachDetails(mounted.div);
      clickButtonByText(mounted.div, 'Share');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(share).toHaveBeenCalledTimes(1);
      const args = share.mock.calls[0]![0];
      expect(args.files).toHaveLength(1);
      const file = args.files[0]!;
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('bawa-receive-eth.png');
      expect(file.type).toBe('image/png');
      expect(await file.text()).toBe('png-bytes');
      expect(mounted.div.textContent).toContain('Card shared.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('downloads the QR PNG when file sharing is not available', async () => {
    setWallet();
    stubQrRendering();
    stubNavigatorShare(undefined, vi.fn(() => false));
    const clickedAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedAnchors.push(this);
      },
    );
    const mounted = await mountScreen();
    try {
      // Item 20: Share/Download live on the details step.
      await reachDetails(mounted.div);
      clickButtonByText(mounted.div, 'Share');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(clickedAnchors).toHaveLength(1);
      expect(clickedAnchors[0]!.download).toBe('bawa-receive-eth.png');
      expect(clickedAnchors[0]!.href.startsWith('blob:')).toBe(true);
      expect(mounted.div.textContent).toContain('downloaded instead');
    } finally {
      await mounted.cleanup();
    }
  });

  it('downloads the card as a PNG from the Download card button', async () => {
    setWallet();
    stubQrRendering();
    const clickedAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedAnchors.push(this);
      },
    );
    const mounted = await mountScreen();
    try {
      // Item 20: Share/Download live on the details step.
      await reachDetails(mounted.div);
      clickButtonByText(mounted.div, 'Download card');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(clickedAnchors).toHaveLength(1);
      expect(clickedAnchors[0]!.download).toBe('bawa-receive-eth.png');
      expect(mounted.div.textContent).toContain('Card downloaded.');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen — the QR card (UI/UX Round 2, item 1)', () => {
  function setAmountInput(div: HTMLDivElement, value: string): void {
    const input = div.querySelector('#receive-amount') as HTMLInputElement;
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('shows the card with amount, address and network for the native coin', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card).not.toBeNull();
      // No amount typed yet — the card says so honestly.
      expect(card?.textContent).toContain('Any amount');
      expect(card?.textContent).toContain(VAULT_ETH);
      // Lane 5: the full card names the asset and its one network
      // in the title and subtitle, and closes with Bawa's footer.
      expect(card?.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive ETH',
      );
      expect(card?.querySelector('[data-testid="qr-card-subtitle"]')?.textContent).toBe(
        'Only Ethereum network assets can be received here.',
      );
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
      await act(async () => {
        setAmountInput(mounted.div, '0.5');
      });
      expect(card?.textContent).toContain('0.5 ETH');
      expect(card?.textContent).not.toContain('Any amount');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the token title, subtitle and name on the card for a token', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      const usdcButton = [...mounted.div.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('USD Coin'),
      );
      expect(usdcButton).not.toBeUndefined();
      await act(async () => {
        usdcButton?.dispatchEvent(new Event('click', { bubbles: true }));
      });
      await act(async () => {
        setAmountInput(mounted.div, '25');
      });
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card).not.toBeNull();
      expect(card?.textContent).toContain('25 USDC');
      // Lane 5: the title names the asset, the subtitle its network,
      // the token line its full name — the old 'usdc (eth)' label
      // line is gone; the title and subtitle already say it.
      expect(card?.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive USDC',
      );
      expect(card?.querySelector('[data-testid="qr-card-subtitle"]')?.textContent).toBe(
        'Only Ethereum network assets can be received here.',
      );
      expect(card?.textContent).toContain('USD Coin · Ethereum');
      expect(card?.querySelector('img[alt="USDC logo"]')).not.toBeNull();
      expect(card?.querySelector('img[alt="Ethereum logo"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('copies the full address from the copy button on the card', async () => {
    // Lane 5: the card carries its own copy button beside the
    // "Receiving address" label — the same copy as the action row
    // below the templates, but on the card itself.
    const writeText = vi.fn().mockResolvedValue(undefined);
    type ClipboardStub = {
      clipboard?: { writeText: (value: string) => Promise<void> };
    };
    const navigatorStub = navigator as unknown as ClipboardStub;
    const previousClipboard = navigatorStub.clipboard;
    navigatorStub.clipboard = { writeText };
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const copy = mounted.div.querySelector(
        '[aria-label="Copy receiving address"]',
      ) as HTMLButtonElement | null;
      expect(copy).not.toBeNull();
      expect((copy as HTMLButtonElement).disabled).toBe(false);
      await act(async () => {
        copy?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(writeText).toHaveBeenCalledWith(VAULT_ETH);
      expect(mounted.div.querySelector('[role="status"]')?.textContent).toBe(
        'Address copied.',
      );
    } finally {
      await mounted.cleanup();
      navigatorStub.clipboard = previousClipboard;
    }
  });

  it('encodes the selected template exactly in the card QR', async () => {
    // Lane 5: template switching still drives the card QR — the
    // payload is the exact payment URI / address / share link for
    // the template the screen names, never a stale one.
    setWallet();
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'eth');
      await clickButton(mounted.div, 'USD Coin');
      const findSmall = (label: string) =>
        [...mounted.div.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label') === label,
        );
      const mainTitle = () => mounted.div.querySelector('#receive-qr svg title')?.textContent;
      // No amount yet: the plain address.
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(findSmall('Show address QR')?.getAttribute('aria-pressed')).toBe('true');
      expect(mainTitle()).toBe(VAULT_ETH);
      await act(async () => {
        setAmountInput(mounted.div, '25');
      });
      // An amount makes the payment request the main QR.
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(findSmall('Show payment request QR')?.getAttribute('aria-pressed')).toBe('true');
      expect(mainTitle()).toBe(
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979&uint256=25000000',
      );
      // Tapping Address swaps the plain address back in.
      await act(async () => {
        findSmall('Show address QR')?.click();
      });
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(findSmall('Show address QR')?.getAttribute('aria-pressed')).toBe('true');
      expect(mainTitle()).toBe(VAULT_ETH);
      // Tapping Share link swaps the Bawa link in.
      await act(async () => {
        findSmall('Show share link QR')?.click();
      });
      // Lane X (Lane D #69): the active template is the marked segment.
      expect(findSmall('Show share link QR')?.getAttribute('aria-pressed')).toBe('true');
      expect(mainTitle()).toContain('chain=eth');
      expect(mainTitle()).toContain(`to=${VAULT_ETH}`);
      expect(mainTitle()).toContain('amount=25');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen — card style picker (QR-cards programme, Lane E; Lane 4 redesign)', () => {
  it('defaults to Paper and switches the card template when picked', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const group = mounted.div.querySelector('[aria-label="Card style"]');
      expect(group).not.toBeNull();
      const buttons = [...group!.querySelectorAll('button')];
      // Lane 4: seven label-only buttons (the old per-segment hints
      // wrapped to 3 lines at four templates); the active template's
      // hint shows as one line under the grid instead.
      expect(buttons.map((button) => button.textContent)).toEqual([
        'Paper',
        'Dark Teal',
        'Sun',
        'Ink',
        'Ticket',
        'Minimal',
        'Poster',
      ]);
      // Lane B (2026-11-28): the Paper hint is the clean light card
      // now, not the drawing style — the card was restyled flat.
      expect(mounted.div.textContent).toContain('Clean light card');
      const card = () => mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card()?.getAttribute('data-template')).toBe('b');
      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
      await act(async () => {
        buttons[1]?.click();
      });
      expect(card()?.getAttribute('data-template')).toBe('a');
      expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');
      expect(mounted.div.textContent).toContain('Closest to the Bitget bar');
      await act(async () => {
        buttons[2]?.click();
      });
      expect(card()?.getAttribute('data-template')).toBe('e');
      expect(mounted.div.textContent).toContain('Bright sun field');
      await act(async () => {
        buttons[6]?.click();
      });
      expect(card()?.getAttribute('data-template')).toBe('d');
    } finally {
      await mounted.cleanup();
    }
  });

  it('puts the amount, then Share, then the pickers — in that order', async () => {
    // Lane 4: the amount input sits directly under the card (it is
    // displayed on the card and encoded in its QR), Share is the first
    // action after the card + amount unit, and the style picker comes
    // after the actions — not the other way round.
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const amount = mounted.div.querySelector('#receive-amount');
      const share = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.textContent === 'Share',
      );
      const style = mounted.div.querySelector('[aria-label="Card style"]');
      expect(amount).not.toBeNull();
      expect(share).not.toBeUndefined();
      expect(style).not.toBeNull();
      expect(
        (amount as HTMLElement).compareDocumentPosition(share as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        (share as HTMLElement).compareDocumentPosition(style as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // Share is the one coral primary, full-width, 48 px.
      expect(share?.className).toContain('bg-coral');
      expect(share?.className).toContain('h-12');
    } finally {
      await mounted.cleanup();
    }
  });

  it('has one copy control (the card copy) and New address with the rotation note', async () => {
    // Lane 4: the standalone 'Copy address' button is gone — the
    // card's Copy is the one copy control; 'New address' sits with
    // the "Receiving address N" line it explains, after the share link.
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      expect(
        [...mounted.div.querySelectorAll('button')].find(
          (button) => button.textContent === 'Copy address',
        ),
      ).toBeUndefined();
      const copyLink = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.textContent === 'Copy link',
      );
      expect(copyLink).not.toBeUndefined();
      const newAddress = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.textContent === 'New address',
      );
      expect(newAddress).not.toBeUndefined();
      const shareLink = mounted.div.querySelector(
        '[data-testid="receive-share-link"]',
      );
      expect(shareLink).not.toBeNull();
      expect(
        (shareLink as HTMLElement).compareDocumentPosition(newAddress as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen - native BNB header logo (Lane 4, honest remains, 2026-11-28)', () => {
  it('shows the real BNB icon in the header circle for native BNB', async () => {
    // The file's beforeEach mocks availableFor to four chains; this
    // test needs BSC in the offered set, like the other full-list tests.
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet({
      addresses: {
        btc: [],
        eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
        trx: [],
        ton: [],
        bsc: [{ index: 0, address: VAULT_ETH }],
      },
      vaultAddresses: {
        btc: [],
        eth: [VAULT_ETH],
        trx: [],
        ton: [],
        bsc: [VAULT_ETH],
      },
      selectedChain: 'bsc',
    });
    const mounted = await mountScreen('/receive');
    try {
      await pickChain(mounted.div, 'bsc');
      await clickButton(mounted.div, 'BNB Smart Chain \u00b7 BNB');
      const header = mounted.div.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      const tokenImg = header?.querySelector('img[alt="BNB logo"]');
      expect(tokenImg).not.toBeNull();
      expect(tokenImg?.getAttribute('src')).toContain('smartchain');
      expect(header?.querySelector('[aria-label="BNB logo unavailable"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
