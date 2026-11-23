// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';
import { expandUniquePrefix } from './import-wallet';
import { deriveAddresses } from '../wallet/core';
import { deleteVault, hasVault, vaultProvenance } from '../wallet/vault';

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
    // Fresh recents per mount: the picker reads them from localStorage.
    window.localStorage.clear();
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

  // Radix Tabs activates its triggers on mousedown, not click — a plain
  // .click() never switches the tab in jsdom. Dispatch both, as a real press does.
  async function clickTabTrigger(div: HTMLDivElement, text: string) {
    const trigger = [...div.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === text,
    );
    expect(trigger).not.toBeUndefined();
    await act(async () => {
      trigger!.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0 }),
      );
      trigger!.click();
    });
  }

  // UI/UX Round 2, item 3: the chain picker is a search bar now, not a
  // row of pills. Focus (or click) the search to open the full list,
  // then pick the chain by its name.
  async function selectChain(div: HTMLDivElement, name: string) {
    const search = div.querySelector<HTMLInputElement>(
      '#watch-only-chain-search',
    );
    expect(search).not.toBeNull();
    await act(async () => {
      search!.focus();
      search!.click();
    });
    await act(async () => {
      for (let i = 0; i < 20 && !div.querySelector('[role="listbox"]'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
    const option = [...div.querySelectorAll('[role="option"]')].find(
      (candidate) => candidate.textContent?.includes(name),
    );
    expect(option, `watch-only picker offers ${name}`).not.toBeUndefined();
    await act(async () => {
      option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (option as HTMLElement).click();
    });
  }

  it('switches the label to TON public address when TON is clicked', async () => {
    const { div, cleanup } = await mountImportScreen();
    try {
      // Lane C: restore-first is the default tab — switch to Watch-only first.
      await clickTabTrigger(div, 'Watch-only');
      await selectChain(div, 'TON');
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
      // Lane C: restore-first is the default tab — switch to Watch-only first.
      await clickTabTrigger(div, 'Watch-only');
      await selectChain(div, 'TON');
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
      // Lane C: restore-first is the default tab — switch to Watch-only first.
      await clickTabTrigger(div, 'Watch-only');
      await selectChain(div, 'TON');
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
  it('offers all 22 chains in the watch-only search, including SOL', async () => {
    // Token gaps, item 6 + item 8: the watch-only picker offered only
    // BTC/ETH/TRX/TON even though validation, derivation and the label
    // map already cover all 22 registry chains — a SOL address could not
    // be watched at all. UI/UX Round 2, item 3: the picker is a search
    // bar now, so the test opens it and checks every chain is an option.
    const { div, cleanup } = await mountImportScreen();
    try {
      await clickTabTrigger(div, 'Watch-only');
      const search = div.querySelector<HTMLInputElement>(
        '#watch-only-chain-search',
      );
      expect(search).not.toBeNull();
      await act(async () => {
        search!.focus();
        search!.click();
      });
      await act(async () => {
        for (let i = 0; i < 20 && !div.querySelector('[role="listbox"]'); i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      const options = [...div.querySelectorAll('[role="option"]')];
      expect(options).toHaveLength(22);
      for (const name of [
        'Bitcoin',
        'Ethereum',
        'TRON',
        'TON',
        'Solana',
        'BNB Smart Chain',
        'Polygon',
        'Arbitrum One',
        'OP Mainnet',
        'Base',
        'Avalanche C-Chain',
        'Litecoin',
        'Dogecoin',
        'Gnosis',
        'Celo',
        'Linea',
        'Mantle',
        'Scroll',
        'opBNB',
        'Metis',
        'Aurora',
        'Fantom',
      ]) {
        expect(
          options.some((option) => option.textContent?.includes(name)),
          `watch-only picker offers ${name}`,
        ).toBe(true);
      }
      await selectChain(div, 'SOL');
      expect(
        div.querySelector('label[for="wallet-xpub"]')?.textContent?.trim(),
      ).toBe('Solana public address');
    } finally {
      await cleanup();
    }
  });

  it('adds a watch-only Solana address and lists it', async () => {
    // Token gaps, item 6: end-to-end watch-only for SOL, with the
    // public Lane 1 address (known live balance 0.00236821 SOL).
    const SOL_ADDRESS = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
    const { div, cleanup } = await mountImportScreen();
    try {
      await clickTabTrigger(div, 'Watch-only');
      await selectChain(div, 'SOL');
      const input = div.querySelector<HTMLInputElement>('#wallet-xpub');
      expect(input).not.toBeNull();
      await act(async () => {
        setInputValue(input!, SOL_ADDRESS);
      });
      await clickButton(div, 'Add');
      // The imported list truncates the address (first 12 + last 8
      // chars); the full address never appears in the DOM.
      await act(async () => {
        for (let i = 0; i < 20 && !div.textContent?.includes('4uQeVj5tqViQ'); i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      expect(div.textContent).toContain('4uQeVj5tqViQ');
      expect(div.textContent).toContain('WCJziofM');
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

      // Lane C: restore-first is the default tab — switch to Watch-only first.
      // (Radix Tabs activates on mousedown, not click.)
      const watchOnlyTab = [...div.querySelectorAll('button')].find(
        (button) => button.textContent === 'Watch-only',
      );
      expect(watchOnlyTab).not.toBeUndefined();
      await act(async () => {
        watchOnlyTab!.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, button: 0 }),
        );
        watchOnlyTab!.click();
      });

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
      // Lane C: the label guidance lives in the Watch-only form.
      // (Radix Tabs activates on mousedown, not click.)
      const watchOnlyTab = [...div.querySelectorAll('button')].find(
        (button) => button.textContent === 'Watch-only',
      );
      expect(watchOnlyTab).not.toBeUndefined();
      await act(async () => {
        watchOnlyTab!.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, button: 0 }),
        );
        watchOnlyTab!.click();
      });
      expect(div.textContent).toContain('Labels are stored in plain text in this browser');
      expect(div.textContent).toContain('Do not enter secrets');
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
    deleteVault();
  });

  afterEach(() => {
    localStorage.clear();
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
    // Lane C: the restore tab is now labelled "Restore full wallet"
    // (restore-first is the default mode).
    await clickButton(div, 'Restore full wallet');
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
        (div.textContent ?? '').includes('Enter a 12-, 15-, 18-, 21- or 24-word recovery phrase.'),
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

  it('restores a valid 15-word phrase (BIP-39 allows 12/15/18/21/24)', async () => {
    // Token gaps, item 10: the repo's own published test vector is 15
    // words (docs/mainnet/MAINNET-VECTORS.md), but the submit gate
    // only accepted 12 or 24, so the vector could not be imported at
    // all — the preview step never appeared. BIP-39 word counts are
    // 12/15/18/21/24; all of them must reach the preview.
    const VEC =
      'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
    const { div, cleanup } = await mountImportScreen();
    try {
      await openPhraseMode(div);
      await restorePhrase(div, VEC);
      await waitFor(div, () =>
        (div.textContent ?? '').includes('Check the restored addresses'),
      );
      const expected = await deriveAddresses(VEC);
      expect(div.textContent).toContain(expected.eth);
      expect(div.textContent).toContain(expected.btc);
      expect(div.textContent).toContain(expected.trx);
      expect(div.textContent).toContain(expected.ton);
    } finally {
      await cleanup();
    }
  }, 30_000);

  it('derives the preview with the passphrase when one is entered', async () => {
    // Lane C, item 5: the 25-word form lives in the SAME field as the
    // 24-word form — there is no second section. Pasting 25 words uses
    // the 25th word as the recovery passphrase.
    const { div, cleanup } = await mountImportScreen();
    try {
      await openPhraseMode(div);
      // The separate passphrase field is gone: one field takes both forms.
      expect(div.querySelector('#import-passphrase')).toBeNull();
      await restorePhrase(div, `${VALID_MNEMONIC} TREZOR`);
      await waitFor(div, () =>
        (div.textContent ?? '').includes('Check the restored addresses'),
      );
      const withPassphrase = await deriveAddresses(VALID_MNEMONIC, 'TREZOR');
      const withoutPassphrase = await deriveAddresses(VALID_MNEMONIC);
      expect(div.textContent).toContain(withPassphrase.eth);
      expect(div.textContent).not.toContain(withoutPassphrase.eth);
      expect(div.textContent).toContain('An extra word was used as your recovery passphrase');
    } finally {
      await cleanup();
    }
  }, 30_000);

  it('offers to add a new account when the same phrase is imported again', async () => {
    // Lane C, item 6: importing the SAME phrase twice used to hit the
    // "delete your vault first" wall. Now it offers a new account from
    // the same phrase — Account 2 — with no deletion.
    const { readVaultAccounts } = await import('../wallet/vault');
    const first = await mountImportScreen();
    try {
      await openPhraseMode(first.div);
      await restorePhrase(first.div, VALID_MNEMONIC);
      await waitFor(first.div, () =>
        (first.div.textContent ?? '').includes('Check the restored addresses'),
      );
      const password = first.div.querySelector<HTMLInputElement>(
        '#import-vault-password',
      );
      const confirm = first.div.querySelector<HTMLInputElement>(
        '#import-vault-password-confirm',
      );
      await act(async () => {
        setInputValue(password!, TEST_PASSWORD);
        setInputValue(confirm!, TEST_PASSWORD);
      });
      await clickButton(first.div, 'Save to vault');
      await waitFor(first.div, () =>
        (first.div.textContent ?? '').includes('Wallet restored'),
      );
      expect(readVaultAccounts()).toEqual([0]);
    } finally {
      await first.cleanup();
    }
    const second = await mountImportScreen();
    try {
      await openPhraseMode(second.div);
      await restorePhrase(second.div, VALID_MNEMONIC);
      await waitFor(second.div, () =>
        (second.div.textContent ?? '').includes('This is the same recovery phrase'),
      );
      expect(second.div.textContent).not.toContain('delete the existing vault');
      await clickButton(second.div, 'Add as Account 2');
      await waitFor(second.div, () =>
        (second.div.textContent ?? '').includes('Account 2 added'),
      );
      expect(readVaultAccounts()).toEqual([0, 1]);
    } finally {
      await second.cleanup();
    }
  }, 60_000);

  it('warns instead of replacing when a different phrase is imported', async () => {
    // Lane C, item 6: a DIFFERENT phrase still needs a vault replace —
    // one vault holds one phrase — but the screen now says so after
    // comparing, instead of blocking before the phrase is even read.
    const { generateBip39Mnemonic } = await import('../wallet/bip39-validation');
    const other = generateBip39Mnemonic(
      256,
      Uint8Array.from({ length: 32 }, (_, i) => 255 - i),
    );
    expect(other).not.toBe(VALID_MNEMONIC);
    const first = await mountImportScreen();
    try {
      await openPhraseMode(first.div);
      await restorePhrase(first.div, VALID_MNEMONIC);
      await waitFor(first.div, () =>
        (first.div.textContent ?? '').includes('Check the restored addresses'),
      );
      const password = first.div.querySelector<HTMLInputElement>(
        '#import-vault-password',
      );
      const confirm = first.div.querySelector<HTMLInputElement>(
        '#import-vault-password-confirm',
      );
      await act(async () => {
        setInputValue(password!, TEST_PASSWORD);
        setInputValue(confirm!, TEST_PASSWORD);
      });
      await clickButton(first.div, 'Save to vault');
      await waitFor(first.div, () =>
        (first.div.textContent ?? '').includes('Wallet restored'),
      );
    } finally {
      await first.cleanup();
    }
    const second = await mountImportScreen();
    try {
      await openPhraseMode(second.div);
      await restorePhrase(second.div, other);
      await waitFor(second.div, () =>
        (second.div.textContent ?? '').includes('This is a different recovery phrase'),
      );
      expect(second.div.textContent).toContain('delete the existing vault');
      expect(second.div.textContent).toContain('Add an account from your current phrase');
    } finally {
      await second.cleanup();
    }
  }, 60_000);

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
      // Merge 1 (Lane B): an imported mnemonic is recorded as
      // 'imported', not 'created'.
      expect(vaultProvenance()).toEqual({
        source: 'imported',
        isTesting: false,
      });
      expect(div.textContent).not.toContain(VALID_MNEMONIC);
    } finally {
      await cleanup();
    }
  }, 30_000);

});

describe('expandUniquePrefix', () => {
  it.each([
    ['aban', 'abandon '],
    ['ab', 'ab'],
    ['abandon', 'abandon'],
    ['abandon aban', 'abandon abandon '],
    ['aban ', 'aban '],
    ['', ''],
    ['ABAN', 'abandon '],
  ])('expandUniquePrefix(%j) returns %j', (input, expected) => {
    expect(expandUniquePrefix(input)).toBe(expected);
  });
});
