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
import type { StonfiQuoteInput } from '../wallet/stonfi-quotes';
import type { ChainId } from '../engine/boundary';

vi.mock('../state/wallet-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../state/wallet-context')>();
  return {
    ...actual,
    useWallet: vi.fn(),
  };
});

// D-16 sign flow: the STON.fi quote is canned (real coverage check),
// the order builder returns a canned unsigned transaction, and the
// vault + TON adapter are stubbed — signing runs end to end on the
// screen with no network and no real key.
vi.mock('../wallet/stonfi-quotes', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../wallet/stonfi-quotes')>();
  return {
    ...actual,
    fetchStonfiQuote: vi.fn(async (input: StonfiQuoteInput) => {
      const coverage = actual.stonfiCoversPair(
        input.fromChain,
        input.fromToken,
        input.toChain,
        input.toToken,
      );
      if (!coverage.covered) {
        return { status: 'not-covered', reason: coverage.reason };
      }
      return {
        status: 'ok',
        quote: {
          quoteId: 'quote-test-1',
          settlement: 'order',
          toAmountBaseUnits: '972487',
          toAmountMinBaseUnits: null,
          estimatedSettlementDurationSeconds: 13,
          tradeStartDeadlineMs: 4102444800 * 1000,
          fetchedAtMs: Date.now(),
        },
      };
    }),
    buildStonfiTonOrderTx: vi.fn(async () => ({
      ok: true,
      orderTx: { validUntil: 4102444800, messages: [] },
      htlcSecretHex: `0x${'ab'.repeat(32)}`,
    })),
  };
});

vi.mock('../wallet/stonfi-signing', () => ({
  signStonfiOrderTonOffline: vi.fn(async () => ({
    ok: true,
    messageHash: 'aabbccddeeff',
    messageCount: 1,
    validUntil: 4102444800,
    from: 'UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY',
  })),
}));

vi.mock('../wallet/vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/vault')>();
  return {
    ...actual,
    withMnemonicAsync: vi.fn(
      async (fn: (mnemonic: string) => unknown) =>
        fn(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        ),
    ),
    getSessionPassphrase: vi.fn(() => ''),
  };
});

vi.mock('../wallet/adapters', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../wallet/adapters')>();
  return {
    ...actual,
    getAdapterForMode: vi.fn((chain: ChainId, devnet: boolean) => {
      if (chain !== 'ton') return actual.getAdapterForMode(chain, devnet);
      return {
        getTxInputs: async () => ({
          status: 'ok' as const,
          data: { kind: 'seqno' as const, seqno: 7 },
        }),
      };
    }),
  };
});

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const FROM = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
// Solana System Program address — a well-known non-user address, used
// as the shape-valid fixture recipient for the default To side
// (Solana). Never a user address, never funded.
const SOL_RECIPIENT = '11111111111111111111111111111111';
const TON_ADDRESS = 'UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY';

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

// Live gas.zip fixtures (Lane C): the chains rows are verbatim from
// GET /v2/chains on 2026-11-26; the quote is the live 0.005 ETH ->
// Base response from the same day.
const GASZIP_CHAINS_FIXTURE = {
  chains: [
    {
      chain: 1,
      decimals: 18,
      inbound: true,
      mainnet: true,
      maxOutbound: 100,
      minOutbound: 0.05,
      name: 'Ethereum',
      price: 1706.93,
      symbol: 'ETH',
    },
    {
      chain: 501474,
      decimals: 9,
      inbound: true,
      mainnet: true,
      maxOutbound: 0,
      minOutbound: 0.015,
      name: 'Solana',
      price: 70.96,
      symbol: 'SOL',
    },
    {
      chain: 8453,
      decimals: 18,
      inbound: true,
      mainnet: true,
      maxOutbound: 2000,
      minOutbound: 0.015,
      name: 'Base',
      price: 1706.93,
      symbol: 'ETH',
    },
  ],
};

const GASZIP_QUOTE_FIXTURE = {
  calldata: '0x010036',
  contractDepositTxn: {
    data: '0xc9630cb00000000000000000000000000000000000000000000000000000000000000036eafd154aed18c7b98205d008dd21f5de29122042000000000000000000000000',
    to: '0x2a37D63EAdFe4b4682a3c28C1c2cD4F109Cc2762',
    value: '0x11c37937e08000',
  },
  expires: 1795697166,
  quotes: [
    {
      chain: 8453,
      decimals: 18,
      expected: 4999610396600102,
      expectedNative: 4999610396600102,
      gas: 126000000000,
      speed: 3.0,
      usd: 8.5351,
    },
  ],
};

