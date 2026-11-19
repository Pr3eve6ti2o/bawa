```tsx
// @vitest-environment jsdom

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackTransactionScreen } from './track-transaction';
import { getRecentActivity, lookupTransaction } from '../wallet/tracker';

vi.mock('../wallet/tracker', () => ({
  lookupTransaction: vi.fn(),
  getRecentActivity: vi.fn(),
}));

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

function mount() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(div);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/track']}>
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

describe('TrackTransactionScreen', () => {
  it('renders the heading and all four chain names', () => {
    mounted = mount();
    const { div } = mounted;
    const heading = Array.from(div.querySelectorAll('h1, h2, h3')).find(
      h => h.textContent?.includes('Track a transaction'),
    );

    expect(heading).toBeDefined();
    for (const chain of ['Bitcoin', 'Ethereum', 'TRON', 'TON']) {
      expect(findButton(div, chain).textContent).toContain(chain);
    }
  });

  it('shows the confirmed BTC transaction and its explorer link', async () => {
    vi.mocked(lookupTransaction).mockResolvedValue({
      status: 'ok',
      data: btcTx,
    });
    mounted = mount();
    const { div } = mounted;

    setInputValue(div.querySelector('input'), btcHash);
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

    setInputValue(div.querySelector('input'), '0'.repeat(64));
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

    setInputValue(div.querySelector('input'), '0'.repeat(64));
    await clickButton(div, 'Look up');

    expect(div.textContent).toContain('Could not look up this transaction');
    expect(div.textContent).toContain('Network error: boom');
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

    await clickButton(div, 'TON');
    const accountInput = findInputByLabel(div, 'Account address');
    expect(accountInput).toBeInstanceOf(window.HTMLInputElement);
    expect(accountInput.value).toBe('');

    setInputValue(div.querySelector('input'), btcHash);
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

    setInputValue(div.querySelectorAll('input')[1], btcAddress);
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

    setInputValue(div.querySelectorAll('input')[1], btcAddress);
    await clickButton(div, 'Show recent activity');

    expect(getRecentActivity).toHaveBeenCalledTimes(1);
    expect(div.textContent).toMatch(/could not be loaded/i);
    expect(div.textContent).toContain('Indexer unavailable');
  });
});
```