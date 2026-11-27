// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AddTokenDialog } from './add-token';
import { LAST_USED_CHAIN_KEY } from './chain-search-select';
import { useWallet } from '../state/wallet-context';
import {
  resolveTokenCoingeckoId,
  verifyEvmToken,
  verifyJettonToken,
  verifySplToken,
  verifyTronToken,
} from '../wallet/adapters/token-balances';
import {
  isBannedToken,
  resolveTokenIcon,
  resolveTokenListVerification,
} from '../wallet/token-verification';
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

vi.mock('../wallet/token-verification', () => ({
  isBannedToken: vi.fn(),
  resolveTokenListVerification: vi.fn(),
  resolveTokenIcon: vi.fn(),
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

function pickChain(root: ParentNode, name: string): void {
  // P1 (Lane S1): the chain is picked through the shared search picker
  // now, not a native select. Focus opens the list; the option is
  // matched on its label (display name only).
  const input = root.querySelector<HTMLInputElement>('#add-token-chain');
  expect(input).not.toBeNull();
  act(() => {
    input!.focus();
    input!.click();
  });
  const option = [...root.querySelectorAll('[role="option"]')].find((candidate) => {
    const label =
      candidate.querySelector('[data-chain-option-name]')?.textContent ?? '';
    // The label span reads "<Display name> <CHAIN ID>".
    return label.startsWith(`${name} `);
  }) as HTMLElement | undefined;
  expect(option, `chain picker offers ${name}`).not.toBeUndefined();
  act(() => {
    option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    option!.click();
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
  // P1 (Lane S1): the chain starts at the last-used chain now, so a
  // pick in one test must not leak into the next.
  localStorage.clear();
  mockAddCustomToken.mockReturnValue({ ok: true });
  vi.mocked(resolveTokenCoingeckoId).mockResolvedValue({ id: 'usd-coin', image: null });
  vi.mocked(isBannedToken).mockResolvedValue(false);
  vi.mocked(resolveTokenListVerification).mockResolvedValue({ verified: false, source: null, logoUri: null });
  vi.mocked(resolveTokenIcon).mockResolvedValue({ iconUrl: null, iconSource: null });
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
  it('lists disabled registry chains only and adds one', async () => {
    const mounted = await mountDialog();
    try {
      clickButton(document, 'Add chain');
      // Lane X (Lane D #151): the add-chain list shows disabled
      // chains only — enabled ones (Ethereum, Dogecoin in this
      // fixture) are already in the wallet and are not listed.
      expect(document.body.textContent).toContain('Solana');
      const chainList = document.querySelector('ul[class*="max-h-[50vh]"]');
      const addRows = [...(chainList?.querySelectorAll('li') ?? [])].filter((li) =>
        [...li.querySelectorAll('button')].some(
          (button) => button.textContent?.trim() === 'Add',
        ),
      );
      // 87 registry chains minus the 12 enabled in this fixture.
      expect(addRows).toHaveLength(75);
      expect(
        addRows.some(
          (li) =>
            li.textContent?.includes('Ethereum') &&
            !li.textContent?.includes('Ethereum Classic'),
        ),
      ).toBe(false);
      expect(addRows.some((li) => li.textContent?.includes('Dogecoin'))).toBe(false);
      // Solana is disabled in the mock wallet.
      // P1 (Lane S1): the list is family-grouped now, so a 'Solana'
      // group heading precedes the row — match the row (the li with
      // the Add button), not the heading.
      const solanaRow = [...document.querySelectorAll('li')].find(
        (li) =>
          li.textContent?.includes('Solana') &&
          [...li.querySelectorAll('button')].some(
            (button) => button.textContent?.trim() === 'Add',
          ),
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

  it('hides enabled chains from the add-chain list', async () => {
    const mounted = await mountDialog();
    try {
      clickButton(document, 'Add chain');
      // Lane X (Lane D #151): an enabled chain is already in the
      // wallet, so it is not listed at all — no "Enabled" row, no
      // Add button for it. (Ethereum Classic is disabled in this
      // fixture, so it still lists — exclude it from the check.)
      const chainList = document.querySelector('ul[class*="max-h-[50vh]"]');
      const addRows = [...(chainList?.querySelectorAll('li') ?? [])].filter((li) =>
        [...li.querySelectorAll('button')].some(
          (button) => button.textContent?.trim() === 'Add',
        ),
      );
      expect(
        addRows.some(
          (li) =>
            li.textContent?.includes('Ethereum') &&
            !li.textContent?.includes('Ethereum Classic'),
        ),
      ).toBe(false);
      expect(addRows.some((li) => li.textContent?.includes('Dogecoin'))).toBe(false);
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('AddTokenDialog — add token mode', () => {
  it('pre-selects the last-used chain when the dialog opens', async () => {
    // P1 (Lane S1): the chain starts at the last-used chain, not
    // always Ethereum.
    window.localStorage.setItem(LAST_USED_CHAIN_KEY, JSON.stringify('ton'));
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-chain');
      expect(input).not.toBeNull();
      expect(input!.value).toBe('TON');
    } finally {
      await mounted.cleanup();
    }
  });

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
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue({ id: 'notcoin', image: null });
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
      pickChain(document, 'TON');
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
    // SHIB is not a default, so with no listing it is Unverified —
    // USDC would be verified by the default list even with no id.
    const SHIB_CONTRACT = '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE';
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue(null);
    vi.mocked(verifyEvmToken).mockResolvedValue({
      ok: true,
      metadata: { name: 'Shiba Inu', symbol: 'SHIB', decimals: 18 },
      balanceBaseUnits: '0',
    });
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, SHIB_CONTRACT);
      await submitForm(document);
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record.coingeckoId).toBeNull();
      expect(document.body.textContent).toContain('Token added');
      // Lane 1: no listing, no tick — the result says Unverified.
      expect(document.body.textContent).toContain('Token added — Unverified');
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane A (token-verify): a token CoinGecko does not list is still
  // Verified when a trusted list holds it — here the 1inch list —
  // and the add result names the list.
  it('verifies a token via 1inch when CoinGecko has no listing for it', async () => {
    const AAMPL_CONTRACT = '0x1e6bb68acec8fefbd87d192be09bb274170a0548';
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue(null);
    vi.mocked(resolveTokenListVerification).mockResolvedValue({
      verified: true,
      source: 'one-inch',
      logoUri: null,
    });
    vi.mocked(verifyEvmToken).mockResolvedValue({
      ok: true,
      metadata: { name: 'Aave interest bearing AMPL', symbol: 'aAMPL', decimals: 9 },
      balanceBaseUnits: '0',
    });
    const mounted = await mountDialog();
    try {
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, AAMPL_CONTRACT);
      await submitForm(document);
      expect(resolveTokenListVerification).toHaveBeenCalledTimes(1);
      const listCall = vi.mocked(resolveTokenListVerification).mock.calls[0]?.[0];
      expect(listCall?.chain).toBe('eth');
      // The contract is checksummed by validation; compare case-insensitively.
      expect(listCall?.contract.toLowerCase()).toBe(AAMPL_CONTRACT);
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record.coingeckoId).toBeNull();
      expect(record.verifiedSource).toBe('one-inch');
      expect(document.body.textContent).toContain('Token added — Verified (1inch)');
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane A (token-verify): a mint on Jupiter's banned list is refused
  // outright — it is never added, so it can never show a tick.
  it('refuses a banned Solana mint', async () => {
    const BANNED_MINT = '3mXx1bNiB5bhgwznk4eeqM9eoy6DU3CeCkm1LPabeoEh';
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
    vi.mocked(isBannedToken).mockResolvedValue(true);
    const mounted = await mountDialog();
    try {
      pickChain(document, 'Solana');
      const input = document.querySelector<HTMLInputElement>('#add-token-contract');
      setInputValue(input!, BANNED_MINT);
      await submitForm(document);
      expect(verifySplToken).toHaveBeenCalledTimes(1);
      expect(isBannedToken).toHaveBeenCalledWith({
        chain: 'sol',
        contract: BANNED_MINT,
      });
      expect(mockAddCustomToken).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("banned-token list");
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
      pickChain(document, 'TRON');
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
      // P1 (Lane S1): the chain is the shared search picker now, not
      // a native select — open it and read the rows: a disabled row
      // carries aria-disabled and its reason, an enabled row neither.
      const input = document.querySelector<HTMLInputElement>('#add-token-chain');
      expect(input).not.toBeNull();
      act(() => {
        input!.focus();
        input!.click();
      });
      const rows = [...document.querySelectorAll('[role="option"]')];
      const rowFor = (name: string) =>
        rows.find((candidate) =>
          candidate
            .querySelector('[data-chain-option-name]')
            ?.textContent?.startsWith(`${name} `),
        );
      for (const name of ['Bitcoin', 'Litecoin', 'Dogecoin']) {
        const row = rowFor(name);
        expect(row, `picker offers ${name}`).not.toBeUndefined();
        expect(row?.getAttribute('aria-disabled')).toBe('true');
        expect(row?.textContent).toContain('Native coin only');
      }
      // UI/UX fixes, item 13: Solana (SPL) and TON (Jetton) are selectable.
      for (const name of ['TON', 'Solana']) {
        const row = rowFor(name);
        expect(row, `picker offers ${name}`).not.toBeUndefined();
        expect(row?.getAttribute('aria-disabled')).toBeNull();
      }
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
      pickChain(document, 'Solana');
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
      pickChain(document, 'TON');
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
  // Lane 1: stub CoinGecko /search + /coins/{id} for the dialog's
  // remote search. `details` maps coin id -> detail payload (or
  // 'rate-limited' for a 429 on that coin's detail fetch).
  // Real SUSHI contract, read live from CoinGecko 2026-11-24: the
  // lowercase form is what CoinGecko returns (and what a search
  // candidate carries).
  const SUSHI_CONTRACT = '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2';
  const SUSHI_DETAIL = {
    id: 'sushi',
    name: 'Sushi',
    symbol: 'sushi',
    detail_platforms: {
      ethereum: { decimal_place: 18, contract_address: SUSHI_CONTRACT },
    },
  };
  function stubCoinGeckoSearch(
    searchCoins: unknown[],
    details: Record<string, unknown | 'rate-limited'>,
  ): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/v3/search?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ coins: searchCoins }),
            headers: { get: () => null },
          };
        }
        const match = url.match(/\/api\/v3\/coins\/([^?]+)/);
        const detail = match !== null ? details[match[1]!] : undefined;
        if (detail === 'rate-limited' || detail === undefined) {
          return {
            ok: false,
            status: detail === 'rate-limited' ? 429 : 404,
            json: async () => ({}),
            headers: { get: () => null },
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => detail,
          headers: { get: () => null },
        };
      }),
    );
  }

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

  it('shows the verified mark on a CoinGecko search result', async () => {
    // Lane 1: "sushi" is not in the local registry, so the remote
    // search resolves it — and the result carries the verified mark,
    // because its contract came from CoinGecko itself.
    stubCoinGeckoSearch(
      [{ id: 'sushi', name: 'Sushi', symbol: 'SUSHI' }],
      { sushi: SUSHI_DETAIL },
    );
    const mounted = await mountDialog();
    try {
      const search = document.querySelector<HTMLInputElement>('#add-token-search');
      setInputValue(search!, 'sushi');
      await act(async () => {
        clickButton(document, 'Search');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(document.body.textContent).toContain('Sushi (SUSHI)');
      expect(document.body.querySelector('[aria-label="Verified token"]')).not.toBeNull();
      expect(document.body.textContent).toContain('0x6b35…0fe2');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Unverified on a search result with no CoinGecko listing', async () => {
    // Lane 1: a user-added token with no listing is a local match —
    // and its result says Unverified, never a tick.
    const UNLISTED_RECORD: TokenRecord = {
      chain: 'eth',
      contract: '0x00000000000000000000000000000000000000A1',
      name: 'Unlisted Token',
      symbol: 'UNL',
      decimals: 18,
      coingeckoId: null,
      addedAtMs: 1,
    };
    setWallet({ customTokens: [UNLISTED_RECORD] });
    const mounted = await mountDialog();
    try {
      const search = document.querySelector<HTMLInputElement>('#add-token-search');
      setInputValue(search!, 'UNL');
      await act(async () => {
        clickButton(document, 'Search');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(document.body.textContent).toContain('Unlisted Token (UNL)');
      expect(document.body.textContent).toContain('Unverified');
      expect(document.body.querySelector('[aria-label="Verified token"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('AddTokenDialog — ticker in the contract field', () => {
  // Real SUSHI contract, read live from CoinGecko 2026-11-24: the
  // lowercase form is what CoinGecko returns (and what a search
  // candidate carries); the checksummed form is what the submit
  // normalizes it to before verifying.
  const SUSHI_CONTRACT = '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2';
  const SUSHI_CONTRACT_CHECKSUMMED = '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2';
  const SUSHI_DETAIL = {
    id: 'sushi',
    name: 'Sushi',
    symbol: 'sushi',
    detail_platforms: {
      ethereum: { decimal_place: 18, contract_address: SUSHI_CONTRACT },
    },
  };
  function stubCoinGeckoSearch(
    searchCoins: unknown[],
    details: Record<string, unknown | 'rate-limited'>,
  ): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/v3/search?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ coins: searchCoins }),
            headers: { get: () => null },
          };
        }
        const match = url.match(/\/api\/v3\/coins\/([^?]+)/);
        const detail = match !== null ? details[match[1]!] : undefined;
        if (detail === 'rate-limited' || detail === undefined) {
          return {
            ok: false,
            status: detail === 'rate-limited' ? 429 : 404,
            json: async () => ({}),
            headers: { get: () => null },
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => detail,
          headers: { get: () => null },
        };
      }),
    );
  }
  async function submitTicker(value: string): Promise<void> {
    const input = document.querySelector<HTMLInputElement>('#add-token-contract');
    setInputValue(input!, value);
    await submitForm(document);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }

  it('adds sushi by typing its ticker in the contract field', async () => {
    // Lane 1: the owner's case — "sushi" in the contract field used
    // to fail with a format error. One unambiguous match is filled in
    // and added, with its real CoinGecko id and the verified result.
    stubCoinGeckoSearch(
      [{ id: 'sushi', name: 'Sushi', symbol: 'SUSHI' }],
      { sushi: SUSHI_DETAIL },
    );
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue({ id: 'sushi', image: null });
    vi.mocked(verifyEvmToken).mockResolvedValue({
      ok: true,
      metadata: { name: 'Sushi', symbol: 'SUSHI', decimals: 18 },
      balanceBaseUnits: '0',
    });
    const mounted = await mountDialog();
    try {
      await submitTicker('sushi');
      expect(verifyEvmToken).toHaveBeenCalledWith({
        chain: 'eth',
        contract: SUSHI_CONTRACT_CHECKSUMMED,
        ownerAddress: ETH_ADDRESS,
      });
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record).toMatchObject({
        chain: 'eth',
        contract: SUSHI_CONTRACT_CHECKSUMMED,
        name: 'Sushi',
        symbol: 'SUSHI',
        decimals: 18,
        coingeckoId: 'sushi',
      });
      expect(document.body.textContent).toContain('Token added — Verified');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the matches when a ticker in the contract field is ambiguous', async () => {
    // Lane 1: "usdc" matches seven registry tokens — the dialog shows
    // them for the user to pick and adds nothing on its own.
    const mounted = await mountDialog();
    try {
      await submitTicker('usdc');
      expect(document.body.textContent).toContain('USD Coin (USDC)');
      expect(document.body.textContent).toContain('pick one, then Add');
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the format error when a ticker in the contract field resolves nowhere', async () => {
    stubCoinGeckoSearch([], {});
    const mounted = await mountDialog();
    try {
      await submitTicker('zzzznonexistent');
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'Enter a 40-character contract address starting with 0x',
      );
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the search error when the ticker lookup is rate-limited', async () => {
    // Lane 1: a 429 is a search failure, not "no token found" — and
    // not a format error either.
    stubCoinGeckoSearch(
      [{ id: 'sushi', name: 'Sushi', symbol: 'SUSHI' }],
      { sushi: 'rate-limited' },
    );
    const mounted = await mountDialog();
    try {
      await submitTicker('sushi');
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'Search failed: CoinGecko is rate-limiting',
      );
      expect(verifyEvmToken).not.toHaveBeenCalled();
      expect(mockAddCustomToken).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('keeps a picked token verified when the CoinGecko re-lookup is rate-limited', async () => {
    // Lane 1: search finds sushi (CoinGecko-confirmed), the user
    // picks it, then the second lookup returns null — the add keeps
    // the picked candidate's listing id, so the token stays verified.
    stubCoinGeckoSearch(
      [{ id: 'sushi', name: 'Sushi', symbol: 'SUSHI' }],
      { sushi: SUSHI_DETAIL },
    );
    vi.mocked(resolveTokenCoingeckoId).mockResolvedValue(null);
    vi.mocked(verifyEvmToken).mockResolvedValue({
      ok: true,
      metadata: { name: 'Sushi', symbol: 'SUSHI', decimals: 18 },
      balanceBaseUnits: '0',
    });
    const mounted = await mountDialog();
    try {
      const search = document.querySelector<HTMLInputElement>('#add-token-search');
      setInputValue(search!, 'sushi');
      await act(async () => {
        clickButton(document, 'Search');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      const useButton = [...document.querySelectorAll('button')].find((candidate) =>
        candidate.textContent?.includes('Use'),
      );
      expect(useButton).not.toBeUndefined();
      act(() => {
        useButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const contract = document.querySelector<HTMLInputElement>('#add-token-contract');
      expect(contract?.value).toBe(SUSHI_CONTRACT);
      await submitForm(document);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(mockAddCustomToken).toHaveBeenCalledTimes(1);
      const record = mockAddCustomToken.mock.calls[0]![0] as TokenRecord;
      expect(record.coingeckoId).toBe('sushi');
      expect(document.body.textContent).toContain('Token added — Verified');
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
        'Adding tokens is off in devnet.',
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
