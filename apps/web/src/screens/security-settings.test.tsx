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

function setWallet(vaultState: string, lockVault: () => void): void {
  vi.mocked(useWallet).mockReturnValue({
    vaultState,
    lockVault,
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
      expect(text).toContain('stored encrypted in the vault');
      expect(text).toContain('Broadcast is disabled');
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

  it('says no vault yet when there is none', async () => {
    setWallet('no-vault', vi.fn());
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('No vault yet');
    } finally {
      await mounted.cleanup();
    }
  });
});
