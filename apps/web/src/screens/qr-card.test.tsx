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
  splitAddressLines,
} from './qr-card';
import { chainConfig } from '../wallet/chains';
import {
  STARKNET_RECEIVE_ONLY_WARNING,
  type QrCardTemplate,
} from '../wallet/payment-links';
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
  zora: { displayName: 'Zora', symbol: 'ETH' },
  starknet: { displayName: 'Starknet', symbol: 'STRK' },
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

describe('splitAddressLines — the card address split (Lane B)', () => {
  it('splits a 42-char address into two balanced 21-char lines', () => {
    expect(
      splitAddressLines('0x742d35Cc6634C0532925a3b844Bc454e4438f44e'),
    ).toEqual(['0x742d35Cc6634C053292', '5a3b844Bc454e4438f44e']);
  });

  it('splits a 66-char Starknet address into three 22-char lines, never an orphan', () => {
    const address = `0x${'ab'.repeat(32)}`;
    expect(splitAddressLines(address)).toEqual([
      address.slice(0, 22),
      address.slice(22, 44),
      address.slice(44),
    ]);
    expect(splitAddressLines(address)[2]).toHaveLength(22);
  });

  it('leaves a short address on one line, and an empty address empty', () => {
    expect(splitAddressLines('0xabc')).toEqual(['0xabc']);
    expect(splitAddressLines('')).toEqual([]);
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
    template?: QrCardTemplate;
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
      // The QR is large (216 px) and carries the asset's mark in its centre.
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg).not.toBeNull();
      expect(qrSvg?.getAttribute('width')).toBe('216');
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

  it('frames the QR in a clean flat tile with the header logos above it', async () => {
    const mounted = await mountCard({
      qrValue: 'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000',
      amountText: '25 USDC',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: token(),
      chain: 'base',
    });
    try {
      // Lane B (2026-11-28): the QR sits in its own clean tile —
      // a paper panel with a 1 px hairline and a 20 px radius, no
      // ink frame and no hard offset shadow. The wobbly radius and
      // the --bawa-shadow are gone from the card.
      const tile = mounted.div.querySelector('[data-testid="qr-card-tile"]');
      expect(tile).not.toBeNull();
      expect(tile?.querySelector('#qr-card-qr svg')).not.toBeNull();
      expect(tile?.className).toContain('rounded-[20px]');
      expect(tile?.className).not.toContain('shadow-[var(--bawa-shadow)]');
      expect(tile?.className).not.toContain('border-2');
      // The header — not a badge riding the tile's edge any more —
      // carries both marks, and the address reads in its own soft
      // panel, full and untruncated, as two clean 21-char lines.
      const header = mounted.div.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      expect(header?.querySelector('img[alt="USDC logo"]')).not.toBeNull();
      expect(header?.querySelector('img[alt="Base logo"]')).not.toBeNull();
      const strip = mounted.div.querySelector('[data-testid="qr-card-address"]');
      expect(strip).not.toBeNull();
      expect(strip?.textContent).toContain('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
      expect(strip?.querySelectorAll('span')).toHaveLength(2);
      expect(strip?.querySelectorAll('span')[0]?.textContent).toBe(
        '0x742d35Cc6634C053292',
      );
      expect(strip?.querySelectorAll('span')[1]?.textContent).toBe(
        '5a3b844Bc454e4438f44e',
      );
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

  it('falls back to the link mark when a token has no logo', async () => {
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
      // No USDC-style logo for PENGU — the deliberate link mark, not
      // the yellow ticker badge (Lane B: badge removed 2026-11-23;
      // merge: Lane E's link mark replaces Lane B's empty ring).
      expect(mounted.div.querySelector('img[alt="PENGU logo"]')).toBeNull();
      const empty = mounted.div.querySelector('[aria-label="PENGU logo"]');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toBe('');
      expect(empty?.className).not.toContain('bg-sun');
      expect(empty?.className).not.toContain('opacity-40');
      expect(empty?.querySelector('svg')).not.toBeNull();
      // The centre mark falls back to the network's mark, never a broken image.
      expect(mounted.div.querySelector('#qr-card-qr svg image')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the real chain logo, not a ticker badge or the Ethereum logo, for a formerly icon-less chain', async () => {
    // Merge (2026-11-24): Lane E wired a real logo for Zora, so the
    // chain badge is the Zora mark now. The token mark is honestly
    // the ETH logo (Zora's native coin is ETH); the chain badge must
    // never be the yellow "ZO" ticker badge (Lane B) or the Ethereum
    // logo in place of the chain's own mark.
    const mounted = await mountCard({
      qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amountText: null,
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      token: null,
      chain: 'zora',
    });
    try {
      expect(mounted.div.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive ETH',
      );
      const header = mounted.div.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      expect(header?.querySelector('img[alt="ETH logo"]')).not.toBeNull();
      const chainBadge = header?.querySelector('img[alt="Zora logo"]');
      expect(chainBadge).not.toBeNull();
      expect(header?.textContent).not.toContain('ZO');
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

describe('QrCard templates (QR-cards programme, Lane E)', () => {
  const baseProps = {
    qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    amountText: '0.5 ETH',
    address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    token: null,
    chain: 'eth' as const,
  };

  it('defaults to the Paper template with the brand strip', async () => {
    const mounted = await mountCard(baseProps);
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('b');
      expect(card?.textContent).toContain('Bawa Wallet');
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Dark Teal with the inverted 218 px code and the Bawa link line', async () => {
    const mounted = await mountCard({ ...baseProps, template: 'a' });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('a');
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg?.getAttribute('width')).toBe('218');
      expect(card?.querySelector('[data-testid="qr-card-title"]')?.textContent).toBe(
        'Receive ETH',
      );
      expect(card?.textContent).toContain('Open the Bawa link');
      expect(card?.textContent).toContain('Bawa Wallet');
      // Lane B: A carries the footer tagline too now, above the link
      // line — the link line no longer takes its place.
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Minimal with the instruction line and the Bawa wordmark', async () => {
    const mounted = await mountCard({ ...baseProps, template: 'c' });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('c');
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg?.getAttribute('width')).toBe('224');
      expect(
        card?.querySelector('[data-testid="qr-card-instruction"]')?.textContent,
      ).toBe('Scan or share this QR code to receive crypto.');
      expect(card?.textContent).toContain('Bawa');
      // Lane B: C carries the footer tagline too now, above the wordmark.
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Poster with the sun underline and the ink address strip', async () => {
    const mounted = await mountCard({ ...baseProps, template: 'd' });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('d');
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg?.getAttribute('width')).toBe('222');
      expect(card?.querySelector('.bg-sun')).not.toBeNull();
      expect(card?.querySelector('.bg-ink')).not.toBeNull();
      expect(card?.textContent).toContain('Bawa Wallet');
      // Lane B: D carries the footer tagline too now, under the strip.
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Sun with the sun field, coral underline and ink strip', async () => {
    const mounted = await mountCard({ ...baseProps, template: 'e' });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('e');
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg?.getAttribute('width')).toBe('218');
      // The sun field is the card root itself, not a descendant.
      expect(card?.className).toContain('bg-sun');
      expect(card?.querySelector('.bg-ink')).not.toBeNull();
      expect(card?.textContent).toContain('Bawa Wallet');
      // Lane B: E carries the footer tagline too now, under the strip.
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Ink with the dark field, white tile and sun underline', async () => {
    const mounted = await mountCard({ ...baseProps, template: 'f' });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('f');
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg?.getAttribute('width')).toBe('216');
      // The ink field is the card root itself, not a descendant.
      expect(card?.className).toContain('bg-ink');
      expect(card?.querySelector('.bg-white')).not.toBeNull();
      expect(card?.textContent).toContain('Bawa Wallet');
      // Lane B: F carries the footer tagline too now, under the strip.
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('renders Ticket with the dashed tear line and sun bottom zone', async () => {
    const mounted = await mountCard({ ...baseProps, template: 'g' });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card?.getAttribute('data-template')).toBe('g');
      const qrSvg = card?.querySelector('#qr-card-qr svg');
      expect(qrSvg?.getAttribute('width')).toBe('216');
      expect(card?.querySelector('.border-dashed')).not.toBeNull();
      expect(card?.querySelector('.bg-sun')).not.toBeNull();
      expect(card?.textContent).toContain('Bawa Wallet');
      // Lane B: G carries the footer tagline too now, in the sun stub.
      expect(card?.querySelector('[data-testid="qr-card-footer"]')?.textContent).toBe(
        'Share the card, keep the keys.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('bolds the network name in the subtitle in every template', async () => {
    for (const template of ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const) {
      const mounted = await mountCard({ ...baseProps, template });
      try {
        const subtitle = mounted.div.querySelector(
          '[data-testid="qr-card-subtitle"]',
        );
        expect(subtitle?.textContent).toBe(
          'Only Ethereum network assets can be received here.',
        );
        expect(subtitle?.querySelector('strong')?.textContent).toBe('Ethereum');
      } finally {
        await mounted.cleanup();
      }
    }
  });

  it('pairs the receiving address with its identicon in every template', async () => {
    // Lane P2-C (M6): the address line carries the deterministic
    // identicon, so the receiver checks the picture, not just the
    // hex. The address text itself is untouched — same string, same
    // testid — and the identicon is the only new svg besides the QR.
    for (const template of ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const) {
      const mounted = await mountCard({ ...baseProps, template });
      try {
        const card = mounted.div.querySelector('[data-testid="qr-card"]');
        expect(card?.querySelector('[data-testid="qr-card-address"]')?.textContent).toBe(
          baseProps.address,
        );
        const identicons = card?.querySelectorAll(
          'svg[data-testid="address-identicon"]',
        );
        expect(identicons).toHaveLength(1);
        expect(identicons?.[0]?.getAttribute('aria-hidden')).toBe('true');
      } finally {
        await mounted.cleanup();
      }
    }
  });
});

describe('QrCard Starknet warning (receive-only Argent account)', () => {
  const starknetProps = {
    qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    amountText: '0.5 STRK',
    address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    token: null,
    chain: 'starknet' as const,
  };
  const ethProps = {
    qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    amountText: '0.5 ETH',
    address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    token: null,
    chain: 'eth' as const,
  };

  it('shows the full receive-only warning in every template', async () => {
    for (const template of ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const) {
      const mounted = await mountCard({ ...starknetProps, template });
      try {
        const warning = mounted.div.querySelector(
          '[data-testid="qr-card-starknet-warning"]',
        );
        expect(warning).not.toBeNull();
        // The shared constant, in full — never paraphrased or
        // shortened — after the subtitle and before the QR tile.
        expect(warning?.textContent).toBe(STARKNET_RECEIVE_ONLY_WARNING);
        const card = mounted.div.querySelector('[data-testid="qr-card"]');
        const ordered = [
          ...(card?.querySelectorAll(
            '[data-testid="qr-card-subtitle"], [data-testid="qr-card-starknet-warning"], [data-testid="qr-card-tile"]',
          ) ?? []),
        ].map((el) => el.getAttribute('data-testid'));
        expect(ordered).toEqual([
          'qr-card-subtitle',
          'qr-card-starknet-warning',
          'qr-card-tile',
        ]);
      } finally {
        await mounted.cleanup();
      }
    }
  });

  it('shows no warning for other chains', async () => {
    for (const template of ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const) {
      const mounted = await mountCard({ ...ethProps, template });
      try {
        expect(
          mounted.div.querySelector('[data-testid="qr-card-starknet-warning"]'),
        ).toBeNull();
        expect(mounted.div.textContent).not.toContain('counterfactual');
      } finally {
        await mounted.cleanup();
      }
    }
  });
});

  // Lane 4 (honest remains, 2026-11-28): the header circle shows
  // the real icon for native BNB (and a token's own recorded icon).
  it('shows the real BNB icon in the header circle for native BNB', async () => {
    const mounted = await mountCard({
      qrValue: 'bnb:0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      amountText: null,
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: null,
      chain: 'bsc',
    });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card).not.toBeNull();
      const header = card?.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      const tokenImg = header?.querySelector('img[alt="BNB logo"]');
      expect(tokenImg).not.toBeNull();
      expect(tokenImg?.getAttribute('src')).toContain('smartchain');
      expect(header?.querySelector('img[alt="BNB Smart Chain logo"]')).not.toBeNull();
      expect(header?.querySelector('[aria-label="BNB logo unavailable"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a token recorded icon in the header circle', async () => {
    const mounted = await mountCard({
      qrValue: 'bnb:0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      amountText: null,
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: token({
        chain: 'bsc',
        contract: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        name: 'PancakeSwap Token',
        symbol: 'CAKE',
        decimals: 18,
        coingeckoId: 'pancakeswap-token',
        iconUrl: 'https://example.invalid/cake.png',
      }),
      chain: 'bsc',
    });
    try {
      const card = mounted.div.querySelector('[data-testid="qr-card"]');
      expect(card).not.toBeNull();
      const header = card?.querySelector('[data-testid="qr-card-header"]');
      expect(header).not.toBeNull();
      const tokenImg = header?.querySelector('img[alt="CAKE logo"]');
      expect(tokenImg).not.toBeNull();
      expect(tokenImg?.getAttribute('src')).toBe('https://example.invalid/cake.png');
    } finally {
      await mounted.cleanup();
    }
  });
});
