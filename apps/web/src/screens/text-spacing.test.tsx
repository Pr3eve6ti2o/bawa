// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { WelcomeScreen } from './welcome';
import { CreateWalletScreen } from './create-wallet';
import { TransactionHistoryScreen } from './transaction-history';
import { RecentActivity } from './recent-activity';
import { AssetRows } from './asset-rows';
import { StepCard } from '../ui/components/step-card';
import { AssetRow } from '../ui/components/asset-row';
import { createWallet } from '../wallet/core';
import { loadCore } from '../engine/boundary';
import { createVault, hasVault } from '../wallet/vault';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { HistoryState } from '../state/wallet-context';
import type { PriceEntry, PriceMap } from '../wallet/prices';

vi.mock('../wallet/core', () => ({
  createWallet: vi.fn(),
}));

vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
}));

vi.mock('../engine/boundary', () => ({
  loadCore: vi.fn(),
}));

const mockRefreshVaultAccounts = vi.fn();

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
}));

// Disposable test mnemonic — never a real secret.
const TEST_MNEMONIC = [...Array(23).fill('abandon'), 'about'].join(' ');
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_ADDRESSES = {
  btc: ['bc1qtest'],
  eth: ['0xTestEthAddress'],
  trx: ['TTestTrxAddress'],
  ton: ['UQTestTonAddress'],
};

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const CHAINS = {
  btc: { displayName: 'Bitcoin', symbol: 'BTC' },
  eth: { displayName: 'Ethereum', symbol: 'ETH' },
  trx: { displayName: 'TRON', symbol: 'TRX' },
  ton: { displayName: 'TON', symbol: 'TON' },
  sol: { displayName: 'Solana', symbol: 'SOL' },
  bsc: { displayName: 'BNB Smart Chain', symbol: 'BNB' },
  matic: { displayName: 'Polygon', symbol: 'POL' },
  arb: { displayName: 'Arbitrum One', symbol: 'ETH' },
  op: { displayName: 'OP Mainnet', symbol: 'ETH' },
  base: { displayName: 'Base', symbol: 'ETH' },
  avax: { displayName: 'Avalanche C-Chain', symbol: 'AVAX' },
  gnosis: { displayName: 'Gnosis', symbol: 'XDAI' },
  celo: { displayName: 'Celo', symbol: 'CELO' },
  linea: { displayName: 'Linea', symbol: 'ETH' },
  mantle: { displayName: 'Mantle', symbol: 'MNT' },
  scroll: { displayName: 'Scroll', symbol: 'ETH' },
  opbnb: { displayName: 'opBNB', symbol: 'BNB' },
  metis: { displayName: 'Metis', symbol: 'METIS' },
  aurora: { displayName: 'Aurora', symbol: 'ETH' },
  fantom: { displayName: 'Fantom', symbol: 'FTM' },
  ltc: { displayName: 'Litecoin', symbol: 'LTC' },
  doge: { displayName: 'Dogecoin', symbol: 'DOGE' },
} as const;

type ChainKey = keyof typeof CHAINS;

const EMPTY_ADDRESSES: Record<ChainKey, string[]> = {
  btc: [],
  eth: [],
  trx: [],
  ton: [],
  sol: [],
  bsc: [],
  matic: [],
  arb: [],
  op: [],
  base: [],
  avax: [],
  gnosis: [],
  celo: [],
  linea: [],
  mantle: [],
  scroll: [],
  opbnb: [],
  metis: [],
  aurora: [],
  fantom: [],
  ltc: [],
  doge: [],
};

const UNAVAILABLE_PRICE: PriceEntry = { status: 'unavailable', reason: 'missing' };
const EMPTY_PRICES: PriceMap = {
  btc: UNAVAILABLE_PRICE,
  eth: UNAVAILABLE_PRICE,
  trx: UNAVAILABLE_PRICE,
  ton: UNAVAILABLE_PRICE,
  sol: UNAVAILABLE_PRICE,
  bsc: UNAVAILABLE_PRICE,
  matic: UNAVAILABLE_PRICE,
  arb: UNAVAILABLE_PRICE,
  op: UNAVAILABLE_PRICE,
  base: UNAVAILABLE_PRICE,
  avax: UNAVAILABLE_PRICE,
  gnosis: UNAVAILABLE_PRICE,
  celo: UNAVAILABLE_PRICE,
  linea: UNAVAILABLE_PRICE,
  mantle: UNAVAILABLE_PRICE,
  scroll: UNAVAILABLE_PRICE,
  opbnb: UNAVAILABLE_PRICE,
  metis: UNAVAILABLE_PRICE,
  aurora: UNAVAILABLE_PRICE,
  fantom: UNAVAILABLE_PRICE,
  ltc: UNAVAILABLE_PRICE,
  doge: UNAVAILABLE_PRICE,
};

