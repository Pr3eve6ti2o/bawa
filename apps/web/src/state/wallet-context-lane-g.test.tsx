// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, humanReasonMessage, isTransientReason, useWallet } from './wallet-context';
import type { WalletContextValue } from './wallet-context';
import { createVault, deleteVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import { registerAdapter } from '../wallet/adapters';
import type { AdapterBalance, AdapterResult, AdapterTx, ChainAdapter } from '../wallet/adapters/types';

// Lane G, Phase 3: boot rehydration, last-good retention, bounded retries.
// The capability registry is mocked to verified so the adapter path is
// exercised. Only availableFor is overridden — the rest comes from the
// real module.
vi.mock('../wallet/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wallet/chains')>();
  return {
    ...actual,
    availableFor: () => ['btc', 'eth', 'trx', 'ton'],
  };
});

// Published wallet-core TREZOR BIP-39 vector (public test data, test-only):
// passphrase "TREZOR" derives ETH 0x27Ef5cDBe01777D62438AfFeb695e33fC2335979.
const VECTOR_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const VECTOR_ETH = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const TEST_PASSWORD = 'lane-g-test-password-123';
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
const firstRenders: Array<{ status: string; stale?: boolean }> = [];

function Probe() {
  latest = useWallet();
  if (firstRenders.length === 0) {
    firstRenders.push({ status: latest.balances.btc.status, stale: latest.balances.btc.stale });
  }
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

async function waitFor(condition: () => boolean): Promise<boolean> {
  for (let i = 0; i < 50; i += 1) {
    if (condition()) return true;
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    });
  }
  return condition();
}

