// @vitest-environment jsdom
// Tests for the Swap screen (Lane 6). Quotes run through the real
// fetchSwapQuote with a stubbed global fetch returning the live-shaped
// LI.FI fixture (see wallet/swap-quotes.test.ts) — no network, no
// invented quote. The screen must show the honest empty state until a
// quote lands, and never a fake rate or route.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SwapScreen } from './swap';
import { useWallet } from '../state/wallet-context';

vi.mock('../state/wallet-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../state/wallet-context')>();
  return {
    ...actual,
    useWallet: vi.fn(),
  };
});

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const FROM = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

const LIFI_OK_FIXTURE = {
  type: 'lifi',
  tool: 'layerswap',
  estimate: {
    toAmountMin: '166163059',
    toAmount: '167627101',
    fromAmountUSD: '168.2710',
    toAmountUSD: '167.7414',
    feeCosts: [
      { name: 'LIFI Fixed Fee', amount: '250000000000000', amountUSD: '0.4207' },
      { name: 'LayerSwap fee', amount: '13520000000000', amountUSD: '0.022754' },
    ],
    gasCosts: [{ type: 'SEND', amount: '10690613224140', amountUSD: '0.0180' }],
    executionDuration: 15,
  },
};

function setWallet(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState: 'unlocked',
    vaultAddresses: { eth: [FROM], matic: [RECIPIENT] },
    balances: {
      eth: { status: 'available', value: '1000000000000000000' },
      matic: { status: 'available', value: '10000000000000000000' },
    },
    tokenBalances: {},
    devnetEnabled: false,
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
}

