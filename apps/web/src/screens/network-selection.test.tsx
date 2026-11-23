// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { NetworkSelectionScreen } from './network-selection';
import { useWallet } from '../state/wallet-context';
import { SUPPORTED_CHAINS } from '../wallet/chains';

vi.mock('../state/wallet-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/wallet-context')>()),
  useWallet: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type Wallet = ReturnType<typeof useWallet>;

function setWallet(enabledChains: string[], overrides: Partial<Wallet> = {}) {
  const mock = {
    enabledChains,
    setChainEnabled: vi.fn(),
    customTokens: [],
    vaultState: 'unlocked',
    devnetEnabled: false,
    setDevnetEnabled: vi.fn(async () => {}),
    ...overrides,
  };
  vi.mocked(useWallet).mockReturnValue(
    mock as unknown as ReturnType<typeof useWallet>,
  );
  return mock;
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter>
        <NetworkSelectionScreen />
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

describe('NetworkSelectionScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all thirteen registry chains with their enable state', async () => {
    setWallet([...SUPPORTED_CHAINS].filter((chain) => chain !== 'sol'));
    const mounted = await mountScreen();
    try {
      for (const name of [
        'Bitcoin',
        'Ethereum',
        'TRON',
        'TON',
        'Solana',
        'BNB Smart Chain',
        'Polygon',
        'Arbitrum One',
        'OP Mainnet',
        'Base',
        'Avalanche C-Chain',
        'Litecoin',
        'Dogecoin',
      ]) {
        expect(mounted.div.textContent).toContain(name);
      }
      expect(mounted.div.textContent).toContain('DISABLED');
      expect(mounted.div.textContent).toContain('ACTIVE');
    } finally {
      await mounted.cleanup();
    }
  });

  it('disabling a chain calls setChainEnabled with false', async () => {
    const wallet = setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const buttons = [...mounted.div.querySelectorAll('button')].filter(
        (button) => button.textContent === 'Disable',
      );
      expect(buttons.length).toBe(22);
      await act(async () => {
        buttons[0]!.click();
      });
      expect(wallet.setChainEnabled).toHaveBeenCalledWith('btc', false);
    } finally {
      await mounted.cleanup();
    }
  });

  it('enabling a disabled chain calls setChainEnabled with true', async () => {
    const wallet = setWallet([...SUPPORTED_CHAINS].filter((chain) => chain !== 'sol'));
    const mounted = await mountScreen();
    try {
      const buttons = [...mounted.div.querySelectorAll('button')].filter(
        (button) => button.textContent === 'Enable',
      );
      expect(buttons.length).toBe(1);
      await act(async () => {
        buttons[0]!.click();
      });
      expect(wallet.setChainEnabled).toHaveBeenCalledWith('sol', true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('states mainnet by default and shows the devnet switch when devnet is off', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      // Lane C: "Mainnet only. This wallet never connects to a test
      // network." was false — the devnet switch sits on this very
      // screen. The copy must say mainnet is the default, not the
      // only mode.
      expect(mounted.div.textContent).toContain(
        'Mainnet by default. Enable or disable chains. Disabled chains are hidden from your assets. A temporary devnet test mode is available below.',
      );
      expect(mounted.div.textContent).not.toContain(
        'Mainnet only. This wallet never connects to a test network.',
      );
      expect(mounted.div.textContent).toContain('Temporary devnet test mode');
      expect(mounted.div.textContent).not.toContain('Devnet test mode is on.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('states devnet test mode and lists the test networks when devnet is on', async () => {
    setWallet([...SUPPORTED_CHAINS], { devnetEnabled: true });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('Devnet test mode is on.');
      expect(mounted.div.textContent).toContain('valueless test tokens');
      expect(mounted.div.textContent).not.toContain(
        'Mainnet only. This wallet never connects to a test network.',
      );
      expect(mounted.div.textContent).toContain('Bitcoin testnet4');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('NetworkSelectionScreen — RPC endpoints (UI/UX fixes, item 19)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  /** Rows of the RPC card: the Mainnet card rows never mention Primary. */
  function rpcRows(mounted: { div: HTMLDivElement }): HTMLLIElement[] {
    return [...mounted.div.querySelectorAll('li')].filter((li) =>
      li.textContent?.includes('Primary'),
    );
  }

  function rowFor(
    mounted: { div: HTMLDivElement },
    chainName: string,
  ): HTMLLIElement {
    const row = rpcRows(mounted).find((li) =>
      li.textContent?.includes(chainName),
    );
    if (!row) throw new Error(`no RPC row for ${chainName}`);
    return row;
  }

  async function clickButton(button: HTMLButtonElement): Promise<void> {
    await act(async () => {
      button.click();
    });
  }

  it('lists each managed chain with its primary and backup endpoints', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('RPC endpoints');
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).toContain('ethereum-rpc.publicnode.com');
      expect(eth.textContent).toContain('1rpc.io');
      expect(eth.textContent).toContain('Primary');
      expect(eth.textContent).toContain('Backup');
      const btc = rowFor(mounted, 'Bitcoin');
      expect(btc.textContent).toContain('mempool.space');
      expect(btc.textContent).toContain('blockstream.info');
      // Dogecoin keeps its built-in pair and takes no custom RPC.
      expect(mounted.div.textContent).toContain('Built-in failover');
    } finally {
      await mounted.cleanup();
    }
  });

  it('Use backup swaps the primary and backup for one chain', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const ethRow = rowFor(mounted, 'Ethereum');
      const button = [...ethRow.querySelectorAll('button')].find(
        (b) => b.textContent === 'Use backup',
      );
      expect(button).toBeDefined();
      await clickButton(button!);
      const updated = rowFor(mounted, 'Ethereum');
      // The badge span's own text is exactly "Primary" — the outer
      // endpoint container also contains it, but is not the badge.
      const primary = [...updated.querySelectorAll('span')].find(
        (s) => s.textContent === 'Primary',
      );
      expect(updated.textContent).toContain('1rpc.io');
      expect(primary?.previousSibling?.textContent).toContain(
        '1rpc.io',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('adds a custom RPC and lists it as Custom', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const select = mounted.div.querySelector('select');
      const input = mounted.div.querySelector(
        'input[placeholder^="https://"]',
      ) as HTMLInputElement | null;
      const add = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Add RPC',
      );
      expect(select).not.toBeNull();
      expect(input).not.toBeNull();
      expect(add).toBeDefined();
      await act(async () => {
        if (select) select.value = 'eth';
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          setter?.call(input, 'https://custom.invalid/eth');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await clickButton(add!);
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).toContain('custom.invalid');
      expect(eth.textContent).toContain('Custom');
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects a non-https custom RPC with an error and stores nothing', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        'input[placeholder^="https://"]',
      ) as HTMLInputElement | null;
      const add = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Add RPC',
      );
      await act(async () => {
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          setter?.call(input, 'http://plain.invalid');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await clickButton(add!);
      expect(mounted.div.textContent).toMatch(/https/i);
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).not.toContain('plain.invalid');
    } finally {
      await mounted.cleanup();
    }
  });

  it('the chain picker excludes Dogecoin', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const select = mounted.div.querySelector('select');
      const options = [...(select?.querySelectorAll('option') ?? [])].map(
        (o) => o.textContent,
      );
      expect(options).toContain('Ethereum');
      expect(options).not.toContain('Dogecoin');
      expect(options).toHaveLength(21);
    } finally {
      await mounted.cleanup();
    }
  });

  it('switch all to backup and reset all to defaults work across chains', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const switchAll = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Switch all to backup',
      );
      expect(switchAll).toBeDefined();
      await clickButton(switchAll!);
      expect(rowFor(mounted, 'Ethereum').textContent).toContain(
        '1rpc.io',
      );
      expect(rowFor(mounted, 'Bitcoin').textContent).toContain('blockstream.info');
      const resetAll = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Reset all to defaults',
      );
      expect(resetAll).toBeDefined();
      await clickButton(resetAll!);
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).toContain('ethereum-rpc.publicnode.com');
    } finally {
      await mounted.cleanup();
    }
  });
});
