// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { ReceiveScreen } from './receive';
import { useWallet } from '../state/wallet-context';
import { availableFor, chainConfig } from '../wallet/chains';

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
  sol: { displayName: 'Solana', symbol: 'SOL' },
  bsc: { displayName: 'BNB Smart Chain', symbol: 'BNB' },
  matic: { displayName: 'Polygon', symbol: 'POL' },
  arb: { displayName: 'Arbitrum One', symbol: 'ETH' },
  op: { displayName: 'OP Mainnet', symbol: 'ETH' },
  base: { displayName: 'Base', symbol: 'ETH' },
  avax: { displayName: 'Avalanche C-Chain', symbol: 'AVAX' },
  ltc: { displayName: 'Litecoin', symbol: 'LTC' },
  doge: { displayName: 'Dogecoin', symbol: 'DOGE' },
} as const;

type ChainKey = keyof typeof CHAINS;

const VAULT_ETH = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';

function setWallet(overrides: Record<string, unknown> = {}): void {
  vi.mocked(useWallet).mockReturnValue({
    addresses: {
      btc: [],
      eth: [{ index: 0, address: '0xWatchOnlyEthAddress0000000000000000000' }],
      trx: [],
      ton: [],
    },
    vaultAddresses: {
      btc: [],
      eth: [VAULT_ETH],
      trx: [],
      ton: [],
    },
    selectedChain: 'eth',
    setSelectedChain: vi.fn(),
    ...overrides,
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
      <MemoryRouter initialEntries={['/receive']}>
        <ReceiveScreen />
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
});

describe('receive screen', () => {
  it('shows the vault-derived address and its QR, with no watch-only alert', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(VAULT_ETH);
      expect(mounted.div.querySelector('svg')).not.toBeNull();
      expect(mounted.div.textContent).not.toContain('Watch-only account');
      expect(mounted.div.textContent).toContain('Mainnet only');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the watch-only alert when falling back to an imported address', async () => {
    setWallet({
      vaultAddresses: { btc: [], eth: [], trx: [], ton: [] },
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('0xWatchOnlyEthAddress0000000000000000000');
      expect(mounted.div.textContent).toContain(
        'Watch-only account — this address can receive, but this wallet cannot sign or send from it.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('lists only chains whose receive capability is verified', async () => {
    vi.mocked(availableFor).mockReturnValue(['eth', 'ton']);
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('ETH');
      expect(mounted.div.textContent).toContain('TON');
      expect(mounted.div.textContent).not.toContain('BTC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the unavailable state when no receive chain is verified', async () => {
    vi.mocked(availableFor).mockReturnValue([]);
    setWallet();
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        "Receive isn't available for this network yet.",
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects an invalid amount and keeps the plain-address QR', async () => {
    setWallet();
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector('#receive-amount') as HTMLInputElement;
      expect(input).not.toBeNull();
      await act(async () => {
        // Simulate typing by setting the value and firing input.
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(input, 'abc');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(mounted.div.textContent).toContain('Enter a valid amount.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays the address list beside the QR card on desktop widths', async () => {
    // Desktop layout (desktop-layout-v2): the heading spans both
    // columns, the address list sits left and the amount + QR card
    // right, sticky while the list scrolls. Below lg the same blocks
    // stack in one column in the same order (space-y-6, no bare
    // grid-cols-2), so the mobile layout is untouched.
    setWallet();
    const mounted = await mountScreen();
    try {
      const root = mounted.div.firstElementChild as Element | null;
      expect(root?.className).toContain('lg:grid');
      expect(root?.className).toContain('lg:grid-cols-2');
      expect(root?.className).toContain('space-y-6');
      expect(root?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
      const heading = mounted.div.querySelector('h1');
      expect(heading?.className).toContain('lg:col-span-2');
      const qrColumn = [...mounted.div.querySelectorAll('div')].find((el) =>
        el.className.includes('lg:sticky'),
      );
      expect(qrColumn).not.toBeUndefined();
      expect(qrColumn?.querySelector('#receive-amount')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
