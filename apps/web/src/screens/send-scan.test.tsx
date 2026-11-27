// @vitest-environment jsdom
// Scanning a payment QR from the asset step auto-selects chain,
// token, amount and recipient (UI/UX Round 2, item 1). The real
// QrScanner needs a camera or a canvas, so this file stubs it with
// two buttons that feed real payment URIs into onScan — the
// resolution underneath (parsePaymentUri + applyPrefill) is the
// production code.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SendScreen } from './send';
import { useWallet } from '../state/wallet-context';
import type { ChainAdapter } from '../wallet/adapters/types';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
  ensureAdapters: vi.fn(async () => undefined),
  ensureDevnetAdapters: vi.fn(async () => undefined),
}));

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
  };
});

vi.mock('../wallet/vault', () => ({
  getSessionPassphrase: vi.fn(() => ''),
  withMnemonicAsync: vi.fn(
    async (fn: (mnemonic: string) => Promise<unknown>) =>
      fn(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      ),
  ),
}));

// Base USDC (EIP-681 transfer, 25 USDC) and a Solana Pay request —
// real payment URIs, verified against their specs in
// payment-links.test.ts. The Base USDC contract is the wallet's
// own default token (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
const BASE_USDC_QR =
  'ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e&uint256=25000000';
const SOLANA_QR =
  'solana:DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK?amount=1.5';
// A bare address (no scheme, no amount) — the Lane 7 case: scanning
// one from the chain step used to close the scanner with nothing
// visibly changed, because handleScan never advanced the step.
const BARE_ADDRESS_QR = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

vi.mock('../wallet/qr-scanner', () => ({
  QrScanner: ({ onScan }: { onScan: (value: string) => void }) => (
    <div>
      <button type="button" onClick={() => onScan(BASE_USDC_QR)}>
        Simulate Base USDC scan
      </button>
      <button type="button" onClick={() => onScan(SOLANA_QR)}>
        Simulate Solana scan
      </button>
      <button type="button" onClick={() => onScan(BARE_ADDRESS_QR)}>
        Simulate bare-address scan
      </button>
    </div>
  ),
}));

// Redesign Lane 3: the screen reads the price feeds for the fiat
// equivalent now — stub them idle (real hooks would fire network
// calls from the test) the same way send.test.tsx does.
vi.mock('../wallet/prices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../wallet/prices')>()),
  usePrices: vi.fn(() => ({
    state: { status: 'idle', entries: {}, lastFetchedAtMs: null },
    refresh: vi.fn(),
  })),
}));

