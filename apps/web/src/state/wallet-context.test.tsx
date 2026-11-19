// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import { deriveAddressesAt } from '../wallet/core';
import { createVault, lock } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';

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
const TEST_PROFILES = ['bawa-evm-bip44-v1', 'bawa-btc-bip84-v1'];

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
  lock();
  setPassphraseUsed(false);
  exposed = undefined;
});

describe('wallet context — passphrase unlock', () => {
  it('refuses to unlock without the passphrase when the flag is set', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    // createVault leaves the vault unlocked; this test's premise is a
    // locked vault whose unlock is refused.
    lock();
    setPassphraseUsed(true);
    const mounted = await mountProvider();
    try {
      await expect(
        act(async () => {
          await exposed!.unlockVault(TEST_PASSWORD);
        }),
      ).rejects.toThrow(
        'This wallet uses a passphrase. Enter it to unlock.',
      );
      expect(exposed!.vaultState).toBe('locked');
    } finally {
      await mounted.cleanup();
    }
  });

  it('derives with the passphrase when it is given', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    setPassphraseUsed(true);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.unlockVault(TEST_PASSWORD, 'TREZOR');
      });
      expect(exposed!.vaultState).toBe('unlocked');
      expect(exposed!.vaultAddresses.eth[0]).toBe(VECTOR_ETH);
    } finally {
      await mounted.cleanup();
    }
  });

  it('derives different addresses with a wrong passphrase', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    setPassphraseUsed(true);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.unlockVault(TEST_PASSWORD, 'WRONG');
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
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        // The vector mnemonic only derives VECTOR_ETH with passphrase TREZOR.
        await exposed!.unlockVault(TEST_PASSWORD, 'TREZOR');
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
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await exposed!.unlockVault(TEST_PASSWORD, 'TREZOR');
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
