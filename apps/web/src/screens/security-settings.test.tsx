// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { SecuritySettingsScreen } from './security-settings';
import { useWallet } from '../state/wallet-context';
import packageJson from '../../package.json';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

vi.mock('../wallet/vault', () => ({
  changePassword: vi.fn(),
  deleteVault: vi.fn(),
  verifyVaultPassword: vi.fn(),
}));

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function fillChangePasswordForm(
  div: HTMLDivElement,
  current: string,
  next: string,
  confirm: string,
): Promise<void> {
  const currentInput = div.querySelector(
    '#change-current-password',
  ) as HTMLInputElement;
  const newInput = div.querySelector(
    '#change-new-password',
  ) as HTMLInputElement;
  const confirmInput = div.querySelector(
    '#change-confirm-password',
  ) as HTMLInputElement;
  expect(currentInput).not.toBeNull();
  expect(newInput).not.toBeNull();
  expect(confirmInput).not.toBeNull();
  await act(async () => {
    setInputValue(currentInput, current);
    setInputValue(newInput, next);
    setInputValue(confirmInput, confirm);
  });
}

async function submitChangePassword(div: HTMLDivElement): Promise<void> {
  const button = Array.from(div.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === 'Change password',
  );
  expect(button).not.toBeUndefined();
  await act(async () => {
    button!.click();
  });
}

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
  it('keeps the safety facts in one short line, without the essay', async () => {
    // P1 (S3-B, item 9 — F34): "What this wallet does" is folded into
    // one line, not a four-bullet essay. The facts stay — the essay
    // lived only here (P0 cut it from Welcome), so deleting it outright
    // would leave the app saying nothing about keys staying on-device.
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('What this wallet does');
      expect(text).not.toContain('What this starter does not do');
      expect(text).not.toContain('UI state only');
      expect(text).not.toContain('watch-only starter does not create');
      expect(text).not.toContain('kept encrypted in the vault');
      expect(text).toContain('Your phrase stays encrypted on this device');
      expect(text).toContain('Sending is off until approved');
      expect(text).toContain('Offline signing only');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the auto-lock setting instead of a stays-unlocked claim', async () => {
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      // Lane X (Lane D #129): the embedded AutoLockSetting now reads
      // "Off — anyone with this device can open it."
      expect(text).toContain('Off — anyone with this device can open it.');
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
      await mounted.cleanup();
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
      const deleteButton = Array.from(div.querySelectorAll('button')).find(
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

  it('shows no Delete vault row when there is no vault', async () => {
    setWallet('no-vault');
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent ?? '').not.toContain('Delete vault');
    } finally {
      await mounted.cleanup();
    }
  });

  it('is one flat list: backup + Networks link rows, no Wallets/Networks link-cards', async () => {
    // P1 (S3-B, item 9 — F34): the two-column card grid is gone. One
    // single-column list; Backup, Backup shares and Networks are
    // one-line link rows; the Connected-wallets and Connections
    // link-cards are gone (the sidebar already links to Wallets and
    // Networks on desktop; the Networks row restores the mobile
    // path — Lane T2 T2-2).
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const section = mounted.div.querySelector('section') as HTMLElement;
      expect(section.className).not.toContain('lg:grid');
      expect(section.className).not.toContain('lg:grid-cols-2');
      expect(section.className).toContain('max-w-2xl');
      expect(mounted.div.innerHTML).not.toContain('lg:col-span-2');
      expect(mounted.div.querySelector('ul')).not.toBeNull();
      const backupLink = mounted.div.querySelector(
        'a[href="/mnemonic-backup"]',
      ) as HTMLAnchorElement | null;
      expect(backupLink).not.toBeNull();
      expect(backupLink?.textContent).toContain('Mnemonic backup');
      const sharesLink = mounted.div.querySelector(
        'a[href="/backup-shares"]',
      ) as HTMLAnchorElement | null;
      expect(sharesLink).not.toBeNull();
      expect(sharesLink?.textContent).toContain('Backup shares');
      const networksLink = mounted.div.querySelector(
        'a[href="/networks"]',
      ) as HTMLAnchorElement | null;
      expect(networksLink).not.toBeNull();
      expect(networksLink?.textContent).toContain('Networks');
      const text = mounted.div.textContent ?? '';
      expect(text).not.toContain('Open Wallets');
      expect(text).not.toContain('Open Networks');
      expect(text).not.toContain('Connected wallets');
      expect(text).not.toContain('live on the Networks screen');
      expect(text).not.toContain('RPC endpoints');
      expect(text).not.toContain('Use backup');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows WalletConnect as one greyed row, not a setup manual', async () => {
    // P1 (S3-B, item 9 — F34): the WalletConnect card (developer setup
    // instructions, VITE_WALLETCONNECT_PROJECT_ID, "restore files from
    // git history") is one greyed row. No link — there is no in-app
    // guide route to link to.
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('WalletConnect');
      expect(text).toContain('Not set up');
      expect(text).not.toContain('not available in this build');
      expect(text).not.toContain('Reown Cloud project ID');
      expect(text).not.toContain('cloud.reown.com');
      expect(text).not.toContain('VITE_WALLETCONNECT_PROJECT_ID');
      expect(text).not.toContain('restore the WalletConnect files');
      const walletConnectLink = [...mounted.div.querySelectorAll('a')].find(
        (anchor) => anchor.textContent?.includes('WalletConnect'),
      );
      expect(walletConnectLink).toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the app version as one line under the list', async () => {
    // P1 (S3-B, item 9 — F34): the About card is gone; the version
    // line stays, as one muted line under the list.
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      // The version line is a hardcoded string in the screen; it must
      // match package.json, or this fails on the next bump.
      expect(text).toContain(`Version ${packageJson.version}`);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the Change password form when a vault exists, and hides it with no vault', async () => {
    // Lane E item 1e (broken): no change-password control existed
    // anywhere in the app. The form is a row in the same flat list.
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      expect(
        mounted.div.querySelector('#change-current-password'),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector('#change-new-password'),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector('#change-confirm-password'),
      ).not.toBeNull();
      expect(mounted.div.textContent ?? '').toContain('Change password');
      expect(mounted.div.textContent ?? '').toContain(
        'The old password stops working.',
      );
    } finally {
      await mounted.cleanup();
    }

    setWallet('no-vault');
    const noVault = await mountScreen();
    try {
      expect(noVault.div.textContent ?? '').not.toContain('Change password');
    } finally {
      await noVault.cleanup();
    }
  });

  it('rejects a wrong current password and never calls changePassword', async () => {
    const { changePassword, verifyVaultPassword } = await import(
      '../wallet/vault'
    );
    vi.mocked(verifyVaultPassword).mockReset();
    vi.mocked(verifyVaultPassword).mockResolvedValue(false);
    vi.mocked(changePassword).mockClear();
    setWallet('unlocked');
    const { div, cleanup } = await mountScreen();
    try {
      await fillChangePasswordForm(div, 'wrong password', 'new password here', 'new password here');
      await submitChangePassword(div);
      expect(div.textContent ?? '').toContain('Incorrect password.');
      expect(changePassword).not.toHaveBeenCalled();
      // The wrong current password is cleared; the new password stays
      // so the user only retypes the one that was wrong.
      expect(
        (div.querySelector('#change-current-password') as HTMLInputElement)
          .value,
      ).toBe('');
    } finally {
      await cleanup();
    }
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const { changePassword, verifyVaultPassword } = await import(
      '../wallet/vault'
    );
    vi.mocked(verifyVaultPassword).mockReset();
    vi.mocked(verifyVaultPassword).mockResolvedValue(true);
    vi.mocked(changePassword).mockClear();
    setWallet('unlocked');
    const { div, cleanup } = await mountScreen();
    try {
      await fillChangePasswordForm(div, 'old password', 'short', 'short');
      await submitChangePassword(div);
      expect(div.textContent ?? '').toContain(
        'Vault password must be at least 8 characters.',
      );
      expect(changePassword).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  it('rejects mismatched new passwords', async () => {
    const { changePassword, verifyVaultPassword } = await import(
      '../wallet/vault'
    );
    vi.mocked(verifyVaultPassword).mockReset();
    vi.mocked(verifyVaultPassword).mockResolvedValue(true);
    vi.mocked(changePassword).mockClear();
    setWallet('unlocked');
    const { div, cleanup } = await mountScreen();
    try {
      await fillChangePasswordForm(
        div,
        'old password',
        'new password here',
        'different password',
      );
      await submitChangePassword(div);
      expect(div.textContent ?? '').toContain('New passwords do not match.');
      expect(changePassword).not.toHaveBeenCalled();
    } finally {
      await cleanup();
    }
  });

  it('changes the password and reports success', async () => {
    const { changePassword, verifyVaultPassword } = await import(
      '../wallet/vault'
    );
    vi.mocked(verifyVaultPassword).mockReset();
    vi.mocked(verifyVaultPassword).mockResolvedValue(true);
    vi.mocked(changePassword).mockReset();
    vi.mocked(changePassword).mockResolvedValue(undefined);
    setWallet('unlocked');
    const { div, cleanup } = await mountScreen();
    try {
      await fillChangePasswordForm(div, 'old password', 'new password here', 'new password here');
      await submitChangePassword(div);
      expect(verifyVaultPassword).toHaveBeenCalledWith('old password');
      expect(changePassword).toHaveBeenCalledWith('new password here');
      expect(changePassword).toHaveBeenCalledTimes(1);
      expect(div.textContent ?? '').toContain('Password changed.');
      expect(
        (div.querySelector('#change-current-password') as HTMLInputElement)
          .value,
      ).toBe('');
      expect(
        (div.querySelector('#change-new-password') as HTMLInputElement).value,
      ).toBe('');
      expect(
        (div.querySelector('#change-confirm-password') as HTMLInputElement)
          .value,
      ).toBe('');
    } finally {
      await cleanup();
    }
  });

  it('unlocks a locked vault with the current password before changing it', async () => {
    // changePassword needs the mnemonic in the closure, which a locked
    // vault does not have — so the current password unlocks it first.
    const { changePassword, verifyVaultPassword } = await import(
      '../wallet/vault'
    );
    vi.mocked(verifyVaultPassword).mockReset();
    vi.mocked(verifyVaultPassword).mockResolvedValue(true);
    vi.mocked(changePassword).mockReset();
    vi.mocked(changePassword).mockResolvedValue(undefined);
    const unlockVault = vi.fn(async () => {});
    setWallet('locked', { unlockVault });
    const { div, cleanup } = await mountScreen();
    try {
      await fillChangePasswordForm(div, 'old password', 'new password here', 'new password here');
      await submitChangePassword(div);
      expect(unlockVault).toHaveBeenCalledWith('old password');
      expect(changePassword).toHaveBeenCalledWith('new password here');
      expect(div.textContent ?? '').toContain('Password changed.');
    } finally {
      await cleanup();
    }
  });
});
