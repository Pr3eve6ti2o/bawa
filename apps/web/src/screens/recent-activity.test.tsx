// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { RecentActivity } from './recent-activity';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';
import type { HistoryState } from '../state/wallet-context';
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

const mockRefreshHistory = vi.fn();

function setWallet(
  history: Record<ChainKey, HistoryState>,
  vaultState: 'locked' | 'unlocked' | 'no-vault' = 'unlocked',
): void {
  vi.mocked(useWallet).mockReturnValue({
    history,
    refreshHistory: mockRefreshHistory,
    vaultState,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountComponent() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter>
        <RecentActivity />
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
  mockRefreshHistory.mockResolvedValue(undefined);
  vi.mocked(availableFor).mockReturnValue(['btc', 'eth', 'trx', 'ton']);
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainId) =>
      CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
  );
});

const emptyHistory: HistoryState = { status: 'empty', txs: [] };

function historyFor(
  overrides: Partial<Record<ChainKey, HistoryState>>,
): Record<ChainKey, HistoryState> {
  return { btc: emptyHistory, eth: emptyHistory, trx: emptyHistory, ton: emptyHistory, ...overrides };
}

function retryButtons(div: HTMLDivElement): HTMLButtonElement[] {
  return [...div.querySelectorAll('button')].filter(
    (candidate) => candidate.textContent === 'Retry',
  ) as HTMLButtonElement[];
}

describe('recent activity', () => {
  it('shows no Retry when every unavailable chain has no address', async () => {
    setWallet(
      historyFor({
        btc: { status: 'unavailable', reason: 'no-address', txs: [] },
        eth: { status: 'unavailable', reason: 'no-address', txs: [] },
        trx: { status: 'unavailable', reason: 'no-address', txs: [] },
        ton: { status: 'unavailable', reason: 'no-address', txs: [] },
      }),
    );
    const mounted = await mountComponent();
    try {
      expect(mounted.div.textContent).toContain('Bitcoin history unavailable');
      expect(mounted.div.textContent).toContain('TON history unavailable');
      expect(retryButtons(mounted.div)).toHaveLength(0);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows one Retry per retryable chain and none for no-address chains', async () => {
    setWallet(
      historyFor({
        btc: { status: 'error', reason: 'down', txs: [] },
        eth: { status: 'unavailable', reason: 'no-address', txs: [] },
      }),
    );
    const mounted = await mountComponent();
    try {
      expect(mounted.div.textContent).toContain('Bitcoin history unavailable');
      expect(mounted.div.textContent).toContain('Ethereum history unavailable');
      expect(retryButtons(mounted.div)).toHaveLength(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('while locked, unavailable history offers Unlock instead of Retry', async () => {
    setWallet(
      historyFor({
        btc: { status: 'unavailable', reason: 'no-address', txs: [] },
        eth: { status: 'unavailable', reason: 'no-address', txs: [] },
      }),
      'locked',
    );
    const mounted = await mountComponent();
    try {
      expect(retryButtons(mounted.div)).toHaveLength(0);
      expect(mounted.div.textContent).toContain('Locked — unlock to see activity.');
      expect(mounted.div.querySelector('a[href="/lock"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
