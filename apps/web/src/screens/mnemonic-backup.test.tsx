// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';
import { createVault, deleteVault } from '../wallet/vault';
import { TEST_VAULT_PROFILE_IDS } from '../state/test-helpers';

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

// The four engine-chain profiles (layout-rebuild's local list): the
// backup screen shows only these four chains.
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return button as HTMLButtonElement;
}

async function waitForText(
  div: HTMLDivElement,
  text: string,
  attempts = 160,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (div.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error(`timed out waiting for text: ${text}`);
}

async function openPasswordStage(
  div: HTMLDivElement,
): Promise<HTMLInputElement> {
  await act(async () => {
    findButton(div, 'Reveal recovery phrase').click();
  });
  const password = div.querySelector(
    '#reveal-password',
  ) as HTMLInputElement;
  expect(password).not.toBeNull();
  return password;
}

async function verifyPassword(
  div: HTMLDivElement,
  value: string,
): Promise<void> {
  const password = div.querySelector(
    '#reveal-password',
  ) as HTMLInputElement;
  await act(async () => {
    setInputValue(password, value);
  });
  await act(async () => {
    findButton(div, 'Verify password').click();
  });
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
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('Recovery profiles');
      for (const profileId of TEST_VAULT_PROFILE_IDS) {
        expect(div.textContent).toContain(profileId);
      }
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

  it('keeps the backup guidance as one compact list, not four repeated cards', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      const text = div.textContent ?? '';
      expect(text).toContain('Words written on paper');
      expect(text).toContain('Never photographed');
      expect(text).toContain(
        'These are reminders, not proof that the steps are done.',
      );
      // The "not verified" note is said once in the section intro, not
      // repeated under every item.
      expect(text).not.toContain('Guidance. Not verified by this app.');
    } finally {
      await cleanup();
    }
  });

  it('hides the reveal section without a vault', async () => {
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).not.toContain('Reveal recovery phrase');
    } finally {
      await cleanup();
    }
  });

  it('shows only the four wallet chains, never a duplicate Ethereum or an extended chain', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const { div, cleanup } = await mountBackupScreen();
    try {
      const text = div.textContent ?? '';
      expect((text.match(/Ethereum/g) ?? []).length).toBe(1);
      expect(text).not.toContain('Solana');
      expect(text).not.toContain('Litecoin');
      expect(text).not.toContain('Dogecoin');
      expect(text).not.toContain('bawa-sol');
      expect(text).not.toContain('bawa-ltc');
      expect(text).not.toContain('bawa-doge');
      const profiles = div.querySelector('[aria-labelledby="backup-profiles"]');
      expect(profiles?.querySelectorAll('li').length).toBe(4);
    } finally {
      await cleanup();
    }
  });

  it('requires the password before the quiz or the phrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('Reveal recovery phrase');
      expect(div.textContent).not.toContain('Vault password');
      await openPasswordStage(div);
      expect(div.textContent).toContain('Vault password');
      expect(div.textContent).not.toContain('abandon');
      await verifyPassword(div, 'wrong password');
      await waitForText(div, 'Incorrect password.');
      expect(div.textContent).not.toContain(
        'Answer all three questions correctly',
      );
      expect(div.textContent).not.toContain('abandon');
    } finally {
      await cleanup();
    }
  });

  // Password verification runs a 600k-iteration PBKDF2 trial decrypt,
  // which can take several seconds while the full suite runs in parallel
  // workers.
  it('reveals only after the password and all three quiz answers', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      await openPasswordStage(div);
      await verifyPassword(div, TEST_PASSWORD);
      await waitForText(div, 'Answer all three questions correctly');
      expect(div.textContent).not.toContain('abandon');

      // A wrong answer marks the question and does not enable the reveal.
      await act(async () => {
        findButton(div, 'Only see your balances').click();
      });
      await waitForText(div, 'Not quite — try again.');
      expect(
        findButton(div, 'Show recovery phrase').disabled,
      ).toBe(true);

      // All three correct answers enable the reveal.
      await act(async () => {
        findButton(div, 'Spend from this wallet').click();
        findButton(div, 'On paper, stored offline').click();
        findButton(div, 'Paste them into any app or website').click();
      });
      expect(findButton(div, 'Show recovery phrase').disabled).toBe(false);
      await act(async () => {
        findButton(div, 'Show recovery phrase').click();
      });
      await waitForText(div, 'Hide recovery phrase');
      expect(div.textContent).toContain('abandon');
      expect(div.textContent).toContain('about');

      // Hiding clears the phrase from the screen.
      await act(async () => {
        findButton(div, 'Hide recovery phrase').click();
      });
      expect(div.textContent).not.toContain('abandon');
      expect(div.textContent).toContain('Reveal recovery phrase');
    } finally {
      await cleanup();
    }
  }, 30000);
});
