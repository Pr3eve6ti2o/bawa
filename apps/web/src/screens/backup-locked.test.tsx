// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { BackupScreen } from './backup';
import { useWallet } from '../state/wallet-context';
import { checkBackupShares } from '../wallet/backup-shares';
import { createVault, deleteVault } from '../wallet/vault';

// S3-A (P1 item 8): the locked-vault states of the Backup screen's
// Shares tab. The screen is mounted directly (not via App) with the
// wallet context mocked to 'locked' — a locked state cannot be reached
// through an App mount without typing the password. The vault
// itself is real, so the screen's hasVault gate reads true.
vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
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

// Standard public BIP-39 test vector — disposable test data, never a real secret.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PASSWORD = 'correct horse battery staple';

// Clearly fake test shares — never real secrets, never generated from a
// real key; the mocked check function returns them verbatim.
const FAKE_SHARES = [
  'bawa-share-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'bawa-share-v1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
];

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
      <MemoryRouter initialEntries={['/mnemonic-backup?tab=shares']}>
        <BackupScreen />
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

describe('BackupScreen shares tab (locked vault)', () => {
  it('locked: offers unlock for creating, but checking stays available', async () => {
    localStorage.clear();
    deleteVault();
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, [
      'bawa-evm-bip44-v1',
    ]);
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
      localStorage.clear();
      deleteVault();
    }
  });

  it('locked: checking shares still proves they restore the vault', async () => {
    localStorage.clear();
    deleteVault();
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, [
      'bawa-evm-bip44-v1',
    ]);
    setWallet('locked');
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
    } finally {
      await mounted.cleanup();
      localStorage.clear();
      deleteVault();
    }
  });
});
