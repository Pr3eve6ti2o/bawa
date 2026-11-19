"""Lane A perf: second round of test fixes.

Root causes found first-hand (full suite: 11 failures in 5 files):
1. registerAllAdapters() clobbered adapters registered before it ran.
   ensureAdapters() (P2a) calls it lazily on first refresh, AFTER the
   balances test had registered its stubs -> the real adapters overwrote
   the stubs and the test saw real mainnet 0 balances for the public
   'abandon' vector. Product fix: first registration wins.
2. src/wallet/wallet-context.test.tsx 'no adapter' premise: with lazy
   registration real adapters now always exist in that test, so it must
   mock the adapters module (as src/state/wallet-context.test.tsx does).
   Its other two tests need lock() after createVault (P3 leaves unlocked).
3. app.test.tsx / mnemonic-backup.test.tsx mount <App/> and assert at
   once; lazy route screens still show the Suspense 'Loading...' fallback.
   Wait (bounded) for the fallback to clear.
4. send.test.tsx mocks '../state/wallet-context' with useWallet only, but
   send.tsx (P2a follow-up) imports ensureAdapters from it -> undefined
   -> handleAmountNext/handleSign throw. Mock ensureAdapters.
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-testfixes2.py
"""


def patch(path, old, new, count=1):
    with open(path, encoding='utf-8') as f:
        src = f.read()
    found = src.count(old)
    assert found == count, f'{path}: expected {count} occurrence(s), found {found}'
    src = src.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f'{path}: patched ({count})')


# --- 1. registerAllAdapters: first registration wins -------------------------
patch(
    'apps/web/src/wallet/adapters/index.ts',
    """/**\n * Registers the Phase 2 mainnet adapters. Filled in as the adapters land\n * (P2 eth done; P3 trx, P4 ton, P5 btc to come). Call once at startup.\n */\nexport function registerAllAdapters(): void {\n  registerAdapter(createEthAdapter());\n  registerAdapter(createTronAdapter());\n  registerAdapter(createTonAdapter());\n  registerAdapter(createBtcAdapter());\n}""",
    """/**\n * Registers the Phase 2 mainnet adapters. Filled in as the adapters land\n * (P2 eth done; P3 trx, P4 ton, P5 btc to come). Call once at startup.\n * First registration wins: never clobber an adapter registered earlier\n * (e.g. a test stub, or an adapter registered before lazy loading ran).\n */\nexport function registerAllAdapters(): void {\n  for (const create of [\n    createEthAdapter,\n    createTronAdapter,\n    createTonAdapter,\n    createBtcAdapter,\n  ]) {\n    const adapter = create();\n    if (!adapters.has(adapter.chain)) {\n      registerAdapter(adapter);\n    }\n  }\n}""",
)

# --- 2a. wallet-context.test.tsx: mock the adapters module -------------------
patch(
    'apps/web/src/wallet/wallet-context.test.tsx',
    "import { beforeEach, describe, expect, it } from 'vitest';",
    "import { beforeEach, describe, expect, it, vi } from 'vitest';",
)
patch(
    'apps/web/src/wallet/wallet-context.test.tsx',
    "import { SUPPORTED_CHAINS } from './chains';",
    """import { SUPPORTED_CHAINS } from './chains';

// No adapter is registered in this file: the adapters module is mocked so
// lazy registration (ensureAdapters) cannot bring the real adapters in.
// getAdapter() returning undefined is the "no adapter" state under test.
vi.mock('./adapters', () => ({
  getAdapter: vi.fn(() => undefined),
  registerAdapter: vi.fn(),
  registeredChains: vi.fn(() => []),
  registerAllAdapters: vi.fn(),
}));""",
)

# --- 2b. wallet-context.test.tsx: lock() after createVault -------------------
patch(
    'apps/web/src/wallet/wallet-context.test.tsx',
    """      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        await latest?.refreshVaultAccounts();
      });""",
    """      await act(async () => {
        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
        // createVault leaves the vault unlocked; these tests' premise is
        // a locked vault.
        lock();
        await latest?.refreshVaultAccounts();
      });""",
    count=2,
)

# --- 3a. app.test.tsx: wait for the lazy screen ------------------------------
patch(
    'apps/web/src/app/app.test.tsx',
    """    await act(async () => {
      root.render(<App />);
    });

    assertions(div);""",
    """    await act(async () => {
      root.render(<App />);
    });

    // Route screens are lazy-loaded: wait for the Suspense fallback to
    // clear before asserting on the screen's content.
    await act(async () => {
      for (let i = 0; i < 40 && div.textContent?.includes('Loading…'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    assertions(div);""",
)

# --- 3b. mnemonic-backup.test.tsx: wait for the lazy screen ------------------
patch(
    'apps/web/src/screens/mnemonic-backup.test.tsx',
    """  window.history.pushState({}, '', '/mnemonic-backup');
  await act(async () => {
    root.render(<App />);
  });
  return {""",
    """  window.history.pushState({}, '', '/mnemonic-backup');
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
  return {""",
)

# --- 4. send.test.tsx: mock ensureAdapters ------------------------------------
patch(
    'apps/web/src/screens/send.test.tsx',
    """vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));""",
    """vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
  ensureAdapters: vi.fn(async () => undefined),
}));""",
)

print('OK')
