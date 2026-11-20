// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';
import { createVault, deleteVault } from '../wallet/vault';

// jsdom has no matchMedia; the vendored theme toggle reads it on mount.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }) as unknown as MediaQueryList;
}

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

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

async function mountBackupScreen() {
  const previousUrl = window.location.href;
  const previousState = window.history.state;
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.pushState({}, '', '/mnemonic-backup');
  await act(async () => {
    root.render(<App />);
  });
  // The backup screen is lazy-loaded: wait for the Suspense fallback to
  // clear before the tests assert on its content.
  await act(async () => {
    for (let i = 0; i < 40 && div.textContent?.includes('Loading…'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
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
        window.history.replaceState(previousState, '', previousUrl);
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
}

describe.sequential('MnemonicBackupScreen (Phase 1.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    deleteVault();
  });

  afterEach(() => {
    localStorage.clear();
    deleteVault();
  });

  it('states there is nothing to back up without a vault', async () => {
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('nothing to back up');
      expect(div.textContent).not.toContain('Recovery profiles');
    } finally {
      await cleanup();
    }
  });

  it('lists the stored recovery profiles with a vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('Recovery profiles');
      expect(div.textContent).toContain('bawa-btc-bip84-v1');
      expect(div.textContent).toContain('bawa-evm-bip44-v1');
      expect(div.textContent).toContain('bawa-trx-bip44-v1');
      expect(div.textContent).toContain('bawa-ton-v4r2-v1');
      expect(div.textContent).toContain(
        'Restoring with a different profile recovers different addresses',
      );
      expect(div.textContent).toContain(
        'An extended public key alone cannot recover spending access',
      );
      expect(div.textContent).toContain('Words written on paper');
      expect(div.textContent).toContain('Never photographed');
    } finally {
      await cleanup();
    }
  });
});
