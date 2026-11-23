// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      fillRect: () => {},
      drawImage: () => {},
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
      expect(mounted.div.textContent).toContain('QR code shared.');
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

  it('downloads the QR as a PNG from the Download QR button', async () => {
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
      clickButtonByText(mounted.div, 'Download QR');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(clickedAnchors).toHaveLength(1);
      expect(clickedAnchors[0]!.download).toBe('bawa-receive-eth.png');
      expect(mounted.div.textContent).toContain('QR code downloaded.');
    } finally {
      await mounted.cleanup();
    }
  });
});
