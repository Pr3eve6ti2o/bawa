// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AddTokenDialog } from './add-token';
import { useWallet } from '../state/wallet-context';
import {
  resolveTokenCoingeckoId,
  verifyEvmToken,
  verifyJettonToken,
  verifySplToken,
  verifyTronToken,
} from '../wallet/adapters/token-balances';
import type { TokenRecord } from '../wallet/tokens';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/adapters/token-balances', () => ({
  verifyEvmToken: vi.fn(),
  verifyTronToken: vi.fn(),
  verifySplToken: vi.fn(),
  verifyJettonToken: vi.fn(),
  resolveTokenCoingeckoId: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const ETH_ADDRESS = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';
const TRON_ADDRESS = 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9';
const SOL_ADDRESS = 'DFeDnNjEonL96pQywDtanNuVGxSnjjq1aHjGGLjtxset';
const TON_ADDRESS = 'UQBfcPvE9ZZ0VXxBN_8zs7oJpf9q6ta8p7GZaaB97uWzvH5M';
const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const SOL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TON_USDT_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

const USDC_RECORD: TokenRecord = {
  chain: 'eth',
  contract: USDC_CONTRACT,
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  coingeckoId: 'usd-coin',
  addedAtMs: 0,
};

const mockSetChainEnabled = vi.fn();
const mockAddCustomToken = vi.fn();

