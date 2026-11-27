// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';
import { createVault, deleteVault } from '../wallet/vault';
import { checkBackupShares, createBackupShares } from '../wallet/backup-shares';
import { TEST_VAULT_PROFILE_IDS } from '../state/test-helpers';

// S3-A (P1 item 8): one Backup screen — the Recovery phrase tab (the
// old /mnemonic-backup) and the Backup shares tab (the old
// /backup-shares) under /mnemonic-backup. /backup-shares redirects to
// /mnemonic-backup?tab=shares. The safety quiz is gone: the reveal is
// password-only. The shares engine is mocked (deterministic fake
// shares); the vault itself is real, so the password and key flows
// are exercised for real.
vi.mock('../wallet/backup-shares', () => ({
  BACKUP_SHARE_SCHEMES: [
    { total: 3, threshold: 2, label: '2 of 3' },
    { total: 5, threshold: 2, label: '2 of 5' },
    { total: 5, threshold: 3, label: '3 of 5' },
  ],
  checkBackupShares: vi.fn(),
  createBackupShares: vi.fn(),
}));

// jsdom has no matchMedia; the vendored theme toggle reads it on mount.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }) as unknown as MediaQueryList;
}

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// Standard public BIP-39 test vector — disposable test data, never a real secret.
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_PASSWORD = 'correct horse battery staple';

// A vault created with only the original four profiles (the
// layout-rebuild fixture): the screen must still list all seven
// profiles the wallet uses, marking the three missing ones as not
// stored with this vault.
const TEST_PROFILES = [
  'bawa-btc-bip84-v1',
  'bawa-evm-bip44-v1',
  'bawa-trx-bip44-v1',
  'bawa-ton-v4r2-v1',
];

// Every distinct derivation profile across all 84 supported chains —
// the same dedup the create and import flows store in the vault.
const ALL_PROFILES = [
  'bawa-btc-bip84-v1',
  'bawa-evm-bip44-v1',
  'bawa-trx-bip44-v1',
  'bawa-ton-v4r2-v1',
  'bawa-sol-bip44-v1',
  'bawa-ltc-bip84-v1',
  'bawa-doge-bip44-v1',
  'bawa-cosmos-bip44-v1',
  'bawa-osmosis-bip44-v1',
  'bawa-xrp-bip44-v1',
  'bawa-stellar-bip44-v1',
  'bawa-polkadot-bip44-v1',
  'bawa-near-bip44-v1',
  'bawa-aptos-bip44-v1',
  'bawa-tezos-bip44-v1',
  'bawa-algorand-bip44-v1',
  'bawa-hedera-bip44-v1',
  'bawa-injective-bip44-v1',
  'bawa-celestia-bip44-v1',
  'bawa-dydx-bip44-v1',
  'bawa-seicosmos-bip44-v1',
  'bawa-axelar-bip44-v1',
  'bawa-noble-bip44-v1',
  'bawa-juno-bip44-v1',
  'bawa-cardano-cip1852-v1',
  'bawa-kaspa-bip44-v1',
  'bawa-starknet-bip44-v1',
];

// Clearly fake test shares — never real secrets, never generated from a
// real key; the mocked create function returns them verbatim.
const FAKE_SHARES = [
  'bawa-share-v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'bawa-share-v1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  'bawa-share-v1:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
];

