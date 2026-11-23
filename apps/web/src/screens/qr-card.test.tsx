// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import {
  QrCard,
  chainShortLabel,
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

describe('QrCard', () => {
  async function mountCard(props: {
    qrValue: string;
    amountText: string | null;
    address: string;
    token: TokenRecord | null;
    chain: ChainKey;
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

  it('shows QR, amount, address, token (chain) and both logos', async () => {
    const mounted = await mountCard({
      qrValue: 'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000',
      amountText: '25 USDC',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: token(),
      chain: 'base',
    });
    try {
      expect(mounted.div.querySelector('[data-testid="qr-card"]')).not.toBeNull();
      expect(mounted.div.querySelector('#qr-card-qr svg')).not.toBeNull();
      expect(mounted.div.textContent).toContain('25 USDC');
      expect(mounted.div.textContent).toContain('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
      expect(mounted.div.textContent).toContain('usdc (base)');
      expect(mounted.div.textContent).toContain('USD Coin · Base');
      expect(mounted.div.querySelector('img[alt="USDC logo"]')).not.toBeNull();
      expect(mounted.div.querySelector('img[alt="Base logo"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('frames the QR in a bordered tile with the token and chain badges on its edge', async () => {
    const mounted = await mountCard({
      qrValue: 'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000',
      amountText: '25 USDC',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      token: token(),
      chain: 'base',
    });
    try {
      // Lane H: the QR sits in its own bordered tile, and the token +
      // chain marks ride on the tile's edge as one badge — the card's
      // one memorable element is the QR, framed.
      const tile = mounted.div.querySelector('[data-testid="qr-card-tile"]');
      expect(tile).not.toBeNull();
      expect(tile?.querySelector('#qr-card-qr svg')).not.toBeNull();
      // Lane H (Oishi hard offset shadow): the tile carries the
      // shadow token, so the card reads as a physical card, not a
      // flat printout.
      expect(tile?.className).toContain('shadow-[var(--bawa-shadow)]');
      const badge = mounted.div.querySelector('[data-testid="qr-card-badge"]');
      expect(badge).not.toBeNull();
      expect(badge?.querySelector('img[alt="USDC logo"]')).not.toBeNull();
      expect(badge?.querySelector('img[alt="Base logo"]')).not.toBeNull();
      // The address reads in its own framed strip, full and untruncated.
      const strip = mounted.div.querySelector('[data-testid="qr-card-address"]');
      expect(strip).not.toBeNull();
      expect(strip?.textContent).toContain('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Any amount when no amount is set, and the network for a native coin', async () => {
    const mounted = await mountCard({
      qrValue: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      amountText: null,
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      token: null,
      chain: 'eth',
    });
    try {
      expect(mounted.div.textContent).toContain('Any amount');
      expect(mounted.div.textContent).toContain('Ethereum');
      expect(mounted.div.textContent).toContain('Native coin');
      expect(mounted.div.querySelector('img[alt="ETH logo"]')).not.toBeNull();
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
      expect(mounted.div.textContent).toContain('pengu (bnb)');
      expect(mounted.div.textContent).toContain('PENGU');
      // No USDC-style logo for PENGU — a badge with the ticker instead.
      expect(mounted.div.querySelector('img[alt="PENGU logo"]')).toBeNull();
      expect(mounted.div.querySelector('[aria-label="PENGU logo"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