function setWallet(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    enabledChains: ['btc', 'eth', 'trx', 'ton', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge'],
    setChainEnabled: mockSetChainEnabled,
    customTokens: [],
    addCustomToken: mockAddCustomToken,
    vaultAddresses: {
      eth: [ETH_ADDRESS],
      trx: [TRON_ADDRESS],
      btc: [], ton: [], sol: [], bsc: [], matic: [], arb: [], op: [], base: [], avax: [], ltc: [], doge: [],
    },
    addresses: {
      eth: [{ address: ETH_ADDRESS }],
      trx: [{ address: TRON_ADDRESS }],
      btc: [], ton: [], sol: [], bsc: [], matic: [], arb: [], op: [], base: [], avax: [], ltc: [], doge: [],
    },
    ...overrides,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountDialog() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<AddTokenDialog open onOpenChange={() => {}} />);
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
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )!.set!;
  act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function clickButton(root: ParentNode, text: string): void {
  const button = [...root.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).not.toBeUndefined();
  act(() => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function submitForm(root: ParentNode): Promise<void> {
  const form = root.querySelector('form');
  expect(form).not.toBeNull();
  await act(async () => {
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddCustomToken.mockReturnValue({ ok: true });
  vi.mocked(resolveTokenCoingeckoId).mockResolvedValue('usd-coin');
  vi.mocked(verifyEvmToken).mockResolvedValue({
    ok: true,
    metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    balanceBaseUnits: '2500000',
  });
  vi.mocked(verifyTronToken).mockResolvedValue({
    ok: true,
    metadata: { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
    balanceBaseUnits: '5000000',
  });
  vi.mocked(verifySplToken).mockResolvedValue({
    ok: true,
    metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    balanceBaseUnits: '2500000',
  });
  vi.mocked(verifyJettonToken).mockResolvedValue({
    ok: true,
    metadata: { name: 'Tether USD', symbol: 'USD₮', decimals: 6 },
    balanceBaseUnits: '1000000',
  });
  setWallet();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddTokenDialog — add chain mode', () => {
  it('lists all 22 registry chains and adds a disabled one', async () => {
    const mounted = await mountDialog();
    try {
      clickButton(document, 'Add chain');
      expect(document.body.textContent).toContain('Solana');
      expect(document.body.textContent).toContain('Dogecoin');
      // Solana is disabled in the mock wallet; Ethereum is enabled.
      const solanaRow = [...document.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('Solana'),
      );
      expect(solanaRow).not.toBeUndefined();
      const addButton = [...(solanaRow?.querySelectorAll('button') ?? [])].find(
        (button) => button.textContent?.trim() === 'Add',
      );
      expect(addButton).not.toBeUndefined();
      act(() => {
        addButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(mockSetChainEnabled).toHaveBeenCalledWith('sol', true);
      expect(document.body.textContent).toContain('Solana added');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows enabled chains as Enabled with no Add button', async () => {
    const mounted = await mountDialog();
    try {
      clickButton(document, 'Add chain');
      const ethRow = [...document.querySelectorAll('li')].find((li) =>
        li.textContent?.includes('Ethereum'),
      );
      expect(ethRow?.textContent).toContain('Enabled');
      expect(
        [...(ethRow?.querySelectorAll('button') ?? [])].some(
          (button) => button.textContent?.trim() === 'Add',
        ),
      ).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('AddTokenDialog — add token mode', () => {
  it('rejects a short contract address with a specific inline error and adds nothing', async () => {
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      expect(input).not.toBeNull();
      setInputValue(input!, '0xA0b86991c6218b36c1d19D4a');
      await submitForm(document);
      const alert = document.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Enter a 40-character contract address starting with 0x');
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).not.toHaveBeenCalled();
      // The input stays intact and keeps focus.
      expect(input!.value).toBe('0xA0b86991c6218b36c1d19D4a');
      expect(document.activeElement).toBe(input);
    } finally {
      await mounted.cleanup();
    }
  });

  it('adds a verified ERC-20 token by contract with its real metadata', async () => {
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, USDC_CONTRACT);
      await submitForm(document);
      expect(verifyEvmToken).toHaveBeenCalledTimes(1);
      expect(resolveTokenCoingeckoId).toHaveBeenCalledWith({
        platform: 'ethereum',
        contract: USDC_CONTRACT,
      });
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record).toMatchObject({
        chain: 'eth',
        contract: USDC_CONTRACT,
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        coingeckoId: 'usd-coin',
      });
      expect(document.body.textContent).toContain('Token added');
    } finally {
      await mounted.cleanup();
    }
  });

  it('resolves a Jetton CoinGecko id via the-open-network', async () => {
    const NOT_MASTER = 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT';
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue('notcoin');
    vi.mocked(verifyJettonToken).mockResolvedValue({
      ok: true,
      metadata: { name: 'Notcoin', symbol: 'NOT', decimals: 9 },
      balanceBaseUnits: '0',
    });
    setWallet({
      vaultAddresses: {
        eth: [ETH_ADDRESS],
        trx: [TRON_ADDRESS],
        btc: [],
        ton: [TON_ADDRESS],
        sol: [],
        bsc: [],
        matic: [],
        arb: [],
        op: [],
        base: [],
        avax: [],
        ltc: [],
        doge: [],
      },
      addresses: {
        eth: [{ address: ETH_ADDRESS }],
        trx: [{ address: TRON_ADDRESS }],
        btc: [],
        ton: [{ address: TON_ADDRESS }],
        sol: [],
        bsc: [],
        matic: [],
        arb: [],
        op: [],
        base: [],
        avax: [],
        ltc: [],
        doge: [],
      },
    });
    const mounted = await mountDialog();
    try {
      const select = document.querySelector<HTMLSelectElement>('#add-token-chain');
      expect(select).not.toBeNull();
      setSelectValue(select!, 'ton');
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, NOT_MASTER);
      await submitForm(document);
      expect(verifyJettonToken).toHaveBeenCalledTimes(1);
      expect(resolveTokenCoingeckoId).toHaveBeenCalledWith({
        platform: 'the-open-network',
        contract: NOT_MASTER,
      });
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record).toMatchObject({
        chain: 'ton',
        contract: NOT_MASTER,
        name: 'Notcoin',
        symbol: 'NOT',
        decimals: 9,
        coingeckoId: 'notcoin',
      });
      expect(document.body.textContent).toContain('Token added');
    } finally {
      await mounted.cleanup();
    }
  });

  it('still adds the token when the CoinGecko lookup 404s, with no price id', async () => {
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue(null);
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, USDC_CONTRACT);
      await submitForm(document);
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record.coingeckoId).toBeNull();
      expect(document.body.textContent).toContain('Token added');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Already added for a duplicate and verifies nothing', async () => {
    setWallet({ customTokens: [USDC_RECORD] });
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
      await submitForm(document);
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Already added');
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the on-chain rejection and adds nothing when the address is not a token contract', async () => {
    vi.mocked(verifyEvmToken).mockResolvedValue({
      ok: false,
      error: 'This address is not a token contract on Ethereum',
    });
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, USDC_CONTRACT);
      await submitForm(document);
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'This address is not a token contract on Ethereum',
      );
      expect(mockAddCustomToken).not.toHaveBeenCalled();
      expect(input!.value).toBe(USDC_CONTRACT);
    } finally {
      await mounted.cleanup();
    }
  });

  it('disables the Add button with Checking… while verification is in flight', async () => {
    let resolveVerify!: (value: {
      ok: true;
      metadata: { name: string; symbol: string; decimals: number };
      balanceBaseUnits: string;
    }) => void;
    vi.mocked(verifyEvmToken).mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, USDC_CONTRACT);
      const form = document.querySelector('form');
      act(() => {
        form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      const button = [...document.querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.includes('Checking'),
      );
      expect(button).not.toBeUndefined();
      expect(button!.disabled).toBe(true);
      await act(async () => {
        resolveVerify({
          ok: true,
          metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
          balanceBaseUnits: '2500000',
        });
      });
      expect(document.body.textContent).toContain('Token added');
    } finally {
      await mounted.cleanup();
    }
  });

  it('adds a TRC-20 token by contract on TRON', async () => {
    const mounted = await mountDialog();
    try {
      const select = document.querySelector<HTMLSelectElement>('#add-token-chain');
      expect(select).not.toBeNull();
      setSelectValue(select!, 'trx');
      expect(document.querySelector('label[for="add-token-contract"]')?.textContent).toContain('TRON');
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, TRON_USDT);
      await submitForm(document);
      expect(verifyTronToken).toHaveBeenCalledTimes(1);
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record).toMatchObject({
        chain: 'trx',
        contract: TRON_USDT,
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows native-coin-only chains as disabled options with the reason, and SPL/Jetton chains as enabled', async () => {
    const mounted = await mountDialog();
    try {
      const select = document.querySelector<HTMLSelectElement>('#add-token-chain');
      for (const value of ['btc', 'ltc', 'doge']) {
        const option = [...(select?.options ?? [])].find(
          (candidate) => candidate.value === value,
        );
        expect(option?.disabled).toBe(true);
        expect(option?.textContent).toContain('Native coin only');
      }
      // UI/UX fixes, item 13: Solana (SPL) and TON (Jetton) are selectable.
      const tonOption = [...(select?.options ?? [])].find((option) => option.value === 'ton');
      expect(tonOption?.disabled).toBe(false);
      const solOption = [...(select?.options ?? [])].find((option) => option.value === 'sol');
      expect(solOption?.disabled).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });

  it('adds a verified SPL token by mint with its real metadata', async () => {
    setWallet({
      vaultAddresses: {
        eth: [ETH_ADDRESS],
        trx: [TRON_ADDRESS],
        sol: [SOL_ADDRESS],
        ton: [TON_ADDRESS],
        btc: [],
        bsc: [],
        matic: [],
        arb: [],
        op: [],
        base: [],
        avax: [],
        ltc: [],
        doge: [],
      },
    });
    const mounted = await mountDialog();
    try {
      const select = document.querySelector<HTMLSelectElement>('#add-token-chain');
      setSelectValue(select!, 'sol');
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, SOL_USDC_MINT);
      await submitForm(document);
      expect(verifySplToken).toHaveBeenCalledTimes(1);
      expect(verifySplToken).toHaveBeenCalledWith({
        contract: SOL_USDC_MINT,
        ownerAddress: SOL_ADDRESS,
      });
      expect(resolveTokenCoingeckoId).toHaveBeenCalledWith({
        platform: 'solana',
        contract: SOL_USDC_MINT,
      });
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record).toMatchObject({
        chain: 'sol',
        contract: SOL_USDC_MINT,
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        coingeckoId: 'usd-coin',
      });
      expect(document.body.textContent).toContain('Token added');
    } finally {
      await mounted.cleanup();
    }
  });

  it('adds a verified Jetton token by master with its real metadata', async () => {
    setWallet({
      vaultAddresses: {
        eth: [ETH_ADDRESS],
        trx: [TRON_ADDRESS],
        sol: [SOL_ADDRESS],
        ton: [TON_ADDRESS],
        btc: [],
        bsc: [],
        matic: [],
        arb: [],
        op: [],
        base: [],
        avax: [],
        ltc: [],
        doge: [],
      },
    });
    const mounted = await mountDialog();
    try {
      const select = document.querySelector<HTMLSelectElement>('#add-token-chain');
      setSelectValue(select!, 'ton');
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, TON_USDT_MASTER);
      await submitForm(document);
      expect(verifyJettonToken).toHaveBeenCalledTimes(1);
      expect(verifyJettonToken).toHaveBeenCalledWith({
        contract: TON_USDT_MASTER,
        ownerAddress: TON_ADDRESS,
      });
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record).toMatchObject({
        chain: 'ton',
        contract: TON_USDT_MASTER,
        name: 'Tether USD',
        symbol: 'USD₮',
        decimals: 6,
      });
      expect(document.body.textContent).toContain('Token added');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('AddTokenDialog — find by ticker or name', () => {
  it('resolves USDC from the local registry and prefills chain + contract', async () => {
    // Token gaps, item 2: a ticker search resolves to the token with
    // its chain and contract — no network call for a registry token.
    const mounted = await mountDialog();
    try {
      const search = document.querySelector<HTMLInputElement>('#add-token-search');
      expect(search).not.toBeNull();
      setInputValue(search!, 'USDC');
      await act(async () => {
        clickButton(document, 'Search');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(document.body.textContent).toContain('USD Coin (USDC)');
      expect(document.body.textContent).toContain('0xA0b8…eB48');
      const useButton = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('Use'),
      );
      expect(useButton).not.toBeUndefined();
      act(() => {
        useButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const contract = document.querySelector<HTMLInputElement>('#add-token-contract');
      expect(contract?.value).toBe(USDC_CONTRACT);
      const status = document.querySelector('[role="status"]');
      expect(status?.textContent).toContain('USD Coin (USDC) on Ethereum');
    } finally {
      await mounted.cleanup();
    }
  });

  it('says honestly when a ticker resolves nowhere', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ coins: [] }),
        headers: { get: () => null },
      })),
    );
    const mounted = await mountDialog();
    try {
      const search = document.querySelector<HTMLInputElement>('#add-token-search');
      setInputValue(search!, 'zzzznonexistent');
      await act(async () => {
        clickButton(document, 'Search');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      const alert = document.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('No token found for "zzzznonexistent"');
      expect(mockAddCustomToken).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('AddTokenDialog — devnet mode', () => {
  it('blocks adding a mainnet token while devnet is on and verifies nothing', async () => {
    setWallet({ devnetEnabled: true });
    const mounted = await mountDialog();
    try {
      // DialogContent portals to document.body, not the mount div.
      expect(document.body.textContent).toContain(
        'Adding tokens is off in devnet test mode',
      );
      const addButton = [...document.querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.trim() === 'Add',
      );
      expect(addButton).not.toBeUndefined();
      expect(addButton!.disabled).toBe(true);
      const contract =
        document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(contract!, USDC_CONTRACT);
      await submitForm(document);
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });
});