function stubFetch(body: unknown, status = 200): string[] {
  const seen: string[] = [];
  const fn = (async (url: unknown) => {
    seen.push(String(url));
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fn);
  return seen;
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/swap']}>
        <Routes>
          <Route path="/swap" element={<SwapScreen />} />
        </Routes>
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function waitForText(
  div: HTMLDivElement,
  text: string,
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (div.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error(`timed out waiting for text: ${text}`);
}

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}

async function click(div: HTMLDivElement, text: string): Promise<void> {
  await act(async () => {
    findButton(div, text).click();
  });
}

async function enterAmount(div: HTMLDivElement, value: string): Promise<void> {
  const input = div.querySelector('#swap-amount') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  await act(async () => {
    setInputValue(input as HTMLInputElement, value);
  });
}

async function pickToken(
  div: HTMLDivElement,
  groupLabel: string,
  symbol: string,
): Promise<void> {
  const group = div.querySelector(
    `[aria-label="${groupLabel}"]`,
  ) as HTMLElement | null;
  expect(group).not.toBeNull();
  const chip = [...(group as HTMLElement).querySelectorAll('button')].find(
    (candidate) => candidate.textContent === symbol,
  );
  expect(chip).not.toBeUndefined();
  await act(async () => {
    (chip as HTMLButtonElement).click();
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SwapScreen', () => {
  it('shows the no-wallet state with create/import actions', async () => {
    setWallet({ vaultState: 'no-vault' });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No wallet yet');
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector('a[href="/import-wallet"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the locked state with an unlock action', async () => {
    setWallet({ vaultState: 'locked' });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Your wallet is locked');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the honest empty state before any quote, never a fake one', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No quote yet');
      expect(mounted.div.textContent).not.toContain('You receive');
      expect(mounted.div.textContent).not.toContain('Route');
      const getQuote = findButton(mounted.div, 'Get quote');
      expect(getQuote.disabled).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a real LI.FI quote with route, fee and timing', async () => {
    setWallet();
    const seen = stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      // The fixture quotes ETH -> a 6-decimal USDC on Polygon, so pick
      // the app's own Polygon USDC first: the request must match the
      // token the screen will format the quote in.
      await pickToken(mounted.div, 'Token on Polygon', 'USDC');
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
      expect(seen[0]).toContain(
        'toToken=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      );
      expect(mounted.div.textContent).toContain('167.627101 USDC');
      expect(mounted.div.textContent).toContain('167.627101 USDC');
      expect(mounted.div.textContent).toContain('($167.74)');
      expect(mounted.div.textContent).toContain('layerswap via LI.FI');
      expect(mounted.div.textContent).toContain('$0.02 gas + $0.44 bridge fees');
      expect(mounted.div.textContent).toContain('About 15 seconds');
      expect(mounted.div.textContent).toContain('Slippage tolerance');
      expect(mounted.div.textContent).toContain('Quote from LI.FI');
      expect(mounted.div.textContent).toContain('1 ETH');
      expect(mounted.div.textContent).toContain('What happens next');
      expect(mounted.div.textContent).toContain(
        'Swaps are not executed in this wallet yet',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports no-route honestly when LI.FI has none', async () => {
    setWallet();
    stubFetch({ message: 'No route found', code: 1001 }, 400);
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'LI.FI found no route for this pair');
      expect(mounted.div.textContent).not.toContain('You receive');
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports rate-limiting honestly on a 429, never a raw code', async () => {
    setWallet();
    stubFetch({ message: 'Rate limit exceeded', code: 1005 }, 429);
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'rate-limited');
      expect(mounted.div.textContent).not.toContain('1005');
    } finally {
      await mounted.cleanup();
    }
  });

  it('uses exact decimals: 1 USDC is a million base units, 1 DAI is 10^18', async () => {
    setWallet();
    const seen: string[] = [];
    const fn = (async (url: unknown) => {
      seen.push(String(url));
      return new Response(JSON.stringify(LIFI_OK_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fn);
    const mounted = await mountScreen();
    try {
      // From-token USDC (6 decimals) on Ethereum.
      const fromGroup = mounted.div.querySelector(
        '[aria-label="Token on Ethereum"]',
      ) as HTMLElement | null;
      expect(fromGroup).not.toBeNull();
      const usdc = [...(fromGroup as HTMLElement).querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'USDC',
      );
      expect(usdc).not.toBeUndefined();
      await act(async () => {
        (usdc as HTMLButtonElement).click();
      });
      await enterAmount(mounted.div, '1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
      expect(seen[0]).toContain('fromAmount=1000000');
      expect(seen[0]).not.toContain('fromAmount=1000000000000000000');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the rate row when the quoted amount is over 1,000 units', async () => {
    // formatNativeAmount groups thousands, so a float-based rate goes
    // NaN and the row vanishes on exactly these quotes (seen live:
    // 0.1 ETH -> 2,209 POL showed no rate until the BigInt fix).
    setWallet();
    stubFetch({
      ...LIFI_OK_FIXTURE,
      estimate: {
        ...LIFI_OK_FIXTURE.estimate,
        toAmount: '2209517669330000000000',
        toAmountMin: '2187422492640000000000',
        toAmountUSD: '167.80',
      },
    });
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
      await waitForText(mounted.div, '2,209.517669 POL');
      await waitForText(mounted.div, '2,187.422492 POL');
      await waitForText(mounted.div, '1 ETH ≈ 22,095.176693 POL');
    } finally {
      await mounted.cleanup();
    }
  });

  it('says "1 second", not "1 seconds", when the quote settles in one', async () => {
    setWallet();
    stubFetch({
      ...LIFI_OK_FIXTURE,
      estimate: { ...LIFI_OK_FIXTURE.estimate, executionDuration: 1 },
    });
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
      await waitForText(mounted.div, 'About 1 second');
      expect(mounted.div.textContent).not.toContain('About 1 seconds');
    } finally {
      await mounted.cleanup();
    }
  });

  it('warns on an amount above the known balance but still quotes it', async () => {
    // A quote is free and signs nothing, so the balance warning is
    // shown, not enforced: an unfunded wallet can still price a swap.
    setWallet();
    stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '2');
      await waitForText(mounted.div, 'Amount exceeds available balance.');
      expect(findButton(mounted.div, 'Get quote').disabled).toBe(false);
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
    } finally {
      await mounted.cleanup();
    }
  });

  it('flags an invalid recipient inline and blocks the quote', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#swap-recipient',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input as HTMLInputElement, 'not-an-address');
      });
      await waitForText(mounted.div, 'Invalid Polygon address.');
      expect(findButton(mounted.div, 'Get quote').disabled).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('clears the quote when the amount changes, so nobody acts on a stale one', async () => {
    setWallet();
    stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
      await enterAmount(mounted.div, '0.2');
      await waitForText(mounted.div, 'No quote yet');
      expect(mounted.div.textContent).not.toContain('You receive');
    } finally {
      await mounted.cleanup();
    }
  });

  it('flips the direction with the switch button', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      const flip = mounted.div.querySelector(
        'button[aria-label="Switch direction"]',
      ) as HTMLButtonElement | null;
      expect(flip).not.toBeNull();
      await act(async () => {
        (flip as HTMLButtonElement).click();
      });
      // From is now Polygon (its native coin is POL) and the amount
      // label follows the new from-token.
      expect(mounted.div.textContent).toContain('Amount (POL)');
    } finally {
      await mounted.cleanup();
    }
  });

  it('says quotes are mainnet-only in devnet mode', async () => {
    setWallet({ devnetEnabled: true });
    const mounted = await mountScreen();
    try {
      await waitForText(mounted.div, 'Quotes are for mainnet');
      expect(findButton(mounted.div, 'Get quote').disabled).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });
});
