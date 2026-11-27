// @vitest-environment jsdom

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackTransactionScreen } from './track-transaction';
import { LAST_USED_CHAIN_KEY } from './chain-search-select';
import { getRecentActivity, lookupTransaction } from '../wallet/tracker';
import { ensureAdapters, useWallet } from '../state/wallet-context';

vi.mock('../wallet/tracker', () => ({
  lookupTransaction: vi.fn(),
  getRecentActivity: vi.fn(),
}));

// The screen reads devnetEnabled from the wallet context; the tracker
// tests run with devnet off unless a test flips it. The adapter
// loaders are stubbed: the real ones would import the ~3 MB adapter
// chunk and register real adapters in jsdom.
vi.mock('../state/wallet-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../state/wallet-context')>();
  return {
    ...actual,
    useWallet: vi.fn(() => ({ devnetEnabled: false })),
    ensureAdapters: vi.fn(() => Promise.resolve()),
    ensureDevnetAdapters: vi.fn(() => Promise.resolve()),
  };
});

const btcHash =
  'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16';
const btcTx = {
  hash: btcHash,
  chain: 'btc',
  networkId: 'bip122:000000000019d6689c085ae165831e93',
  status: 'confirmed',
  statusLabel: 'confirmed',
  confirmations: 976455,
  blockHeight: 170,
  from: null,
  to: null,
  amountBaseUnits: '5000000000',
  feeBaseUnits: '0',
  timestamp: 1231731025 * 1000,
  explorerUrl:
    'https://mempool.space/tx/f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16',
  source: 'mempool.space',
  fetchedAt: 1231731025000,
} as const;
const btcAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

function mount(entries: string[] = ['/track']) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(div);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={entries}>
        <TrackTransactionScreen />
      </MemoryRouter>,
    );
  });

  return {
    div,
    cleanup() {
      act(() => root.unmount());
      div.remove();
    },
  };
}

let mounted: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  // P1 (Lane S1): the chain starts at the last-used chain now, so a
  // pick in one test must not leak into the next.
  localStorage.clear();
  // afterEach resets all mocks, so restore the devnet-off default here.
  vi.mocked(useWallet).mockReturnValue({
    devnetEnabled: false,
  } as ReturnType<typeof useWallet>);
});

afterEach(() => {
  mounted?.cleanup();
  mounted = undefined;
  vi.resetAllMocks();
});

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = Array.from(div.querySelectorAll('button')).find(
    b => b.textContent?.includes(text),
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button;
}

