"""Lane A perf: test fixes for the three failure causes found first-hand.

1. create-wallet.tsx yieldFrame: setTimeout(0) instead of racing rAF
   against a 50 ms timeout. rAF never fires in a background tab or a
   non-visual environment (jsdom) and would stall the flow; one macrotask
   yield lets React commit the progress label, and the paint still happens
   while the next stage awaits its (off-main-thread) work.
2. create-wallet.test.tsx: act() does not flush yieldFrame's timers, so
   the tests must settle after the Generate / Confirm clicks.
3. wallet-context.test.tsx: createVault now leaves the vault unlocked, so
   the "refuses to unlock" test must lock() first to set up its premise.
4. import-wallet.test.tsx: the import screen is lazy-loaded (P1 route
   code-splitting), so mounts must wait for it to appear before clicking
   its tabs. All four mount sites get the wait.
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-testfixes.py
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


# --- 1. yieldFrame: macrotask yield, no rAF dependency -----------------------
patch(
    'apps/web/src/screens/create-wallet.tsx',
    """function yieldFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(undefined);
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => finish());
    }
    // rAF never fires in a background tab or a non-visual environment
    // (jsdom), so never wait on it alone: the timeout keeps the flow
    // moving. In a visible tab rAF wins (~16 ms).
    setTimeout(() => finish(), 50);
  });
}""",
    """function yieldFrame(): Promise<void> {
  // One macrotask yield: lets React commit the progress label before the
  // next (async) stage starts. requestAnimationFrame is deliberately NOT
  // used: it never fires in a background tab or a non-visual environment
  // (jsdom), which would stall the flow; the paint still happens while
  // the following stage awaits its (off-main-thread) work.
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(undefined), 0);
  });
}""",
)

# --- 2. create-wallet.test.tsx: settle after async clicks --------------------
patch(
    'apps/web/src/screens/create-wallet.test.tsx',
    """  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}""",
    """  expect(button).not.toBeUndefined();
  return button as HTMLButtonElement;
}

// handleGenerate/handleConfirm yield to the event loop between stages
// (yieldFrame); act() does not flush those timers, so let them run.
async function settle(ms = 200): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}""",
)
patch(
    'apps/web/src/screens/create-wallet.test.tsx',
    """async function generate(div: HTMLDivElement) {
  await fillPasswords(div);
  await act(async () => {
    findButton(div, 'Generate recovery phrase').click();
  });
}""",
    """async function generate(div: HTMLDivElement) {
  await fillPasswords(div);
  await act(async () => {
    findButton(div, 'Generate recovery phrase').click();
  });
  await settle();
}""",
)
patch(
    'apps/web/src/screens/create-wallet.test.tsx',
    """      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });""",
    """      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      await settle();""",
    count=5,
)
patch(
    'apps/web/src/screens/create-wallet.test.tsx',
    """      await act(async () => {
        findButton(mounted.div, 'Generate recovery phrase').click();
      });""",
    """      await act(async () => {
        findButton(mounted.div, 'Generate recovery phrase').click();
      });
      await settle();""",
    count=2,
)

# --- 3. wallet-context.test.tsx: lock first ----------------------------------
patch(
    'apps/web/src/state/wallet-context.test.tsx',
    """  it('refuses to unlock without the passphrase when the flag is set', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    setPassphraseUsed(true);""",
    """  it('refuses to unlock without the passphrase when the flag is set', async () => {
    await createVault(VECTOR_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    // createVault leaves the vault unlocked; this test's premise is a
    // locked vault whose unlock is refused.
    lock();
    setPassphraseUsed(true);""",
)

# --- 4. import-wallet.test.tsx: wait for the lazy screen ---------------------
patch(
    'apps/web/src/screens/import-wallet.test.tsx',
    """describe.sequential('ImportWalletScreen TON (R01)', () => {""",
    """// The import screen is lazy-loaded (route code-splitting): after mount,
// wait for it to appear before the tests touch its controls.
async function waitForImportScreen(div: HTMLDivElement): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 40 && !div.querySelector('#wallet-xpub'); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
}

describe.sequential('ImportWalletScreen TON (R01)', () => {""",
)
patch(
    'apps/web/src/screens/import-wallet.test.tsx',
    """    await act(async () => {
      root.render(<App />);
    });
    return {""",
    """    await act(async () => {
      root.render(<App />);
    });
    await waitForImportScreen(div);
    return {""",
    count=2,
)
patch(
    'apps/web/src/screens/import-wallet.test.tsx',
    """      await act(async () => {
        root.render(<App />);
      });

      const input = div.querySelector<HTMLInputElement>('#wallet-xpub');""",
    """      await act(async () => {
        root.render(<App />);
      });
      await waitForImportScreen(div);

      const input = div.querySelector<HTMLInputElement>('#wallet-xpub');""",
)
patch(
    'apps/web/src/screens/import-wallet.test.tsx',
    """      await act(async () => {
        root.render(<App />);
      });
      expect(div.textContent).toContain('Labels are stored in plain text in this browser');""",
    """      await act(async () => {
        root.render(<App />);
      });
      await waitForImportScreen(div);
      expect(div.textContent).toContain('Labels are stored in plain text in this browser');""",
)

print('OK')
