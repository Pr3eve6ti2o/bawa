// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SendScreen } from './send';
import { useWallet } from '../state/wallet-context';
import type { ChainAdapter } from '../wallet/adapters/types';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
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
    signEthOffline: vi.fn(async () => ({
      ok: true,
      signedTxHex: '0xdeadbeef',
      txHash: '0xhash1234',
      from: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
    })),
  };
});

vi.mock('../wallet/vault', () => ({
  withMnemonicAsync: vi.fn(
    async (fn: (mnemonic: string) => Promise<unknown>) =>
      fn(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      ),
  ),
}));

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

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/send']}>
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

async function reachReview(div: HTMLDivElement): Promise<void> {
  const recipient = div.querySelector(
    '#send-recipient',
  ) as HTMLInputElement;
  await act(async () => {
    setInputValue(recipient, RECIPIENT);
  });
  await click(div, 'Continue');
  const amount = await waitForInput(div, '#send-amount');
  await act(async () => {
    setInputValue(amount, '0.5');
  });
  await click(div, 'Review');
  await waitForText(div, 'Review send');
}

beforeEach(() => {
  vi.clearAllMocks();
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

  it('walks the ETH flow to a signed, not-broadcast result', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Broadcast is disabled');
      await reachReview(mounted.div);
      expect(mounted.div.textContent).toContain('Review send');
      expect(mounted.div.textContent).toContain('0.5 ETH');
      expect(mounted.div.textContent).toContain('0.00042 ETH');
      expect(mounted.div.textContent).toContain('0.50042 ETH');
      expect(mounted.div.textContent).toContain('stub fee');
      expect(mounted.div.textContent).toContain('Broadcast is disabled');
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Send signed — not broadcast');
      expect(mounted.div.textContent).toContain(
        'Send signed — not broadcast',
      );
      expect(mounted.div.textContent).toContain('0xhash1234');
      expect(mounted.div.textContent).toContain('0xdeadbeef');
      expect(mounted.div.textContent).toContain('Signed transaction (hex)');
      expect(mounted.div.textContent).toContain('not sent anywhere');
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects an invalid recipient', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      const recipient = mounted.div.querySelector(
        '#send-recipient',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(recipient, 'not-an-address');
      });
      await click(mounted.div, 'Continue');
      await waitForText(mounted.div, 'Invalid Ethereum address.');
      expect(mounted.div.textContent).toContain('Invalid Ethereum address.');
      expect(
        mounted.div.querySelector('#send-amount'),
      ).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unlock notice when the vault is locked', async () => {
    setWallet({ vaultState: 'locked' });
    const mounted = await mountScreen();
    try {
      await reachReview(mounted.div);
      await click(mounted.div, 'Sign offline');
      await waitForText(mounted.div, 'Your vault is locked');
      expect(mounted.div.textContent).toContain('Your vault is locked');
      expect(
        mounted.div.querySelector('a[href="/security"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a camera error when the scanner cannot start', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      await click(mounted.div, 'Scan QR');
      await waitForText(
        mounted.div,
        'Camera is not available in this browser.',
      );
      expect(mounted.div.textContent).toContain(
        'Camera is not available in this browser.',
      );
    } finally {
      await mounted.cleanup();
    }
  });
});
