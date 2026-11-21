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

function setWallet(vaultState: string): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState,
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

  it('leaves an empty, clearly-marked mount point for the auto-lock setting', async () => {
    // Lane D2: the vault-lock card is gone; Lane D0 mounts its
    // AutoLockSetting component at this mount point at merge time.
    setWallet('unlocked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      const mount = mounted.div.querySelector('[data-d0-mount-point="auto-lock-setting"]');
      expect(mount).not.toBeNull();
      expect(mount?.textContent).toBe('');
      expect(text).not.toContain('Vault stays unlocked');
      expect(text).not.toContain('Vault lock');
      expect(text).not.toContain('Lock after inactivity');
      expect(text).not.toContain('Lock vault');
      expect(text).not.toContain('Lock now');
      expect(text).not.toContain('locks after');
      expect(mounted.div.querySelector('#auto-lock')).toBeNull();
      expect(mounted.div.querySelector('a[href="/lock"]')).toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the same mount point when there is no vault', async () => {
    setWallet('no-vault');
    const mounted = await mountScreen();
    try {
      expect(mounted.div.querySelector('[data-d0-mount-point="auto-lock-setting"]')).not.toBeNull();
      expect(mounted.div.textContent).not.toContain('No vault yet');
    } finally {
      await mounted.cleanup();
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
