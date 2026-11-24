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

  it('renders an unknown symbol as the deliberate link mark without an image', () => {
    // Lane E: no yellow ticker badge and no faded empty ring — a paper
    // disc with an ink ring and a centred chain-link mark, no text.
    mount('ZZZZ');

    expect(div.querySelector('img')).toBeNull();

    const empty = div.querySelector('span[role="img"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toBe('');
    expect(empty?.className).not.toContain('bg-sun');
    expect(empty?.className).not.toContain('opacity-40');
    expect(empty?.querySelector('svg')).not.toBeNull();
    expect(empty?.getAttribute('aria-label')).toBe('ZZZZ logo unavailable');
  });

  it('replaces a failed token image with the link mark', () => {
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
    expect(empty?.querySelector('svg')).not.toBeNull();
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
      // Lane E: the 28 chains that had no Trust Wallet Assets icon.
      'zora',
      'mode',
      'fraxtal',
      'berachain',
      'arbnova',
      'worldchain',
      'unichain',
      'ink',
      'abstract',
      'soneium',
      'apechain',
      'immutable',
      'fuse',
      'velas',
      'xlayer',
      'taiko',
      'astar',
      'telos',
      'core',
      'songbird',
      'pulsechain',
      'chiliz',
      'flare',
      'hemi',
      'bob',
      'flowevm',
      'celestia',
      'dydx',
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
