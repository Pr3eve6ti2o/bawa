// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import type { WalletContextValue } from './wallet-context';
import { createVault, deleteVault } from '../wallet/vault';
import { registerAdapter } from '../wallet/adapters';
import type { AdapterResult, AdapterTx, ChainAdapter } from '../wallet/adapters/types';
import { TEST_VAULT_PROFILE_IDS } from './test-helpers';

// The capability registry is mocked to verified so the adapter path is
// exercised; the no-adapter gate itself is covered by wallet-context.test.tsx.
// Only availableFor is overridden — the rest (incl. pathFor, used by
// deriveAddressesAt) comes from the real module. 'sol' is included for
// 'balance'/'history' only, so the watch-only refresh test below can
// exercise the SOL balance path; it stays out of 'derive' (vault SOL
// derivation stalls in jsdom) and every other capability.
vi.mock('../wallet/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  return {
    ...actual,
    availableFor: (capability: string) =>
      capability === 'balance' || capability === 'history'
        ? ['btc', 'eth', 'trx', 'ton', 'sol']
        : ['btc', 'eth', 'trx', 'ton'],
  };
});

// Standard public BIP-39 test vector — disposable test data, never a real secret.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PASSWORD = 'correct horse battery staple';
const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let latest: WalletContextValue | undefined;

function Probe() {
  latest = useWallet();
  return null;
}

async function mountProvider() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <WalletProvider>
        <Probe />
      </WalletProvider>,
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