type StubBalance =
  | { status: 'ok'; value: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

function stubAdapter(
  chain: ChainAdapter['chain'],
  balance: StubBalance | (() => Promise<AdapterResult<AdapterBalance>>),
  txs: AdapterResult<AdapterTx[]>,
): ChainAdapter {
  return {
    chain,
    networkId: 'test',
    getBalance: async () => {
      if (typeof balance === 'function') return balance();
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

function registerOkStubs(): void {
  registerAdapter(stubAdapter('eth', okBalance('0'), okTxs([])));
  registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
  registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
  registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
}

beforeEach(() => {
  localStorage.clear();
  deleteVault();
  setPassphraseUsed(false);
  latest = undefined;
  firstRenders.length = 0;
});

describe('wallet context — reason messages (Lane G)', () => {
  it('maps known codes to human sentences, never the raw code', () => {
    expect(humanReasonMessage('no-adapter', 'balance')).toBe('This chain is not connected yet.');
    expect(humanReasonMessage('no-adapter', 'history')).toBe(
      'Transaction history is not connected for this chain yet.',
    );
    expect(humanReasonMessage('no-address', 'balance')).toBe(
      'No address is available for this chain yet.',
    );
    expect(humanReasonMessage('HTTP 429', 'balance')).toBe(
      'The network is busy or unreachable. Please try again in a moment.',
    );
    expect(humanReasonMessage('boom', 'balance')).toBe('Please try again later.');
    expect(humanReasonMessage(undefined, 'balance')).toBe('');
    expect(humanReasonMessage('no-adapter', 'balance')).not.toContain('no-adapter');
  });

  it('classifies only transient failures as retryable', () => {
    expect(isTransientReason('HTTP 429')).toBe(true);
    expect(isTransientReason('Network error: request timed out')).toBe(true);
    expect(isTransientReason('HTTP 503')).toBe(true);
    expect(isTransientReason('boom')).toBe(false);
    expect(isTransientReason('no-network')).toBe(false);
    expect(isTransientReason('Invalid Bitcoin address')).toBe(false);
    expect(isTransientReason(undefined)).toBe(false);
  });


  it('uses price-specific reason messages', () => {
    expect(humanReasonMessage('no-adapter', 'price')).toBe(
      'Prices are not connected for this chain yet.',
    );
    expect(humanReasonMessage('rate-limited', 'price')).toBe(
      'Price feed rate-limited — try again shortly.',
    );
    expect(humanReasonMessage('network', 'price')).toBe(
      'Could not reach the price feed — check your connection and retry.',
    );
    expect(humanReasonMessage('timeout', 'price')).toBe(
      'Price feed timed out — retry.',
    );
    expect(humanReasonMessage('provider', 'price')).toBe(
      'Price feed error — retry.',
    );
  });

  it('uses tracking-specific reason messages', () => {
    expect(humanReasonMessage('no-adapter', 'track')).toBe(
      'Tracking is not connected for this chain yet.',
    );
    expect(humanReasonMessage('not-included', 'track')).toBe(
      'This transaction is not included in a block yet.',
    );
    expect(humanReasonMessage('unsupported', 'track')).toBe(
      'This is not supported for this chain yet.',
    );
  });

  it('uses general reason messages', () => {
    expect(humanReasonMessage('no-adapter', 'general')).toBe(
      'This feature is not connected yet.',
    );
    expect(humanReasonMessage('stub', 'general')).toBe(
      'This feature is not available yet.',
    );
    expect(humanReasonMessage('unavailable-chain-data', 'general')).toBe(
      'Data for this chain is unavailable right now.',
    );
  });

  it('uses the same address-invalid message for every kind', () => {
    const kinds = ['balance', 'history', 'price', 'track', 'general'] as const;

    for (const kind of kinds) {
      expect(humanReasonMessage('invalid-checksum', kind)).toBe(
        'The address for this chain looks invalid.',
      );
      expect(humanReasonMessage('invalid-length', kind)).toBe(
        'The address for this chain looks invalid.',
      );
      expect(humanReasonMessage('invalid-base58', kind)).toBe(
        'The address for this chain looks invalid.',
      );
    }
  });

  it('warns about secret-like and private-key inputs', () => {
    const kinds = ['balance', 'history', 'price', 'track', 'general'] as const;

    for (const kind of kinds) {
      expect(humanReasonMessage('secret-like', kind)).toBe(
        'That looks like a secret. Please check what you entered.',
      );
      expect(humanReasonMessage('private-key', kind)).toBe(
        'That looks like a secret. Please check what you entered.',
      );
    }
  });

  it('avoids raw reason codes and uses a fallback for unknown reasons', () => {
    expect(humanReasonMessage('no-adapter', 'price')).not.toContain('no-adapter');

    // The price-specific sentence includes "rate-limited"; check general here.
    expect(humanReasonMessage('rate-limited', 'general')).not.toContain(
      'rate-limited',
    );

    expect(humanReasonMessage('not-included', 'track')).not.toContain(
      'not-included',
    );
    expect(humanReasonMessage('some-weird-reason-xyz', 'general')).toBe(
      'Please try again later.',
    );
  });
});

describe('wallet context — boot rehydration (Lane G)', () => {
  it('starts unavailable immediately when no fetch can run', async () => {
    const mounted = await mountProvider();
    try {
      // No vault, no stored xpubs, no persisted addresses: nothing can
      // ever load, so the first paint is the settled unavailable state,
      // not a skeleton that never resolves.
      expect(firstRenders[0]?.status).toBe('unavailable');
      await waitFor(() => latest?.hydrating === false);
      expect(latest?.hydrating).toBe(false);
      expect(latest?.balances.btc.status).toBe('unavailable');
    } finally {
      await mounted.cleanup();
    }
  });

  it('starts at loading when a stored xpub may yield an address', async () => {
    localStorage.setItem(
      'bawa-watch-only-xpubs',
      JSON.stringify({ eth: { xpub: 'xpub6TestWallet1234567890abcdef', label: '' } }),
    );
    const mounted = await mountProvider();
    try {
      expect(firstRenders[0]?.status).toBe('loading');
      await waitFor(() => latest?.hydrating === false);
      expect(latest?.hydrating).toBe(false);
      // The stored key derives nothing usable, so the boot refresh
      // resolves the chain out of loading instead of sticking.
      expect(latest?.balances.eth.status).toBe('unavailable');
    } finally {
      await mounted.cleanup();
    }
  });

  it('persists public addresses only and rehydrates them on remount', async () => {
    registerOkStubs();
    const mounted = await mountProvider();
    try {
      setPassphraseUsed(true);
      await act(async () => {
        // The passphrase is given at creation (no unlock step any more).
        await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
        await latest?.refreshVaultAccounts();
      });
      await waitFor(() => latest?.vaultAddresses.eth[0] === VECTOR_ETH);
      expect(latest?.vaultAddresses.eth).toEqual([VECTOR_ETH]);
      await waitFor(() => latest?.balances.eth.status === 'zero');
      expect(latest?.balances.eth.status).toBe('zero');

      const raw = localStorage.getItem('bawa-vault-addresses:v1');
      expect(raw).not.toBeNull();
      const stored: unknown = JSON.parse(raw ?? '{}');
      expect(stored).toMatchObject({ version: 1, account: 0, index: 0 });
      // Addresses are public; the mnemonic must never be persisted.
      expect(raw).toContain(VECTOR_ETH);
      expect(raw).not.toContain('ripple');
      expect(raw).not.toContain('scissors');
    } finally {
      await mounted.cleanup();
    }

    // Remount without clearing storage: a reload rehydrates the addresses
    // and the cached last-good balance (labelled stale) with no unlock.
    firstRenders.length = 0;
    const remounted = await mountProvider();
    try {
      expect(latest?.vaultAddresses.eth).toEqual([VECTOR_ETH]);
      expect(firstRenders[0]).toEqual({ status: 'zero', stale: true });
      await waitFor(() => latest?.hydrating === false);
      // The boot refresh re-fetches for the rehydrated address.
      await waitFor(() => latest?.balances.eth.status === 'zero' && latest?.balances.eth.stale !== true);
      expect(latest?.balances.eth.status).toBe('zero');
    } finally {
      await remounted.cleanup();
    }
  });
});

describe('wallet context — last-good retention and retries (Lane G)', () => {
  it('keeps the last good balance/history labelled stale after a failure', async () => {
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
    registerAdapter(stubAdapter('eth', okBalance('5'), okTxs([tx])));
    registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.refreshVaultAccounts();
      });
      await waitFor(() => latest?.balances.eth.status === 'available');
      expect(latest?.balances.eth.value).toBe('5');
      await waitFor(() => latest?.history.eth.status === 'loaded');
      expect(latest?.history.eth.txs).toHaveLength(1);

      registerAdapter(stubAdapter('eth', { status: 'error', reason: 'boom' }, { status: 'error', reason: 'boom' }));
      await act(async () => {
        await latest?.refreshBalances();
        await latest?.refreshHistory();
      });
      expect(latest?.balances.eth.status).toBe('available');
      expect(latest?.balances.eth.value).toBe('5');
      expect(latest?.balances.eth.stale).toBe(true);
      expect(latest?.history.eth.status).toBe('loaded');
      expect(latest?.history.eth.txs).toHaveLength(1);
      expect(latest?.history.eth.stale).toBe(true);
    } finally {
      await mounted.cleanup();
    }
  });

  it('retries a 429 honouring Retry-After and lands the ok result', async () => {
    let calls = 0;
    registerAdapter(stubAdapter('eth', async () => {
      calls += 1;
      if (calls < 3) {
        return { status: 'error' as const, reason: 'HTTP 429 Retry-After: 0' };
      }
      return {
        status: 'ok' as const,
        data: {
          chain: 'eth' as const,
          address: 'test',
          networkId: 'test',
          valueBaseUnits: '7',
          decimals: 18,
          source: 'stub',
          fetchedAt: 0,
        },
        source: 'stub',
        fetchedAt: 0,
      };
    }, okTxs([])));
    registerAdapter(stubAdapter('btc', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('trx', okBalance('0'), okTxs([])));
    registerAdapter(stubAdapter('ton', okBalance('0'), okTxs([])));
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.refreshVaultAccounts();
      });
      await waitFor(() => latest?.balances.eth.status === 'available');
      expect(latest?.balances.eth.value).toBe('7');
      expect(calls).toBe(3);
    } finally {
      await mounted.cleanup();
    }
  });
});