const mockRefreshHistory = vi.fn();

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

// handleGenerate yields to the event loop between stages (yieldFrame);
// act() does not flush those timers, so let them run.
async function settle(ms = 200): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function mountScreen(children: ReactNode, initialEntry = '/') {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
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

async function fillPasswords(div: HTMLDivElement) {
  const password = div.querySelector('#vault-password') as HTMLInputElement;
  const confirm = div.querySelector('#vault-password-confirm') as HTMLInputElement;
  await act(async () => {
    setInputValue(password, TEST_PASSWORD);
    setInputValue(confirm, TEST_PASSWORD);
  });
}

async function acknowledgeRisk(div: HTMLDivElement) {
  await act(async () => {
    const boxes = [...div.querySelectorAll('[id^="risk-check-"]')];
    expect(boxes.length).toBe(3);
    boxes.forEach((box) => (box as HTMLButtonElement).click());
  });
  await act(async () => {
    findButton(div, 'I understand — show my recovery phrase').click();
  });
  await settle();
}

async function generate(div: HTMLDivElement) {
  await fillPasswords(div);
  await act(async () => {
    findButton(div, 'Generate recovery phrase').click();
  });
  await settle();
  await acknowledgeRisk(div);
}

function setWallet(history: Record<ChainKey, HistoryState>): void {
  vi.mocked(useWallet).mockReturnValue({
    history,
    refreshHistory: mockRefreshHistory,
  } as unknown as ReturnType<typeof useWallet>);
}

const loadedHistory: HistoryState = { status: 'loaded', txs: [] };

const perChainLoaded = (): Record<ChainKey, HistoryState> => ({
  btc: loadedHistory,
  eth: loadedHistory,
  trx: loadedHistory,
  ton: loadedHistory,
  sol: loadedHistory,
  bsc: loadedHistory,
  matic: loadedHistory,
  arb: loadedHistory,
  op: loadedHistory,
  base: loadedHistory,
  avax: loadedHistory,
  gnosis: loadedHistory,
  celo: loadedHistory,
  linea: loadedHistory,
  mantle: loadedHistory,
  scroll: loadedHistory,
  opbnb: loadedHistory,
  metis: loadedHistory,
  aurora: loadedHistory,
  fantom: loadedHistory,
  ltc: loadedHistory,
  doge: loadedHistory,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(createWallet).mockResolvedValue(TEST_MNEMONIC);
  vi.mocked(createVault).mockResolvedValue(undefined);
  vi.mocked(hasVault).mockReturnValue(false);
  vi.mocked(loadCore).mockResolvedValue(
    undefined as unknown as Awaited<ReturnType<typeof loadCore>>,
  );
  mockRefreshVaultAccounts.mockResolvedValue(undefined);
  vi.mocked(useWallet).mockReturnValue({
    vaultAddresses: TEST_ADDRESSES,
    refreshVaultAccounts: mockRefreshVaultAccounts,
  } as unknown as ReturnType<typeof useWallet>);

  mockRefreshHistory.mockResolvedValue(undefined);
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
  );
});

