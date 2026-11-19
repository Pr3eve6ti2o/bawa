// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { TokenLogo, tokenLogoFor } from './token-logo';

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
