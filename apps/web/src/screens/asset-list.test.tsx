// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { AssetListScreen } from './asset-list';
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

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/assets']}>
        <AssetListScreen />
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
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainKey) => CHAINS[chain] as unknown as ReturnType<typeof chainConfig>,
  );
  vi.mocked(useWallet).mockReturnValue({
    balances: balancesFor({}),
    refreshBalances: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useWallet>);
});

describe('asset list screen', () => {
  it('shows unavailable, never a fabricated balance', async () => {
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Balance unavailable');
      // No fiat amount anywhere: no fabricated portfolio total.
      expect(mounted.div.textContent).not.toContain('$');
      expect(mounted.div.textContent).not.toContain('Demo figures');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a formatted native balance when available', async () => {
    vi.mocked(useWallet).mockReturnValue({
      balances: balancesFor({
        btc: { status: 'available', value: '250000000' },
      }),
      refreshBalances: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useWallet>);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('2.5 BTC');
    } finally {
      await mounted.cleanup();
    }
  });
});
