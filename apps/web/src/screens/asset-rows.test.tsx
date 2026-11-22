// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { AssetRows, getRowModel } from './asset-rows';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { BalanceState } from '../state/wallet-context';
import type { ChainId } from '../engine/boundary';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const CHAINS = {
  btc: { displayName: 'Bitcoin', symbol: 'BTC' },
  eth: { displayName: 'Ethereum', symbol: 'ETH' },
  trx: { displayName: 'TRON', symbol: 'TRX' },
  ton: { displayName: 'TON', symbol: 'TON' },
} as const;

type ChainKey = keyof typeof CHAINS;

function balancesFor(
  overrides: Partial<Record<ChainKey, BalanceState>>,
): Record<ChainKey, BalanceState> {
  const base: Record<ChainKey, BalanceState> = {
    btc: { status: 'unavailable', reason: 'no-address' },
    eth: { status: 'unavailable', reason: 'no-address' },
    trx: { status: 'unavailable', reason: 'no-address' },
    ton: { status: 'unavailable', reason: 'no-address' },
  };
  return { ...base, ...overrides };
}

function fakeWallet(balances: Record<ChainKey, BalanceState>) {
  return { balances } as unknown as ReturnType<typeof useWallet>;
}

function setWallet(
  balances: Record<ChainKey, BalanceState>,
  extra: Record<string, unknown> = {},
) {
  vi.mocked(useWallet).mockReturnValue({
    balances,
    refreshBalances: vi.fn().mockResolvedValue(undefined),
    vaultState: 'unlocked',
    ...extra,
  } as unknown as ReturnType<typeof useWallet>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainId) =>
      CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
  );
});

