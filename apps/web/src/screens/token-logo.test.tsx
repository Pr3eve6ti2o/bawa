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

  it('renders an unknown symbol as an honest empty state without an image', () => {
    // Lane B: no yellow ticker badge — a plain ring, no fill, no text.
    mount('ZZZZ');

    expect(div.querySelector('img')).toBeNull();

    const empty = div.querySelector('span[role="img"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toBe('');
    expect(empty?.className).not.toContain('bg-sun');
    expect(empty?.getAttribute('aria-label')).toBe('ZZZZ logo unavailable');
  });

  it('replaces a failed token image with an empty state', () => {
    mount('USDC');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();

    act(() => {
      img?.dispatchEvent(new Event('error'));
    });

    expect(div.querySelector('img')).toBeNull();

    const empty = div.querySelector('span[role="img"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toBe('');
    expect(empty?.className).not.toContain('bg-sun');
    expect(empty?.getAttribute('aria-label')).toBe('USDC logo unavailable');
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

  it('prefers a resolved iconUrl over the bundled symbol logo', () => {
    // Lane A: a custom token's recorded icon wins — a fake USDC must
    // not wear the real USDC mark just because it shares the symbol.
    const iconUrl = 'https://example.invalid/bonk.png';
    act(() => {
      root.render(
        <MemoryRouter>
          <TokenLogo symbol="USDC" iconUrl={iconUrl} allowSymbolLogo={false} />
        </MemoryRouter>,
      );
    });
    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(iconUrl);
  });

  it('falls back to the empty ring when a resolved icon fails and no symbol logo is allowed', () => {
    // Lane A: a custom token whose icon 404s shows the honest ring —
    // never the bundled logo of a different token with the same symbol.
    const iconUrl = 'https://example.invalid/gone.png';
    act(() => {
      root.render(
        <MemoryRouter>
          <TokenLogo symbol="USDC" iconUrl={iconUrl} allowSymbolLogo={false} />
        </MemoryRouter>,
      );
    });
    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    act(() => {
      img?.dispatchEvent(new Event('error'));
    });
    expect(div.querySelector('img')).toBeNull();
    const empty = div.querySelector('span[role="img"]');
    expect(empty).not.toBeNull();
    expect(empty?.getAttribute('aria-label')).toBe('USDC logo unavailable');
  });

  it('falls back to the bundled symbol logo when a resolved icon fails and it is allowed', () => {
    // Lane A: a default token whose remote icon fails still shows its
    // bundled mark — its symbol IS its identity.
    const iconUrl = 'https://example.invalid/gone.png';
    act(() => {
      root.render(
        <MemoryRouter>
          <TokenLogo symbol="USDC" iconUrl={iconUrl} allowSymbolLogo />
        </MemoryRouter>,
      );
    });
    const img = div.querySelector('img');
    expect(img?.getAttribute('src')).toBe(iconUrl);
    act(() => {
      img?.dispatchEvent(new Event('error'));
    });
    const fallback = div.querySelector('img');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('src')).not.toBe(iconUrl);
    expect(fallback?.getAttribute('src')).not.toBe('');
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
