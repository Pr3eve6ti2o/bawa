// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { CreateWalletScreen } from './create-wallet';
import { createWallet } from '../wallet/core';
import { createVault, hasVault, isLocked } from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';
import { useWallet } from '../state/wallet-context';

vi.mock('../wallet/core', () => ({
  createWallet: vi.fn(),
}));

vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
  isLocked: vi.fn(),
}));

const mockUnlockVault = vi.fn();
const mockRefreshVaultAccounts = vi.fn();

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

async function generate(div: HTMLDivElement) {
  await fillPasswords(div);
  await act(async () => {
    findButton(div, 'Generate recovery phrase').click();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(createWallet).mockResolvedValue(TEST_MNEMONIC);
  vi.mocked(createVault).mockResolvedValue(undefined);
  vi.mocked(hasVault).mockReturnValue(false);
  vi.mocked(isLocked).mockReturnValue(false);
  mockUnlockVault.mockResolvedValue(undefined);
  mockRefreshVaultAccounts.mockResolvedValue(undefined);
  vi.mocked(useWallet).mockReturnValue({
    vaultAddresses: TEST_ADDRESSES,
    unlockVault: mockUnlockVault,
    refreshVaultAccounts: mockRefreshVaultAccounts,
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
      expect(createVault).not.toHaveBeenCalled();
      expect(mounted.div.textContent).toContain('do not match the recovery phrase');
    } finally {
      await mounted.cleanup();
    }
  });

  it('creates the vault with all four profileIds and clears the words', async () => {
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
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
      ]);
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, '');
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

  it('advances to step 4 with addresses when the post-unlock refresh fails', async () => {
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
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, '');
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('completed');
      const text = mounted.div.textContent as string;
      expect(text).toContain('Your wallet is ready');
      expect(text).toContain(TEST_ADDRESSES.btc[0]);
      expect(text).toContain(TEST_ADDRESSES.eth[0]);
      expect(text).toContain(TEST_ADDRESSES.trx[0]);
      expect(text).toContain(TEST_ADDRESSES.ton[0]);
      expect(text).not.toContain('could not be saved');
    } finally {
      await mounted.cleanup();
    }
  });

  it('stays on step 3 when the unlock itself fails', async () => {
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
      mockUnlockVault.mockRejectedValueOnce(new Error('unlock failed'));
      vi.mocked(isLocked).mockReturnValue(true);
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
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

  it('passes a passphrase to unlock and records that one is used', async () => {
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
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, 'TREZOR');
      expect(isPassphraseUsed()).toBe(true);
      expect(mounted.div.textContent).toContain('Your wallet is ready');
    } finally {
      await mounted.cleanup();
    }
  });

  it('blocks creation when a vault already exists', async () => {
    vi.mocked(hasVault).mockReturnValue(true);
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('A wallet already exists');
      expect(createWallet).not.toHaveBeenCalled();
      const link = mounted.div.querySelector('a[href="/security"]');
      expect(link).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
