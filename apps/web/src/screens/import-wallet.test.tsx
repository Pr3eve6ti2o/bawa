// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';
import { deriveAddresses } from '../wallet/core';
import { deleteVault, hasVault, lock } from '../wallet/vault';

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

// Published BIP-39 test mnemonic ("abandon" x23 + "art") — a test vector
// only, never for funds. Pasted here by mistake by a user, it must be
// rejected AND cleared from the field (T41).
const TEST_MNEMONIC = [...Array(23).fill('abandon'), 'art'].join(' ');

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// The import screen is lazy-loaded (route code-splitting): after mount,
// wait for it to appear before the tests touch its controls.
async function waitForImportScreen(div: HTMLDivElement): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 40 && !div.querySelector('#wallet-xpub'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
}

describe.sequential('ImportWalletScreen TON (R01)', () => {
  const TON_ADDRESS = 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn';

  async function mountImportScreen() {
    const previousUrl = window.location.href;
    const previousState = window.history.state;
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    window.history.pushState({}, '', '/import-wallet');
    await act(async () => {
      root.render(<App />);
    });
    await waitForImportScreen(div);
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

  async function clickButton(div: HTMLDivElement, text: string) {
    const button = [...div.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === text,
    );
    expect(button).not.toBeUndefined();
    await act(async () => {
      button!.click();
    });
  }

  it('switches the label to TON public address when TON is clicked', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await clickButton(div, 'TON');
      expect(
        div.querySelector('label[for="wallet-xpub"]')?.textContent?.trim(),
      ).toBe('TON public address');
      expect(div.textContent).toContain('No child addresses are derived');
    } finally {
      await cleanup();
    }
  });

  it('shows a valid TON wallet in the imported list', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await clickButton(div, 'TON');
      const input = div.querySelector<HTMLInputElement>('#wallet-xpub');
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input!, TON_ADDRESS);
      });
      await clickButton(div, 'Add');
      // The imported list truncates the address (first 12 + last 8
      // chars); the full address never appears in the DOM.
      await act(async () => {
        for (let i = 0; i < 20 && !div.textContent?.includes('UQC7gZvGVdCx'); i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(div.textContent).toContain('UQC7gZvGVdCx');
      expect(div.textContent).toContain('mM5wD3zn');
    } finally {
      await cleanup();
    }
  });

  it('clears a rejected mnemonic on the TON tab and shows a secret-free error', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await clickButton(div, 'TON');
      const input = div.querySelector<HTMLInputElement>('#wallet-xpub');
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input!, TEST_MNEMONIC);
      });
      expect(input!.value).toBe(TEST_MNEMONIC);
      await clickButton(div, 'Add');
      await act(async () => {
        for (let i = 0; i < 20 && input!.value !== ''; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(input!.value).toBe('');
      expect(div.textContent).toContain('input was cleared');
      expect(div.textContent).not.toContain(TEST_MNEMONIC);
      expect(div.innerHTML).not.toContain(TEST_MNEMONIC);
    } finally {
      await cleanup();
    }
  });
});

describe.sequential('ImportWalletScreen (T41)', () => {
  it('clears a pasted mnemonic from the field when validation rejects it', async () => {
    const previousUrl = window.location.href;
    const previousState = window.history.state;
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;

    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      window.history.pushState({}, '', '/import-wallet');
      await act(async () => {
        root.render(<App />);
      });
      await waitForImportScreen(div);

      const input = div.querySelector<HTMLInputElement>('#wallet-xpub');
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input!, TEST_MNEMONIC);
      });
      expect(input!.value).toBe(TEST_MNEMONIC);

      const addButton = [...div.querySelectorAll('button')].find(
        (button) => button.textContent === 'Add',
      );
      expect(addButton).not.toBeUndefined();
      await act(async () => {
        addButton!.click();
        // Flush the async extended-key validation and the re-render.
        for (let i = 0; i < 20 && input!.value !== ''; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });

      expect(input!.value).toBe('');
      expect(div.textContent).toContain('input was cleared');
      expect(div.textContent).not.toContain(TEST_MNEMONIC);
    } finally {
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
    }
  });

  it('shows the do-not-enter-secrets label guidance (R02-F09)', async () => {
    const previousUrl = window.location.href;
    const previousState = window.history.state;
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      window.history.pushState({}, '', '/import-wallet');
      await act(async () => {
        root.render(<App />);
      });
      await waitForImportScreen(div);
      expect(div.textContent).toContain('Labels are stored in plain text in this browser');
      expect(div.textContent).toContain('do not enter secrets');
    } finally {
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
    }
  });
});

