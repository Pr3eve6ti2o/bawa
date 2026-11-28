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
    vaultHasPassword: true,
    autoLockEnabled: false,
    autoLockMinutes: 5,
    setAutoLockMinutes: vi.fn(),
    setAutoLockEnabled: vi.fn(async () => {}),
    lockVault: vi.fn(),
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

describe('AutoLockSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that off means unlocked until reload, with a password set', () => {
    setWallet();
    const { div, cleanup } = mount();

    try {
      // Password-only: off no longer means anyone can open it — the
      // vault still needs its password after a reload.
      expect(div.textContent).toContain(
        'Off — your wallet stays unlocked until you lock it or reload this page.',
      );
      expect(div.textContent).not.toContain(
        'Off — anyone with this device can open it.',
      );
    } finally {
      cleanup();
    }
  });

  it('is inert with no password: nothing to lock, switch disabled', () => {
    setWallet({ vaultHasPassword: false });
    const { div, cleanup } = mount();

    try {
      expect(div.textContent).toContain(
        'No password is set, so there is nothing to lock',
      );
      expect(div.textContent).toContain(
        'anyone with this device can open the wallet',
      );
      const toggle = getSwitch(div);
      expect((toggle as HTMLButtonElement).disabled).toBe(true);
      expect(div.textContent).not.toContain('Lock now');
      expect(div.querySelector('select#auto-lock')).toBeNull();
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
      expect(div.textContent).toContain('No vault yet.');
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

  it('disables auto-lock while locked with no password step', async () => {
    // Toggling is a preference flip only now: disabling while locked
    // used to ask for the password (to re-store the key). There is no
    // stored key any more, so the toggle just flips.
    const setAutoLockEnabled = vi.fn(async () => {});
    setWallet({
      vaultState: 'locked',
      autoLockEnabled: true,
      setAutoLockEnabled,
    });

    const { div, cleanup } = mount();

    try {
      expect(div.querySelector('input[type="password"]')).toBeNull();

      const toggle = getSwitch(div);
      await act(async () => {
        toggle.click();
      });

      expect(setAutoLockEnabled).toHaveBeenCalledTimes(1);
      expect(setAutoLockEnabled).toHaveBeenCalledWith(false);
      expect(div.querySelector('input[type="password"]')).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('shows the error text when toggling fails', async () => {
    const error = new Error('Storage unavailable');
    const setAutoLockEnabled = vi.fn(async () => {
      throw error;
    });
    setWallet({
      vaultState: 'unlocked',
      autoLockEnabled: false,
      setAutoLockEnabled,
    });

    const { div, cleanup } = mount();

    try {
      const toggle = getSwitch(div);
      await act(async () => {
        toggle.click();
      });

      expect(setAutoLockEnabled).toHaveBeenCalledWith(true);
      expect(div.textContent).toContain(error.message);
    } finally {
      cleanup();
    }
  });

  it('offers Lock now while unlocked and locks the vault when clicked', async () => {
    const wallet = setWallet();
    const { div, cleanup } = mount();

    try {
      const button = [...div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Lock now',
      );
      expect(button).not.toBeUndefined();

      await act(async () => {
        button!.click();
      });

      expect(wallet.lockVault).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('offers no Lock now button while locked, without a vault, or with no password', () => {
    for (const overrides of [
      { vaultState: 'locked' },
      { vaultState: 'no-vault' },
      { vaultState: 'unlocked', vaultHasPassword: false },
    ] as const) {
      setWallet(overrides);
      const { div, cleanup } = mount();

      try {
        expect(div.textContent).not.toContain('Lock now');
      } finally {
        cleanup();
      }
    }
  });
});
