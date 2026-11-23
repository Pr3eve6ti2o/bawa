// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { CreateWalletScreen } from './create-wallet';
import { createWallet } from '../wallet/core';
import { loadCore } from '../engine/boundary';
import { createVault, hasVault } from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';
import { useWallet } from '../state/wallet-context';

vi.mock('../wallet/core', () => ({
  createWallet: vi.fn(),
}));

vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
}));

vi.mock('../engine/boundary', () => ({
  loadCore: vi.fn(),
}));

const mockRefreshVaultAccounts = vi.fn();
const mockResetReceiveRotation = vi.fn();

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

// Disposable test mnemonic — never a real secret.
const TEST_MNEMONIC = [...Array(23).fill('abandon'), 'about'].join(' ');
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_ADDRESSES = {
  btc: ['bc1qtest'],
  eth: ['0xTestEthAddress'],
  trx: ['TTestTrxAddress'],
  ton: ['UQTestTonAddress'],
};

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

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
  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}

// handleGenerate/handleConfirm yield to the event loop between stages
// (yieldFrame); act() does not flush those timers, so let them run.
async function settle(ms = 200): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/create-wallet']}>
        <CreateWalletScreen />
      </MemoryRouter>,
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

async function fillPasswords(div: HTMLDivElement) {
  const password = div.querySelector('#vault-password') as HTMLInputElement;
  const confirm = div.querySelector('#vault-password-confirm') as HTMLInputElement;
  await act(async () => {
    setInputValue(password, TEST_PASSWORD);
    setInputValue(confirm, TEST_PASSWORD);
  });
}


// Lane B (Phase 2): step 2 now opens with a Rabby-style risk check — the
// phrase is not rendered until all three boxes are ticked and the user
// continues. Every flow that reaches the phrase screen goes through this.
async function acknowledgeRisk(div: HTMLDivElement) {
  await act(async () => {
    const boxes = [...div.querySelectorAll('[id^="risk-check-"]')];
    expect(boxes.length).toBe(3);
    boxes.forEach((box) => (box as HTMLButtonElement).click());
  });
  await act(async () => {
    findButton(div, 'I understand — show my recovery phrase').click();
  });
  await settle();
}

async function generate(div: HTMLDivElement) {
  await fillPasswords(div);
  await act(async () => {
    findButton(div, 'Generate recovery phrase').click();
  });
  await settle();
  await acknowledgeRisk(div);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(createWallet).mockResolvedValue(TEST_MNEMONIC);
  vi.mocked(createVault).mockResolvedValue(undefined);
  vi.mocked(hasVault).mockReturnValue(false);
  vi.mocked(loadCore).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof loadCore>>);
  mockRefreshVaultAccounts.mockResolvedValue(undefined);
  mockResetReceiveRotation.mockClear();
  vi.mocked(useWallet).mockReturnValue({
    vaultAddresses: TEST_ADDRESSES,
    refreshVaultAccounts: mockRefreshVaultAccounts,
    resetReceiveRotation: mockResetReceiveRotation,
  } as unknown as ReturnType<typeof useWallet>);
});

