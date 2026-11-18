// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { DashboardScreen } from './dashboard';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { BalanceState } from '../state/wallet-context';

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
    btc: { status: 'unavailable', reason: 'no-adapter' },
    eth: { status: 'unavailable', reason: 'no-adapter' },
    trx: { status: 'unavailable', reason: 'no-adapter' },
    ton: { status: 'unavailable', reason: 'no-adapter' },
  };
  return { ...base, ...overrides };
}

const mockRefreshBalances = vi.fn();

function setWallet(balances: Record<ChainKey, BalanceState>, extra: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    balances,
    refreshBalances: mockRefreshBalances,
    locked: false,
    unlock: vi.fn(),
    vaultState: 'unlocked',
    ...extra,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/']}>
        <DashboardScreen />
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRefreshBalances.mockResolvedValue(undefined);
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
  );
});

describe('dashboard screen', () => {
  it('shows skeletons while balances load', async () => {
    setWallet(balancesFor({ btc: { status: 'loading' } }));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('[role="status"]')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Loading Bitcoin balance');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows an exact zero and hides it behind the toggle', async () => {
    setWallet(
      balancesFor({
        btc: { status: 'zero', value: '0' },
        eth: { status: 'available', value: '1500000000000000000' },
      }),
    );
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('0 BTC');
      expect(mounted.div.textContent).toContain('1.5 ETH');
      const toggle = mounted.div.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      await act(async () => {
        toggle.click();
      });
      expect(mounted.div.textContent).not.toContain('0 BTC');
      expect(mounted.div.textContent).toContain('1.5 ETH');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows unavailable, never zero, on a failed fetch', async () => {
    setWallet(balancesFor({ btc: { status: 'error', reason: 'boom' } }));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Could not load balance');
      expect(mounted.div.textContent).not.toContain('0 BTC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the empty state when no balance adapter is verified', async () => {
    vi.mocked(availableFor).mockReturnValue([]);
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No balance adapters verified yet.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the onboarding card when there is no vault', async () => {
    setWallet(balancesFor({}), { vaultState: 'no-vault' });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No wallet yet');
      expect(mounted.div.textContent).toContain('Create wallet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('never renders a fabricated portfolio total', async () => {
    setWallet(balancesFor({}));
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).not.toContain('$12,480');
      expect(mounted.div.textContent).toContain('No price feed connected');
    } finally {
      await mounted.cleanup();
    }
  });
});
