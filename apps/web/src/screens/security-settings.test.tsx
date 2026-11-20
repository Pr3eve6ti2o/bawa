// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { SecuritySettingsScreen } from './security-settings';
import { useWallet } from '../state/wallet-context';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
  AUTO_LOCK_OPTIONS: [0, 1, 5, 15, 60, 1440] as const,
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function setWallet(
  vaultState: string,
  lockVault: () => void,
  autoLockMinutes = 5,
  setAutoLockMinutes: (minutes: number) => void = vi.fn(),
): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState,
    lockVault,
    autoLockMinutes,
    setAutoLockMinutes,
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
    setWallet('locked', vi.fn());
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

  it('links to /lock when the vault is locked', async () => {
    setWallet('locked', vi.fn());
    const mounted = await mountScreen();
    try {
      const link = mounted.div.querySelector(
        'a[href="/lock"]',
      ) as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.textContent).toBe('Unlock');
      expect(mounted.div.textContent).toContain('Vault locked');
    } finally {
      await mounted.cleanup();
    }
  });

  it('locks the vault when unlocked', async () => {
    const lockVault = vi.fn();
    setWallet('unlocked', lockVault);
    const mounted = await mountScreen();
    try {
      const button = [...mounted.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Lock vault',
      ) as HTMLButtonElement;
      expect(button).not.toBeUndefined();
      await act(async () => {
        button.click();
      });
      expect(lockVault).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the auto-lock selector with the current preference', async () => {
    // Lane C (spec §9): auto-lock lives in Security settings.
    setWallet('unlocked', vi.fn());
    const mounted = await mountScreen();
    try {
      const select = mounted.div.querySelector(
        '#auto-lock',
      ) as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('5');
      const labels = [...select.querySelectorAll('option')].map(
        (option) => option.textContent,
      );
      expect(labels).toEqual([
        'Immediately',
        '1 minute',
        '5 minutes',
        '15 minutes',
        '1 hour',
        '1 day',
      ]);
      expect(mounted.div.textContent).toContain(
        'The vault locks after this long without activity.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('calls setAutoLockMinutes when the selector changes', async () => {
    const setAutoLockMinutes = vi.fn();
    setWallet('unlocked', vi.fn(), 5, setAutoLockMinutes);
    const mounted = await mountScreen();
    try {
      const select = mounted.div.querySelector(
        '#auto-lock',
      ) as HTMLSelectElement;
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value',
        )?.set;
        setter?.call(select, '15');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(setAutoLockMinutes).toHaveBeenCalledWith(15);
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows Lock now only when the vault is unlocked', async () => {
    setWallet('locked', vi.fn());
    const locked = await mountScreen();
    try {
      const lockNow = [...locked.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Lock now',
      );
      expect(lockNow).toBeUndefined();
    } finally {
      await locked.cleanup();
    }
    setWallet('unlocked', vi.fn());
    const unlocked = await mountScreen();
    try {
      const lockNow = [...unlocked.div.querySelectorAll('button')].find(
        (candidate) => candidate.textContent === 'Lock now',
      );
      expect(lockNow).not.toBeUndefined();
    } finally {
      await unlocked.cleanup();
    }
  });

  it('says no vault yet when there is none', async () => {
    setWallet('no-vault', vi.fn());
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No vault yet');
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays out in two desktop columns with the reading panels spanning both', async () => {
    // Lane C: at lg the heading and the two reading panels span both
    // columns while the two locking cards sit side by side.
    setWallet('locked', vi.fn());
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