vi.mock('../wallet/token-prices', () => ({
  useTokenPrices: () => ({
    state: { status: 'idle', entries: {} },
    refresh: vi.fn(),
  }),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const FROM = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

function setWallet(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState: 'unlocked',
    vaultAddresses: { btc: [], eth: [FROM], base: [FROM], trx: [], ton: [] },
    balances: {
      btc: { status: 'unavailable', reason: 'no-adapter' },
      eth: { status: 'available', value: '1000000000000000000' },
      base: { status: 'available', value: '1000000000000000000' },
      trx: { status: 'unavailable', reason: 'no-adapter' },
      ton: { status: 'unavailable', reason: 'no-adapter' },
    },
    selectedChain: 'eth',
    customTokens: [],
    tokenBalances: {},
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountScreen(entry = '/send') {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/send" element={<SendScreen />} />
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

async function clickLabel(div: HTMLDivElement, label: string): Promise<void> {
  const button = div.querySelector(
    `button[aria-label="${label}"]`,
  ) as HTMLButtonElement | null;
  expect(button).not.toBeNull();
  await act(async () => {
    button?.click();
  });
}

async function clickText(div: HTMLDivElement, text: string): Promise<void> {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  expect(button).not.toBeUndefined();
  await act(async () => {
    button?.click();
  });
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

beforeEach(() => {
  vi.clearAllMocks();
  // P1 (Lane S1): scans record the last-used chain, so a scan in one
  // test must not change the entry chain of the next.
  localStorage.clear();
});

describe('send screen — scanning a QR from the amount form (Round 2, item 1)', () => {
  it('offers the scanner on the amount form, before any amount is entered', async () => {
    // P1 (Lane S1): Send opens on the amount form with the last-used
    // chain pre-selected, and the scanner is offered there — the icon
    // button beside Paste (the chain step's 'Scan a QR code' card is
    // gone with the chain-first entry). Opening it shows the scanner.
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Step 3 of 6: Address & amount');
      expect(
        mounted.div.querySelector('button[aria-label="Scan QR code"]'),
      ).not.toBeNull();
      await clickLabel(mounted.div, 'Scan QR code');
      const simulate = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Simulate Base USDC scan',
      );
      expect(simulate).not.toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  it('auto-selects chain, token, amount and recipient from a Base USDC payment QR', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await clickLabel(mounted.div, 'Scan QR code');
      await clickText(mounted.div, 'Simulate Base USDC scan');
      const amount = await waitForInput(mounted.div, '#send-amount');
      // The QR picked the chain and the token: Base, USDC, 25.
      expect(mounted.div.textContent).toContain('Address & amount · Base');
      expect(mounted.div.textContent).toContain('USD Coin · USDC');
      expect(amount.value).toBe('25');
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      expect(recipient.value).toBe(RECIPIENT);
      expect(mounted.div.textContent).toContain('Step 3 of 6: Address & amount');
    } finally {
      await mounted.cleanup();
    }
  });

  it('advances to the details step and prefills the recipient from a bare-address scan', async () => {
    // Lane 7: a bare address carries no chain, token or amount, so the
    // scan fills the recipient on the current chain and must land on
    // the details step, where the recipient and amount render — the
    // chain step shows neither, so staying there looked like nothing
    // happened at all.
    setWallet();
    const mounted = await mountScreen();
    try {
      await clickLabel(mounted.div, 'Scan QR code');
      await clickText(mounted.div, 'Simulate bare-address scan');
      const amount = await waitForInput(mounted.div, '#send-amount');
      expect(mounted.div.textContent).toContain('Step 3 of 6: Address & amount');
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      expect(recipient.value).toBe(RECIPIENT);
      expect(amount.value).toBe('');
    } finally {
      await mounted.cleanup();
    }
  });

  it('says so instead of silently staying put when the QR chain has no wallet', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [FROM], trx: [], ton: [] },
      balances: {
        btc: { status: 'unavailable', reason: 'no-adapter' },
        eth: { status: 'available', value: '1000000000000000000' },
        trx: { status: 'unavailable', reason: 'no-adapter' },
        ton: { status: 'unavailable', reason: 'no-adapter' },
      },
    });
    const mounted = await mountScreen();
    try {
      await clickLabel(mounted.div, 'Scan QR code');
      await clickText(mounted.div, 'Simulate Solana scan');
      await waitForText(
        mounted.div,
        'This QR is for Solana, which has no wallet here yet.',
      );
      // P1 (Lane S1): the scan starts on the amount form now, so
      // staying put means staying on the form — nothing prefilled,
      // nothing advanced.
      expect(mounted.div.textContent).toContain('Step 3 of 6: Address & amount');
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      expect(recipient.value).toBe('');
    } finally {
      await mounted.cleanup();
    }
  });

  it('opens the scanner on arrival when the URL carries ?scan=1', async () => {
    // Lane J: the dashboard Scan tile links here, so the scanner must
    // already be open — no extra tap. The stub scanner renders its
    // simulate-scan buttons only while the panel is open.
    setWallet();
    const mounted = await mountScreen('/send?scan=1');
    try {
      const simulate = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Simulate Base USDC scan',
      );
      expect(simulate).not.toBeUndefined();
      // P1 (Lane S1): ?scan=1 opens the scanner from the amount form
      // now (the entry step).
      expect(mounted.div.textContent).toContain('Step 3 of 6: Address & amount');
    } finally {
      await mounted.cleanup();
    }
  });
});
