// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import { getAdapter } from '../wallet/adapters';
import { deriveAddressesAt } from '../wallet/core';
import { createVault, deleteVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import { BTC_PROFILE_ID, EVM_PROFILE_ID } from './test-helpers';

// Vault-lock removal (owner order 2026-11-20): unlockVault/lockVault,
// the auto-lock timer and autoLockMinutes/setAutoLockMinutes no longer
// exist. The whole "auto-lock (Lane C, spec §9)" describe was deleted
// with the timer (5 tests: default, stored preference, persist/ignore,
// inactivity lock, pagehide lock). The passphrase tests below now pass
// the passphrase to createVault — the session passphrase is set at
// creation — and derivation runs through refreshVaultAccounts.

vi.mock('../wallet/adapters', () => ({
  getAdapter: vi.fn(() => undefined),
  registerAdapter: vi.fn(),
  registeredChains: vi.fn(() => []),
  registerAllAdapters: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// Published wallet-core TREZOR BIP-39 vector (public test data, test-only):
// passphrase "TREZOR" derives ETH 0x27Ef5cDBe01777D62438AfFeb695e33fC2335979.
const VECTOR_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const VECTOR_ETH = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const TEST_PASSWORD = 'vault-test-password-2026';
const TEST_PROFILES = [EVM_PROFILE_ID, BTC_PROFILE_ID];

let exposed: ReturnType<typeof useWallet> | undefined;

function Probe() {
  exposed = useWallet();
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  deleteVault();
  setPassphraseUsed(false);
  exposed = undefined;
});

describe('wallet context — passphrase', () => {
  it('does not derive addresses without the session passphrase when the flag is set', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    // No passphrase was given at creation, so the session passphrase is
    // unknown; the flag only records that one was used. Deriving with ''
    // would produce (and persist) the wrong addresses, so no derivation
    // happens at all.
    setPassphraseUsed(true);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      expect(exposed!.vaultState).toBe('unlocked');
      expect(exposed!.vaultAddresses.eth).toEqual([]);
    } finally {
      await mounted.cleanup();
    }
  });

  it('derives with the passphrase when it is given at creation', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    setPassphraseUsed(true);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      expect(exposed!.vaultState).toBe('unlocked');
      expect(exposed!.vaultAddresses.eth[0]).toBe(VECTOR_ETH);
    } finally {
      await mounted.cleanup();
    }
  });

  it('derives different addresses with a wrong passphrase', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'WRONG');
    setPassphraseUsed(true);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      expect(exposed!.vaultState).toBe('unlocked');
      expect(exposed!.vaultAddresses.eth[0]).not.toBe(VECTOR_ETH);
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('wallet context — vault account selection', () => {
  it('derives the selected account/index on setVaultAccount', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    const mounted = await mountProvider();
    try {
      await act(async () => {
        // The vector mnemonic only derives VECTOR_ETH with passphrase TREZOR.
        await exposed!.refreshVaultAccounts();
      });
      expect(exposed!.vaultAccount).toEqual({ account: 0, index: 0 });
      expect(exposed!.vaultAddresses.eth[0]).toBe(VECTOR_ETH);
      const tonBefore = exposed!.vaultAddresses.ton[0];
      await act(async () => {
        await exposed!.setVaultAccount(0, 1);
      });
      expect(exposed!.vaultAccount).toEqual({ account: 0, index: 1 });
      const expected = await deriveAddressesAt(
        VECTOR_MNEMONIC,
        'TREZOR',
        0,
        1,
      );
      expect(exposed!.vaultAddresses.eth[0]).toBe(expected.eth);
      expect(exposed!.vaultAddresses.btc[0]).toBe(expected.btc);
      expect(exposed!.vaultAddresses.trx[0]).toBe(expected.trx);
      // TON has one address per wallet: account and index do not change it.
      expect(exposed!.vaultAddresses.ton[0]).toBe(tonBefore);
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects out-of-range account/index without changing the selection', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      await expect(
        act(async () => {
          await exposed!.setVaultAccount(0, 0x80000000);
        }),
      ).rejects.toThrow(RangeError);
      expect(exposed!.vaultAccount).toEqual({ account: 0, index: 0 });
      expect(exposed!.vaultAddresses.eth[0]).toBe(VECTOR_ETH);
    } finally {
      await mounted.cleanup();
    }
  });
});

describe('wallet context — balance before history (Lane B)', () => {
  // Recording adapters: balance takes 50ms, so a parallel history call
  // would observably start before the balance settles. The vault-accounts
  // refresh path must start history only after balances settle, so the
  // TON balance does not race the TON history for TonCenter's ~1 req/s token.
  const calls: string[] = [];
  const recordingAdapter = (chain: string) => ({
    chain,
    networkId: `test:${chain}`,
    getBalance: async () => {
      calls.push(`balance-start:${chain}`);
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      calls.push(`balance-end:${chain}`);
      return {
        status: 'ok' as const,
        data: {
          chain,
          address: 'test-address',
          networkId: `test:${chain}`,
          valueBaseUnits: '0',
          decimals: 9,
          source: 'test',
          fetchedAt: 0,
        },
        source: 'test',
        fetchedAt: 0,
      };
    },
    getHistory: async () => {
      calls.push(`history-start:${chain}`);
      return { status: 'ok' as const, data: [], source: 'test', fetchedAt: 0 };
    },
    estimateFee: async () => ({ status: 'unavailable' as const, reason: 'test' }),
    getTxInputs: async () => ({ status: 'unavailable' as const, reason: 'test' }),
    broadcast: async () => {
      throw new Error('disabled');
    },
  });

  it('starts history only after balances settle on vault accounts refresh', async () => {
    calls.length = 0;
    vi.mocked(getAdapter).mockImplementation(
      ((chain: string) => recordingAdapter(chain)) as unknown as typeof getAdapter,
    );
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      // Balances/history load in the background after the refresh.
      await act(async () => {
        for (let i = 0; i < 100; i += 1) {
          if (
            calls.includes('balance-end:ton') &&
            calls.includes('history-start:ton')
          ) {
            break;
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
        }
      });
      expect(calls).toContain('balance-end:ton');
      expect(calls).toContain('history-start:ton');
      expect(calls.indexOf('balance-end:ton')).toBeLessThan(
        calls.indexOf('history-start:ton'),
      );
    } finally {
      await mounted.cleanup();
    }
  });
});