describe('create wallet screen', () => {
  it('blocks generation when the passwords do not match', async () => {
    const mounted = await mountScreen();
    try {
      const password = mounted.div.querySelector('#vault-password') as HTMLInputElement;
      const confirm = mounted.div.querySelector(
        '#vault-password-confirm',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(password, TEST_PASSWORD);
        setInputValue(confirm, 'a different password');
      });
      await act(async () => {
        findButton(mounted.div, 'Generate recovery phrase').click();
      });
      await settle();
      expect(createWallet).not.toHaveBeenCalled();
      expect(mounted.div.textContent).toContain('Passwords do not match.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('blocks progress when confirmation words are wrong', async () => {
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      expect(mounted.div.textContent).toContain('Write down your recovery phrase');
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      expect(inputs.length).toBe(3);
      await act(async () => {
        inputs.forEach((input) =>
          setInputValue(input as HTMLInputElement, 'wrongword'),
        );
      });
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();
      expect(createVault).not.toHaveBeenCalled();
      expect(mounted.div.textContent).toContain('do not match the recovery phrase');
    } finally {
      await mounted.cleanup();
    }
  });

  it('creates the vault with all seven profileIds and clears the words', async () => {
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const words = TEST_MNEMONIC.split(' ');
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      expect(inputs.length).toBe(3);
      await act(async () => {
        inputs.forEach((input) => {
          const position = Number(
            (input as HTMLInputElement).id.replace('confirm-word-', ''),
          );
          setInputValue(input as HTMLInputElement, words[position] as string);
        });
      });
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
        'bawa-sol-bip44-v1',
        'bawa-ltc-bip84-v1',
        'bawa-doge-bip44-v1',
      ], '');
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      // The mnemonic is cleared: no recovery word is shown any more.
      expect(mounted.div.textContent).not.toContain('abandon');
      expect(mounted.div.textContent).toContain('Your wallet is ready');
      // Ethereum first.
      const text = mounted.div.textContent as string;
      expect(text.indexOf('Ethereum')).toBeLessThan(text.indexOf('Bitcoin'));
      expect(text.indexOf('Bitcoin')).toBeLessThan(text.indexOf('TRON'));
      expect(text.indexOf('TRON')).toBeLessThan(text.indexOf('TON'));
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('completed');
      expect(stepCards[2]?.getAttribute('data-state')).toBe('completed');
      expect(text).toContain(TEST_ADDRESSES.btc[0]);
      expect(text).toContain(TEST_ADDRESSES.eth[0]);
      expect(text).toContain(TEST_ADDRESSES.trx[0]);
      expect(text).toContain(TEST_ADDRESSES.ton[0]);
    } finally {
      await mounted.cleanup();
    }
  });

  it('stays on step 3 when address derivation fails', async () => {
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const words = TEST_MNEMONIC.split(' ');
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      expect(inputs.length).toBe(3);
      await act(async () => {
        inputs.forEach((input) => {
          const position = Number(
            (input as HTMLInputElement).id.replace('confirm-word-', ''),
          );
          setInputValue(input as HTMLInputElement, words[position] as string);
        });
      });
      mockRefreshVaultAccounts.mockRejectedValueOnce(new Error('refresh failed'));
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      // A new phrase starts HD receive rotation at index 0.
      expect(mockResetReceiveRotation).toHaveBeenCalledTimes(1);
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('pending');
      const text = mounted.div.textContent as string;
      expect(text).toContain('could not be saved');
      expect(text).not.toContain('Your wallet is ready');
    } finally {
      await mounted.cleanup();
    }
  });

  it('stays on step 3 when vault creation fails', async () => {
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const words = TEST_MNEMONIC.split(' ');
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      expect(inputs.length).toBe(3);
      await act(async () => {
        inputs.forEach((input) => {
          const position = Number(
            (input as HTMLInputElement).id.replace('confirm-word-', ''),
          );
          setInputValue(input as HTMLInputElement, words[position] as string);
        });
      });
      vi.mocked(createVault).mockRejectedValueOnce(new Error('save failed'));
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockRefreshVaultAccounts).not.toHaveBeenCalled();
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('pending');
      const text = mounted.div.textContent as string;
      expect(text).toContain('could not be saved');
      expect(text).not.toContain('Your wallet is ready');
    } finally {
      await mounted.cleanup();
    }
  });

  it('passes a passphrase to the vault and records that one is used', async () => {
    const mounted = await mountScreen();
    try {
      await fillPasswords(mounted.div);
      const passphrase = mounted.div.querySelector(
        '#vault-passphrase',
      ) as HTMLInputElement;
      expect(passphrase).not.toBeNull();
      await act(async () => {
        setInputValue(passphrase, 'TREZOR');
      });
      await act(async () => {
        findButton(mounted.div, 'Generate recovery phrase').click();
      });
      await settle();
      await acknowledgeRisk(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const words = TEST_MNEMONIC.split(' ');
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      await act(async () => {
        inputs.forEach((input) => {
          const position = Number(
            (input as HTMLInputElement).id.replace('confirm-word-', ''),
          );
          setInputValue(input as HTMLInputElement, words[position] as string);
        });
      });
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();
      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
        'bawa-sol-bip44-v1',
        'bawa-ltc-bip84-v1',
        'bawa-doge-bip44-v1',
      ], 'TREZOR');
      expect(isPassphraseUsed()).toBe(true);
      expect(mounted.div.textContent).toContain('Your wallet is ready');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the risk check before the recovery phrase and hides the phrase until acknowledged', async () => {
    const mounted = await mountScreen();
    try {
      // Drive generation without the acknowledgeRisk helper: the phrase
      // must not be shown yet.
      await fillPasswords(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'Generate recovery phrase').click();
      });
      await settle();
      expect(mounted.div.textContent).toContain('Check the risks first');
      expect(mounted.div.textContent).not.toContain('abandon');
      expect(mounted.div.textContent).not.toContain('I have written them down');
      const boxes = [...mounted.div.querySelectorAll('[id^="risk-check-"]')];
      expect(boxes.length).toBe(3);
      const continueButton = findButton(
        mounted.div,
        'I understand — show my recovery phrase',
      );
      expect(continueButton.disabled).toBe(true);
      // Two of three ticked: still gated.
      await act(async () => {
        (boxes[0] as HTMLButtonElement).click();
        (boxes[1] as HTMLButtonElement).click();
      });
      expect(continueButton.disabled).toBe(true);
      expect(mounted.div.textContent).not.toContain('abandon');
      // All three ticked: the phrase appears.
      await act(async () => {
        (boxes[2] as HTMLButtonElement).click();
      });
      expect(continueButton.disabled).toBe(false);
      await act(async () => {
        continueButton.click();
      });
      await settle();
      expect(mounted.div.textContent).toContain('Write down your recovery phrase');
      expect(mounted.div.textContent).toContain('abandon');
      expect(mounted.div.textContent).toContain('I have written them down');
    } finally {
      await mounted.cleanup();
    }
  });

  it('tells the user to add an account instead of deleting the vault', async () => {
    vi.mocked(hasVault).mockReturnValue(true);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('A wallet already exists');
      expect(createWallet).not.toHaveBeenCalled();
      // Item 17: no delete wall any more — another account comes from the
      // same phrase, on the Wallets screen.
      expect(mounted.div.textContent).toContain(
        'add another account from the same phrase',
      );
      expect(mounted.div.textContent).not.toContain(
        'To start over, delete the existing vault',
      );
      expect(mounted.div.querySelector('a[href="/wallets"]')).not.toBeNull();
      expect(mounted.div.querySelector('a[href="/security"]')).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('copies the recovery phrase from step 2', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      const button = mounted.div.querySelector(
        '[aria-label="Copy recovery phrase"]',
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();
      await act(async () => {
        button.click();
      });
      expect(writeText).toHaveBeenCalledWith(TEST_MNEMONIC);
      expect(button.textContent).toBe('Copied');
    } finally {
      await mounted.cleanup();
    }
  });

  it('copies each address from step 4', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const words = TEST_MNEMONIC.split(' ');
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      await act(async () => {
        inputs.forEach((input) => {
          const position = Number(
            (input as HTMLInputElement).id.replace('confirm-word-', ''),
          );
          setInputValue(input as HTMLInputElement, words[position] as string);
        });
      });
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();
      expect(mounted.div.textContent).toContain('Your wallet is ready');
      const button = mounted.div.querySelector(
        '[aria-label="Copy Ethereum address"]',
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();
      await act(async () => {
        button.click();
      });
      expect(writeText).toHaveBeenCalledWith(TEST_ADDRESSES.eth[0]);
      expect(button.textContent).toBe('Copied');
    } finally {
      await mounted.cleanup();
    }
  });
});
