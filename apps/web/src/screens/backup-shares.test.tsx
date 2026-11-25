// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { BackupSharesScreen } from './backup-shares';
import { useWallet } from '../state/wallet-context';
import { exportUnlockedKeyBytes } from '../wallet/vault';
import {
  checkBackupShares,
  createBackupShares,
} from '../wallet/backup-shares';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/vault', () => ({
  exportUnlockedKeyBytes: vi.fn(),
}));

vi.mock('../wallet/backup-shares', () => ({
  BACKUP_SHARE_SCHEMES: [
    { total: 3, threshold: 2, label: '2 of 3' },
    { total: 5, threshold: 2, label: '2 of 5' },
    { total: 5, threshold: 3, label: '3 of 5' },
  ],
  checkBackupShares: vi.fn(),
  createBackupShares: vi.fn(),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// Clearly fake test shares — never real secrets, never generated from a
// real key; the mocked create function returns them verbatim.
const FAKE_SHARES = [
  'bawa-share-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'bawa-share-v1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  'bawa-share-v1:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
];

it('states the chosen scheme in the header, not always 2 of 3', async () => {
  // UX-major Lane 5: the intro used to say 'Any 2 of 3 shares restore
  // this vault' even after the user picked 3 of 5. The header now
  // follows the selected scheme.
  setWallet('unlocked');
  const mounted = await mountScreen();
  try {
    expect(mounted.div.textContent).toContain('Any 2 of 3 shares restore');
    const radio = mounted.div.querySelector(
      'input[value="3 of 5"]',
    ) as HTMLInputElement | null;
    expect(radio).not.toBeNull();
    await act(async () => {
      radio!.click();
    });
    expect(mounted.div.textContent).toContain('Any 3 of 5 shares restore');
    expect(mounted.div.textContent).not.toContain('Any 2 of 3 shares restore');
  } finally {
    await mounted.cleanup();
  }
});

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
      <MemoryRouter initialEntries={['/backup-shares']}>
        <BackupSharesScreen />
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

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return button as HTMLButtonElement;
}

function setTextareaValue(
  textarea: HTMLTextAreaElement,
  value: string,
): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no textarea value setter');
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

async function waitForText(
  div: HTMLDivElement,
  text: string,
  attempts = 100,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (div.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error(`timed out waiting for text: ${text}`);
}

describe('backup shares screen', () => {
  it('shows the no-vault state with a create link', async () => {
    setWallet('no-vault');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('nothing to back up here');
      expect(text).toContain('Create a wallet');
      expect(text).not.toContain('Create backup shares');
      expect(text).not.toContain('Check shares');
    } finally {
      await mounted.cleanup();
    }
  });

  it('locked: offers unlock for creating, but checking stays available', async () => {
    setWallet('locked');
    const mounted = await mountScreen();
    try {
      const text = mounted.div.textContent ?? '';
      expect(text).toContain('Unlock the vault');
      expect(text).toContain('Check shares');
      expect(text).not.toContain('Shares to create');
      expect(text).not.toContain('Create backup shares');
    } finally {
      await mounted.cleanup();
    }
  });

  it('unlocked: creates shares, shows each with a QR and a copy button', async () => {
    setWallet('unlocked');
    vi.mocked(exportUnlockedKeyBytes).mockResolvedValue(
      new Uint8Array(32),
    );
    vi.mocked(createBackupShares).mockResolvedValue([...FAKE_SHARES]);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const mounted = await mountScreen();
    try {
      expect(mounted.div.textContent).toContain('2 of 3');
      await act(async () => {
        findButton(mounted.div, 'Create backup shares').click();
      });
      await waitForText(mounted.div, 'Share 1 of 3');
      expect(mounted.div.textContent).toContain('Share 3 of 3');
      // One QR svg per share.
      expect(mounted.div.querySelectorAll('svg').length).toBe(3);
      const shown = [...mounted.div.querySelectorAll('textarea')]
        .filter((area) => area.id.startsWith('backup-share-'))
        .map((area) => (area as HTMLTextAreaElement).value);
      expect(shown).toEqual(FAKE_SHARES);

      await act(async () => {
        findButton(mounted.div, 'Copy share 1').click();
      });
      await waitForText(mounted.div, 'Copied');
      expect(writeText).toHaveBeenCalledWith(FAKE_SHARES[0]);

      await act(async () => {
        findButton(mounted.div, 'Hide shares').click();
      });
      expect(mounted.div.textContent).not.toContain('Share 1 of 3');
    } finally {
      await mounted.cleanup();
    }
  });

  it('unlocked: a failed creation shows the error', async () => {
    setWallet('unlocked');
    vi.mocked(exportUnlockedKeyBytes).mockResolvedValue(
      new Uint8Array(32),
    );
    vi.mocked(createBackupShares).mockRejectedValue(
      new Error('Share creation failed.'),
    );
    const mounted = await mountScreen();
    try {
      await act(async () => {
        findButton(mounted.div, 'Create backup shares').click();
      });
      await waitForText(mounted.div, 'Share creation failed.');
    } finally {
      await mounted.cleanup();
    }
  });

  it('check flow reports success and failure plainly', async () => {
    setWallet('unlocked');
    vi.mocked(checkBackupShares).mockResolvedValue({ ok: true });
    const mounted = await mountScreen();
    try {
      const boxes = [...mounted.div.querySelectorAll('textarea')].filter(
        (area) => area.id.startsWith('check-share-'),
      ) as HTMLTextAreaElement[];
      expect(boxes).toHaveLength(2);
      await act(async () => {
        setTextareaValue(boxes[0] as HTMLTextAreaElement, FAKE_SHARES[0] as string);
        setTextareaValue(boxes[1] as HTMLTextAreaElement, FAKE_SHARES[1] as string);
      });
      await act(async () => {
        findButton(mounted.div, 'Check shares').click();
      });
      await waitForText(mounted.div, 'These shares restore this vault.');
      expect(vi.mocked(checkBackupShares)).toHaveBeenCalledWith(
        [FAKE_SHARES[0], FAKE_SHARES[1]],
        2,
      );

      vi.mocked(checkBackupShares).mockResolvedValue({
        ok: false,
        reason: 'These shares did not restore this vault.',
      });
      await act(async () => {
        findButton(mounted.div, 'Check shares').click();
      });
      await waitForText(
        mounted.div,
        'These shares did not restore this vault.',
      );
    } finally {
      await mounted.cleanup();
    }
  });
});
