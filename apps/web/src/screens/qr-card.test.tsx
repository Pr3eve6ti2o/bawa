// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import {
  QrCard,
  QR_CARD_FOOTER,
  chainShortLabel,
  qrCardSubtitle,
  qrCardTitle,
  qrCardTokenLabel,
  qrCardTokenSubline,
} from './qr-card';
import { chainConfig } from '../wallet/chains';
import type { TokenRecord } from '../wallet/tokens';

vi.mock('../wallet/chains', () => ({
  chainConfig: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const CHAINS = {
  eth: { displayName: 'Ethereum', symbol: 'ETH' },
  base: { displayName: 'Base', symbol: 'ETH' },
  bsc: { displayName: 'BNB Smart Chain', symbol: 'BNB' },
} as const;

type ChainKey = keyof typeof CHAINS;

function token(overrides: Partial<TokenRecord> = {}): TokenRecord {
  return {
    chain: 'base',
    contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addedAtMs: 0,
    ...overrides,
  };
}

describe('qr card labels (UI/UX Round 2, item 1)', () => {
  it('shortens BNB Smart Chain to bnb, and leaves other chains as-is', () => {
    expect(chainShortLabel('bsc' as never)).toBe('bnb');
    expect(chainShortLabel('base' as never)).toBe('base');
    expect(chainShortLabel('eth' as never)).toBe('eth');
  });

  it('labels a token as symbol (chain): usdc (base), pengu (bnb)', () => {
    vi.mocked(chainConfig).mockImplementation(
      (chain) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
    );
    expect(qrCardTokenLabel(token(), 'base')).toBe('usdc (base)');
    expect(
      qrCardTokenLabel(
        token({
          chain: 'bsc',
          contract: '0x0000000000000000000000000000000000000001',
          name: 'Pudgy Penguins',
          symbol: 'PENGU',
        }),
        'bsc',
      ),
    ).toBe('pengu (bnb)');
  });

  it('labels a native coin as its network name', () => {
    vi.mocked(chainConfig).mockImplementation(
      (chain) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
    );
    expect(qrCardTokenLabel(null, 'eth')).toBe('Ethereum');
    expect(qrCardTokenLabel(null, 'base')).toBe('Base');
    expect(qrCardTokenSubline(null, 'eth')).toBe('Native coin');
    expect(qrCardTokenSubline(token(), 'base')).toBe('USD Coin · Base');
  });
});

describe('qr card title and subtitle (Lane 5 full-card redesign)', () => {
  it('titles the card Receive {TOKEN} for a native coin and for a token', () => {
    vi.mocked(chainConfig).mockImplementation(
      (chain) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
    );
    expect(qrCardTitle(null, 'eth')).toBe('Receive ETH');
    expect(qrCardTitle(null, 'base')).toBe('Receive ETH');
    expect(qrCardTitle(token(), 'base')).toBe('Receive USDC');
    expect(
      qrCardTitle(
        token({
          chain: 'bsc',
          contract: '0x0000000000000000000000000000000000000001',
          name: 'Pudgy Penguins',
          symbol: 'PENGU',
        }),
        'bsc',
      ),
    ).toBe('Receive PENGU');
  });

  it('subtitles the card with the one network it can receive on', () => {
    vi.mocked(chainConfig).mockImplementation(
      (chain) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
    );
    expect(qrCardSubtitle('eth')).toBe(
      'Only Ethereum network assets can be received here.',
    );
    expect(qrCardSubtitle('base')).toBe(
      'Only Base network assets can be received here.',
    );
    expect(qrCardSubtitle('bsc')).toBe(
      'Only BNB Smart Chain network assets can be received here.',
    );
  });

  it('uses the caller-supplied network name on a test network', () => {
    vi.mocked(chainConfig).mockImplementation(
      (chain) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
    );
    expect(qrCardSubtitle('eth', 'Ethereum Sepolia')).toBe(
      'Only Ethereum Sepolia network assets can be received here.',
    );
  });

  it('has one footer line in Bawa’s own words', () => {
    expect(QR_CARD_FOOTER).toBe('Share the card, keep the keys.');
  });
});

describe('QrCard', () => {
  async function mountCard(props: {
    qrValue: string;
    amountText: string | null;
    address: string;
    token: TokenRecord | null;
    chain: ChainKey;
    onCopyAddress?: () => void;
    networkDisplayName?: string;
  }) {
    vi.mocked(chainConfig).mockImplementation(
      (chain) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
    );
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {
      root.render(<QrCard {...props} />);
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

  it('shows the full card: title, subtitle, large QR with centre mark, amount, full address with copy, footer', async () => {
    const onCopyAddress = vi.fn();
    const mounted = await mountCard({
      qrValue: 'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000',
      amountText: '25 USDC',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: token(),
      chain: 'base',
      onCopyAddress,
    });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card).not.toBeNull();
      // Title + subtitle name the asset and its one network.
      expect(card?.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive USDC',
      );
      expect(card?.querySelector('[data-testid="qr-card-subtitle"]')?.textContent).toBe(
        'Only Base network assets can be received here.',
      );
      // The QR is large (192 px) and carries the asset's mark in its centre.
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg).not.toBeNull();
      expect(qrSvg?.getAttribute('width')).toBe('192');
      expect(qrSvg?.querySelector('title')?.textContent).toBe(
        'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000',
      );
      expect(qrSvg?.querySelector('image')).not.toBeNull();
      // Amount, full address, token name + network, footer.
      expect(card?.textContent).toContain('25 USDC');
      expect(card?.textContent).toContain('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
      expect(card?.textContent).toContain('USD Coin · Base');
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
      // The header circle carries the token mark with the chain mark as its badge.
      const header = card?.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      expect(header?.querySelector('img[alt="USDC logo"]')).not.toBeNull();
      expect(header?.querySelector('img[alt="Base logo"]')).not.toBeNull();
      // The copy button beside the address calls back with the tap.
      const copy = card?.querySelector('[aria-label="Copy receiving address"]');
      expect(copy).not.toBeNull();
      expect(copy?.textContent).toContain('Copy');
      await act(async () => {
        (copy as HTMLButtonElement).click();
      });
      expect(onCopyAddress).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('frames the QR in a bordered tile with the header logos above it', async () => {
    const mounted = await mountCard({
      qrValue: 'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000',
      amountText: '25 USDC',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: token(),
      chain: 'base',
    });
    try {
      // Lane H: the QR sits in its own bordered tile — the card's
      // one memorable element is the QR, framed.
      const tile = mounted.div.querySelector('[data-testid="qr-card-tile"]');
      expect(tile).not.toBeNull();
      expect(tile?.querySelector('#qr-card-qr svg')).not.toBeNull();
      // Lane H (Oishi hard offset shadow): the tile carries the
      // shadow token, so the card reads as a physical card, not a
      // flat printout.
      expect(tile?.className).toContain('shadow-[var(--bawa-shadow)]');
      // The header — not a badge riding the tile's edge any more —
      // carries both marks, and the address reads in its own framed
      // strip, full and untruncated.
      const header = mounted.div.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      expect(header?.querySelector('img[alt="USDC logo"]')).not.toBeNull();
      expect(header?.querySelector('img[alt="Base logo"]')).not.toBeNull();
      const strip = mounted.div.querySelector('[data-testid="qr-card-address"]');
      expect(strip).not.toBeNull();
      expect(strip?.textContent).toContain('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Any amount, the network title and subtitle, and the native mark for a native coin', async () => {
    const mounted = await mountCard({
      qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amountText: null,
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      token: null,
      chain: 'eth',
    });
    try {
      expect(mounted.div.textContent).toContain('Any amount');
      expect(mounted.div.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive ETH',
      );
      expect(
        mounted.div.querySelector('[data-testid="qr-card-subtitle"]')?.textContent,
      ).toBe('Only Ethereum network assets can be received here.');
      expect(mounted.div.textContent).toContain('Ethereum');
      expect(mounted.div.querySelector('img[alt="ETH logo"]')).not.toBeNull();
      // A native coin needs no token-name line: the title and the
      // subtitle already name it and its network.
      expect(mounted.div.textContent).not.toContain('Native coin');
    } finally {
      await mounted.cleanup();
    }
  });

  it('falls back to a ticker badge when a token has no logo', async () => {
    const mounted = await mountCard({
      qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amountText: '10 PENGU',
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      token: token({
        chain: 'bsc',
        contract: '0x0000000000000000000000000000000000000001',
        name: 'Pudgy Penguins',
        symbol: 'PENGU',
      }),
      chain: 'bsc',
    });
    try {
      expect(mounted.div.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive PENGU',
      );
      expect(
        mounted.div.querySelector('[data-testid="qr-card-subtitle"]')?.textContent,
      ).toBe('Only BNB Smart Chain network assets can be received here.');
      expect(mounted.div.textContent).toContain('PENGU');
      // No USDC-style logo for PENGU — a badge with the ticker instead.
      expect(mounted.div.querySelector('img[alt="PENGU logo"]')).toBeNull();
      expect(mounted.div.querySelector('[aria-label="PENGU logo"]')).not.toBeNull();
      // The centre mark falls back to the network's mark, never a broken image.
      expect(mounted.div.querySelector('#qr-card-qr svg image')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('disables the copy button when no copy handler is given', async () => {
    const mounted = await mountCard({
      qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amountText: null,
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      token: null,
      chain: 'eth',
    });
    try {
      const copy = mounted.div.querySelector('[aria-label="Copy receiving address"]');
      expect(copy).not.toBeNull();
      expect((copy as HTMLButtonElement).disabled).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('uses the caller-supplied network name in the subtitle', async () => {
    const mounted = await mountCard({
      qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amountText: null,
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      token: null,
      chain: 'eth',
      networkDisplayName: 'Ethereum Sepolia',
    });
    try {
      expect(
        mounted.div.querySelector('[data-testid="qr-card-subtitle"]')?.textContent,
      ).toBe('Only Ethereum Sepolia network assets can be received here.');
    } finally {
      await mounted.cleanup();
    }
  });
});