describe('text spacing', () => {
  it('welcome list reads with real spaces', async () => {
    const mounted = await mountScreen(<WelcomeScreen />);
    try {
      // Lane C, item 9: the welcome steps are gone — the screen is an
      // introduction now. The spacing check moves to the new list and
      // intro line: words must not run together.
      expect(mounted.div.textContent).toContain(
        'Bawa is a guide made for humans and AI agents to create crypto wallets, web wallets, Android wallets, HD wallets and smart contracts easily',
      );
      expect(mounted.div.textContent).not.toContain('Bawais a guide');
      expect(mounted.div.textContent).toContain(
        'Create a crypto wallet — a self-custodial multi-chain wallet, with one address per chain.',
      );
      expect(mounted.div.textContent).not.toContain('Createa crypto wallet');
      expect(mounted.div.textContent).toContain(
        'Create a web wallet — this one. It runs in your browser, with nothing to install.',
      );
      expect(mounted.div.textContent).toContain(
        'Create an HD wallet — a fresh receiving address for every payment.',
      );
      expect(mounted.div.textContent).toContain(
        'Create a smart contract — guided, step by step, from a prompt.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('step card reads with real spaces', async () => {
    const mounted = await mountScreen(
      <StepCard
        icon="1"
        label="Set a vault password"
        detail="At least 8 characters. It encrypts the vault on this device."
        state="active"
      />,
    );
    try {
      expect(mounted.div.textContent).toContain(
        '1 Set a vault password At least 8 characters.',
      );
      expect(mounted.div.textContent).not.toContain('1Set a vault password');
    } finally {
      await mounted.cleanup();
    }
  });

  it('asset row reads with real spaces', async () => {
    const mounted = await mountScreen(
      <AssetRow
        avatar={null}
        symbol="ETH"
        amount="0.5 ETH"
        value="$1,234.56"
        detail="Ethereum mainnet"
      />,
    );
    try {
      expect(mounted.div.textContent).toContain(
        'ETH 0.5 ETH $1,234.56 Ethereum mainnet',
      );
      expect(mounted.div.textContent).not.toContain('ETH0.5 ETH');
    } finally {
      await mounted.cleanup();
    }
  });

  it('create step counter reads with real spaces', async () => {
    const mounted = await mountScreen(<CreateWalletScreen />, '/create-wallet');
    try {
      expect(mounted.div.textContent).toContain(
        'Step 1 of 4: Set a vault password',
      );
      expect(mounted.div.textContent).not.toContain('Step1of 4');

      await generate(mounted.div);
      expect(mounted.div.textContent).toContain('1. abandon');
      expect(mounted.div.textContent).not.toContain('1.abandon');

      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      expect(mounted.div.textContent).toMatch(/Word [0-9]/);
      expect(mounted.div.textContent).not.toContain('Word1');
    } finally {
      await mounted.cleanup();
    }
  });

  it('failed history reads with real spaces', async () => {
    setWallet({
      ...perChainLoaded(),
      ton: { status: 'unavailable', reason: 'no-adapter', txs: [] },
    });
    const mounted = await mountScreen(
      <TransactionHistoryScreen />,
      '/transactions',
    );
    try {
      expect(mounted.div.textContent).toContain('TON history unavailable');
      expect(mounted.div.textContent).not.toContain('TONhistory unavailable');
    } finally {
      await mounted.cleanup();
    }
  });

  it('recent activity unavailable reads with real spaces', async () => {
    setWallet({
      ...perChainLoaded(),
      ton: { status: 'unavailable', reason: 'no-adapter', txs: [] },
    });
    const mounted = await mountScreen(<RecentActivity />);
    try {
      expect(mounted.div.textContent).toContain('TON history unavailable');
      expect(mounted.div.textContent).not.toContain('TONhistory unavailable');
    } finally {
      await mounted.cleanup();
    }
  });

  it('unavailable asset row reads with real spaces', async () => {
    vi.mocked(useWallet).mockReturnValue({
      balances: {
        btc: { status: 'available', value: '0' },
        eth: { status: 'available', value: '0' },
        trx: { status: 'available', value: '0' },
        ton: { status: 'unavailable' },
        sol: { status: 'unavailable', reason: 'no-adapter' },
        bsc: { status: 'unavailable', reason: 'no-adapter' },
        matic: { status: 'unavailable', reason: 'no-adapter' },
        arb: { status: 'unavailable', reason: 'no-adapter' },
        op: { status: 'unavailable', reason: 'no-adapter' },
        base: { status: 'unavailable', reason: 'no-adapter' },
        avax: { status: 'unavailable', reason: 'no-adapter' },
        gnosis: { status: 'unavailable', reason: 'no-adapter' },
        celo: { status: 'unavailable', reason: 'no-adapter' },
        linea: { status: 'unavailable', reason: 'no-adapter' },
        mantle: { status: 'unavailable', reason: 'no-adapter' },
        scroll: { status: 'unavailable', reason: 'no-adapter' },
        opbnb: { status: 'unavailable', reason: 'no-adapter' },
        metis: { status: 'unavailable', reason: 'no-adapter' },
        aurora: { status: 'unavailable', reason: 'no-adapter' },
        fantom: { status: 'unavailable', reason: 'no-adapter' },
        ltc: { status: 'unavailable', reason: 'no-adapter' },
        doge: { status: 'unavailable', reason: 'no-adapter' },
      },
      vaultState: 'no-vault',
      vaultAddresses: EMPTY_ADDRESSES,
      addresses: EMPTY_ADDRESSES,
      refreshBalances: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useWallet>);

    const mounted = await mountScreen(
      <AssetRows
        hideZero={false}
        onShowAll={vi.fn()}
        prices={EMPTY_PRICES}
        pricesNowMs={Date.now()}
      />,
      '/assets',
    );
    try {
      expect(mounted.div.textContent).toContain('TON Balance unavailable');
      expect(mounted.div.textContent).not.toContain('TONBalance unavailable');
    } finally {
      await mounted.cleanup();
    }
  });
});
