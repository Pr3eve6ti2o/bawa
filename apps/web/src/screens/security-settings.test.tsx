// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { SecuritySettingsScreen } from './security-settings';
import { useWallet } from '../state/wallet-context';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

vi.mock('../wallet/vault', () => ({
  deleteVault: vi.fn(),
}));

function setWallet(
  vaultState: string,
  extra: Partial<ReturnType<typeof useWallet>> = {},
): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState,
    autoLockEnabled: false,
    autoLockMinutes: 5,
    setAutoLockMinutes: vi.fn(),
    setAutoLockEnabled: vi.fn(async () => {}),
    unlockVault: vi.fn(async () => {}),
    refreshVaultAccounts: vi.fn(async () => {}),
    ...extra,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountScreen() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/security']}>
        <SecuritySettingsScreen />
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

describe('security settings screen', () => {
  it('describes the real vault, never the watch-only starter copy', async () => {
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('What this starter does not do');
      expect(text).not.toContain('UI state only');
      expect(text).not.toContain('watch-only starter does not create');
      expect(text).toContain('kept encrypted in the vault');
      expect(text).toContain('Sending funds is switched off');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the auto-lock setting instead of a stays-unlocked claim', async () => {
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Auto-lock is off');
      expect(text).not.toContain('Vault stays unlocked');
      expect(mounted.div.querySelector('select#auto-lock')).toBeNull();
    } finally {
      await mounted.cleanup();
    }

    setWallet('unlocked', { autoLockEnabled: true });
    const autoLockMounted = await mountScreen();
    try {
      const select = autoLockMounted.div.querySelector('select#auto-lock');
      expect(select).not.toBeNull();
      expect(select?.querySelectorAll('option')).toHaveLength(6);
      expect(autoLockMounted.div.textContent ?? '').toContain(
        'locks after 5 minutes without activity',
      );
    } finally {
      await autoLockMounted.cleanup();
    }
  });

  it('shows the auto-lock setting with a no-vault notice when there is no vault', async () => {
    // Merge resolution: Lane D2 left an empty mount point here and asserted
    // it stayed empty; Lane D0 mounts the real AutoLockSetting at this
    // point, which renders a no-vault notice instead of the off copy.
    setWallet('no-vault');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Auto-lock');
      expect(text).toContain('No vault yet');
      expect(text).not.toContain('Vault stays unlocked');
    } finally {
      await mounted.cleanup();
    }
  });

  it('requires two taps to delete a locked vault and refreshes accounts', async () => {
    const { deleteVault } = await import('../wallet/vault');
    vi.mocked(deleteVault).mockClear();
    const refreshVaultAccounts = vi.fn(async () => {});
    setWallet('locked', { refreshVaultAccounts });
    const { div, cleanup } = await mountScreen();

    try {
      expect(div.textContent).toContain('Delete vault');
      const firstButton = div.querySelector('button');
      const deleteButton =
        firstButton?.textContent === 'Delete vault'
          ? firstButton
          : Array.from(div.querySelectorAll('button')).find(
              (button) => button.textContent === 'Delete vault',
            );
      expect(deleteButton?.textContent).toBe('Delete vault');

      await act(async () => {
        deleteButton!.click();
      });

      expect(deleteButton?.textContent).toBe('Tap again to confirm delete');
      expect(deleteVault).not.toHaveBeenCalled();
      expect(refreshVaultAccounts).not.toHaveBeenCalled();

      await act(async () => {
        deleteButton!.click();
      });

      expect(deleteVault).toHaveBeenCalledTimes(1);
      expect(refreshVaultAccounts).toHaveBeenCalledTimes(1);
    } finally {
      await cleanup();
    }
  });

  it('lays out in two desktop columns with the reading panels spanning both', async () => {
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const section = mounted.div.querySelector('section') as HTMLElement;
      expect(section.className).toContain('lg:grid-cols-2');
      const heading = mounted.div.querySelector('#security-heading') as HTMLElement;
      expect(heading.className).toContain('lg:col-span-2');
      const intro = [...mounted.div.querySelectorAll('div')].find((el) =>
        el.textContent?.includes('What this wallet does'),
      ) as HTMLElement;
      expect(intro.className).toContain('lg:col-span-2');
      const backup = [...mounted.div.querySelectorAll('div')].find((el) =>
        el.textContent?.includes('Backup procedure') &&
        el.className.includes('rounded-xl'),
      ) as HTMLElement;
      expect(backup.className).toContain('lg:col-span-2');
    } finally {
      await mounted.cleanup();
    }
  });
});
