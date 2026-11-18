// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from '../state/wallet-context';
import type { WalletContextValue } from '../state/wallet-context';
import { createVault, deleteVault, lock } from './vault';
import { registerAdapter } from './adapters';
import type { AdapterResult, AdapterTx, ChainAdapter } from './adapters/types';

// The capability registry is mocked to verified so the adapter path is
// exercised; the no-adapter gate itself is covered by wallet-context.test.tsx.
// Only availableFor is overridden — the rest (incl. pathFor, used by
// deriveAddressesAt) comes from the real module.
vi.mock('./chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chains')>();
  return {
    ...actual,
    availableFor: () => ['btc', 'eth', 'trx', 'ton'],
  };
});

// Standard public BIP-39 test vector — disposable test data, never a real secret.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_PROFILES = [
  'bawa-btc-bip84-v1',
  'bawa-evm-bip44-v1',
  'bawa-trx-bip44-v1',
  'bawa-ton-v4r2-v1',
];

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
      throw new Error('Broadcast is disabled until separately authorised.');
    },
  };
}

const okBalance = (value: string): StubBalance => ({ status: 'ok', value });
const okTxs = (txs: AdapterTx[]) =>
  ({ status: 'ok' as const, data: txs, source: 'stub', fetchedAt: 0 });

beforeEach(() => {
  localStorage.clear();
  lock();
  deleteVault();
  latest = undefined;
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
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.unlockVault(TEST_PASSWORD);
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
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      // Unlock already refreshed history via refreshVaultAccounts; verify.
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

  it('clears balances and history on vault lock', async () => {
    const mounted = await mountProvider();
    try {
      registerAdapter(stubAdapter('eth', okBalance('5'), okTxs([])));
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.unlockVault(TEST_PASSWORD);
      });
      expect(latest?.balances.eth.status).toBe('available');
      await act(async () => {
        latest?.lockVault();
      });
      expect(latest?.balances.eth.status).toBe('unavailable');
      expect(latest?.history.eth.status).toBe('unavailable');
      expect(latest?.history.eth.txs).toEqual([]);
    } finally {
      await mounted.cleanup();
    }
  });
});
