// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import { getAdapter } from '../wallet/adapters';
import { deriveAddressesAt } from '../wallet/core';
import { createVault, deleteVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import { BTC_PROFILE_ID, EVM_PROFILE_ID } from './test-helpers';

// Auto-lock tests are restored for the optional auto-lock order.
// The redesigned timer has no persisted deadline: the full duration is always
// counted from the last unlock or activity.
// The passphrase tests below pass the passphrase to createVault — the session
// passphrase is set at creation — and derivation runs through refreshVaultAccounts.

vi.mock('../wallet/adapters', () => ({
  getAdapter: vi.fn(() => undefined),
  getDevnetAdapter: vi.fn(() => undefined),
  getAdapterForMode: vi.fn(() => undefined),
  registerAdapter: vi.fn(),
  registerDevnetAdapter: vi.fn(),
  registeredChains: vi.fn(() => []),
  registeredDevnetChains: vi.fn(() => []),
  registerAllAdapters: vi.fn(),
  registerDevnetAdapters: vi.fn(),
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

describe('wallet context — optional auto-lock', () => {
  let cleanup: Awaited<ReturnType<typeof mountProvider>>['cleanup'] | undefined;

  beforeEach(async () => {
    vi.useFakeTimers();

    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);

    const mounted = await mountProvider();
    cleanup = mounted.cleanup;
    await act(async () => {
      await exposed!.refreshVaultAccounts();
    });
  });

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
  });

  it('defaults to off and preserves the unlocked vault for 10 minutes', async () => {
    expect(exposed!.autoLockEnabled).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    expect(exposed!.vaultState).toBe('unlocked');
    expect(exposed!.vaultAddresses.eth.length).toBeGreaterThan(0);
    expect(localStorage.getItem('bawa-vault-key')).not.toBeNull();
  });

  it('deletes the stored key when enabled without locking the vault in memory', async () => {
    expect(localStorage.getItem('bawa-vault-key')).not.toBeNull();

    await act(async () => {
      await exposed!.setAutoLockEnabled(true);
    });

    expect(exposed!.autoLockEnabled).toBe(true);
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
    expect(exposed!.vaultState).toBe('unlocked');
    expect(exposed!.vaultAddresses.eth.length).toBeGreaterThan(0);
  });

  it('locks at one minute and clears vault addresses and balance availability', async () => {
    await act(async () => {
      exposed!.setAutoLockMinutes(1);
      await exposed!.setAutoLockEnabled(true);
    });

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });

    expect(exposed!.vaultState).toBe('unlocked');

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(exposed!.vaultState).toBe('locked');
    expect(Object.values(exposed!.vaultAddresses).every((addresses) => addresses.length === 0)).toBe(true);
    expect(exposed!.balances.eth.status).toBe('unavailable');
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
  });

  it('resets the timer on pointerdown activity', async () => {
    await act(async () => {
      exposed!.setAutoLockMinutes(1);
      await exposed!.setAutoLockEnabled(true);
    });

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });

    expect(exposed!.vaultState).toBe('unlocked');

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });

    expect(exposed!.vaultState).toBe('unlocked');

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(exposed!.vaultState).toBe('locked');
  });

  it('stores the key and cancels the timer when disabled while unlocked', async () => {
    await act(async () => {
      exposed!.setAutoLockMinutes(1);
      await exposed!.setAutoLockEnabled(true);
    });

    expect(localStorage.getItem('bawa-vault-key')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });

    expect(exposed!.vaultState).toBe('unlocked');

    await act(async () => {
      await exposed!.setAutoLockEnabled(false);
    });

    expect(exposed!.autoLockEnabled).toBe(false);
    expect(localStorage.getItem('bawa-vault-key')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    expect(exposed!.vaultState).toBe('unlocked');
    expect(exposed!.vaultAddresses.eth.length).toBeGreaterThan(0);
    expect(localStorage.getItem('bawa-vault-key')).not.toBeNull();
  });

  it('stores no key when disabled while locked, then stores it upon unlocking', async () => {
    await act(async () => {
      exposed!.setAutoLockMinutes(1);
      await exposed!.setAutoLockEnabled(true);
    });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(exposed!.vaultState).toBe('locked');
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();

    await act(async () => {
      await exposed!.setAutoLockEnabled(false);
    });

    expect(exposed!.autoLockEnabled).toBe(false);
    expect(exposed!.vaultState).toBe('locked');
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();

    await act(async () => {
      await exposed!.unlockVault(TEST_PASSWORD);
    });

    expect(exposed!.vaultState).toBe('unlocked');
    expect(exposed!.vaultAddresses.eth.length).toBeGreaterThan(0);
    expect(localStorage.getItem('bawa-vault-key')).not.toBeNull();
  });

  it('locks on pagehide when Immediately (0 minutes) is enabled', async () => {
    await act(async () => {
      exposed!.setAutoLockMinutes(0);
      await exposed!.setAutoLockEnabled(true);
    });

    expect(exposed!.autoLockMinutes).toBe(0);
    expect(exposed!.vaultState).toBe('unlocked');

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(exposed!.vaultState).toBe('locked');
    expect(Object.values(exposed!.vaultAddresses).every((addresses) => addresses.length === 0)).toBe(true);
    expect(exposed!.balances.eth.status).toBe('unavailable');
    expect(localStorage.getItem('bawa-vault-key')).toBeNull();
  });

  it('reads the stored minutes preference after remounting', async () => {
    await act(async () => {
      exposed!.setAutoLockMinutes(15);
    });

    expect(exposed!.autoLockMinutes).toBe(15);

    await cleanup!();
    cleanup = undefined;

    const remounted = await mountProvider();
    cleanup = remounted.cleanup;
    await act(async () => {
      await exposed!.refreshVaultAccounts();
    });

    expect(exposed!.autoLockMinutes).toBe(15);
  });
});
describe('wallet context — auto-lock real-time timer', () => {
  it(
    'locks after about one real minute of inactivity and leaves no stored key',
    async () => {
      vi.useRealTimers();

      await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
      const mounted = await mountProvider();

      try {
        await act(async () => {
          await exposed!.refreshVaultAccounts();
        });
        expect(exposed!.vaultState).toBe('unlocked');

        const startedAt = Date.now();
        await act(async () => {
          await exposed!.setAutoLockMinutes(1);
          await exposed!.setAutoLockEnabled(true);
        });

        const deadline = Date.now() + 70_000;
        while (exposed!.vaultState !== 'locked' && Date.now() < deadline) {
          await act(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
          });
        }

        expect(exposed!.vaultState).toBe('locked');
        // Allow one second of timing tolerance, but reject premature locking.
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(59_000);
        expect(localStorage.getItem('bawa-vault-key')).toBeNull();
      } finally {
        await mounted.cleanup();
      }
    },
    120_000,
  );
});