describe.sequential('ImportWalletScreen recovery phrase (Phase 1.3)', () => {
  // Standard public BIP-39 test vector — disposable test data, never a real secret.
  const VALID_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const TEST_PASSWORD = 'correct horse battery staple';

  beforeEach(() => {
    localStorage.clear();
    lock();
    deleteVault();
  });

  afterEach(() => {
    localStorage.clear();
    lock();
    deleteVault();
  });

  async function mountImportScreen() {
    const previousUrl = window.location.href;
    const previousState = window.history.state;
    const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    window.history.pushState({}, '', '/import-wallet');
    await act(async () => {
      root.render(<App />);
    });
    await waitForImportScreen(div);
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

  async function clickButton(div: HTMLDivElement, text: string) {
    const button = [...div.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === text,
    );
    expect(button).not.toBeUndefined();
    await act(async () => {
      button!.click();
    });
  }

  async function waitFor(
    div: HTMLDivElement,
    predicate: () => boolean,
    attempts = 60,
  ) {
    await act(async () => {
      for (let i = 0; i < attempts && !predicate(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
    expect(predicate()).toBe(true);
  }

  async function openPhraseMode(div: HTMLDivElement) {
    await clickButton(div, 'Recovery phrase');
    expect(div.querySelector('#recovery-phrase')).not.toBeNull();
  }

  async function restorePhrase(div: HTMLDivElement, phrase: string) {
    const input = div.querySelector<HTMLInputElement>('#recovery-phrase');
    expect(input).not.toBeNull();
    await act(async () => {
      setInputValue(input!, phrase);
    });
    await clickButton(div, 'Restore wallet');
  }

  it('rejects an invalid recovery phrase and clears the input', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await openPhraseMode(div);
      await restorePhrase(div, 'hello world');
      await waitFor(div, () =>
        (div.textContent ?? '').includes('12-word or 24-word'),
      );
      const input = div.querySelector<HTMLInputElement>('#recovery-phrase');
      expect(input?.value).toBe('');
      expect(div.textContent).not.toContain('hello world');
    } finally {
      await cleanup();
    }
  });

  it('restores a valid phrase and shows Ethereum-first addresses', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await openPhraseMode(div);
      await restorePhrase(div, VALID_MNEMONIC);
      await waitFor(div, () =>
        (div.textContent ?? '').includes('Check the restored addresses'),
      );
      // The phrase input is cleared immediately after use.
      expect(div.querySelector('#recovery-phrase')).toBeNull();
      expect(div.textContent).not.toContain(VALID_MNEMONIC);
      const expected = await deriveAddresses(VALID_MNEMONIC);
      // The same addresses creation derives (core.test.ts round-trip).
      expect(div.textContent).toContain(expected.eth);
      expect(div.textContent).toContain(expected.btc);
      expect(div.textContent).toContain(expected.trx);
      expect(div.textContent).toContain(expected.ton);
      const text = div.textContent as string;
      expect(text.indexOf('Ethereum')).toBeLessThan(text.indexOf('Bitcoin'));
      expect(text.indexOf('Bitcoin')).toBeLessThan(text.indexOf('TRON'));
      expect(text.indexOf('TRON')).toBeLessThan(text.indexOf('TON'));
    } finally {
      await cleanup();
    }
  }, 30_000);

  it('derives the preview with the passphrase when one is entered', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await openPhraseMode(div);
      const passphrase = div.querySelector<HTMLInputElement>(
        '#import-passphrase',
      );
      expect(passphrase).not.toBeNull();
      await act(async () => {
        setInputValue(passphrase!, 'TREZOR');
      });
      await restorePhrase(div, VALID_MNEMONIC);
      await waitFor(div, () =>
        (div.textContent ?? '').includes('Check the restored addresses'),
      );
      const withPassphrase = await deriveAddresses(VALID_MNEMONIC, 'TREZOR');
      const withoutPassphrase = await deriveAddresses(VALID_MNEMONIC);
      expect(div.textContent).toContain(withPassphrase.eth);
      expect(div.textContent).not.toContain(withoutPassphrase.eth);
    } finally {
      await cleanup();
    }
  }, 30_000);

  it('saves the restored wallet to the vault', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      await openPhraseMode(div);
      await restorePhrase(div, VALID_MNEMONIC);
      await waitFor(div, () =>
        (div.textContent ?? '').includes('Check the restored addresses'),
      );
      const password = div.querySelector<HTMLInputElement>(
        '#import-vault-password',
      );
      const confirm = div.querySelector<HTMLInputElement>(
        '#import-vault-password-confirm',
      );
      expect(password).not.toBeNull();
      expect(confirm).not.toBeNull();
      await act(async () => {
        setInputValue(password!, TEST_PASSWORD);
        setInputValue(confirm!, TEST_PASSWORD);
      });
      await clickButton(div, 'Save to vault');
      await waitFor(div, () =>
        (div.textContent ?? '').includes('Wallet restored'),
      );
      expect(hasVault()).toBe(true);
      expect(div.textContent).not.toContain(VALID_MNEMONIC);
    } finally {
      await cleanup();
    }
  }, 30_000);
});
