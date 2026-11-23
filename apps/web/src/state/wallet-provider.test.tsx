// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { WalletProvider, useWallet } from './wallet-context';
import type { WalletContextValue } from './wallet-context';
import { deriveAddresses, deriveDevnetAddressesAt } from '../wallet/core';
import {
  createVault,
  deleteVault,
} from '../wallet/vault';
import { SUPPORTED_CHAINS } from '../wallet/chains';
import { writeDevnetEnabled } from '../wallet/devnet';
import { TEST_VAULT_PROFILE_IDS } from './test-helpers';

// Auto-lock is optional and OFF by default (owner order 2026-11-20):
// unlockVault/lockVault exist again (merge 2 restored them), and unlock()
// rejects a wrong password — that rejection is covered by
// wallet/vault.test.ts. Creation leaves the vault open, so the tests below
// drive derivation through refreshVaultAccounts instead of an unlock step.

// No adapter is registered in this file: the adapters module is mocked so
// lazy registration (ensureAdapters) cannot bring the real adapters in.
// getAdapter() returning undefined is the "no adapter" state under test.
vi.mock('../wallet/adapters', () => ({
  getAdapter: vi.fn(() => undefined),
  registerAdapter: vi.fn(),
  registeredChains: vi.fn(() => []),
  registerAllAdapters: vi.fn(),
  // Lane D (FIX-ALL): the devnet loader calls this; without it the
  // devnet boot path rejects unhandled in this file's tests.
  registerDevnetAdapters: vi.fn(),
  // Lane D (FIX-ALL): the devnet balance refresh resolves adapters
  // through this, mirroring getAdapter on the mainnet path.
  getDevnetAdapter: vi.fn(() => undefined),
}));

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

beforeEach(() => {
  localStorage.clear();
  deleteVault();
  latest = undefined;
});

describe('wallet context — vault-backed accounts', () => {
  it('derives vault addresses after creation and reports no-vault after delete', async () => {
    const mounted = await mountProvider();
    try {
      expect(latest?.vaultState).toBe('no-vault');
      expect(latest?.vaultProfileIds).toBeNull();

      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.refreshVaultAccounts();
      });
      expect(latest?.vaultState).toBe('unlocked');
      expect(latest?.vaultProfileIds).toEqual(TEST_VAULT_PROFILE_IDS);

      const expected = await deriveAddresses(TEST_MNEMONIC);
      expect(latest?.vaultAddresses.btc).toEqual([expected.btc]);
      expect(latest?.vaultAddresses.eth).toEqual([expected.eth]);
      expect(latest?.vaultAddresses.trx).toEqual([expected.trx]);
      expect(latest?.vaultAddresses.ton).toEqual([expected.ton]);

      await act(async () => {
        deleteVault();
        await latest?.refreshVaultAccounts();
      });
      expect(latest?.vaultState).toBe('no-vault');
      expect(latest?.vaultProfileIds).toBeNull();
      // The persisted public addresses are NOT deleted with the vault
      // (pre-existing behaviour, unchanged by the lock removal); only the
      // vault state and profiles are asserted here.
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports balances unavailable with no adapter', async () => {
    const mounted = await mountProvider();
    try {
      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
        await latest?.refreshVaultAccounts();
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

  // Lane D (FIX-ALL): a reload must re-derive the vault addresses when
  // the persisted record for the current mode is missing. The devnet
  // pill flips before its re-derivation finishes, so a reload
  // mid-derivation used to strand the wallet with no addresses and
  // Receive settled on 'No receiving address available for this chain'
  // (E2E-02). No explicit refresh call is made after the remount: the
  // boot effect itself must do the derivation.
  it('re-derives devnet vault addresses on boot when the record is missing', async () => {
    const mounted = await mountProvider();
    await act(async () => {
      await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
      await latest?.refreshVaultAccounts();
    });
    const expected = await deriveAddresses(TEST_MNEMONIC);
    expect(latest?.vaultAddresses.btc).toEqual([expected.btc]);
    await mounted.cleanup();
    // Simulate the stranded reload: the toggle's derivation was killed
    // before it persisted the devnet record, so only the flag survives.
    localStorage.removeItem('bawa-vault-addresses-devnet:v1');
    writeDevnetEnabled(true);
    const remounted = await mountProvider();
    try {
      expect(latest?.devnetEnabled).toBe(true);
      const started = Date.now();
      while (
        latest?.vaultAddresses.btc[0] === undefined
        && Date.now() - started < 30_000
      ) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 250));
        });
      }
      const expectedDevnet = await deriveDevnetAddressesAt(TEST_MNEMONIC, '', 0, 0);
      expect(expectedDevnet.btc.startsWith('tb1q')).toBe(true);
      expect(latest?.vaultAddresses.btc).toEqual([expectedDevnet.btc]);
    } finally {
      await remounted.cleanup();
    }
  });
});
