// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import {
  ChainLogo,
  TokenLogo,
  chainLogoFor,
  qrCardHeaderLogoFor,
  tokenLogoFor,
} from './token-logo';
import { DEFAULT_ENABLED_CHAINS, DEFAULT_TOKENS, type TokenRecord } from '../wallet/tokens';

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

  it('falls back to the link mark when a resolved icon fails and no symbol logo is allowed', () => {
    // Lane A: a custom token whose icon 404s shows the deliberate
    // fallback — never the bundled logo of a different token with the
    // same symbol. Merge (2026-11-24): Lane E's link mark replaces
    // Lane B's empty ring as that fallback.
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
    expect(empty?.className).not.toContain('bg-sun');
    expect(empty?.className).not.toContain('opacity-40');
    expect(empty?.querySelector('svg')).not.toBeNull();
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

describe('ChainLogo (Lane B, token-verify)', () => {
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

  function mountChain(chain: Parameters<typeof ChainLogo>[0]['chain']) {
    act(() => {
      root.render(
        <MemoryRouter>
          <ChainLogo chain={chain} />
        </MemoryRouter>,
      );
    });
  }

  it('renders a failed ETH-symbol chain logo as the link mark, never the Ethereum logo', () => {
    // Merge (2026-11-24): Lane E wired a real logo for Zora, so the
    // no-logo path is exercised by failing the load instead. Zora's
    // native token is ETH: the old symbol fallback showed the
    // Ethereum diamond on the Zora row (Lane B). A failed chain logo
    // must show Lane E's link mark, never the wrong network's mark.
    mountChain('zora');

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
    expect(empty?.className).not.toContain('opacity-40');
    expect(empty?.querySelector('svg')).not.toBeNull();
    expect(empty?.getAttribute('aria-label')).toBe('Zora logo unavailable');
  });

  it('renders a failed non-ETH chain logo as the link mark', () => {
    // Merge (2026-11-24): Velas has a real logo since Lane E; fail
    // the load to reach the fallback, which is Lane E's link mark.
    mountChain('velas');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    act(() => {
      img?.dispatchEvent(new Event('error'));
    });
    expect(div.querySelector('img')).toBeNull();
    const empty = div.querySelector('span[role="img"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toBe('');
    expect(empty?.querySelector('svg')).not.toBeNull();
    expect(empty?.getAttribute('aria-label')).toBe('Velas logo unavailable');
  });

  it('still renders the Ethereum logo for the Ethereum chain itself', () => {
    // ETH has no chain-keyed entry, so ChainLogo falls through to
    // the token logo — the ETH diamond, honestly the chain's mark.
    mountChain('eth');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.alt).toBe('ETH logo');
  });

  it('still renders a chain-keyed logo where one exists', () => {
    mountChain('arb');

    const img = div.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.alt).toContain('Arbitrum');
  });
});

describe('qrCardHeaderLogoFor (Lane 4, honest remains, 2026-11-28)', () => {
  it('resolves native BNB to the BNB Smart Chain mark, not the link fallback', () => {
    const logo = qrCardHeaderLogoFor(null, 'bsc');
    expect(logo).toBe(chainLogoFor('bsc'));
    expect(logo).toContain('smartchain');
  });

  it('resolves native BNB on opBNB to the opBNB mark, not the BSC one', () => {
    const logo = qrCardHeaderLogoFor(null, 'opbnb');
    expect(logo).toBe(chainLogoFor('opbnb'));
    expect(logo).toContain('opbnb');
  });

  it('resolves every curated native to a real logo', () => {
    for (const chain of DEFAULT_ENABLED_CHAINS) {
      expect(qrCardHeaderLogoFor(null, chain)).toBeDefined();
    }
  });

  it('keeps the symbol logo for the four chains with no chain-keyed entry', () => {
    expect(qrCardHeaderLogoFor(null, 'btc')).toBe(tokenLogoFor('BTC'));
    expect(qrCardHeaderLogoFor(null, 'eth')).toBe(tokenLogoFor('ETH'));
    expect(qrCardHeaderLogoFor(null, 'trx')).toBe(tokenLogoFor('TRX'));
    expect(qrCardHeaderLogoFor(null, 'ton')).toBe(tokenLogoFor('TON'));
  });

  it('prefers a token recorded icon over the bundled symbol logo', () => {
    const cake: TokenRecord = {
      chain: 'bsc',
      contract: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      name: 'PancakeSwap Token',
      symbol: 'CAKE',
      decimals: 18,
      coingeckoId: 'pancakeswap-token',
      addedAtMs: 1,
      iconUrl: 'https://example.invalid/cake.png',
    };
    expect(qrCardHeaderLogoFor(cake, 'bsc')).toBe('https://example.invalid/cake.png');
  });

  it('shows a curated default token its bundled logo when no icon was recorded', () => {
    const usdc = DEFAULT_TOKENS.find(
      (candidate) => candidate.chain === 'eth' && candidate.symbol === 'USDC',
    );
    if (usdc === undefined) throw new Error('default USDC missing from DEFAULT_TOKENS');
    expect(qrCardHeaderLogoFor({ ...usdc, iconUrl: undefined }, 'eth')).toBe(
      tokenLogoFor('USDC'),
    );
  });

  it('never lends a bundled logo to a user-added token sharing a symbol', () => {
    const copycat: TokenRecord = {
      chain: 'bsc',
      contract: '0x1111111111111111111111111111111111111111',
      name: 'USD Coin copy',
      symbol: 'USDC',
      decimals: 6,
      coingeckoId: null,
      addedAtMs: 1,
    };
    expect(qrCardHeaderLogoFor(copycat, 'bsc')).toBeUndefined();
  });
});
