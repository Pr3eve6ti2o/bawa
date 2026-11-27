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
    refreshBalances: vi.fn(async () => {}),
    refreshHistory: vi.fn(async () => {}),
    balances: {},
    history: {},
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

// Lane 6 redesign: the RPC manager shows one chain at a time, picked
// through the search picker. Open it and click the option by name.
async function selectRpcChain(
  mounted: { div: HTMLDivElement },
  name: string,
): Promise<void> {
  const input = mounted.div.querySelector<HTMLInputElement>('#rpc-chain');
  if (!input) throw new Error('RPC chain picker not found');
  await act(async () => {
    input.focus();
    input.click();
  });
  const option = [...mounted.div.querySelectorAll('[role="option"]')].find(
    (o) => o.textContent?.includes(name),
  ) as HTMLElement | undefined;
  if (!option) throw new Error(`RPC chain option not found: ${name}`);
  await act(async () => {
    option.click();
  });
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
      expect(buttons.length).toBe(87);
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
        'Mainnet by default. Enable or disable chains. Disabled chains are hidden from your assets. Devnet test mode is at the top of this screen.',
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
      expect(eth.textContent).toContain('eth.drpc.org');
      expect(eth.textContent).toContain('Primary');
      expect(eth.textContent).toContain('Backup');
      await selectRpcChain(mounted, 'Bitcoin');
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
      expect(updated.textContent).toContain('eth.drpc.org');
      expect(primary?.previousSibling?.textContent).toContain(
        'eth.drpc.org',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('adds a custom RPC and lists it as Custom', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        'input[placeholder^="https://"]',
      ) as HTMLInputElement | null;
      const add = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Add RPC',
      );
      expect(input).not.toBeNull();
      expect(add).toBeDefined();
      await act(async () => {
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          // Lane F: only origins on the wallet's allowed connection
          // list can be added — Flashbots is one of the one-tap
          // suggestions, so it is accepted.
          setter?.call(input, 'https://rpc.flashbots.net');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await clickButton(add!);
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).toContain('rpc.flashbots.net');
      expect(eth.textContent).toContain('Custom');
    } finally {
      await mounted.cleanup();
    }
  });

  it('marks a chain with a custom RPC on its Mainnet row', async () => {
    // UX-major Lane 5: a custom RPC used to be visible only inside the
    // RPC manager for the picked chain. The Mainnet list row now says
    // 'Custom RPC', so the custom entry is not mixed silently into the
    // curated list.
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      // The Mainnet list row (not the RPC manager's 'Custom RPC URL'
      // label, which always contains those words): find the row for
      // Ethereum that is not the RPC-manager row.
      const mainnetRow = () =>
        [...mounted.div.querySelectorAll('li')].find(
          (li) =>
            li.textContent?.includes('Ethereum') &&
            !li.textContent?.includes('Primary'),
        );
      expect(mainnetRow()?.textContent).not.toContain('Custom RPC');
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
          setter?.call(input, 'https://rpc.flashbots.net');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await clickButton(add!);
      expect(mainnetRow()?.textContent).toContain('Custom RPC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects a custom RPC outside the allowed connection list and stores nothing', async () => {
    // Lane F: the browser refuses fetches to origins outside the CSP
    // connect-src allowlist, so such a URL is rejected with a plain
    // message instead of being stored as a dead entry.
    const wallet = setWallet([...SUPPORTED_CHAINS]);
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
          setter?.call(input, 'https://custom.invalid/eth');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await clickButton(add!);
      expect(mounted.div.textContent).toMatch(/allowed connection list/i);
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).not.toContain('custom.invalid');
      expect(wallet.refreshBalances).not.toHaveBeenCalled();
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
      const input = mounted.div.querySelector<HTMLInputElement>('#rpc-chain');
      expect(input).not.toBeNull();
      await act(async () => {
        input!.focus();
        input!.click();
      });
      const options = [...mounted.div.querySelectorAll('[role="option"]')].map(
        (o) => o.textContent,
      );
      expect(options.join(' ')).toContain('Ethereum');
      expect(options.join(' ')).not.toContain('Dogecoin');
      expect(options).toHaveLength(86);
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
        'eth.drpc.org',
      );
      await selectRpcChain(mounted, 'Bitcoin');
      expect(rowFor(mounted, 'Bitcoin').textContent).toContain('blockstream.info');
      const resetAll = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Reset all to defaults',
      );
      expect(resetAll).toBeDefined();
      await clickButton(resetAll!);
      await selectRpcChain(mounted, 'Ethereum');
      const eth = rowFor(mounted, 'Ethereum');
      expect(eth.textContent).toContain('ethereum-rpc.publicnode.com');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('NetworkSelectionScreen — Lane F, FIX-ALL', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  /** The RPC row for a chain: the Mainnet card rows never mention Primary. */
  function rpcRow(mounted: { div: HTMLDivElement }, chainName: string): HTMLLIElement {
    const rows = [...mounted.div.querySelectorAll('li')].filter((li) =>
      li.textContent?.includes('Primary'),
    );
    const row = rows.find((li) => li.textContent?.includes(chainName));
    if (!row) throw new Error(`no RPC row for ${chainName}`);
    return row;
  }

  async function fillCustomRpc(
    mounted: { div: HTMLDivElement },
    url: string,
  ): Promise<void> {
    const input = mounted.div.querySelector(
      'input[placeholder^="https://"]',
    ) as HTMLInputElement | null;
    const add = [...mounted.div.querySelectorAll('button')].find(
      (b) => b.textContent === 'Add RPC',
    );
    expect(input).not.toBeNull();
    expect(add).toBeDefined();
    await act(async () => {
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(input, url);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await act(async () => {
      add!.click();
    });
  }

  it('Use backup refreshes balances straight away', async () => {
    const wallet = setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const ethRow = rpcRow(mounted, 'Ethereum');
      const button = [...ethRow.querySelectorAll('button')].find(
        (b) => b.textContent === 'Use backup',
      );
      expect(button).toBeDefined();
      await act(async () => {
        button!.click();
      });
      await vi.waitFor(() =>
        expect(wallet.refreshBalances).toHaveBeenCalled(),
      );
      expect(mounted.div.textContent).toMatch(
        /Switched Ethereum to its backup endpoint\. Balance refreshed\./,
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('Use this one moves a custom endpoint to primary and refreshes balances', async () => {
    const wallet = setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      await fillCustomRpc(mounted, 'https://rpc.flashbots.net');
      const eth = rpcRow(mounted, 'Ethereum');
      expect(eth.textContent).toContain('rpc.flashbots.net');
      // The Flashbots chip is the span holding its host text: the
      // inner host span's parent is the chip. (The endpoint wrapper
      // span also contains the host text, so an includes-match would
      // find the wrapper and its first "Use this one" — the wrong
      // chain's button.)
      const host = [...eth.querySelectorAll('span')].find(
        (s) => s.textContent === 'rpc.flashbots.net',
      );
      const chip = host?.parentElement ?? undefined;
      const useThisOne = [...(chip?.querySelectorAll('button') ?? [])].find(
        (b) => b.textContent === 'Use this one',
      );
      expect(useThisOne).toBeDefined();
      await act(async () => {
        useThisOne!.click();
      });
      await vi.waitFor(() =>
        expect(wallet.refreshBalances).toHaveBeenCalled(),
      );
      const updated = rpcRow(mounted, 'Ethereum');
      const primary = [...updated.querySelectorAll('span')].find(
        (s) => s.textContent === 'Primary',
      );
      expect(primary?.previousSibling?.textContent).toContain(
        'rpc.flashbots.net',
      );
      expect(mounted.div.textContent).toMatch(
        /Switched Ethereum to rpc\.flashbots\.net\. Balance refreshed\./,
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('the one-tap suggestion adds the well-known public RPC', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      const suggestion = [...mounted.div.querySelectorAll('button')].find(
        (b) => b.textContent === 'Add Flashbots',
      );
      expect(suggestion).toBeDefined();
      await act(async () => {
        suggestion!.click();
      });
      const eth = rpcRow(mounted, 'Ethereum');
      expect(eth.textContent).toContain('rpc.flashbots.net');
      expect(eth.textContent).toContain('Custom');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows which host answered the last balance, and the history source per chain', async () => {
    setWallet(
      [...SUPPORTED_CHAINS],
      {
        balances: {
          eth: { status: 'zero', value: '0', fetchedAtMs: 1795446545000, source: '1rpc.io' },
        },
        history: {
          eth: { status: 'loaded', txs: [], fetchedAtMs: 1795446545000 },
        },
      } as unknown as Partial<Wallet>,
    );
    const mounted = await mountScreen();
    try {
      const eth = rpcRow(mounted, 'Ethereum');
      expect(eth.textContent).toContain('Last balance from 1rpc.io');
      expect(eth.textContent).toContain('History: eth.blockscout.com');
      expect(eth.textContent).toContain('working');
      await selectRpcChain(mounted, 'Gnosis');
      const gnosis = rpcRow(mounted, 'Gnosis');
      expect(gnosis.textContent).toContain(
        'History: no working source — history unavailable for this chain.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('Prices card shows the fallback chain in order and the live line', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain(
        'Prices come from CoinGecko first.',
      );
      expect(mounted.div.textContent).toContain('CoinLore');
      expect(mounted.div.textContent).toContain('DexScreener');
      expect(mounted.div.textContent).toContain('TonAPI');
      expect(mounted.div.textContent).toContain('Coinbase');
      expect(mounted.div.textContent).toContain(
        'Seven chains are CoinGecko-alone — Fraxtal, Velas, Telos, Songbird, Rootstock, PulseChain and XDC — with no second source.',
      );
      expect(mounted.div.textContent).toContain(
        'Every other chain has a second source.',
      );
      expect(mounted.div.textContent).toContain('No prices fetched yet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('Check probes each endpoint and reports working with the block height', async () => {
    setWallet([...SUPPORTED_CHAINS]);
    const stub = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string;
      };
      if (body.method === 'eth_chainId') {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', result: '0x1', id: 1 }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', result: '0x1940ddc', id: 2 }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', stub);
    const mounted = await mountScreen();
    try {
      const ethRow = rpcRow(mounted, 'Ethereum');
      const check = [...ethRow.querySelectorAll('button')].find(
        (b) => b.textContent === 'Check',
      );
      expect(check).toBeDefined();
      await act(async () => {
        check!.click();
      });
      await vi.waitFor(() =>
        expect(mounted.div.textContent).toContain('Working · block'),
      );
      expect(stub).toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
      vi.unstubAllGlobals();
    }
  });
});