async function mountRows(variant?: 'list' | 'table') {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/assets']}>
        <AssetRows
          hideZero={false}
          {...(variant === undefined ? {} : { variant })}
        />
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

function retryButtons(div: HTMLDivElement): HTMLButtonElement[] {
  return [...div.querySelectorAll('button')].filter(
    (candidate) => candidate.textContent === 'Retry',
  ) as HTMLButtonElement[];
}

describe('getRowModel retry gate', () => {
  it('hides Retry for a no-address balance even when unlocked', () => {
    const model = getRowModel(
      'btc' as ChainId,
      fakeWallet(balancesFor({})),
      undefined,
      Date.now(),
      false,
      false,
    );

    expect(model.kind).toBe('unavailable');
    if (model.kind !== 'unavailable') return;
    expect(model.showRetry).toBe(false);
  });

  it('shows Retry for a failed fetch with an address when unlocked', () => {
    const model = getRowModel(
      'btc' as ChainId,
      fakeWallet(balancesFor({ btc: { status: 'error', reason: 'network' } })),
      undefined,
      Date.now(),
      false,
      false,
    );

    expect(model.kind).toBe('unavailable');
    if (model.kind !== 'unavailable') return;
    expect(model.statusText).toBe('Could not load balance');
    expect(model.showRetry).toBe(true);
  });

  it('hides Retry while locked even for a failed fetch with an address', () => {
    const model = getRowModel(
      'btc' as ChainId,
      fakeWallet(balancesFor({ btc: { status: 'error', reason: 'network' } })),
      undefined,
      Date.now(),
      false,
      true,
    );

    expect(model.kind).toBe('unavailable');
    if (model.kind !== 'unavailable') return;
    expect(model.showRetry).toBe(false);
  });

  it('hides the per-row Retry when the list-level retry owns it', () => {
    const model = getRowModel(
      'btc' as ChainId,
      fakeWallet(balancesFor({ btc: { status: 'error', reason: 'network' } })),
      undefined,
      Date.now(),
      false,
      false,
      false,
    );

    expect(model.kind).toBe('unavailable');
    if (model.kind !== 'unavailable') return;
    expect(model.showRetry).toBe(false);
  });

  it('names the no-address state Balance unavailable', () => {
    const model = getRowModel(
      'btc' as ChainId,
      fakeWallet(balancesFor({})),
      undefined,
      Date.now(),
      false,
      false,
    );

    expect(model.kind).toBe('unavailable');
    if (model.kind !== 'unavailable') return;
    expect(model.statusText).toBe('Balance unavailable');
  });
});

describe('AssetRows empty state', () => {
  it('no-vault with zero addresses shows one empty-state block, no dead rows, no Retry', async () => {
    setWallet(balancesFor({}), { vaultState: 'no-vault' });
    const mounted = await mountRows();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('Balance unavailable');
      expect(retryButtons(mounted.div)).toHaveLength(0);
      // Reuses the welcome screen's copy and routes, verbatim.
      expect(text).toContain('Create a wallet in the browser');
      const create = mounted.div.querySelector('a[href="/create-wallet"]');
      expect(create).not.toBeNull();
      expect(create?.textContent).toContain('Create a wallet');
      const importWallet = mounted.div.querySelector(
        'a[href="/import-wallet"]',
      );
      expect(importWallet).not.toBeNull();
      expect(importWallet?.textContent).toContain('Import a wallet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('no-vault with zero addresses shows the same empty state in the table variant', async () => {
    setWallet(balancesFor({}), { vaultState: 'no-vault' });
    const mounted = await mountRows('table');
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('Balance unavailable');
      expect(retryButtons(mounted.div)).toHaveLength(0);
      expect(mounted.div.querySelector('a[href="/create-wallet"]')).not.toBeNull();
      expect(mounted.div.querySelector('a[href="/import-wallet"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('AssetRows list-level retry', () => {
  it('unlocked with two failed fetches shows exactly one Retry in the table variant', async () => {
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    setWallet(
      balancesFor({
        btc: { status: 'error', reason: 'network' },
        eth: { status: 'error', reason: 'network' },
      }),
      { refreshBalances: mockRefreshBalances },
    );
    const mounted = await mountRows('table');
    try {
      const buttons = retryButtons(mounted.div);
      expect(buttons).toHaveLength(1);
      await act(async () => {
        buttons[0]?.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('unlocked with two failed fetches shows no per-row Retry in the list variant', async () => {
    // The dashboard hero owns the list-level retry ("Refresh
    // balances"), so the list variant must not add a second one — the
    // per-row buttons are suppressed and no list-level button renders.
    setWallet(
      balancesFor({
        btc: { status: 'error', reason: 'network' },
        eth: { status: 'error', reason: 'network' },
      }),
    );
    const mounted = await mountRows();
    try {
      expect(mounted.div.textContent).toContain('Could not load balance');
      expect(retryButtons(mounted.div)).toHaveLength(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('unlocked with one failed fetch keeps its single per-row Retry', async () => {
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    setWallet(
      balancesFor({
        btc: { status: 'error', reason: 'rpc-error' },
        eth: { status: 'zero', value: '0' },
        trx: { status: 'zero', value: '0' },
        ton: { status: 'zero', value: '0' },
      }),
      { refreshBalances: mockRefreshBalances },
    );
    const mounted = await mountRows();
    try {
      const buttons = retryButtons(mounted.div);
      expect(buttons).toHaveLength(1);
      await act(async () => {
        buttons[0]?.click();
      });
      expect(mockRefreshBalances).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('locked with failed rows offers Unlock, no Retry', async () => {
    const mockRefreshBalances = vi.fn().mockResolvedValue(undefined);
    setWallet(
      balancesFor({
        btc: { status: 'error', reason: 'network' },
        eth: { status: 'error', reason: 'network' },
      }),
      { vaultState: 'locked', refreshBalances: mockRefreshBalances },
    );
    const mounted = await mountRows();
    try {
      expect(retryButtons(mounted.div)).toHaveLength(0);
      expect(mockRefreshBalances).not.toHaveBeenCalled();
      const unlock = mounted.div.querySelector('a[href="/lock"]');
      expect(unlock).not.toBeNull();
      expect(unlock?.textContent).toContain('Unlock');
    } finally {
      await mounted.cleanup();
    }
  });
});
