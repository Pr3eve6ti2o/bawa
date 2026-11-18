// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LockScreen } from './lock';
import { useWallet } from '../state/wallet-context';
import { setPassphraseUsed } from '../wallet/passphrase';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function setWallet(vaultState: string, unlockVault: () => Promise<void>): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState,
    unlockVault,
  } as unknown as ReturnType<typeof useWallet>);
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

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/lock']}>
        <Routes>
          <Route path="/lock" element={<LockScreen />} />
          <Route path="/" element={<div>Dashboard marker</div>} />
        </Routes>
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

describe('lock screen', () => {
  it('unlocks and navigates home on the right password', async () => {
    const unlockVault = vi.fn(async () => {});
    setWallet('locked', unlockVault);
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#lock-password',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(input, 'correct horse');
      });
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Unlock',
      ) as HTMLButtonElement;
      await act(async () => {
        button.click();
      });
      expect(unlockVault).toHaveBeenCalledWith('correct horse', '');
      expect(mounted.div.textContent).toContain('Dashboard marker');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the vault error and clears the field on a wrong password', async () => {
    setWallet('locked', async () => {
      throw new Error('Wrong password.');
    });
    const mounted = await mountScreen();
    try {
      const input = mounted.div.querySelector(
        '#lock-password',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(input, 'wrong');
      });
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Unlock',
      ) as HTMLButtonElement;
      await act(async () => {
        button.click();
      });
      expect(mounted.div.textContent).toContain('Wrong password.');
      expect(
        (mounted.div.querySelector('#lock-password') as HTMLInputElement)
          .value,
      ).toBe('');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the passphrase field only when a passphrase is used', async () => {
    const unlockVault = vi.fn(async () => {});
    setWallet('locked', unlockVault);
    setPassphraseUsed(true);
    const mounted = await mountScreen();
    try {
      const passphrase = mounted.div.querySelector(
        '#lock-passphrase',
      ) as HTMLInputElement;
      expect(passphrase).not.toBeNull();
      const password = mounted.div.querySelector(
        '#lock-password',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(password, 'correct horse');
        setInputValue(passphrase, 'TREZOR');
      });
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Unlock',
      ) as HTMLButtonElement;
      await act(async () => {
        button.click();
      });
      expect(unlockVault).toHaveBeenCalledWith('correct horse', 'TREZOR');
      expect(mounted.div.textContent).toContain('Dashboard marker');
    } finally {
      await mounted.cleanup();
      setPassphraseUsed(false);
    }
  });

  it('shows the no-vault state with create/import links', async () => {
    setWallet('no-vault', async () => {});
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No vault exists yet.');
      expect(
        mounted.div.querySelector('a[href="/create-wallet"]'),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector('a[href="/import-wallet"]'),
      ).not.toBeNull();
      expect(mounted.div.querySelector('#lock-password')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });
});
