// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../state/wallet-context';
import { AutoLockSetting } from './auto-lock-setting';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type Wallet = ReturnType<typeof useWallet>;

function setWallet(overrides: Partial<Wallet> = {}) {
  const wallet = {
    vaultState: 'unlocked',
    autoLockEnabled: false,
    autoLockMinutes: 5,
    setAutoLockMinutes: vi.fn(),
    setAutoLockEnabled: vi.fn(async () => {}),
    unlockVault: vi.fn(async () => {}),
    ...overrides,
  } as Wallet;

  vi.mocked(useWallet).mockReturnValue(wallet);
  return wallet;
}

function mount() {
  const div = document.createElement('div');
  document.body.appendChild(div);

  const root = createRoot(div);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/security']}>
        <AutoLockSetting />
      </MemoryRouter>,
    );
  });

  return {
    div,
    cleanup() {
      act(() => {
        root.unmount();
      });
      div.remove();
    },
  };
}

function getSwitch(div: HTMLDivElement) {
  const toggle = div.querySelector<HTMLElement>(
    '[role="switch"][aria-label="Auto-lock"]',
  );
  expect(toggle).not.toBeNull();
  return toggle!;
}

function fillPassword(div: HTMLDivElement, password: string) {
  const input = div.querySelector<HTMLInputElement>('input[type="password"]');
  expect(input).not.toBeNull();

  const form = input!.form;
  expect(form).not.toBeNull();

  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;

  act(() => {
    setValue.call(input!, password);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  });

  return form!;
}

describe('AutoLockSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that the wallet stays unlocked when auto-lock is disabled', () => {
    setWallet();
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Auto-lock is off');
      expect(div.textContent).toContain('stays unlocked on this device');
    } finally {
      cleanup();
    }
  });

  it('enables auto-lock when the switch is clicked', async () => {
    const wallet = setWallet();
    const { div, cleanup } = mount();

    try {
      const toggle = getSwitch(div);

      await act(async () => {
        toggle.click();
      });

      expect(wallet.setAutoLockEnabled).toHaveBeenCalledTimes(1);
      expect(wallet.setAutoLockEnabled).toHaveBeenCalledWith(true);
    } finally {
      cleanup();
    }
  });

  it('describes the five-minute delay when auto-lock is enabled', () => {
    setWallet({ autoLockEnabled: true, autoLockMinutes: 5 });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Auto-lock is on');
      expect(div.textContent).toContain(
        'locks after 5 minutes without activity',
      );
    } finally {
      cleanup();
    }
  });

  it('describes immediate locking when the duration is zero', () => {
    setWallet({ autoLockEnabled: true, autoLockMinutes: 0 });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Auto-lock is on');
      expect(div.textContent).toContain(
        'locks immediately when you leave this page',
      );
    } finally {
      cleanup();
    }
  });

  it('offers six durations and saves a selection of 15 minutes', () => {
    const wallet = setWallet({ autoLockEnabled: true });
    const { div, cleanup } = mount();

    try {
      const select = div.querySelector<HTMLSelectElement>('select#auto-lock');
      expect(select).not.toBeNull();
      expect(select!.options).toHaveLength(6);

      const setValue = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )!.set!;

      act(() => {
        setValue.call(select!, '15');
        select!.dispatchEvent(new Event('change', { bubbles: true }));
      });

      expect(wallet.setAutoLockMinutes).toHaveBeenCalledTimes(1);
      expect(wallet.setAutoLockMinutes).toHaveBeenCalledWith(15);
    } finally {
      cleanup();
    }
  });

  it('shows the no-vault notice when there is no vault', () => {
    setWallet({ vaultState: 'no-vault' });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain(
        'No vault yet. Create or import a wallet first.',
      );
    } finally {
      cleanup();
    }
  });

  it('shows the locked notice and a link to /lock', () => {
    setWallet({ vaultState: 'locked', autoLockEnabled: true });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain('Vault locked.');

      const link = div.querySelector<HTMLAnchorElement>('a[href="/lock"]');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('/lock');
    } finally {
      cleanup();
    }
  });

  it('requests a password while locked, then disables auto-lock before unlocking', async () => {
    const setAutoLockEnabled = vi.fn(async () => {});
    const unlockVault = vi.fn(async () => {});
    setWallet({
      vaultState: 'locked',
      autoLockEnabled: true,
      setAutoLockEnabled,
      unlockVault,
    });

    const { div, cleanup } = mount();

    try {
      expect(div.querySelector('input[type="password"]')).toBeNull();

      const toggle = getSwitch(div);
      await act(async () => {
        toggle.click();
      });

      expect(setAutoLockEnabled).not.toHaveBeenCalled();
      expect(unlockVault).not.toHaveBeenCalled();

      const password = 'correct horse battery staple';
      const form = fillPassword(div, password);

      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });

      expect(setAutoLockEnabled).toHaveBeenCalledTimes(1);
      expect(setAutoLockEnabled).toHaveBeenCalledWith(false);
      expect(unlockVault).toHaveBeenCalledTimes(1);
      expect(unlockVault).toHaveBeenCalledWith(password);
      expect(setAutoLockEnabled.mock.invocationCallOrder[0]!).toBeLessThan(
        unlockVault.mock.invocationCallOrder[0]!,
      );
    } finally {
      cleanup();
    }
  });

  it('shows the error text when unlocking fails', async () => {
    const error = new Error('Incorrect password');
    const setAutoLockEnabled = vi.fn(async () => {});
    const unlockVault = vi.fn(async () => {}).mockRejectedValue(error);
    setWallet({
      vaultState: 'locked',
      autoLockEnabled: true,
      setAutoLockEnabled,
      unlockVault,
    });

    const { div, cleanup } = mount();

    try {
      const toggle = getSwitch(div);
      await act(async () => {
        toggle.click();
      });

      const password = 'wrong-password';
      const form = fillPassword(div, password);

      await act(async () => {
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });

      expect(setAutoLockEnabled).toHaveBeenCalledWith(false);
      expect(unlockVault).toHaveBeenCalledTimes(1);
      expect(unlockVault).toHaveBeenCalledWith(password);
      expect(div.textContent).toContain(error.message);
    } finally {
      cleanup();
    }
  });
});
