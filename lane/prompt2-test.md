You are updating one test file in the Bawa web wallet. Worktree: /home/boxd/workspace/bawa-panel-rebuild/fix-landing (branch panel-rebuild/fix-landing, base commit 5638eea). You have NO file tools and cannot read files: return the COMPLETE new content of apps/web/src/app/app.test.tsx in your reply, as one code block, so the coordinator can write it to disk verbatim. Do not describe the change instead of writing it.

CONTEXT (verified first-hand by the coordinator; the implementation change is already made in apps/web/src/app/app.tsx)
- The index (/) route now renders a HomeScreen that returns WelcomeScreen when useWallet().vaultState is no-vault and DashboardScreen otherwise (locked or unlocked vault both show the dashboard). The /welcome route is unchanged.
- The existing test "renders the wallet title and the empty dashboard" at / expects "No wallet yet" — that is now WRONG for / with no vault and must be updated.
- vault.ts: VAULT_STORAGE_KEY is bawa-vault in localStorage. hasVault() returns true even for a corrupted envelope (any stored value counts as a vault existing). With a stored value, vaultState is locked (nothing is unlocked), and the DashboardScreen then renders the text "Vault locked — your vault addresses are hidden until you unlock." WalletProvider reads the vault on mount, so seeding localStorage BEFORE root.render is enough. The DashboardScreen no-vault branch renders "No wallet yet — create a wallet or import one to see its balances." — that text must NOT appear on / with no vault any more.
- The WelcomeScreen renders the heading "Welcome to Bawa Web Wallet" and the line "Mainnet only — this wallet never connects to a test network."

TASK — rewrite apps/web/src/app/app.test.tsx with exactly these tests (keep the existing withRenderedApp helper, matchMedia shim and IS_REACT_ACT_ENVIRONMENT handling exactly as they are):
1. At / with no vault (no bawa-vault value in localStorage): expect "Bawa Web Wallet", expect "Welcome to Bawa Web Wallet", expect "Mainnet only — this wallet never connects to a test network", and expect the text NOT to contain "No wallet yet".
2. NEW test at / with a vault present: seed window.localStorage.setItem("bawa-vault", "corrupted-envelope-for-test") before rendering, remove it in a finally block after unmount (localStorage.removeItem("bawa-vault")), and expect "Vault locked — your vault addresses are hidden until you unlock." and expect the text NOT to contain "Welcome to Bawa Web Wallet".
3. Keep the other two existing tests unchanged: /import-wallet shows "Import a wallet"; /send shows "No wallet yet" and "Create a wallet".
- Do NOT change any other file. Do NOT change the Welcome screen, vault, CSP, create-flow, or send/receive code.

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
  it('renders the wallet title and the empty dashboard', async () => {
    await withRenderedApp('/', (div) => {
      expect(div.textContent).toContain('Bawa Web Wallet');
      expect(div.textContent).toContain('No wallet yet');
    });
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
- tsc --noEmit exits 0, vitest apps/web/src/app/app.test.tsx passes (all 4 tests).
- Return ONLY the complete new app.test.tsx in one code block, then one short paragraph listing what you changed.