async function mountApp(path: string) {
  const previousUrl = window.location.href;
  const previousState = window.history.state;
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.pushState({}, '', path);
  await act(async () => {
    root.render(<App />);
  });
  // The backup screen is lazy-loaded: wait for the Suspense fallback to
  // clear before the tests assert on its content.
  await act(async () => {
    for (let i = 0; i < 40 && div.textContent?.includes('Loading…'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
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
        window.history.replaceState(previousState, '', previousUrl);
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
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

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no textarea value setter');
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButton(div: HTMLDivElement, text: string): HTMLButtonElement {
  const button = [...div.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return button as HTMLButtonElement;
}

async function waitForText(
  div: HTMLDivElement,
  text: string,
  attempts = 160,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (div.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  throw new Error(`timed out waiting for text: ${text}`);
}

async function openPasswordStage(
  div: HTMLDivElement,
): Promise<HTMLInputElement> {
  await act(async () => {
    findButton(div, 'Reveal recovery phrase').click();
  });
  const password = div.querySelector(
    '#reveal-password',
  ) as HTMLInputElement;
  expect(password).not.toBeNull();
  return password;
}

async function verifyPassword(
  div: HTMLDivElement,
  value: string,
): Promise<void> {
  const password = div.querySelector(
    '#reveal-password',
  ) as HTMLInputElement;
  await act(async () => {
    setInputValue(password, value);
  });
  await act(async () => {
    findButton(div, 'Verify password').click();
  });
}

function phrasePanel(div: HTMLDivElement): Element {
  const panel = div.querySelector('[role="tabpanel"]');
  expect(panel).not.toBeNull();
  return panel?.firstElementChild as Element;
}

describe.sequential('BackupScreen (S3-A: one screen, two tabs)', () => {
  beforeEach(() => {
    localStorage.clear();
    deleteVault();
    vi.mocked(createBackupShares).mockReset();
    vi.mocked(checkBackupShares).mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    deleteVault();
  });

  it('shares one empty state without a vault, with no tabs', async () => {
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      expect(div.textContent).toContain('No vault wallet here');
      expect(div.textContent).toContain('nothing to back up');
      expect(div.textContent).toContain('Create a wallet');
      expect(div.querySelector('[role="tablist"]')).toBeNull();
      expect(div.textContent).not.toContain('Recovery profiles');
      expect(div.textContent).not.toContain('Reveal recovery phrase');
    } finally {
      await cleanup();
    }
  });

  it('lists the stored recovery profiles with a vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      expect(div.textContent).toContain('Recovery profiles');
      for (const profileId of TEST_VAULT_PROFILE_IDS) {
        expect(div.textContent).toContain(profileId);
      }
      // The per-row note (Lane D row 153 shortened the disclosure
      // intro to one line, so the old intro clause is gone by design).
      expect(div.textContent).toContain(
        'Restoring with this profile would recover different addresses',
      );
      expect(div.textContent).toContain('Back up the profile names with the words.');
      expect(div.textContent).toContain('Words written on paper');
      expect(div.textContent).toContain('Never photographed');
      // UX-major Lane 5: the backup reads as one ordered path, with a
      // testable recovery step (restore in a fresh profile).
      expect(div.textContent).toContain('Confirm your vault password.');
      // S3-A: the quiz step is gone.
      expect(div.textContent).not.toContain('Answer three safety questions.');
      expect(div.textContent).toContain('Test recovery before you need it');
    } finally {
      await cleanup();
    }
  });

  it('keeps the backup guidance as one compact list, not the same facts twice', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      const text = div.textContent ?? '';
      expect(text).toContain('Words written on paper');
      expect(text).toContain('Never photographed');
      expect(text).toContain(
        "Reminders, not proof — the app can't verify them.",
      );
      // The long bulleted list said the same four facts as the compact
      // list; it is deleted, not shortened.
      expect(text).not.toContain(
        'The 24 words you wrote down when the wallet was created',
      );
      expect(text).not.toContain('Guidance. Not verified by this app.');
    } finally {
      await cleanup();
    }
  });

  it('lays the phrase tab in two columns on desktop widths, keeping profiles and guidance as single-column stacks', async () => {
    // Desktop layout (desktop-layout-v2): the phrase tab lays out in
    // two columns at lg. The recovery profiles and guidance checklist
    // stay single-column divide-y stacks — gridding them would break
    // their dividers — so only the tab panel root is a grid. Below lg
    // the blocks stack in one column (space-y-4), so the mobile layout
    // is untouched.
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      const root = phrasePanel(div);
      expect(root?.className).toContain('space-y-4');
      expect(root?.className).toContain('lg:grid');
      expect(root?.className).toContain('lg:grid-cols-2');
      expect(root?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
      const intro = [...root?.querySelectorAll('div[data-slot="card"]') ?? []].find((el) =>
        el.textContent?.includes('Recovery phrase'),
      ) as HTMLElement | undefined;
      expect(intro).not.toBeUndefined();
      expect(intro?.className).toContain('lg:col-span-2');
      const profiles = div.querySelector('[aria-labelledby="backup-profiles"]');
      const list = profiles?.querySelector('ul');
      expect(list).not.toBeNull();
      expect(list?.className).toContain('divide-y');
      expect(list?.className).not.toContain('lg:grid');
      const guidance = div.querySelector('[aria-label="Backup guidance"]');
      const guideList = [...(guidance?.querySelectorAll('ul') ?? [])].find((el) =>
        el.className.includes('divide-y'),
      );
      expect(guideList).not.toBeUndefined();
      expect(guideList?.className).toContain('divide-y');
      expect(guideList?.className).not.toContain('lg:grid-cols-2');
    } finally {
      await cleanup();
    }
  });

  it('hides the reveal section without a vault', async () => {
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      expect(div.textContent).not.toContain('Reveal recovery phrase');
    } finally {
      await cleanup();
    }
  });

  it('shows every distinct recovery profile, with the EVM chains collapsed to one Ethereum row', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      const text = div.textContent ?? '';
      // The fifty-nine EVM chains share one profile, so Ethereum appears once.
      expect((text.match(/Ethereum/g) ?? []).length).toBe(1);
      // Solana, Litecoin and Dogecoin have their own profiles: they get
      // their own rows. A vault created with only the original four
      // profiles honestly marks them as not stored with this vault.
      expect(text).toContain('Solana');
      expect(text).toContain('Litecoin');
      expect(text).toContain('Dogecoin');
      expect(text).toContain('bawa-sol-bip44-v1');
      expect(text).toContain('bawa-ltc-bip84-v1');
      expect(text).toContain('bawa-doge-bip44-v1');
      const profiles = div.querySelector('[aria-labelledby="backup-profiles"]');
      expect(profiles?.querySelectorAll('li').length).toBe(27);
    } finally {
      await cleanup();
    }
  });

  it('marks all twenty-seven profiles stored for a vault created with them', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, ALL_PROFILES);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      const text = div.textContent ?? '';
      for (const profileId of ALL_PROFILES) {
        expect(text).toContain(profileId);
      }
      expect(text).not.toContain('Not stored with this vault');
      const profiles = div.querySelector('[aria-labelledby="backup-profiles"]');
      expect(profiles?.querySelectorAll('li').length).toBe(27);
    } finally {
      await cleanup();
    }
  });

  it('requires the password before the phrase, and has no quiz', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      expect(div.textContent).toContain('Reveal recovery phrase');
      expect(div.textContent).not.toContain('Vault password');
      await openPasswordStage(div);
      expect(div.textContent).toContain('Vault password');
      expect(div.textContent).not.toContain('abandon');
      await verifyPassword(div, 'wrong password');
      await waitForText(div, 'Incorrect password.');
      expect(div.textContent).not.toContain('abandon');
      // The quiz is gone entirely: no question, no Show button gating.
      expect(div.textContent).not.toContain('Answer all three questions');
      expect(div.textContent).not.toContain('Show recovery phrase');
      expect(div.textContent).not.toContain('If someone else learns your 24 words');
    } finally {
      await cleanup();
    }
  });

  // Password verification runs a 600k-iteration PBKDF2 trial decrypt,
  // which can take several seconds while the full suite runs in parallel
  // workers.
  it('reveals on the password alone, marks the wallet backed up, and hides cleanly', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      expect(div.textContent).not.toContain('Backed up');
      await openPasswordStage(div);
      await verifyPassword(div, TEST_PASSWORD);
      await waitForText(div, 'Hide recovery phrase');
      expect(div.textContent).toContain('abandon');
      expect(div.textContent).toContain('about');
      // Revealing marks the wallet backed up.
      expect(div.textContent).toContain('Backed up');
      // The revealed phrase can be copied whole (same CopyButton as
      // the create flow).
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      // P3-A (style B): the Copy-all button reads "Copy all 24 words".
      await act(async () => {
        findButton(div, 'Copy all 24 words').click();
      });
      await waitForText(div, 'Copied');
      expect(writeText).toHaveBeenCalledWith(TEST_MNEMONIC);

      // Hiding clears the phrase from the screen.
      await act(async () => {
        findButton(div, 'Hide recovery phrase').click();
      });
      expect(div.textContent).not.toContain('abandon');
      expect(div.textContent).toContain('Reveal recovery phrase');
      // The backed-up state stays: hiding is not un-backing-up.
      expect(div.textContent).toContain('Backed up');
    } finally {
      await cleanup();
    }
  }, 30000);

  // Password verification runs a 600k-iteration PBKDF2 trial decrypt,
  // which can take several seconds while the full suite runs in parallel
  // workers.
  it('shows the revealed words three across on desktop widths', async () => {
    // P3-A (style B): the revealed 24-word grid is three across at
    // desktop, not four. Four across squeezed 8-letter words to an
    // ellipsis in this half-width column ("indica…", CDP-verified at
    // 1280px) — a recovery word must never be visually cut. Below lg
    // it stays two across, then three at sm.
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      await openPasswordStage(div);
      await verifyPassword(div, TEST_PASSWORD);
      await waitForText(div, 'Hide recovery phrase');
      const words = [...div.querySelectorAll('ol')].find((el) =>
        el.textContent?.includes('abandon'),
      );
      expect(words?.className).not.toContain('lg:grid-cols-4');
      expect(words?.className).toContain('sm:grid-cols-3');
      expect(words?.className).toContain('grid-cols-2');
    } finally {
      await cleanup();
    }
  }, 30000);

  it('switches tabs, keeps the choice in the URL, and lands deep links on the right tab', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup');
    try {
      const phraseTab = div.querySelector(
        '#backup-phrase-tab',
      ) as HTMLButtonElement;
      const sharesTab = div.querySelector(
        '#backup-shares-tab',
      ) as HTMLButtonElement;
      expect(phraseTab?.getAttribute('aria-selected')).toBe('true');
      expect(sharesTab?.getAttribute('aria-selected')).toBe('false');
      expect(div.textContent).toContain('Reveal recovery phrase');
      expect(div.textContent).not.toContain('Create shares');
      await act(async () => {
        sharesTab.click();
      });
      expect(sharesTab.getAttribute('aria-selected')).toBe('true');
      expect(phraseTab.getAttribute('aria-selected')).toBe('false');
      expect(div.textContent).toContain('Create shares');
      expect(div.textContent).toContain('Check shares');
      expect(div.textContent).not.toContain('Reveal recovery phrase');
      expect(window.location.search).toBe('?tab=shares');
      await act(async () => {
        phraseTab.click();
      });
      expect(div.textContent).toContain('Reveal recovery phrase');
      expect(window.location.search).toBe('');
    } finally {
      await cleanup();
    }
  });

  it('opens the shares tab from ?tab=shares', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup?tab=shares');
    try {
      const sharesTab = div.querySelector(
        '#backup-shares-tab',
      ) as HTMLButtonElement;
      expect(sharesTab?.getAttribute('aria-selected')).toBe('true');
      expect(div.textContent).toContain('Create shares');
      expect(div.textContent).toContain('Check shares');
    } finally {
      await cleanup();
    }
  });

  it('redirects the old /backup-shares route to the shares tab', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/backup-shares');
    try {
      await waitForText(div, 'Create shares');
      expect(window.location.pathname).toBe('/mnemonic-backup');
      expect(window.location.search).toBe('?tab=shares');
      const sharesTab = div.querySelector(
        '#backup-shares-tab',
      ) as HTMLButtonElement;
      expect(sharesTab?.getAttribute('aria-selected')).toBe('true');
    } finally {
      await cleanup();
    }
  });

  it('shares tab states the chosen scheme in the header, not always 2 of 3', async () => {
    // UX-major Lane 5: the intro used to say 'Any 2 of 3 shares restore
    // this vault' even after the user picked 3 of 5. The header now
    // follows the selected scheme.
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountApp('/mnemonic-backup?tab=shares');
    try {
      expect(div.textContent).toContain('Any 2 of 3 shares restore');
      const radio = div.querySelector(
        'input[value="3 of 5"]',
      ) as HTMLInputElement | null;
      expect(radio).not.toBeNull();
      await act(async () => {
        radio!.click();
      });
      expect(div.textContent).toContain('Any 3 of 5 shares restore');
      expect(div.textContent).not.toContain('Any 2 of 3 shares restore');
    } finally {
      await cleanup();
    }
  });

  it('shares tab: creates shares, shows each with a QR and a copy button, and defaults the check to the created scheme', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    vi.mocked(createBackupShares).mockResolvedValue([...FAKE_SHARES]);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { div, cleanup } = await mountApp('/mnemonic-backup?tab=shares');
    try {
      expect(div.textContent).toContain('2 of 3');
      // Create a 3-of-5 set, so the check form must default to 3.
      const radio = div.querySelector(
        'input[value="3 of 5"]',
      ) as HTMLInputElement | null;
      expect(radio).not.toBeNull();
      await act(async () => {
        radio!.click();
      });
      await act(async () => {
        findButton(div, 'Create backup shares').click();
      });
      await waitForText(div, 'Share 1 of 3');
      expect(div.textContent).toContain('Share 3 of 3');
      // One QR svg per share (counted inside the shares list only —
      // the app header and bottom nav carry their own icons).
      const sharesList = [...div.querySelectorAll('ol')].find((el) =>
        el.textContent?.includes('Share 1 of 3'),
      );
      expect(sharesList?.querySelectorAll('svg').length).toBe(3);
      const shown = [...div.querySelectorAll('textarea')]
        .filter((area) => area.id.startsWith('backup-share-'))
        .map((area) => (area as HTMLTextAreaElement).value);
      expect(shown).toEqual(FAKE_SHARES);
      // Creating a set marks the wallet backed up.
      expect(div.textContent).toContain('Backed up');
      // The check form follows the created scheme: 3 shares needed,
      // 3 paste boxes.
      const threshold = div.querySelector(
        '#check-threshold',
      ) as HTMLSelectElement;
      expect(threshold?.value).toBe('3');
      const checkBoxes = [...div.querySelectorAll('textarea')].filter(
        (area) => area.id.startsWith('check-share-'),
      );
      expect(checkBoxes).toHaveLength(3);

      await act(async () => {
        findButton(div, 'Copy share 1').click();
      });
      await waitForText(div, 'Copied');
      expect(writeText).toHaveBeenCalledWith(FAKE_SHARES[0]);

      await act(async () => {
        findButton(div, 'Hide shares').click();
      });
      expect(div.textContent).not.toContain('Share 1 of 3');
    } finally {
      await cleanup();
    }
  });

  it('shares tab: a failed creation shows the error', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    vi.mocked(createBackupShares).mockRejectedValue(
      new Error('Share creation failed.'),
    );
    const { div, cleanup } = await mountApp('/mnemonic-backup?tab=shares');
    try {
      await act(async () => {
        findButton(div, 'Create backup shares').click();
      });
      await waitForText(div, 'Share creation failed.');
    } finally {
      await cleanup();
    }
  });

  it('shares tab: check flow reports success and failure plainly', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    vi.mocked(checkBackupShares).mockResolvedValue({ ok: true });
    const { div, cleanup } = await mountApp('/mnemonic-backup?tab=shares');
    try {
      const boxes = [...div.querySelectorAll('textarea')].filter(
        (area) => area.id.startsWith('check-share-'),
      ) as HTMLTextAreaElement[];
      expect(boxes).toHaveLength(2);
      await act(async () => {
        setTextareaValue(boxes[0] as HTMLTextAreaElement, FAKE_SHARES[0] as string);
        setTextareaValue(boxes[1] as HTMLTextAreaElement, FAKE_SHARES[1] as string);
      });
      await act(async () => {
        findButton(div, 'Check shares').click();
      });
      await waitForText(div, 'These shares restore this vault.');
      expect(vi.mocked(checkBackupShares)).toHaveBeenCalledWith(
        [FAKE_SHARES[0], FAKE_SHARES[1]],
        2,
      );

      vi.mocked(checkBackupShares).mockResolvedValue({
        ok: false,
        reason: 'These shares did not restore this vault.',
      });
      await act(async () => {
        findButton(div, 'Check shares').click();
      });
      await waitForText(
        div,
        'These shares did not restore this vault.',
      );
    } finally {
      await cleanup();
    }
  });
});
