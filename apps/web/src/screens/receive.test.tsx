// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { ReceiveScreen } from './receive';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
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
    ltc: { evmChainId: null },
    doge: { evmChainId: null },
  },
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

const VAULT_ETH = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

function setWallet(overrides: Record<string, unknown> = {}): void {
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
    setSelectedChain: vi.fn(),
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

// Item 20: drive the stepped flow to the details step — pick the
// Ethereum chain, then its native asset.
async function reachDetails(div: HTMLDivElement): Promise<void> {
  await clickButton(div, 'Ethereum');
  await clickButton(div, 'Ethereum · ETH');
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/receive']}>
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
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
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

  it('shows the watch-only alert when falling back to an imported address', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
    });
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      expect(mounted.div.textContent).toContain('0xWatchOnlyEthAddress0000000000000000000');
      expect(mounted.div.textContent).toContain(
        'Watch-only account — this address can receive, but this wallet cannot sign or send from it.',
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
      await clickButton(mounted.div, 'Ethereum');
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

  it('filters the token list by ticker', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await clickButton(mounted.div, 'Ethereum');
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
      await clickButton(mounted.div, 'Ethereum');
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
      await clickButton(mounted.div, 'Ethereum');
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

  it('steps chain, then token, then amount with QR and address', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // Item 20, step 1: chains only — no amount input, no QR yet.
      expect(mounted.div.querySelector('#receive-amount')).toBeNull();
      expect(mounted.div.querySelector('#receive-qr')).toBeNull();
      expect(mounted.div.textContent).toContain('Ethereum');
      await clickButton(mounted.div, 'Ethereum');
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

  it('shows three QR templates and swaps the main QR on a small QR tap', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // A token with no amount has no payment request, so the main QR
      // starts as the plain address.
      await clickButton(mounted.div, 'Ethereum');
      await clickButton(mounted.div, 'USD Coin');
      const mainBefore = mounted.div.querySelector('svg title')?.textContent;
      expect(mainBefore).toBe(VAULT_ETH);
      const linkQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show share link QR',
      );
      expect(linkQr).not.toBeUndefined();
      await act(async () => {
        linkQr?.click();
      });
      // Tapping the small share-link QR swaps it into the main slot;
      // the address QR drops into the small row.
      const mainAfter = mounted.div.querySelector('svg title')?.textContent;
      expect(mainAfter).not.toBe(mainBefore);
      expect(mainAfter).toContain('chain=eth');
      const addressQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show address QR',
      );
      expect(addressQr).not.toBeUndefined();
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
      await clickButton(mounted.div, 'Ethereum');
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
});