function findInputByLabel(div: HTMLDivElement, text: string): HTMLInputElement {
  const label = Array.from(div.querySelectorAll('label')).find(
    l => l.textContent?.includes(text),
  );
  const labelledInput = label?.htmlFor
    ? div.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`)
    : label?.querySelector('input');
  const input = labelledInput
    ?? div.querySelector<HTMLInputElement>('input[placeholder*="EQ"]')
    ?? label?.parentElement?.querySelector('input');
  if (!input) {
    throw new Error(`Input not found: ${text}`);
  }
  return input;
}

function setInputValue(input: HTMLInputElement | null | undefined, value: string): void {
  if (!input) {
    throw new Error('Input not found');
  }
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!setter) {
      throw new Error('Native input value setter not found');
    }
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickButton(div: HTMLDivElement, text: string): Promise<void> {
  await act(async () => {
    findButton(div, text).click();
    await Promise.resolve();
  });
}

// Lane 6 redesign: chains are picked through the search picker, not a
// wall of buttons. Open the picker and click the option by name.
async function pickChain(div: HTMLDivElement, name: string): Promise<void> {
  const input = div.querySelector<HTMLInputElement>('#track-chain');
  if (!input) throw new Error('Chain picker not found');
  await act(async () => {
    input.focus();
    input.click();
  });
  const option = [...div.querySelectorAll('[role="option"]')].find((o) =>
    o.textContent?.includes(name),
  ) as HTMLElement | undefined;
  if (!option) throw new Error(`Chain option not found: ${name}`);
  await act(async () => {
    option.click();
  });
}

describe('TrackTransactionScreen', () => {
  it('renders the heading and offers every chain through the search picker', async () => {
    mounted = mount();
    const { div } = mounted;
    const heading = Array.from(div.querySelectorAll('h1, h2, h3')).find(
      h => h.textContent?.includes('Track a transaction'),
    );

    expect(heading).toBeDefined();
    const input = div.querySelector<HTMLInputElement>('#track-chain');
    expect(input).not.toBeNull();
    // Closed, the picker shows only the selected chain.
    expect(input?.value).toBe('Bitcoin');
    await act(async () => {
      input!.focus();
      input!.click();
    });
    const options = [...div.querySelectorAll('[role="option"]')].map(
      (o) => o.textContent,
    );
    for (const chain of ['Bitcoin', 'Ethereum', 'TRON', 'TON']) {
      expect(options.join(' ')).toContain(chain);
    }
  });

  it('shows the confirmed BTC transaction and its explorer link', async () => {
    vi.mocked(lookupTransaction).mockResolvedValue({
      status: 'ok',
      data: btcTx,
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#transaction-hash'), btcHash);
    await clickButton(div, 'Look up');

    expect(lookupTransaction).toHaveBeenCalledTimes(1);
    expect(div.textContent).toContain('976,455');
    expect(div.textContent).toContain('50 BTC');
    const explorer = div.querySelector('a[href*="mempool.space/tx/f4184fc5"]');
    expect(explorer?.getAttribute('href')).toContain('mempool.space/tx/f4184fc5');
  });

  it('shows a missing transaction without fabricating an amount or explorer link', async () => {
    vi.mocked(lookupTransaction).mockResolvedValue({ status: 'not-found' });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#transaction-hash'), '0'.repeat(64));
    await clickButton(div, 'Look up');

    expect(lookupTransaction).toHaveBeenCalledTimes(1);
    expect(div.textContent).toContain('Transaction not found');
    expect(div.textContent).not.toMatch(/\b\d[\d,.]*\s+BTC\b/);
    expect(div.querySelector('a[href*="/tx/"]')).toBeNull();
  });

  it('distinguishes a lookup failure from a missing transaction', async () => {
    vi.mocked(lookupTransaction).mockResolvedValue({
      status: 'error',
      reason: 'Network error: boom',
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#transaction-hash'), '0'.repeat(64));
    await clickButton(div, 'Look up');

    expect(div.textContent).toContain('Could not look up this transaction');
    expect(div.textContent).toContain(
      'The network is busy or unreachable. Please try again in a moment.',
    );
    expect(div.textContent).not.toContain('Transaction not found');
  });

  it('shows the TON account field and passes its address on resubmission', async () => {
    vi.mocked(lookupTransaction)
      .mockResolvedValueOnce({
        status: 'unsupported',
        reason: 'TON lookups need the account address',
      })
      .mockResolvedValueOnce({
        status: 'not-found',
        note: 'Checked the 10 most recent transactions',
      });
    mounted = mount();
    const { div } = mounted;

    await pickChain(div, 'TON');
    const accountInput = findInputByLabel(div, 'Account address');
    expect(accountInput).toBeInstanceOf(window.HTMLInputElement);
    expect(accountInput.value).toBe('');

    setInputValue(div.querySelector<HTMLInputElement>('#transaction-hash'), btcHash);
    await clickButton(div, 'Look up');
    expect(lookupTransaction).toHaveBeenCalledTimes(1);
    expect(div.textContent).toContain('TON lookups need the account address');

    const address = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    setInputValue(accountInput, address);
    await clickButton(div, 'Look up');

    expect(lookupTransaction).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(lookupTransaction).mock.calls[1])).toContain(address);
    expect(div.textContent).toContain('Transaction not found');
    expect(div.textContent).toContain('Checked the 10 most recent transactions');
  });

  it('reports empty recent activity without calling the address unused', async () => {
    vi.mocked(getRecentActivity).mockResolvedValue({
      status: 'ok',
      data: [],
      source: 'stub',
      fetchedAt: 1,
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#activity-address'), btcAddress);
    await clickButton(div, 'Show recent activity');

    expect(getRecentActivity).toHaveBeenCalledTimes(1);
    expect(div.textContent).toContain('No transactions found for this address');
    expect(div.textContent).not.toMatch(/unused address/i);
  });

  it('shows the reason recent activity could not be loaded', async () => {
    vi.mocked(getRecentActivity).mockResolvedValue({
      status: 'error',
      reason: 'Indexer unavailable',
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#activity-address'), btcAddress);
    await clickButton(div, 'Show recent activity');

    expect(getRecentActivity).toHaveBeenCalledTimes(1);
    expect(div.textContent).toMatch(/could not be loaded/i);
    expect(div.textContent).toContain('Indexer unavailable');
  });

  it('offers a Retry on the activity error that refetches it', async () => {
    // P0-6: the lookup error on this screen has a Retry; the
    // activity error had none. Same failure, same action.
    vi.mocked(getRecentActivity).mockResolvedValue({
      status: 'error',
      reason: 'Indexer unavailable',
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#activity-address'), btcAddress);
    await clickButton(div, 'Show recent activity');
    expect(getRecentActivity).toHaveBeenCalledTimes(1);

    await clickButton(div, 'Retry');
    expect(getRecentActivity).toHaveBeenCalledTimes(2);
  });

  it('loads the adapters before the activity lookup, and hides the Retry when the chain has none', async () => {
    // CDP first-hand: on a cold visit to /track the activity call
    // ran before any adapter was registered and failed at once with
    // "No history adapter…", and the Retry could never succeed
    // because the retry path registered nothing either. The screen
    // now loads the adapters first; a chain with genuinely no
    // adapter still gets the reason, but no dead Retry.
    vi.mocked(getRecentActivity).mockResolvedValue({
      status: 'unavailable',
      reason: 'No history adapter is available for this chain.',
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector<HTMLInputElement>('#activity-address'), btcAddress);
    await clickButton(div, 'Show recent activity');
    expect(vi.mocked(ensureAdapters)).toHaveBeenCalledTimes(1);
    expect(getRecentActivity).toHaveBeenCalledTimes(1);
    expect(div.textContent).toContain(
      'No history adapter is available for this chain.',
    );
    expect(div.textContent).toContain('Recent activity could not be loaded.');
    expect(
      [...div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Retry',
      ),
    ).toBeUndefined();
  });

  it('says what unblocks the disabled Show recent activity button', async () => {
    // P0-6: with no address the button rendered as a dashed outline
    // and read as broken. It now says what to do instead.
    mounted = mount();
    const { div } = mounted;

    expect(div.textContent).toContain(
      'Enter an address above to see its recent activity.',
    );
    const button = findButton(div, 'Show recent activity');
    expect(button.disabled).toBe(true);
  });

  it('fills the bottom of the page with honest guidance and a real example', async () => {
    vi.mocked(lookupTransaction).mockResolvedValue({
      status: 'ok',
      data: btcTx,
    });
    mounted = mount();
    const { div } = mounted;

    expect(div.textContent).toContain('How tracking works');
    // Lane X (Lane D #98/#99/#103): the step cards and "what a result
    // shows" are gone; the lag note is the "Indexers may lag" badge.
    expect(div.textContent).toContain('Try the first Bitcoin transaction');
    expect(div.textContent).toContain('Indexers may lag');
    expect(div.textContent).toContain(btcHash);

    await clickButton(div, 'Look up this example');

    expect(lookupTransaction).toHaveBeenCalledTimes(1);
    expect(lookupTransaction).toHaveBeenCalledWith('btc', btcHash, { address: undefined, devnet: false });
    expect(div.textContent).toContain('50 BTC');
  });

  it('shows the guide with the example only, no step cards', () => {
    // Lane X (Lane D #98/#99): the step cards and "what a result
    // shows" list are gone — the form labels already say it. Only the
    // genesis example stays.
    mounted = mount();
    const { div } = mounted;
    expect(div.querySelector('details')).toBeNull();
    const guide = div.querySelector('[aria-labelledby="track-guide-heading"]');
    expect(guide).not.toBeNull();
    expect(guide?.textContent).toContain('Try the first Bitcoin transaction');
    expect(guide?.textContent).toContain('The first Bitcoin transaction. Try it.');
    expect(guide?.textContent).not.toContain('Search for the chain.');
    expect(guide?.textContent).not.toContain('What a result shows');
    const grey = guide?.querySelectorAll('[class*="text-muted-foreground"], [class*="text-gray"]');
    expect(grey?.length).toBe(0);
  });

  it('passes the devnet flag to the tracker when devnet is on', async () => {
    vi.mocked(useWallet).mockReturnValue({ devnetEnabled: true } as ReturnType<typeof useWallet>);
    vi.mocked(lookupTransaction).mockResolvedValue({
      status: 'not-found',
      networkId: 'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      explorerUrl: null,
    } as never);
    mounted = mount();
    const { div } = mounted;
    const input = findInputByLabel(div, 'Transaction hash');
    setInputValue(input, btcHash);
    await act(async () => {
      findButton(div, 'Look up').click();
    });
    expect(lookupTransaction).toHaveBeenCalledWith('btc', btcHash, { address: undefined, devnet: true });
  });

  it('pre-selects the last-used chain', () => {
    // P1 (Lane S1): the tracker opens on the last chain picked anywhere.
    window.localStorage.setItem(LAST_USED_CHAIN_KEY, JSON.stringify('eth'));
    mounted = mount();
    const input = mounted.div.querySelector<HTMLInputElement>('#track-chain');
    expect(input).not.toBeNull();
    expect(input!.value).toBe('Ethereum');
  });

  it('lets the ?chain= parameter win over the last-used chain', () => {
    // The URL is the explicit choice; last-used is only the default.
    window.localStorage.setItem(LAST_USED_CHAIN_KEY, JSON.stringify('eth'));
    mounted = mount(['/track?chain=sol']);
    const input = mounted.div.querySelector<HTMLInputElement>('#track-chain');
    expect(input).not.toBeNull();
    expect(input!.value).toBe('Solana');
  });
});