function stubGasZipFetch(): void {
  const fn = (async (url: unknown) => {
    const target = String(url);
    if (target.includes('backend.gas.zip/v2/chains')) {
      return new Response(JSON.stringify(GASZIP_CHAINS_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.includes('backend.gas.zip/v2/quotes/')) {
      return new Response(JSON.stringify(GASZIP_QUOTE_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(LIFI_OK_FIXTURE), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fn);
}

function setRefuelWallet(): void {
  setWallet({
    vaultAddresses: {
      eth: [FROM],
      base: [RECIPIENT],
      matic: [RECIPIENT],
    },
    balances: {
      eth: { status: 'available', value: '1000000000000000000' },
      base: { status: 'available', value: '1000000000000000000' },
      matic: { status: 'available', value: '10000000000000000000' },
    },
  });
}

async function openRefuel(div: HTMLDivElement): Promise<void> {
  await click(div, 'Refuel gas');
  await waitForText(div, 'From network');
}

function setWallet(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState: 'unlocked',
    vaultAddresses: { eth: [FROM], matic: [RECIPIENT], sol: [SOL_RECIPIENT] },
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

async function pickChain(
  div: HTMLDivElement,
  selectId: string,
  chain: string,
  query: string,
): Promise<void> {
  const input = div.querySelector(`#${selectId}`) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  await act(async () => {
    setInputValue(input as HTMLInputElement, query);
  });
  const option = div.querySelector(
    `#${selectId}-option-${chain}`,
  ) as HTMLElement | null;
  expect(option).not.toBeNull();
  await act(async () => {
    (option as HTMLElement).click();
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  // P1 (Lane S4): the screen reads the shared last-used chain on
  // entry — clear it so every test starts from the same defaults.
  localStorage.clear();
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
      // Lane X (Lane D #85): "Enter an amount for a quote. Free to
      // check; signs nothing."
      expect(mounted.div.textContent).toContain('Enter an amount for a quote.');
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
      // P1 (Lane S4, item 10): with no last-used chain the To side
      // defaults to Solana — pick Polygon explicitly for the fixture pair.
      await pickChain(mounted.div, 'swap-to-chain', 'matic', 'Polygon');
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

  it('offers a Retry on a failed quote that refetches it', async () => {
    // P0-6: a failed quote said why and offered no way back —
    // re-entering the amount was the only retry. The first fetch
    // fails (rate limit); Retry refetches and the live quote lands.
    setWallet();
    stubFetch({ message: 'Rate limit exceeded', code: 1005 }, 429);
    const mounted = await mountScreen();
    try {
      // P1 (Lane S4, item 10): To defaults to Solana with no
      // last-used chain — pick Polygon explicitly for this pair.
      await pickChain(mounted.div, 'swap-to-chain', 'matic', 'Polygon');
      await pickToken(mounted.div, 'Token on Polygon', 'USDC');
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'rate-limited');
      stubFetch(LIFI_OK_FIXTURE);
      await click(mounted.div, 'Retry');
      await waitForText(mounted.div, 'You receive');
      expect(mounted.div.textContent).toContain('167.627101 USDC');
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
      // P1 (Lane S4, item 10): To defaults to Solana with no
      // last-used chain — pick Polygon explicitly for this pair, or
      // the fixture's POL amounts never render.
      await pickChain(mounted.div, 'swap-to-chain', 'matic', 'Polygon');
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
      // P1 (Lane S4, item 10): the recipient is validated against the
      // To chain, which now defaults to Solana — pick Polygon
      // explicitly for this pair.
      await pickChain(mounted.div, 'swap-to-chain', 'matic', 'Polygon');
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
      await waitForText(mounted.div, 'Enter an amount for a quote.');
      expect(mounted.div.textContent).not.toContain('You receive');
    } finally {
      await mounted.cleanup();
    }
  });

  it('flips the direction with the switch button', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // P1 (Lane S4, item 10): To defaults to Solana with no
      // last-used chain — pick Polygon as the To side first, so the
      // flip lands on POL.
      await pickChain(mounted.div, 'swap-to-chain', 'matic', 'Polygon');
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

  it('compares providers after a quote: Relay honest state, STON.fi corridor, best quote', async () => {
    setWallet();
    stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      // Lane X (Lane D #83): "{N} networks have no swap provider yet."
      await waitForText(
        mounted.div,
        'networks have no swap provider yet',
      );
      // P1 (Lane S4, item 10): To defaults to Solana with no
      // last-used chain — pick Polygon explicitly for this pair.
      await pickChain(mounted.div, 'swap-to-chain', 'matic', 'Polygon');
      await pickToken(mounted.div, 'Token on Polygon', 'USDC');
      await enterAmount(mounted.div, '0.1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'You receive');
      await waitForText(mounted.div, 'Compare providers');
      expect(mounted.div.textContent).toContain(
        'Relay quotes need a proxy or access-token endpoint — not set up yet',
      );
      // The default pair is native ETH -> native POL: STON.fi covers
      // stablecoins only, so the corridor row says so.
      expect(mounted.div.textContent).toContain(
        'STON.fi covers stablecoins only',
      );
      // LI.FI is the only live quote, so it is the best by definition.
      expect(mounted.div.textContent).toContain('Best quote');
    } finally {
      await mounted.cleanup();
    }
  });

  it('refuels gas through gas.zip: live chains, live quote, deposit address shown', async () => {
    setRefuelWallet();
    stubGasZipFetch();
    const mounted = await mountScreen();
    try {
      await openRefuel(mounted.div);
      const input = mounted.div.querySelector(
        '#refuel-amount',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input as HTMLInputElement, '0.005');
      });
      await waitForText(mounted.div, 'About $8.53');
      await click(mounted.div, 'Get refuel quote');
      await waitForText(mounted.div, 'Refuel quote');
      expect(mounted.div.textContent).toContain('0.004999 ETH');
      expect(mounted.div.textContent).toContain('($8.54)');
      // The deposit address comes from the live quote — never the
      // docs example address.
      expect(mounted.div.textContent).toContain(
        '0x2a37D63EAdFe4b4682a3c28C1c2cD4F109Cc2762',
      );
      expect(mounted.div.textContent).not.toContain(
        '0x391E7C679d29bD940d63be94AD22A25d25b5A604',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('blocks a refuel above the $50 per-chain maximum', async () => {
    setRefuelWallet();
    stubGasZipFetch();
    const mounted = await mountScreen();
    try {
      await openRefuel(mounted.div);
      const input = mounted.div.querySelector(
        '#refuel-amount',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input as HTMLInputElement, '1');
      });
      await waitForText(
        mounted.div,
        'Above the $50.00 maximum per destination chain.',
      );
      expect(findButton(mounted.div, 'Get refuel quote').disabled).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('discloses quote data sharing on the Swap screen', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        'Getting a quote sends your from and to addresses to LI.FI',
      );
      expect(mounted.div.textContent).toContain(
        'STON.fi receives no wallet address',
      );
      expect(mounted.div.textContent).toContain(
        'Relay receives none today because no proxy is set up',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('signs a TON-source STON.fi order offline and shows the signed BoC, never sending it', async () => {
    setWallet({
      vaultAddresses: { ton: [TON_ADDRESS], base: [RECIPIENT] },
      balances: {
        ton: { status: 'available', value: '10000000000' },
        base: { status: 'available', value: '1000000000000000000' },
      },
    });
    stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'swap-from-chain', 'ton', 'TON');
      await pickToken(mounted.div, 'Token on TON', 'USD₮');
      await pickChain(mounted.div, 'swap-to-chain', 'base', 'Base');
      await pickToken(mounted.div, 'Token on Base', 'USDC');
      await enterAmount(mounted.div, '1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'Compare providers');
      await waitForText(mounted.div, 'TON signing for STON.fi orders is wired');
      expect(findButton(mounted.div, 'Sign order')).not.toBeUndefined();
      await click(mounted.div, 'Sign order');
      await waitForText(mounted.div, 'Signed, not broadcast');
      expect(mounted.div.textContent).toContain(`signed from ${TON_ADDRESS}`);
      expect(mounted.div.textContent).toContain('Message hash aabbccddeeff');
      // Lane X (Lane D #88): the idle line is "Signing returns a BoC
      // only. Nothing is sent." — once signed, the signed line keeps
      // "…broadcast authorisation — nothing was sent."
      expect(mounted.div.textContent).toContain('nothing was sent');
      // Lane X (Lane D #89): "Secret held in memory only."
      expect(mounted.div.textContent).toContain('Secret held in memory only.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('offers no signing when TON is only the destination leg', async () => {
    setWallet({
      vaultAddresses: { base: [RECIPIENT], ton: [TON_ADDRESS] },
      balances: {
        base: { status: 'available', value: '1000000000000000000' },
        ton: { status: 'available', value: '10000000000' },
      },
    });
    stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'swap-from-chain', 'base', 'Base');
      await pickToken(mounted.div, 'Token on Base', 'USDC');
      await pickChain(mounted.div, 'swap-to-chain', 'ton', 'TON');
      await pickToken(mounted.div, 'Token on TON', 'USD₮');
      await enterAmount(mounted.div, '1');
      await click(mounted.div, 'Get quote');
      await waitForText(mounted.div, 'Compare providers');
      await waitForText(mounted.div, 'STON.fi');
      expect(mounted.div.textContent).not.toContain('Sign order');
      expect(mounted.div.textContent).not.toContain(
        'TON signing for STON.fi orders is wired',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('auto-fires the quote on amount entry, without tapping Get quote', async () => {
    // P1 (Lane S4, item 10): typing an amount is the quote request —
    // no manual Get-quote tap exists in the top-tier flow.
    setWallet();
    stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      await waitForText(mounted.div, 'You receive');
      expect(mounted.div.textContent).toContain('layerswap via LI.FI');
      expect(mounted.div.textContent).toContain('($167.74)');
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps Get quote a real primary button, never dashed', async () => {
    // P1 (Lane S4, item 10): the button is the Lane T primary
    // (coral), enabled once an amount is typed — never a dashed
    // outline that reads as disabled.
    setWallet();
    const mounted = await mountScreen();
    try {
      await enterAmount(mounted.div, '0.1');
      const getQuote = findButton(mounted.div, 'Get quote');
      expect(getQuote.disabled).toBe(false);
      expect(getQuote.className).toContain('bg-coral');
      expect(getQuote.className).not.toContain('border-dashed');
    } finally {
      await mounted.cleanup();
    }
  });

  it('defaults To to a different chain LI.FI can quote, never the from-chain', async () => {
    // T1-11: a recorded last-used chain is the From default; To is
    // the first LI.FI-covered chain that is not From — the same pair
    // can never quote, so it is never the default.
    localStorage.setItem('bawa:last-used-chain', JSON.stringify('base'));
    setWallet({
      vaultAddresses: { eth: [FROM], base: [RECIPIENT], matic: [RECIPIENT] },
      balances: {
        eth: { status: 'available', value: '1000000000000000000' },
        base: { status: 'available', value: '1000000000000000000' },
        matic: { status: 'available', value: '10000000000000000000' },
      },
    });
    const mounted = await mountScreen();
    try {
      const fromInput = mounted.div.querySelector(
        '#swap-from-chain',
      ) as HTMLInputElement;
      const toInput = mounted.div.querySelector(
        '#swap-to-chain',
      ) as HTMLInputElement;
      expect(fromInput.value).toBe('Base');
      expect(toInput.value).toBe('Ethereum');
    } finally {
      await mounted.cleanup();
    }
    // Nothing recorded: From is Ethereum, To is the first LI.FI-covered
    // chain that is not Ethereum — Solana.
    localStorage.clear();
    setWallet();
    const second = await mountScreen();
    try {
      const toInput = second.div.querySelector(
        '#swap-to-chain',
      ) as HTMLInputElement;
      expect(toInput.value).toBe('Solana');
    } finally {
      await second.cleanup();
    }
  });

  it('blocks the same pair from quoting, before any request fires', async () => {
    // T1-11: ETH -> ETH can never quote — the guard disables Get quote
    // with its reason, so the auto-quote never fires a doomed LI.FI
    // request against the keyless quota.
    setWallet();
    const seen = stubFetch(LIFI_OK_FIXTURE);
    const mounted = await mountScreen();
    try {
      await pickChain(mounted.div, 'swap-to-chain', 'eth', 'Ethereum');
      await enterAmount(mounted.div, '0.1');
      await waitForText(mounted.div, 'Choose a different network');
      expect(findButton(mounted.div, 'Get quote').disabled).toBe(true);
      // The auto-quote debounce is 600 ms — past it, no request fired.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
      });
      expect(seen).toHaveLength(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('collapses the Refuel essay and What happens next into one-line disclosures', async () => {
    // P1 (Lane S4, item 10): one line each on screen; the essays
    // live behind disclosures, still in the DOM.
    setWallet();
    const mounted = await mountScreen();
    try {
      // Lane X (Lane D #86/#87): "Out of gas? gas.zip sends a little
      // native gas. $0.25–$50.00 per network." / "Swaps aren't executed
      // yet — quotes only."
      expect(mounted.div.textContent).toContain(
        'Out of gas? gas.zip sends a little native gas.',
      );
      expect(mounted.div.textContent).toContain(
        "Swaps aren't executed yet — quotes only.",
      );
      expect(mounted.div.textContent).toContain('What happens next');
      expect(mounted.div.textContent).toContain(
        'Swaps are not executed in this wallet yet',
      );
      expect(mounted.div.textContent).toContain(
        'Getting a quote sends your from and to addresses to LI.FI',
      );
      const disclosures = mounted.div.querySelectorAll('details');
      expect(disclosures.length).toBeGreaterThanOrEqual(2);
    } finally {
      await mounted.cleanup();
    }
  });
});