describe('wallet context — temporary devnet mode', () => {
  it('derives devnet addresses under a separate key and restores mainnet on toggle off', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      expect(exposed!.devnetEnabled).toBe(false);
      expect(exposed!.vaultAddresses.btc[0]).toMatch(/^bc1q/);
      const mainnetStored = localStorage.getItem('bawa-vault-addresses:v1');
      expect(mainnetStored).toContain('bc1q');
      expect(localStorage.getItem('bawa-vault-addresses-devnet:v1')).toBeNull();

      await act(async () => {
        await exposed!.setDevnetEnabled(true);
      });
      expect(exposed!.devnetEnabled).toBe(true);
      expect(localStorage.getItem('bawa-devnet-enabled')).toBe('1');
      expect(exposed!.vaultAddresses.btc[0]).toMatch(/^tb1q/);
      expect(exposed!.vaultAddresses.ton[0]).toMatch(/^0Q/);
      expect(exposed!.vaultAddresses.eth[0]).toBe(VECTOR_ETH);
      const devnetStored = localStorage.getItem(
        'bawa-vault-addresses-devnet:v1',
      );
      expect(devnetStored).toContain('tb1q');
      // The mainnet record is untouched by the devnet derivation.
      expect(localStorage.getItem('bawa-vault-addresses:v1')).toBe(
        mainnetStored,
      );

      await act(async () => {
        await exposed!.setDevnetEnabled(false);
      });
      expect(exposed!.devnetEnabled).toBe(false);
      expect(localStorage.getItem('bawa-devnet-enabled')).toBe('0');
      expect(exposed!.vaultAddresses.btc[0]).toMatch(/^bc1q/);
      expect(exposed!.vaultAddresses.ton[0]).toMatch(/^UQ/);
    } finally {
      await mounted.cleanup();
    }
  });

  it('boots into devnet when the flag is set and rehydrates devnet addresses', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    const first = await mountProvider();
    try {
      await act(async () => {
        await exposed!.refreshVaultAccounts();
      });
      await act(async () => {
        await exposed!.setDevnetEnabled(true);
      });
      expect(exposed!.vaultAddresses.btc[0]).toMatch(/^tb1q/);
    } finally {
      await first.cleanup();
    }

    // Remount with the flag still set: the devnet addresses rehydrate
    // from the devnet record without a fresh derivation.
    const second = await mountProvider();
    try {
      expect(exposed!.devnetEnabled).toBe(true);
      expect(exposed!.vaultAddresses.btc[0]).toMatch(/^tb1q/);
      expect(exposed!.vaultAddresses.ton[0]).toMatch(/^0Q/);
    } finally {
      await second.cleanup();
    }
  });
});
