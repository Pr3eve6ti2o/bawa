// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { TokenLogo, chainLogoFor, tokenLogoFor } from './token-logo';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('TokenLogo', () => {
  let div: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    div = document.createElement('div');
    root = createRoot(div);
    previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (previousActEnvironment === undefined) {
      delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
    } else {
      testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  function mount(symbol: string) {
    act(() => {
      root.render(
        <MemoryRouter>
          <TokenLogo symbol={symbol} />
        </MemoryRouter>,
      );
    });
  }

  it('renders a registered native symbol as an image', () => {
    mount('BTC');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.alt).toContain('BTC');

    const src = img?.getAttribute('src');
    expect(src).toBeTypeOf('string');
    expect(src).not.toBe('');
  });

  it('renders a registered ERC-20 symbol as an image', () => {
    mount('USDC');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.alt).toContain('USDC');

    const src = img?.getAttribute('src');
    expect(src).toBeTypeOf('string');
    expect(src).not.toBe('');
  });

  it('renders an unknown symbol as a badge without an image', () => {
    mount('ZZZZ');

    expect(div.querySelector('img')).toBeNull();

    const badge = div.querySelector('span[role="img"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('ZZZZ');
    expect(badge?.getAttribute('aria-label')).toBe('ZZZZ logo unavailable');
  });

  it('replaces a failed token image with a badge', () => {
    mount('USDC');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();

    act(() => {
      img?.dispatchEvent(new Event('error'));
    });

    expect(div.querySelector('img')).toBeNull();

    const badge = div.querySelector('span[role="img"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('USDC');
    expect(badge?.getAttribute('aria-label')).toBe('USDC logo unavailable');
  });

  it('renders WETH and USDT0 as images, not ticker badges', () => {
    // Lane G: both are default tokens (WETH on Ethereum, USDT0 on
    // Arbitrum) and both had real Trust Wallet logos — the rows showed
    // the yellow ticker badge instead.
    for (const symbol of ['WETH', 'USDT0']) {
      mount(symbol);

      const img = div.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.alt).toContain(symbol);
      expect(img?.getAttribute('src')).not.toBe('');
    }
  });

  it('maps on-chain variant symbols to the USDT / USDT0 logos', () => {
    // Lane G: the chains report these spellings on-chain (Arbitrum
    // USDT0 is USD₮0, Avalanche USDT is USDt) — the rows showed the
    // yellow badge for them instead of the real logo.
    expect(tokenLogoFor('USD₮')).toBe(tokenLogoFor('USDT'));
    expect(tokenLogoFor('USDt')).toBe(tokenLogoFor('USDT'));
    expect(tokenLogoFor('USD₮0')).toBe(tokenLogoFor('USDT0'));
  });

  it('returns a URL for every chain logo, including the late-registry chains', () => {
    // Lane G: Gnosis, Celo, Linea, Mantle, Scroll, opBNB, Metis,
    // Aurora and Fantom had no chain logo, so their rows showed the
    // yellow ticker badge (or the wrong Ethereum mark for the ETH-symbol
    // chains). Every registry chain must resolve to a real logo: the
    // four originals through the symbol map, the rest chain-keyed.
    for (const symbol of ['BTC', 'ETH', 'TRX', 'TON']) {
      const logo = tokenLogoFor(symbol);
      expect(logo).toBeTypeOf('string');
      expect(logo).not.toBe('');
    }
    const chains = [
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

    for (const chain of chains) {
      const logo = chainLogoFor(chain);
      expect(logo).toBeTypeOf('string');
      expect(logo).not.toBe('');
    }

    expect(chainLogoFor('nope')).toBeUndefined();
  });

  it('returns a URL for every registered symbol and undefined for an unknown symbol', () => {
    const symbols = [
      'BTC',
      'ETH',
      'TRX',
      'TON',
      'USDC',
      'USDT',
      'DAI',
      'LINK',
      'UNI',
      'WBTC',
      'WETH',
      'USDT0',
    ];

    for (const symbol of symbols) {
      const logo = tokenLogoFor(symbol);
      expect(logo).toBeTypeOf('string');
      expect(logo).not.toBe('');
      expect(tokenLogoFor(symbol.toLowerCase())).toBe(logo);
    }

    expect(tokenLogoFor('ZZZZ')).toBeUndefined();
  });
});
