// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SendScreen } from './send';
import { useWallet } from '../state/wallet-context';
import { getAdapterForMode } from '../wallet/adapters';
import type { ChainAdapter } from '../wallet/adapters/types';

vi.mock('../state/wallet-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../state/wallet-context')>();
  return {
    ...actual,
    useWallet: vi.fn(),
    ensureAdapters: vi.fn(async () => undefined),
    ensureDevnetAdapters: vi.fn(async () => undefined),
  };
});

const ethAdapter: ChainAdapter = {
  chain: 'eth',
  networkId: 'eip155:1',
  getBalance: async () => ({
    status: 'ok',
    data: {
      chain: 'eth',
      address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
      networkId: 'eip155:1',
      valueBaseUnits: '1000000000000000000',
      decimals: 18,
      source: 'stub',
      fetchedAt: 0,
    },
    source: 'stub',
    fetchedAt: 0,
  }),
  getHistory: async () => ({
    status: 'ok',
    data: [],
    source: 'stub',
    fetchedAt: 0,
  }),
  estimateFee: async () => ({
    status: 'ok',
    data: {
      chain: 'eth',
      networkId: 'eip155:1',
      feeBaseUnits: '420000000000000',
      unit: 'wei',
      note: 'stub fee',
      source: 'stub',
      fetchedAt: 0,
    },
    source: 'stub',
    fetchedAt: 0,
  }),
  getTxInputs: async () => ({
    status: 'ok',
    data: { kind: 'nonce', nonce: 7 },
    source: 'stub',
    fetchedAt: 0,
  }),
  broadcast: async (): Promise<never> => {
    throw new Error('disabled');
  },
};

vi.mock('../wallet/adapters', () => ({
  getAdapter: vi.fn(() => ethAdapter),
  getAdapterForMode: vi.fn(() => ethAdapter),
  registerAdapter: vi.fn(),
  registeredChains: vi.fn(() => ['eth']),
  registerAllAdapters: vi.fn(),
}));

// Real validateRecipient/previewSendAmount; only the offline signer is
// stubbed (its real behaviour is covered in send.test.ts).
vi.mock('../wallet/send', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../wallet/send')>();
  return {
    ...actual,
    signEvmOffline: vi.fn(async () => ({
      ok: true,
      signedTxHex: '0xdeadbeef',
      txHash: '0xhash1234',
      from: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    })),
    signEvmTokenOffline: vi.fn(async () => ({
      ok: true,
      signedTxHex: '0xdeadbeef',
      txHash: '0xhash1234',
      from: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    })),
  };
});

// The token simulate re-reads the token balance live; stub that read
// (100 USDC) so the screen test stays hermetic — the real simulate
// is covered in send.test.ts with stub adapters.
vi.mock('../wallet/adapters/token-balances', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../wallet/adapters/token-balances')
    >();
  return {
    ...actual,
    fetchTokenBalance: vi.fn(async () => ({
      status: 'ok',
      data: {
        chain: 'eth',
        address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        networkId: 'eip155:1',
        valueBaseUnits: '100000000',
        decimals: 6,
        source: 'stub',
        fetchedAt: 0,
      },
      source: 'stub',
      fetchedAt: 0,
    })),
  };
});

vi.mock('../wallet/vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/vault')>();
  return {
    ...actual,
    getSessionPassphrase: vi.fn(() => ''),
    withMnemonicAsync: vi.fn(
      async (fn: (mnemonic: string) => Promise<unknown>) =>
        fn(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        ),
    ),
  };
});

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const FROM = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

function setWallet(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState: 'unlocked',
    vaultAddresses: { btc: [], eth: [FROM], trx: [], ton: [] },
    balances: {
      btc: { status: 'unavailable', reason: 'no-adapter' },
      eth: { status: 'available', value: '1000000000000000000' },
      trx: { status: 'unavailable', reason: 'no-adapter' },
      ton: { status: 'unavailable', reason: 'no-adapter' },
    },
    selectedChain: 'eth',
    customTokens: [],
    tokenBalances: {},
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
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

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}

async function clickLabel(div: HTMLDivElement, label: string): Promise<void> {
  const button = div.querySelector(
    `button[aria-label="${label}"]`,
  ) as HTMLButtonElement | null;
  expect(button).not.toBeNull();
  await act(async () => {
    button?.click();
  });
}

