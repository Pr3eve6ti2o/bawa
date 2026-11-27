// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from '../app/app';
import { createVault, deleteVault } from '../wallet/vault';
import { TEST_VAULT_PROFILE_IDS } from '../state/test-helpers';

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

async function mountBackupScreen() {
  const previousUrl = window.location.href;
  const previousState = window.history.state;
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.pushState({}, '', '/mnemonic-backup');
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

describe.sequential('MnemonicBackupScreen (Phase 1.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    deleteVault();
  });

  afterEach(() => {
    localStorage.clear();
    deleteVault();
  });

  it('states there is nothing to back up without a vault', async () => {
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('nothing to back up');
      expect(div.textContent).not.toContain('Recovery profiles');
    } finally {
      await cleanup();
    }
  });

  it('lists the stored recovery profiles with a vault', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('Recovery profiles');
      for (const profileId of TEST_VAULT_PROFILE_IDS) {
        expect(div.textContent).toContain(profileId);
      }
      expect(div.textContent).toContain(
        'Restoring with a different profile recovers different addresses',
      );
      expect(div.textContent).toContain(
        'An extended public key alone cannot recover spending access',
      );
      expect(div.textContent).toContain('Words written on paper');
      expect(div.textContent).toContain('Never photographed');
      // UX-major Lane 5: the backup reads as one ordered path, with a
      // testable recovery step (restore in a fresh profile).
      expect(div.textContent).toContain('Confirm your vault password.');
      expect(div.textContent).toContain('Answer three safety questions.');
      expect(div.textContent).toContain('Test recovery before you need it');
    } finally {
      await cleanup();
    }
  });

  it('keeps the backup guidance as one compact list, not four repeated cards', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      const text = div.textContent ?? '';
      expect(text).toContain('Words written on paper');
      expect(text).toContain('Never photographed');
      expect(text).toContain(
        'These are reminders, not proof that the steps are done.',
      );
      // The "not verified" note is said once in the section intro, not
      // repeated under every item.
      expect(text).not.toContain('Guidance. Not verified by this app.');
    } finally {
      await cleanup();
    }
  });

  it('lays the screen in two columns on desktop widths, keeping profiles and guidance as single-column stacks', async () => {
    // Desktop layout (desktop-layout-v2): the screen lays out in two
    // columns at lg. The recovery profiles and guidance checklist stay
    // single-column divide-y stacks — gridding them would break their
    // dividers — so only the screen root is a grid. Below lg the
    // blocks stack in one column (space-y-4), so the mobile layout is
    // untouched.
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      const main = div.querySelector('main');
      expect(main).not.toBeNull();
      const outlet = main?.children[0] as Element | undefined;
      const root = outlet?.children[0] as Element | undefined;
      expect(root?.className).toContain('lg:grid');
      expect(root?.className).toContain('lg:grid-cols-2');
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
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).not.toContain('Reveal recovery phrase');
    } finally {
      await cleanup();
    }
  });

  it('shows every distinct recovery profile, with the EVM chains collapsed to one Ethereum row', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const { div, cleanup } = await mountBackupScreen();
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
    const { div, cleanup } = await mountBackupScreen();
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

  it('requires the password before the quiz or the phrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      expect(div.textContent).toContain('Reveal recovery phrase');
      expect(div.textContent).not.toContain('Vault password');
      await openPasswordStage(div);
      expect(div.textContent).toContain('Vault password');
      expect(div.textContent).not.toContain('abandon');
      await verifyPassword(div, 'wrong password');
      await waitForText(div, 'Incorrect password.');
      expect(div.textContent).not.toContain(
        'Answer all three questions correctly',
      );
      expect(div.textContent).not.toContain('abandon');
    } finally {
      await cleanup();
    }
  });

  // Password verification runs a 600k-iteration PBKDF2 trial decrypt,
  // which can take several seconds while the full suite runs in parallel
  // workers.
  it('reveals only after the password and all three quiz answers', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      await openPasswordStage(div);
      await verifyPassword(div, TEST_PASSWORD);
      await waitForText(div, 'Answer all three questions correctly');
      expect(div.textContent).not.toContain('abandon');

      // A wrong answer marks the question and does not enable the reveal.
      await act(async () => {
        findButton(div, 'Only see your balances').click();
      });
      await waitForText(div, 'Not quite — try again.');
      expect(
        findButton(div, 'Show recovery phrase').disabled,
      ).toBe(true);

      // All three correct answers enable the reveal.
      await act(async () => {
        findButton(div, 'Spend from this wallet').click();
        findButton(div, 'On paper, stored offline').click();
        findButton(div, 'Paste them into any app or website').click();
      });
      expect(findButton(div, 'Show recovery phrase').disabled).toBe(false);
      await act(async () => {
        findButton(div, 'Show recovery phrase').click();
      });
      await waitForText(div, 'Hide recovery phrase');
      expect(div.textContent).toContain('abandon');
      expect(div.textContent).toContain('about');

      // Hiding clears the phrase from the screen.
      await act(async () => {
        findButton(div, 'Hide recovery phrase').click();
      });
      expect(div.textContent).not.toContain('abandon');
      expect(div.textContent).toContain('Reveal recovery phrase');
    } finally {
      await cleanup();
    }
  }, 30000);

  // Password verification runs a 600k-iteration PBKDF2 trial decrypt,
  // which can take several seconds while the full suite runs in parallel
  // workers.
  it('shows the revealed words four across on desktop widths', async () => {
    // Desktop layout (desktop-layout-v2): the revealed 24-word grid is
    // four across at lg (six rows) instead of three across at every
    // width. Below lg it stays two across, then three at sm.
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_VAULT_PROFILE_IDS);
    const { div, cleanup } = await mountBackupScreen();
    try {
      await openPasswordStage(div);
      await verifyPassword(div, TEST_PASSWORD);
      await waitForText(div, 'Answer all three questions correctly');
      await act(async () => {
        findButton(div, 'Spend from this wallet').click();
        findButton(div, 'On paper, stored offline').click();
        findButton(div, 'Paste them into any app or website').click();
      });
      await act(async () => {
        findButton(div, 'Show recovery phrase').click();
      });
      await waitForText(div, 'Hide recovery phrase');
      const words = [...div.querySelectorAll('ol')].find((el) =>
        el.textContent?.includes('abandon'),
      );
      expect(words?.className).toContain('lg:grid-cols-4');
      expect(words?.className).toContain('sm:grid-cols-3');
      expect(words?.className).toContain('grid-cols-2');
    } finally {
      await cleanup();
    }
  }, 30000);

  it('lays the intro, profiles and guidance in two columns on desktop widths', async () => {
    // Follow-up: the screen was wrapped in a centered 720px column,
    // which reads as a phone column on a 1440px main. The intro spans
    // both columns at lg, the profiles and guidance sit left and the
    // reveal section right, and the back link spans both. Below lg the
    // same blocks stack in one column in the same order (space-y-4,
    // no bare grid-cols-2), so the mobile layout is untouched. This
    // mounts with no vault, so only the always-visible blocks are
    // asserted here.
    const { div, cleanup } = await mountBackupScreen();
    try {
      const main = div.querySelector('main');
      expect(main).not.toBeNull();
      const outlet = main?.children[0] as Element | undefined;
      const root = outlet?.children[0] as Element | undefined;
      expect(root?.className).toContain('space-y-4');
      expect(root?.className).toContain('lg:grid');
      expect(root?.className).toContain('lg:grid-cols-2');
      expect(root?.className).not.toMatch(/(^|\s)grid-cols-2(\s|$)/);
      const intro = [...root?.querySelectorAll('div[data-slot="card"]') ?? []].find((el) =>
        el.textContent?.includes('Mnemonic backup'),
      ) as HTMLElement | undefined;
      expect(intro).not.toBeUndefined();
      expect(intro?.className).toContain('lg:col-span-2');
    } finally {
      await cleanup();
    }
  });
});
