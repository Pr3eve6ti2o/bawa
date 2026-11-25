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

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
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

const ALL_CHAINS: ChainKey[] = [
  'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base',
  'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll',
  'opbnb', 'metis', 'aurora', 'fantom',
];

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
      await clickButton(mounted.div, 'Copy address');
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
      await clickButton(mounted.div, 'Ethereum');
      const row = [...mounted.div.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('Unlisted Token'),
      );
      expect(row?.textContent).toContain('Unverified');
      expect(row?.textContent).not.toContain('✓ Verified');
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
      await clickButton(mounted.div, 'All networks (18)');
      await clickButton(mounted.div, 'Solana');
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
      await clickButton(mounted.div, 'TON');
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
      await clickButton(mounted.div, 'TRON');
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

  it('keeps every step compact: searchable picker, 200 px full QR card, truncated share link', async () => {
    // Lane H: the chain step is a searchable picker (Popular first,
    // the rest behind All networks), not a 22-button grid; the QR
    // card's code is 200 px, and the long share link shows as one
    // truncated line. Layout heights are asserted in CDP.
    //
    // Lane 5 (2026-11-24): the 136 px value was Lane E's fold fix
    // (the template row sat 55 px below the fold at 192) — the
    // owner has since ordered the full card with a large QR, so
    // 200 is the size now (QR-cards Lane E respaced the card) and
    // the template row is reached with
    // one short scroll at 390 px instead of sitting above the fold.
    setWallet();
    const mounted = await mountScreen();
    try {
      const chainSection = mounted.div.querySelector(
        'section[aria-labelledby="receive-addresses-heading"]',
      );
      expect(chainSection).not.toBeNull();
      expect(chainSection?.querySelector('#receive-chain-search')).not.toBeNull();
      expect(chainSection?.textContent).toContain('Popular');
      await reachDetails(mounted.div);
      const qrSvg = mounted.div.querySelector('#receive-qr svg');
      expect(qrSvg).not.toBeNull();
      expect(qrSvg?.getAttribute('width')).toBe('200');
      const link = mounted.div.querySelector('[data-testid="receive-share-link"]');
      expect(link).not.toBeNull();
      expect(link?.className).toContain('truncate');
      expect(link?.textContent).toContain('chain=eth');
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
      // Lane 7: the heading names the shown template, the small QRs
      // are 64 px, and the unavailable payment template says why
      // instead of sitting there as a dead box.
      expect(mounted.div.textContent).toContain('QR type: Address');
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
      expect(paymentSegment?.querySelector('span:last-child')?.className).toContain(
        'text-[10px]',
      );
      const linkQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show share link QR',
      );
      expect(linkQr).not.toBeUndefined();
      expect(linkQr?.querySelector('svg')?.getAttribute('width')).toBe('64');
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
      // Tapping the small share-link QR swaps it into the main slot;
      // the address QR drops into the small row.
      const mainAfter = mounted.div.querySelector('svg title')?.textContent;
      expect(mainAfter).not.toBe(mainBefore);
      expect(mainAfter).toContain('chain=eth');
      expect(mounted.div.textContent).toContain('QR type: Share link');
      const addressQr = [...mounted.div.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Show address QR',
      );
      expect(addressQr).not.toBeUndefined();
      expect(addressQr?.querySelector('svg')?.getAttribute('width')).toBe(
        '64',
      );
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
      await clickButton(mounted.div, 'Ethereum');
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
      expect(mounted.div.textContent).toContain('QR type: Payment request');
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
      expect(mounted.div.textContent).toContain('QR type: Address');
      const paymentQrAgain = findSmall('Show payment request QR');
      expect(paymentQrAgain).not.toBeUndefined();
      expect((paymentQrAgain as HTMLButtonElement).disabled).toBe(false);
      await act(async () => {
        paymentQrAgain?.click();
      });
      expect(mounted.div.textContent).toContain('QR type: Payment request');
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
      expect(mounted.div.textContent).toContain(
        'Receiving address 3 of this account',
      );
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
      // Lane H: Solana is not a popular chain, so it sits behind
      // "All networks" in the picker.
      await clickButton(mounted.div, 'All networks (1)');
      await clickButton(mounted.div, 'Solana');
      await clickButton(mounted.div, 'Solana · SOL');
      expect(mounted.div.textContent).toContain(
        'Receiving address 1 of this account.',
      );
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
      expect(mounted.div.textContent).toContain(
        'Watch-only account — this address can receive',
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

describe('receive screen — network picker (Lane H)', () => {
  it('shows the popular chains first, with the rest behind All networks', async () => {
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      // Popular first, reachable without scrolling through all 22.
      expect(mounted.div.textContent).toContain('Popular');
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).toContain('Ethereum');
      expect(mounted.div.textContent).toContain('TRON');
      expect(mounted.div.textContent).toContain('TON');
      // The rest are grouped, not listed: Fantom is behind the toggle.
      expect(mounted.div.textContent).not.toContain('Fantom');
      expect(mounted.div.textContent).toContain('All networks (18)');
      await clickButton(mounted.div, 'All networks (18)');
      expect(mounted.div.textContent).toContain('Fantom');
      // Picking a grouped chain still advances the flow.
      await clickButton(mounted.div, 'Fantom');
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
        '#receive-chain-search',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();
      await fillInput(input, 'sol');
      expect(mounted.div.textContent).toContain('Solana');
      expect(mounted.div.textContent).not.toContain('Bitcoin');
      await fillInput(input, 'zzz-no-such-chain');
      expect(mounted.div.textContent).toContain('No networks match');
      // Clearing the search brings the Popular section back.
      await fillInput(input, '');
      expect(mounted.div.textContent).toContain('Popular');
      expect(mounted.div.textContent).not.toContain('Fantom');
    } finally {
      await mounted.cleanup();
    }
  });

  it('hides the All networks toggle when every chain is popular', async () => {
    vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Popular');
      expect(mounted.div.textContent).not.toContain('All networks');
    } finally {
      await mounted.cleanup();
    }
  });

  it('moves focus to the first chain with ArrowDown and picks the first match with Enter', async () => {
    // Lane H (COSS Combobox): the search is a combobox — ArrowDown
    // moves focus into the results, Enter picks the first match.
    vi.mocked(availableFor).mockReturnValue([...ALL_CHAINS]);
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#receive-chain-search',
      ) as HTMLInputElement;
      await fillInput(input, 'sol');
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
        );
      });
      const solanaButton = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.textContent?.includes('Solana'),
      );
      expect(document.activeElement).toBe(solanaButton);
      input.focus();
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
      });
      expect(mounted.div.textContent).toContain('Step 2 of 3: Token');
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
        '#receive-chain-search',
      ) as HTMLInputElement;
      await fillInput(input, 'sol');
      expect(mounted.div.textContent).not.toContain('Popular');
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      });
      expect(input.value).toBe('');
      expect(mounted.div.textContent).toContain('Popular');
    } finally {
      await mounted.cleanup();
    }
  });

  it('uses SVG chevrons on the picker rows, never a text glyph', async () => {
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
      const rowButton = [...mounted.div.querySelectorAll('button')].find(
        (button) => button.textContent?.includes('Ethereum'),
      );
      expect(rowButton?.querySelector('svg')).not.toBeNull();
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
      await clickButton(mounted.div, 'Ethereum');
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
      await clickButton(mounted.div, 'Ethereum');
      await clickButton(mounted.div, 'USD Coin');
      const findSmall = (label: string) =>
        [...mounted.div.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label') === label,
        );
      const mainTitle = () => mounted.div.querySelector('#receive-qr svg title')?.textContent;
      // No amount yet: the plain address.
      expect(mounted.div.textContent).toContain('QR type: Address');
      expect(mainTitle()).toBe(VAULT_ETH);
      await act(async () => {
        setAmountInput(mounted.div, '25');
      });
      // An amount makes the payment request the main QR.
      expect(mounted.div.textContent).toContain('QR type: Payment request');
      expect(mainTitle()).toBe(
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979&uint256=25000000',
      );
      // Tapping Address swaps the plain address back in.
      await act(async () => {
        findSmall('Show address QR')?.click();
      });
      expect(mounted.div.textContent).toContain('QR type: Address');
      expect(mainTitle()).toBe(VAULT_ETH);
      // Tapping Share link swaps the Bawa link in.
      await act(async () => {
        findSmall('Show share link QR')?.click();
      });
      expect(mounted.div.textContent).toContain('QR type: Share link');
      expect(mainTitle()).toContain('chain=eth');
      expect(mainTitle()).toContain(`to=${VAULT_ETH}`);
      expect(mainTitle()).toContain('amount=25');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('receive screen — card style picker (QR-cards programme, Lane E)', () => {
  it('defaults to Paper and switches the card template when picked', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await reachDetails(mounted.div);
      const group = mounted.div.querySelector('[aria-label="Card style"]');
      expect(group).not.toBeNull();
      const buttons = [...group!.querySelectorAll('button')];
      expect(buttons.map((button) => button.textContent)).toEqual([
        'PaperBawa drawing style',
        'Dark TealClosest to the Bitget bar',
        'MinimalPlain and quiet',
        'PosterBold, for sharing',
      ]);
      const card = () => mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card()?.getAttribute('data-template')).toBe('b');
      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
      await act(async () => {
        buttons[1]?.click();
      });
      expect(card()?.getAttribute('data-template')).toBe('a');
      expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');
      await act(async () => {
        buttons[3]?.click();
      });
      expect(card()?.getAttribute('data-template')).toBe('d');
    } finally {
      await mounted.cleanup();
    }
  });
});
