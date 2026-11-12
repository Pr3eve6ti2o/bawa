// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';

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
});