type StubBalance =
  | { status: 'ok'; value: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

function stubAdapter(
  chain: ChainAdapter['chain'],
  balance: StubBalance,
  txs: AdapterResult<AdapterTx[]>,
): ChainAdapter {
  return {
    chain,
    networkId: 'test',
    getBalance: async () => {
      if (balance.status !== 'ok') return balance;
      return {
        status: 'ok',
        data: {
          chain,
          address: 'test',
          networkId: 'test',
          valueBaseUnits: balance.value,
          decimals: 18,
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      };
    },
    getHistory: async () => txs,
    estimateFee: async () => ({
      status: 'unavailable',
      reason: 'stub',
    }),
    getTxInputs: async () => ({
      status: 'unavailable',
      reason: 'stub',
    }),
    broadcast: async () => {
      throw new Error('Sending funds is switched off until it is separately approved.');
    },
  };
}

const okBalance = (value: string): StubBalance => ({ status: 'ok', value });
const okTxs = (txs: AdapterTx[]) =>
  ({ status: 'ok' as const, data: txs, source: 'stub', fetchedAt: 0 });

beforeEach(() => {
  localStorage.clear();
  deleteVault();
  latest = undefined;
  // The capability mock below lets 'sol' through for balance/history,
  // so the real Solana adapter would otherwise make live RPC calls in
  // jsdom (slow retries). A zero stub keeps every test in this file
  // off the network; the watch-only test re-registers the 2368210
  // stub after mount.
  registerAdapter(stubAdapter('sol', okBalance('0'), okTxs([])));
});

describe('wallet context — adapter-backed balances and history', () => {
  it('maps adapter ok/zero/unavailable/error to balance states', async () => {
    const mounted = await mountProvider();
    try {
      registerAdapter(
        stubAdapter('eth', okBalance('1500000000000000000'), okTxs([])),
      );
      registerAdapter(
        stubAdapter('btc', okBalance('0'), okTxs([])),
      );
      registerAdapter(
        stubAdapter('trx', { status: 'unavailable', reason: 'no-network' }, okTxs([])),
      );
      registerAdapter(
        stubAdapter('ton', { status: 'error', reason: 'boom' }, okTxs([])),
      );
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.refreshVaultAccounts();
      });
      await act(async () => {
        await latest?.refreshBalances();
      });
      expect(latest?.balances.eth.status).toBe('available');
      expect(latest?.balances.eth.value).toBe('1500000000000000000');
      expect(latest?.balances.btc.status).toBe('zero');
      expect(latest?.balances.btc.value).toBe('0');
      expect(latest?.balances.trx.status).toBe('unavailable');
      expect(latest?.balances.trx.reason).toBe('no-network');
      expect(latest?.balances.ton.status).toBe('error');
      expect(latest?.balances.ton.reason).toBe('boom');
    } finally {
      await mounted.cleanup();
    }
  });

  it('maps adapter history to loaded/empty/unavailable/error', async () => {
    const mounted = await mountProvider();
    try {
      const tx: AdapterTx = {
        hash: '0xabc',
        chain: 'eth',
        networkId: 'eip155:1',
        direction: 'in',
        amountBaseUnits: '1000',
        counterparty: null,
        timestamp: 1700000000000,
        status: 'confirmed',
        explorerUrl: null,
      };
      registerAdapter(stubAdapter('eth', okBalance('1'), okTxs([tx])));
      registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
      registerAdapter(
        stubAdapter('trx', okBalance('0'), { status: 'unavailable', reason: 'down' }),
      );
      registerAdapter(
        stubAdapter('ton', okBalance('0'), { status: 'error', reason: 'boom' }),
      );
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.refreshVaultAccounts();
      });
      // Refresh already refreshed history via refreshVaultAccounts; verify.
      expect(latest?.history.eth.status).toBe('loaded');
      expect(latest?.history.eth.txs).toHaveLength(1);
      expect(latest?.history.eth.txs[0]?.hash).toBe('0xabc');
      expect(latest?.history.btc.status).toBe('empty');
      expect(latest?.history.trx.status).toBe('unavailable');
      expect(latest?.history.trx.reason).toBe('down');
      expect(latest?.history.ton.status).toBe('error');
      await act(async () => {
        await latest?.refreshHistory();
      });
      expect(latest?.history.eth.status).toBe('loaded');
    } finally {
      await mounted.cleanup();
    }
  });

  // 'clears balances and history on vault lock' was deleted with the lock
  // (owner order 2026-11-20): lockVault no longer exists, so there is no
  // lock that clears balances or history any more.

  it('loads a watch-only balance right after addXpub, with no manual refresh', async () => {
    // Token gaps, item 6: adding a watch-only wallet must fetch its
    // balance (and history after it) at once — before this fix the row
    // kept its boot-time 'unavailable' state until a reload or a
    // manual refresh, because only the boot refresh called
    // refreshBalances. The SOL address is the public Lane 1 address
    // (live balance 0.00236821 SOL = 2368210 lamports).
    const SOL_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
    const mounted = await mountProvider();
    try {
      registerAdapter(stubAdapter('sol', okBalance('2368210'), okTxs([])));
      expect(latest?.balances.sol.status).toBe('unavailable');
      await act(async () => {
        await latest?.addXpub('sol', SOL_ADDRESS, '');
      });
      await act(async () => {
        for (let i = 0; i < 40 && latest?.balances.sol.status !== 'available'; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(latest?.balances.sol.status).toBe('available');
      expect(latest?.balances.sol.value).toBe('2368210');
    } finally {
      await mounted.cleanup();
    }
  });

  it('restores a stored watch-only Solana wallet on boot (hydration covers all 13 chains)', async () => {
    // Token gaps, item 6 + item 8: the boot hydration effect iterated
    // a stale four-chain list, so a SOL watch-only wallet persisted in
    // localStorage was dropped on every reload — the Wallets screen
    // showed "No wallets imported" and the Assets row stayed
    // "Balance unavailable" until the wallet was re-added. Seeding
    // storage before mount reproduces the reload: the provider must
    // restore xpubs.sol, derive its address, and load its balance.
    const SOL_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
    localStorage.setItem(
      'bawa-watch-only-xpubs',
      JSON.stringify({
        btc: null, eth: null, trx: null, ton: null,
        sol: { chain: 'sol', xpub: SOL_ADDRESS, label: '', derivedCount: 5 },
        bsc: null, matic: null, arb: null, op: null, base: null,
        avax: null, ltc: null, doge: null,
      }),
    );
    registerAdapter(stubAdapter('sol', okBalance('2368210'), okTxs([])));
    const mounted = await mountProvider();
    try {
      await act(async () => {
        for (let i = 0; i < 200 && latest?.balances.sol.status !== 'available'; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(latest?.xpubs.sol).not.toBeNull();
      expect(latest?.xpubs.sol?.xpub).toBe(SOL_ADDRESS);
      expect(latest?.balances.sol.status).toBe('available');
      expect(latest?.balances.sol.value).toBe('2368210');
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('wallet context — watch-only address fan-out (Lane B)', () => {
  // BIP-39 test-vector EVM address (wallet/core.test.ts). One 0x address
  // is the same address on all sixteen EVM chains, so importing it must
  // create a watch entry on every one of them.
  const EVM_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
  const ETH_XPUB =
    'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc';
  const EVM_CHAINS = [
    'eth', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'gnosis',
    'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora',
    'fantom',
  ] as const;

  it('fans one EVM address out to all sixteen EVM chains', async () => {
    const mounted = await mountProvider();
    try {
      const result = await act(async () =>
        latest?.addWatchOnlyAddress('eth', EVM_ADDRESS, ''),
      );
      expect(result?.added).toEqual([...EVM_CHAINS]);
      expect(result?.skipped).toEqual([]);
      for (const chain of EVM_CHAINS) {
        const entry = latest?.xpubs[chain];
        expect(entry).not.toBeNull();
        expect(entry?.xpub).toBe(EVM_ADDRESS);
        expect(entry?.derivedCount).toBe(1);
      }
      // The derived address is the address itself, at index 0.
      await act(async () => {
        for (
          let i = 0;
          i < 100 &&
          latest?.addresses.eth[0]?.address !== EVM_ADDRESS;
          i++
        ) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(latest?.addresses.eth[0]?.address).toBe(EVM_ADDRESS);
    } finally {
      await mounted.cleanup();
    }
  });

  it('loads the fanned-out ETH balance through the normal refresh', async () => {
    const mounted = await mountProvider();
    try {
      registerAdapter(stubAdapter('eth', okBalance('123'), okTxs([])));
      await act(async () => {
        await latest?.addWatchOnlyAddress('eth', EVM_ADDRESS, '');
      });
      await act(async () => {
        for (
          let i = 0;
          i < 100 && latest?.balances.eth.status !== 'available';
          i++
        ) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(latest?.balances.eth.status).toBe('available');
      expect(latest?.balances.eth.value).toBe('123');
    } finally {
      await mounted.cleanup();
    }
  });

  it('skips chains that already have a watch-only entry, never overwriting them', async () => {
    const mounted = await mountProvider();
    try {
      // Import the same address once: all sixteen chains are taken.
      await act(async () => {
        await latest?.addWatchOnlyAddress('eth', EVM_ADDRESS, '');
      });
      // A second import of the same address adds nothing and skips all.
      const result = await act(async () =>
        latest?.addWatchOnlyAddress('bsc', EVM_ADDRESS, ''),
      );
      expect(result?.added).toEqual([]);
      expect(result?.skipped).toEqual([...EVM_CHAINS]);
      expect(latest?.xpubs.eth?.xpub).toBe(EVM_ADDRESS);
      expect(latest?.xpubs.eth?.derivedCount).toBe(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects an extended key through the address path', async () => {
    const mounted = await mountProvider();
    try {
      await expect(
        act(async () => {
          await latest?.addWatchOnlyAddress('eth', ETH_XPUB, '');
        }),
      ).rejects.toThrow('Expected a public address');
      expect(latest?.xpubs.eth).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
