// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import type { WalletContextValue } from './wallet-context';
import { deriveAddresses } from '../wallet/core';
import {
  createVault,
  deleteVault,
  lock,
} from '../wallet/vault';
import { ERROR_MESSAGES, WalletErrorCodes } from '../wallet/errors';
import { SUPPORTED_CHAINS } from '../wallet/chains';

// No adapter is registered in this file: the adapters module is mocked so
// lazy registration (ensureAdapters) cannot bring the real adapters in.
// getAdapter() returning undefined is the "no adapter" state under test.
vi.mock('../wallet/adapters', () => ({
  getAdapter: vi.fn(() => undefined),
  registerAdapter: vi.fn(),
  registeredChains: vi.fn(() => []),
  registerAllAdapters: vi.fn(),
}));

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

beforeEach(() => {
  localStorage.clear();
  lock();
  deleteVault();
  latest = undefined;
});

describe('wallet context — vault-backed accounts', () => {
  it('derives vault addresses on unlock and clears them on lock', async () => {
    const mounted = await mountProvider();
    try {
      expect(latest?.vaultState).toBe('no-vault');
      expect(latest?.vaultProfileIds).toBeNull();

      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        // createVault leaves the vault unlocked; these tests' premise is
        // a locked vault.
        lock();
        await latest?.refreshVaultAccounts();
      });
      expect(latest?.vaultState).toBe('locked');
      expect(latest?.vaultProfileIds).toEqual(TEST_PROFILES);
      expect(latest?.vaultAddresses.eth).toEqual([]);

      const expected = await deriveAddresses(TEST_MNEMONIC);
      await act(async () => {
        await latest?.unlockVault(TEST_PASSWORD);
      });
      expect(latest?.vaultState).toBe('unlocked');
      expect(latest?.vaultAddresses.btc).toEqual([expected.btc]);
      expect(latest?.vaultAddresses.eth).toEqual([expected.eth]);
      expect(latest?.vaultAddresses.trx).toEqual([expected.trx]);
      expect(latest?.vaultAddresses.ton).toEqual([expected.ton]);

      await act(async () => {
        latest?.lockVault();
      });
      expect(latest?.vaultState).toBe('locked');
      expect(latest?.vaultAddresses.eth).toEqual([]);
    } finally {
      await mounted.cleanup();
    }
  });

  it('rejects a wrong vault password', async () => {
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        // createVault leaves the vault unlocked; these tests' premise is
        // a locked vault.
        lock();
        await latest?.refreshVaultAccounts();
      });
      expect(latest?.vaultState).toBe('locked');
      await expect(
        act(async () => {
          await latest?.unlockVault('wrong password');
        }),
      ).rejects.toThrow(ERROR_MESSAGES[WalletErrorCodes.VAULT_WRONG_PASSWORD]);
      expect(latest?.vaultState).toBe('locked');
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports balances unavailable with no adapter', async () => {
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.unlockVault(TEST_PASSWORD);
        await latest?.refreshBalances();
      });
      for (const chain of SUPPORTED_CHAINS) {
        expect(latest?.balances[chain].status).toBe('unavailable');
        expect(latest?.balances[chain].reason).toBe('no-adapter');
        expect(latest?.balances[chain].value).toBeUndefined();
      }
    } finally {
      await mounted.cleanup();
    }
  });
});