async function mountScreen(initialEntries: string[] = ['/send']) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/send" element={<SendScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return {
    div,
    rerender: async () => {
      await act(async () => {
        root.render(
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/send" element={<SendScreen />} />
            </Routes>
          </MemoryRouter>,
        );
      });
    },
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

async function click(div: HTMLDivElement, text: string): Promise<void> {
  await act(async () => {
    findButton(div, text).click();
  });
}

async function waitForInput(
  div: HTMLDivElement,
  selector: string,
  timeoutMs = 10000,
): Promise<HTMLInputElement> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = div.querySelector(selector) as HTMLInputElement | null;
    if (el) return el;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error(`timed out waiting for ${selector}`);
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

async function clickContaining(div: HTMLDivElement, text: string): Promise<void> {
  const button = [...div.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  expect(button).not.toBeUndefined();
  await act(async () => {
    button?.click();
  });
}

async function reachReview(div: HTMLDivElement): Promise<void> {
  // Round 2, item 8: chain step, then token step, then the merged
  // address + amount step — pick the native asset first, which lands
  // on the details step with recipient and amount together.
  await clickContaining(div, 'Ethereum');
  await clickContaining(div, 'Ethereum · ETH');
  const recipient = div.querySelector(
    '#send-recipient',
  ) as HTMLInputElement;
  await act(async () => {
    setInputValue(recipient, RECIPIENT);
  });
  const amount = await waitForInput(div, '#send-amount');
  await act(async () => {
    setInputValue(amount, '0.5');
  });
  await click(div, 'Review');
  await waitForText(div, 'Review your send');
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('send screen', () => {
  it('shows the no-wallet state when no vault address exists', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No wallet yet');
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('walks the ETH flow to a signed, not-sent result', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Sending funds is switched off');
      await reachReview(mounted.div);
      expect(mounted.div.textContent).toContain('Review your send');
      expect(mounted.div.textContent).toContain('0.5 ETH');
      expect(mounted.div.textContent).toContain('0.00042 ETH');
      expect(mounted.div.textContent).toContain('0.50042 ETH');
      expect(mounted.div.textContent).toContain('stub fee');
      expect(mounted.div.textContent).toContain('Sending is switched off');
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Send signed, not sent');
      expect(mounted.div.textContent).toContain(
        'Send signed, not sent',
      );
      expect(mounted.div.textContent).toContain('0xhash1234');
      expect(mounted.div.textContent).toContain('0xdeadbeef');
      expect(mounted.div.textContent).toContain('Signed transaction (hex)');
      expect(mounted.div.textContent).toContain('not sent anywhere');
    } finally {
      await mounted.cleanup();
    }
  });

  it('walks the BSC flow to a signed, not-sent result', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [FROM], trx: [], ton: [], bsc: [FROM] },
      balances: {
        btc: { status: 'unavailable', reason: 'no-adapter' },
        eth: { status: 'available', value: '1000000000000000000' },
        trx: { status: 'unavailable', reason: 'no-adapter' },
        ton: { status: 'unavailable', reason: 'no-adapter' },
        bsc: { status: 'available', value: '1000000000000000000' },
      },
    });
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'BNB Smart Chain');
      await clickContaining(mounted.div, 'BNB Smart Chain · BNB');
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(recipient, RECIPIENT);
      });
      const amount = await waitForInput(mounted.div, '#send-amount');
      await act(async () => {
        setInputValue(amount, '0.5');
      });
      await click(mounted.div, 'Review');
      await waitForText(mounted.div, 'Review your send');
      expect(mounted.div.textContent).toContain('Review your send');
      expect(mounted.div.textContent).toContain('BNB Smart Chain · BNB');
      expect(mounted.div.textContent).toContain('0.5 BNB');
      expect(mounted.div.textContent).toContain('0.00042 BNB');
      expect(mounted.div.textContent).toContain('0.50042 BNB');
      expect(mounted.div.textContent).not.toContain("isn't available yet");
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Send signed, not sent');
      expect(mounted.div.textContent).toContain('Send signed, not sent');
      expect(mounted.div.textContent).toContain('0xhash1234');
      expect(mounted.div.textContent).toContain('0xdeadbeef');
      expect(mounted.div.textContent).toContain('Signed transaction (hex)');
      expect(mounted.div.textContent).toContain('not sent anywhere');
    } finally {
      await mounted.cleanup();
    }
  });

  it('a still-unsupported chain (Polygon) shows the honest unavailable state', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [FROM], trx: [], ton: [], matic: [FROM] },
      balances: {
        btc: { status: 'unavailable', reason: 'no-adapter' },
        eth: { status: 'available', value: '1000000000000000000' },
        trx: { status: 'unavailable', reason: 'no-adapter' },
        ton: { status: 'unavailable', reason: 'no-adapter' },
        matic: { status: 'available', value: '1000000000000000000' },
      },
    });
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Polygon');
      await clickContaining(mounted.div, 'Polygon · POL');
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(recipient, RECIPIENT);
      });
      const amount = await waitForInput(mounted.div, '#send-amount');
      await act(async () => {
        setInputValue(amount, '0.5');
      });
      await click(mounted.div, 'Review');
      await waitForText(mounted.div, "Sending on Polygon isn't available yet");
      expect(mounted.div.textContent).toContain(
        "Sending on Polygon isn't available yet",
      );
      expect(mounted.div.textContent).toContain('BTC, ETH, BNB, TRX and TON');
      expect(mounted.div.textContent).not.toContain('Review your send');
    } finally {
      await mounted.cleanup();
    }
  });

  it('a failed devnet broadcast says so in the heading, not that it was broadcast (gap 24)', async () => {
    // Devnet mode on: the mocked adapter's broadcast throws 'disabled',
    // so broadcastSignedDevnet fails and the result screen must not
    // claim the transaction "was broadcast to the test network".
    setWallet({ devnetEnabled: true });
    const mounted = await mountScreen();
    try {
      await reachReview(mounted.div);
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Send signed — broadcast failed');
      expect(mounted.div.textContent).toContain(
        'Send signed — broadcast failed',
      );
      expect(mounted.div.textContent).not.toContain(
        'Send broadcast to the test network',
      );
      expect(mounted.div.textContent).toContain(
        'The broadcast to the Ethereum Sepolia test network failed — it was not broadcast.',
      );
      expect(mounted.div.textContent).not.toContain(
        'was signed offline with your vault key and broadcast to the',
      );
      expect(mounted.div.textContent).toContain('0xhash1234');
    } finally {
      await mounted.cleanup();
    }
  });

  it('in devnet mode the chain picker offers only the four devnet chains', async () => {
    // The crash: in devnet mode the picker offered all 22 chains, and
    // picking a non-devnet chain (BSC) crashed the details step
    // (devnetChainConfig throws for it). The picker now offers only the
    // chains with a test network.
    setWallet({
      devnetEnabled: true,
      vaultAddresses: {
        btc: [FROM],
        eth: [FROM],
        trx: [FROM],
        ton: [FROM],
        bsc: [FROM],
        sol: [FROM],
      },
    });
    const mounted = await mountScreen();
    try {
      const chips = [
        ...mounted.div.querySelectorAll(
          '[role="group"][aria-label="Chain"] button',
        ),
      ].map((button) => button.textContent?.trim());
      expect(chips).toEqual(['Bitcoin', 'Ethereum', 'TRON', 'TON']);
    } finally {
      await mounted.cleanup();
    }
  });

  it('in devnet mode a non-devnet starting chain falls back to a devnet chain', async () => {
    // selectedChain can be a non-devnet chain (the wallet remembers the
    // last chain). Before the fix the chain-step banner called
    // devnetChainConfig on it at mount and the screen unmounted.
    setWallet({
      devnetEnabled: true,
      selectedChain: 'bsc',
      vaultAddresses: {
        btc: [FROM],
        eth: [FROM],
        trx: [],
        ton: [],
        bsc: [FROM],
      },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        'Devnet test mode. This send broadcasts to the Bitcoin testnet4 test network only.',
      );
      expect(mounted.div.textContent).not.toContain('BNB Smart Chain');
    } finally {
      await mounted.cleanup();
    }
  });

  it('a devnet-mode send link for a non-devnet chain shows an honest message, not a crash', async () => {
    // A shared send link can force a non-devnet chain in devnet mode
    // (applyPrefill sets the chain and jumps to the details step).
    // The banner must say the chain has no test network instead of
    // throwing and unmounting the screen.
    setWallet({
      devnetEnabled: true,
      vaultAddresses: {
        btc: [FROM],
        eth: [FROM],
        trx: [],
        ton: [],
        bsc: [FROM],
      },
    });
    const mounted = await mountScreen([
      `/send?chain=bsc&to=${RECIPIENT}`,
    ]);
    try {
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect(amount).not.toBeNull();
      expect(mounted.div.textContent).toContain(
        'Devnet test mode. BNB Smart Chain has no test network — pick a chain with one.',
      );
      expect(mounted.div.textContent).toContain(
        'Step 3 of 6: Address & amount',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('refuses to sign while the vault is locked', async () => {
    setWallet({ vaultState: 'locked' });
    const mounted = await mountScreen();
    try {
      await reachReview(mounted.div);
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Your vault is locked. Unlock it on the lock screen to sign.');
      expect(mounted.div.textContent).toContain('Your vault is locked. Unlock it on the lock screen to sign.');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects an invalid recipient', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Ethereum');
      await clickContaining(mounted.div, 'Ethereum · ETH');
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(recipient, 'not-an-address');
      });
      // Recipient and amount share one step now: the amount input is
      // already there, but Review must not advance with a bad recipient.
      expect(
        mounted.div.querySelector('#send-amount'),
      ).not.toBeNull();
      await click(mounted.div, 'Review');
      await waitForText(mounted.div, 'Invalid Ethereum address.');
      expect(mounted.div.textContent).toContain('Invalid Ethereum address.');
      expect(mounted.div.textContent).not.toContain('Review your send');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a camera error when the scanner cannot start', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Ethereum');
      await clickContaining(mounted.div, 'Ethereum · ETH');
      await clickLabel(mounted.div, 'Scan QR code');
      await waitForText(
        mounted.div,
        'Camera is not available in this browser.',
      );
      expect(mounted.div.textContent).toContain(
        'Camera is not available in this browser.',
      );
      // The panel stays open so the image upload stays available.
      expect(
        mounted.div.querySelector('input[type="file"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('toggles the scanner from the scan icon button', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Ethereum');
      await clickContaining(mounted.div, 'Ethereum · ETH');
      const button = mounted.div.querySelector(
        'button[aria-label="Scan QR code"]',
      ) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-expanded')).toBe('false');
      await clickLabel(mounted.div, 'Scan QR code');
      await waitForText(
        mounted.div,
        'Camera is not available in this browser.',
      );
      expect(button?.getAttribute('aria-expanded')).toBe('true');
      await clickLabel(mounted.div, 'Scan QR code');
      expect(mounted.div.textContent).not.toContain(
        'Camera is not available in this browser.',
      );
      expect(button?.getAttribute('aria-expanded')).toBe('false');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows all thirteen chains on step 1, and the selected chain’s tokens on step 2', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // Step 1 is chains only (Round 2, item 8): all 13 registry chains
      // have a picker button (disabled without a wallet on that chain),
      // and no token list yet.
      for (const name of ['Bitcoin', 'Ethereum', 'TRON', 'TON', 'Solana', 'BNB Smart Chain', 'Polygon', 'Arbitrum One', 'OP Mainnet', 'Base', 'Avalanche C-Chain', 'Litecoin', 'Dogecoin']) {
        expect(mounted.div.textContent).toContain(name);
      }
      expect(mounted.div.textContent).not.toContain('USD Coin');
      // Picking a chain advances to the token step: the full token list
      // for the selected chain, with the verified tick and short
      // contract under each token.
      await clickContaining(mounted.div, 'Ethereum');
      expect(mounted.div.textContent).toContain('USD Coin');
      expect(mounted.div.textContent).toContain('Tether USD');
      expect(mounted.div.textContent).toContain('ChainLink Token');
      expect(mounted.div.textContent).toContain('Verified');
      expect(mounted.div.textContent).toContain('0xA0b8…eB48');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Unverified on an unlisted token in the picker and in the summary', async () => {
    // Lane 1: a user-added token with no CoinGecko listing says
    // Unverified on its picker row — and in the footer summary once
    // it is selected.
    setWallet({
      customTokens: [
        {
          chain: 'eth',
          contract: '0x00000000000000000000000000000000000000A1',
          name: 'Unlisted Token',
          symbol: 'UNL',
          decimals: 18,
          coingeckoId: null,
          addedAtMs: 1,
        },
      ],
    });
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Ethereum');
      const row = [...mounted.div.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('Unlisted Token'),
      );
      expect(row?.textContent).toContain('Unverified');
      expect(row?.textContent).not.toContain('✓ Verified');
      await clickContaining(mounted.div, 'Unlisted Token');
      expect(mounted.div.textContent).toContain('Unlisted Token · UNL');
      expect(mounted.div.textContent).toContain('Unverified');
    } finally {
      await mounted.cleanup();
    }
  });

  it('prefills chain, recipient and amount from a Bawa send link', async () => {
    setWallet();
    const mounted = await mountScreen([
      `/send?chain=eth&to=${RECIPIENT}&amount=0.5`,
    ]);
    try {
      // The link moves the flow to the amount step with both prefilled.
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect((amount as HTMLInputElement).value).toBe('0.5');
      expect(mounted.div.textContent).toContain(RECIPIENT);
    } finally {
      await mounted.cleanup();
    }
  });

  it('prefills a token payment from a Bawa send link', async () => {
    setWallet();
    const mounted = await mountScreen([
      '/send?chain=eth&to=' +
        RECIPIENT +
        '&amount=25&token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    ]);
    try {
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect((amount as HTMLInputElement).value).toBe('25');
      expect(mounted.div.textContent).toContain('Amount (USDC)');
      expect(mounted.div.textContent).toContain(RECIPIENT);
    } finally {
      await mounted.cleanup();
    }
  });

  it('walks an ETH USDC token send to a signed, not-sent result (Lane 2)', async () => {
    // Lane 2: the token send no longer shows the honest unavailable
    // state — it previews and signs offline. The stub adapter quotes
    // 420000000000000 wei (20 gwei x 21000), so the token fee is
    // 20 gwei x 100000 = 0.002 ETH.
    setWallet({
      tokenBalances: {
        'eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          status: 'available',
          value: '100000000',
        },
      },
    });
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Ethereum');
      const usdcButton = [...mounted.div.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('USD Coin'),
      );
      expect(usdcButton).not.toBeUndefined();
      await act(async () => {
        usdcButton?.click();
      });
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(recipient, RECIPIENT);
      });
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect(mounted.div.textContent).toContain('Amount (USDC)');
      await act(async () => {
        setInputValue(amount, '25');
      });
      await click(mounted.div, 'Review');
      await waitForText(mounted.div, 'Review your send');
      expect(mounted.div.textContent).toContain('Review your send');
      expect(mounted.div.textContent).toContain('25 USDC');
      expect(mounted.div.textContent).toContain('0.002 ETH');
      expect(mounted.div.textContent).toContain('25 USDC + 0.002 ETH');
      expect(mounted.div.textContent).toContain(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      );
      expect(mounted.div.textContent).not.toContain("isn't available yet");
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Send signed, not sent');
      expect(mounted.div.textContent).toContain('Send signed, not sent');
      expect(mounted.div.textContent).toContain('0xhash1234');
      expect(mounted.div.textContent).toContain('0xdeadbeef');
      expect(mounted.div.textContent).toContain('Signed transaction (hex)');
      expect(mounted.div.textContent).toContain('not sent anywhere');
    } finally {
      await mounted.cleanup();
    }
  });

  it('a Polygon token send reaches review while native Polygon stays unavailable (Lane 2)', async () => {
    // Lane 2: a token transfer only needs the generalised EVM signer,
    // so MATIC USDC sends even though native Polygon sends are not
    // built (the existing test above keeps that native refusal).
    setWallet({
      vaultAddresses: { btc: [], eth: [FROM], trx: [], ton: [], matic: [FROM] },
      balances: {
        btc: { status: 'unavailable', reason: 'no-adapter' },
        eth: { status: 'available', value: '1000000000000000000' },
        trx: { status: 'unavailable', reason: 'no-adapter' },
        ton: { status: 'unavailable', reason: 'no-adapter' },
        matic: { status: 'available', value: '1000000000000000000' },
      },
      tokenBalances: {
        'matic:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': {
          status: 'available',
          value: '100000000',
        },
      },
    });
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Polygon');
      const usdcButton = [...mounted.div.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('USD Coin'),
      );
      expect(usdcButton).not.toBeUndefined();
      await act(async () => {
        usdcButton?.click();
      });
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(recipient, RECIPIENT);
      });
      const amount = await waitForInput(mounted.div, '#send-amount');
      await act(async () => {
        setInputValue(amount, '25');
      });
      await click(mounted.div, 'Review');
      await waitForText(mounted.div, 'Review your send');
      expect(mounted.div.textContent).toContain('Review your send');
      expect(mounted.div.textContent).toContain('25 USDC');
      expect(mounted.div.textContent).not.toContain("isn't available yet");
    } finally {
      await mounted.cleanup();
    }
  });

  it('a rate-limited fee estimate shows the human sentence, never the raw HTTP 429', async () => {
    // Lane D: a TRON getchainparameters 429 surfaced as a bare "HTTP 429"
    // on the send details step. The codebase rule (wallet-context) is
    // that no screen renders a raw reason; the fee line must use the
    // human sentence instead.
    setWallet();
    const failingAdapter = {
      ...ethAdapter,
      estimateFee: async () => ({ status: 'error', reason: 'HTTP 429' }),
    };
    vi.mocked(getAdapterForMode).mockReturnValueOnce(
      failingAdapter as unknown as ChainAdapter,
    );
    const mounted = await mountScreen();
    try {
      await clickContaining(mounted.div, 'Ethereum');
      await clickContaining(mounted.div, 'Ethereum · ETH');
      await waitForText(
        mounted.div,
        'Fee estimate unavailable: The network is busy or unreachable. Please try again in a moment.',
      );
      expect(mounted.div.textContent).toContain(
        'Fee estimate unavailable: The network is busy or unreachable. Please try again in a moment.',
      );
      expect(mounted.div.textContent).not.toContain('HTTP 429');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows only the chain step on mount — no token list, recipient, amount or action below it', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      // Round 2, item 8: chain is step 1 of 6; the token list, the
      // recipient input, the amount input and the send action must not
      // be on the page until a chain is picked.
      expect(mounted.div.textContent).toContain('Step 1 of 6: Chain');
      expect(mounted.div.querySelector('#send-recipient')).toBeNull();
      expect(mounted.div.querySelector('#send-amount')).toBeNull();
      expect(mounted.div.textContent).toContain('Bitcoin');
      expect(mounted.div.textContent).not.toContain('USD Coin');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows recipient and amount together on step 3, with no separate amount step', async () => {
    // Round 2, item 8: chain → token → address + amount in one place.
    // Picking a token lands on the merged details step: both inputs are
    // present at once, and the step label says so.
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Step 1 of 6: Chain');
      await clickContaining(mounted.div, 'Ethereum');
      expect(mounted.div.textContent).toContain('Step 2 of 6: Token');
      await clickContaining(mounted.div, 'Ethereum · ETH');
      expect(mounted.div.textContent).toContain('Step 3 of 6: Address & amount');
      expect(mounted.div.querySelector('#send-recipient')).not.toBeNull();
      expect(mounted.div.querySelector('#send-amount')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('lists non-zero assets above zero balances', async () => {
    // Item 20: DAI holds a balance, USDC does not — DAI must sort
    // above USDC even though the registry lists USDC first.
    setWallet({
      tokenBalances: {
        'eth:0x6b175474e89094c44da98b954eedeac495271d0f': {
          status: 'available',
          value: '1000000000000000000',
        },
      },
    });
    const mounted = await mountScreen();
    try {
      // The token step lists the chain's assets: pick the chain first.
      await clickContaining(mounted.div, 'Ethereum');
      const list = mounted.div.querySelector(
        'section[aria-labelledby="send-token-heading"] ul',
      );
      expect(list).not.toBeNull();
      const rows = [...(list as HTMLUListElement).querySelectorAll('li')].map(
        (li) => li.textContent ?? '',
      );
      const dai = rows.findIndex((text) => text.includes('Dai Stablecoin'));
      const usdc = rows.findIndex((text) => text.includes('USD Coin'));
      expect(dai).toBeGreaterThanOrEqual(0);
      expect(usdc).toBeGreaterThanOrEqual(0);
      expect(dai).toBeLessThan(usdc);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the pending payment and keeps the link with no wallet yet', async () => {
    // Cold start, fresh profile (UI/UX round 2, deep-link fix): the
    // old screen said only "No wallet yet" and the link was lost.
    setWallet({
      vaultState: 'no-vault',
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
    });
    const mounted = await mountScreen([
      `/send?chain=eth&to=${RECIPIENT}&amount=0.5`,
    ]);
    try {
      expect(mounted.div.textContent).toContain('No wallet yet');
      expect(mounted.div.textContent).toContain(
        'This link asks to send 0.5 ETH',
      );
      expect(mounted.div.textContent).toContain(RECIPIENT);
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector('a[href="/import-wallet"]'),
      ).not.toBeNull();
      // The link survives in session storage for the create flow.
      expect(sessionStorage.getItem('bawa-pending-send-link')).toBe(
        `chain=eth&to=${RECIPIENT}&amount=0.5`,
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unlock panel while locked, then prefills after unlock', async () => {
    // Cold start, vault locked at boot (UI/UX round 2, deep-link
    // fix): the old screen said "No wallet yet" even though the
    // header showed Account 01, and the link never retried.
    setWallet({
      vaultState: 'locked',
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
    });
    const mounted = await mountScreen([
      `/send?chain=eth&to=${RECIPIENT}&amount=0.5`,
    ]);
    try {
      expect(mounted.div.textContent).toContain(
        'This link asks to send 0.5 ETH',
      );
      expect(mounted.div.textContent).toContain('Your wallet is locked');
      expect(
        mounted.div.querySelector('a[href="/lock"]'),
      ).not.toBeNull();
      expect(mounted.div.querySelector('#send-amount')).toBeNull();
      // Unlocking (same mounted screen, new wallet snapshot) retries
      // the link instead of needing a remount.
      setWallet({ vaultState: 'unlocked' });
      await mounted.rerender();
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect((amount as HTMLInputElement).value).toBe('0.5');
      expect(mounted.div.textContent).toContain(RECIPIENT);
    } finally {
      await mounted.cleanup();
    }
  });

  it('asks which wallet to use with more than one account, then prefills from the chosen one', async () => {
    // (UI/UX round 2, deep-link fix): the old screen silently used
    // whichever account was selected; the link never asked.
    const selectVaultAccount = vi.fn(async () => undefined);
    const account2 = '0x1111111111111111111111111111111111111111';
    setWallet({
      vaultAccount: { account: 0, index: 0 },
      vaultAccounts: [0, 1],
      selectVaultAccount,
    });
    const mounted = await mountScreen([
      `/send?chain=eth&to=${RECIPIENT}&amount=0.5`,
    ]);
    try {
      await waitForText(mounted.div, 'Choose which wallet sends this payment');
      expect(mounted.div.textContent).toContain('Account 1');
      expect(mounted.div.textContent).toContain('Account 2');
      expect(mounted.div.textContent).toContain('Current wallet');
      expect(mounted.div.textContent).toContain(FROM);
      expect(mounted.div.querySelector('#send-amount')).toBeNull();
      await clickContaining(mounted.div, 'Account 2');
      expect(selectVaultAccount).toHaveBeenCalledWith(1);
      // The switch lands: the new account's addresses arrive and the
      // link prefills from the chosen wallet.
      setWallet({
        vaultAccount: { account: 1, index: 0 },
        vaultAccounts: [0, 1],
        selectVaultAccount,
        vaultAddresses: { btc: [], eth: [account2], trx: [], ton: [] },
      });
      await mounted.rerender();
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect((amount as HTMLInputElement).value).toBe('0.5');
      expect(mounted.div.textContent).toContain(RECIPIENT);
      expect(mounted.div.textContent).toContain(account2);
    } finally {
      await mounted.cleanup();
    }
  });

  it('does not show the chooser for a single account', async () => {
    setWallet({
      vaultAccount: { account: 0, index: 0 },
      vaultAccounts: [0],
      selectVaultAccount: vi.fn(async () => undefined),
    });
    const mounted = await mountScreen([
      `/send?chain=eth&to=${RECIPIENT}&amount=0.5`,
    ]);
    try {
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect((amount as HTMLInputElement).value).toBe('0.5');
      expect(mounted.div.textContent).not.toContain(
        'Choose which wallet sends this payment',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('resumes a stored link when the URL has none (back from create/import)', async () => {
    sessionStorage.setItem(
      'bawa-pending-send-link',
      `chain=eth&to=${RECIPIENT}&amount=0.5`,
    );
    setWallet();
    const mounted = await mountScreen(['/send']);
    try {
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect((amount as HTMLInputElement).value).toBe('0.5');
      expect(mounted.div.textContent).toContain(RECIPIENT);
      // Applied links clear the stored copy.
      expect(sessionStorage.getItem('bawa-pending-send-link')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
