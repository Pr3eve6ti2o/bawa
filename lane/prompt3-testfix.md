You are fixing one failing test in the Bawa web wallet. Worktree: /home/boxd/workspace/bawa-panel-rebuild/fix-landing (branch panel-rebuild/fix-landing, base commit 5638eea). You have NO file tools and cannot read files: return the COMPLETE new content of apps/web/src/app/app.test.tsx in your reply, as one code block, so the coordinator can write it to disk verbatim.

FAILURE (verified first-hand; full suite 347/348, only this test fails)
- Test "renders the locked dashboard when a vault is present" fails with Error: Vault is corrupted, thrown from readEnvelope in apps/web/src/wallet/vault.ts via vaultProfiles(), called by WalletProvider on mount (wallet-context line 480).
- Cause: readEnvelope THROWS on unparsable JSON. hasVault() catches that throw and returns true, but vaultProfiles() does not catch it, so seeding localStorage with the garbage string "corrupted-envelope-for-test" crashes the mount.
- readEnvelope only accepts a structurally valid envelope: version 1, kdf name PBKDF2 with string hash, number iterations, string saltB64, string ivB64, string ciphertextB64, profileIds an array of strings. A locked vault never decrypts, so the base64 fields are never decoded in this test; they only need to be strings.

FIX (only change in the file)
- In the "renders the locked dashboard when a vault is present" test, replace the seed line with a structurally valid envelope (dummy zero bytes, never decrypted, no real secret):
window.localStorage.setItem("bawa-vault", JSON.stringify({ version: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 600000, saltB64: "AAAAAAAAAAAAAAAAAAAAAA==" }, ivB64: "AAAAAAAAAAAAAAAA", ciphertextB64: "AAAAAAAAAAAAAAAAAAAAAA==", profileIds: [] }));
- Keep the try/finally cleanup (removeItem bawa-vault), the "Vault locked" assertion, the "Welcome to Bawa Web Wallet" absence assertion, and every other test exactly as they are. Do NOT change any other file.

CURRENT apps/web/src/app/app.test.tsx:
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { App } from './app';

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

async function withRenderedApp(
  path: string,
  assertions: (div: HTMLDivElement) => void,
): Promise<void> {
  const previousUrl = window.location.href;
  const previousState = window.history.state;
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;

  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);

  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    window.history.pushState({}, '', path);

    await act(async () => {
      root.render(<App />);
    });

    assertions(div);
  } finally {
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
  }
}

describe.sequential('App', () => {
  it('renders the wallet title and welcome screen without a vault', async () => {
    window.localStorage.removeItem('bawa-vault');

    await withRenderedApp('/', (div) => {
      expect(div.textContent).toContain('Bawa Web Wallet');
      expect(div.textContent).toContain('Welcome to Bawa Web Wallet');
      expect(div.textContent).toContain(
        'Mainnet only — this wallet never connects to a test network',
      );
      expect(div.textContent).not.toContain('No wallet yet');
    });
  });

  it('renders the locked dashboard when a vault is present', async () => {
    window.localStorage.setItem('bawa-vault', 'corrupted-envelope-for-test');

    try {
      await withRenderedApp('/', (div) => {
        expect(div.textContent).toContain(
          'Vault locked — your vault addresses are hidden until you unlock.',
        );
        expect(div.textContent).not.toContain('Welcome to Bawa Web Wallet');
      });
    } finally {
      window.localStorage.removeItem('bawa-vault');
    }
  });

  it('renders the watch-only wallet import page', async () => {
    await withRenderedApp('/import-wallet', (div) => {
      expect(div.textContent).toContain('Import a wallet');
    });
  });

  it('renders the send screen (offline signing; broadcast disabled)', async () => {
    await withRenderedApp('/send', (div) => {
      // No vault in the default app state, so the send screen shows its
      // no-wallet state; the placeholder copy is gone with Phase 4.
      expect(div.textContent).toContain('No wallet yet');
      expect(div.textContent).toContain('Create a wallet');
    });
  });
});

ACCEPTANCE (the coordinator will verify; your reply must make these pass)
- npx vitest run apps/web/src/app/app.test.tsx passes 4/4; tsc --noEmit exits 0.
- Return ONLY the complete new app.test.tsx in one code block, then one short paragraph listing what you changed.
