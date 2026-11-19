"""Lane A perf: hands-on follow-ups after prompts 3+4a+4b.

1. import-wallet.tsx: createVault now leaves the vault unlocked, so pass
   the passphrase to createVault and drop the redundant unlockVault call.
2. asset-rows.tsx: when the vault is locked and a chain has no address,
   say "Unlock your wallet to see balances" instead of the misleading
   "Balance unavailable", and hide Retry (it cannot fetch without one).
3. create-wallet.test.tsx: mock the engine (loadCore), createVault takes
   a 4th passphrase arg, unlockVault/isLocked are gone from the screen,
   and the two obsolete unlock/refresh-failure tests are rewritten for
   the new confirm path.
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-followups.py
"""
IMPORT = 'apps/web/src/screens/import-wallet.tsx'
ROWS = 'apps/web/src/screens/asset-rows.tsx'
TEST = 'apps/web/src/screens/create-wallet.test.tsx'

# ---- 1. import-wallet.tsx ----
with open(IMPORT, encoding='utf-8') as f:
    s = f.read()
old = "  const { xpubs, addXpub, unlockVault, refreshVaultAccounts } = useWallet();"
assert s.count(old) == 1, 'import-wallet destructure not found once'
s = s.replace(old, "  const { xpubs, addXpub, refreshVaultAccounts } = useWallet();", 1)
old = "      await createVault(mnemonic, vaultPassword, profileIds);"
assert s.count(old) == 1, 'import-wallet createVault not found once'
s = s.replace(old, "      await createVault(mnemonic, vaultPassword, profileIds, passphrase);", 1)
old = "      await unlockVault(vaultPassword, passphrase);\n"
assert s.count(old) == 1, 'import-wallet unlockVault call not found once'
s = s.replace(old, '', 1)
with open(IMPORT, 'w', encoding='utf-8') as f:
    f.write(s)
print('import-wallet.tsx: passphrase to createVault, unlockVault dropped')

# ---- 2. asset-rows.tsx ----
with open(ROWS, encoding='utf-8') as f:
    s = f.read()
old = """export function AssetRows({ hideZero }: { hideZero: boolean }) {
  const { balances, refreshBalances } = useWallet();"""
assert s.count(old) == 1, 'AssetRows destructure not found once'
s = s.replace(
    old,
    """export function AssetRows({ hideZero }: { hideZero: boolean }) {
  const { balances, refreshBalances, vaultState, vaultAddresses, addresses } =
    useWallet();""",
    1,
)
old = """        if (balance.status === 'unavailable' || balance.status === 'error') {
          return (
            <li key={chain} className="flex items-center gap-3 py-4">
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#eff2fc]">
                  {config.displayName}
                </span>
                <span className="block text-xs text-[#9da9c7]">
                  {balance.status === 'unavailable'
                    ? 'Balance unavailable'
                    : 'Could not load balance'}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshBalances()}
              >
                Retry
              </Button>
            </li>
          );
        }"""
assert s.count(old) == 1, 'AssetRows unavailable branch not found once'
s = s.replace(
    old,
    """        if (balance.status === 'unavailable' || balance.status === 'error') {
          // Locked vault, no address for this chain: the balance is not
          // "unavailable", it is hidden until unlock. Say so honestly and
          // hide Retry (it cannot fetch without an address). A locked vault
          // WITH a watch-only address still shows the real failure + Retry.
          const hasAddress =
            (vaultAddresses?.[chain]?.length ?? 0) > 0 ||
            (addresses?.[chain]?.length ?? 0) > 0;
          const lockedNoAddress =
            vaultState === 'locked' &&
            !hasAddress &&
            balance.status === 'unavailable';
          return (
            <li key={chain} className="flex items-center gap-3 py-4">
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#eff2fc]">
                  {config.displayName}
                </span>
                <span className="block text-xs text-[#9da9c7]">
                  {lockedNoAddress
                    ? 'Unlock your wallet to see balances'
                    : balance.status === 'unavailable'
                      ? 'Balance unavailable'
                      : 'Could not load balance'}
                </span>
              </span>
              {!lockedNoAddress && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshBalances()}
                >
                  Retry
                </Button>
              )}
            </li>
          );
        }""",
    1,
)
with open(ROWS, 'w', encoding='utf-8') as f:
    f.write(s)
print('asset-rows.tsx: locked-no-address hint instead of Balance unavailable')

# ---- 3. create-wallet.test.tsx ----
with open(TEST, encoding='utf-8') as f:
    s = f.read()

old = "import { createVault, hasVault, isLocked } from '../wallet/vault';"
assert s.count(old) == 1, 'test vault import not found once'
s = s.replace(old, "import { createVault, hasVault } from '../wallet/vault';", 1)

old = "import { createWallet } from '../wallet/core';"
assert s.count(old) == 1, 'test core import not found once'
s = s.replace(
    old,
    "import { createWallet } from '../wallet/core';\nimport { loadCore } from '../engine/boundary';",
    1,
)

old = """vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
  isLocked: vi.fn(),
}));"""
assert s.count(old) == 1, 'test vault mock not found once'
s = s.replace(
    old,
    """vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
}));

vi.mock('../engine/boundary', () => ({
  loadCore: vi.fn(),
}));""",
    1,
)

old = "const mockUnlockVault = vi.fn();\n"
assert s.count(old) == 1, 'mockUnlockVault decl not found once'
s = s.replace(old, '', 1)

old = "  vi.mocked(isLocked).mockReturnValue(false);\n"
assert s.count(old) == 1, 'isLocked mock setup not found once'
s = s.replace(old, '', 1)

old = "  mockUnlockVault.mockResolvedValue(undefined);\n"
assert s.count(old) == 1, 'mockUnlockVault setup not found once'
s = s.replace(
    old,
    "  vi.mocked(loadCore).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof loadCore>>);\n",
    1,
)

old = """    vaultAddresses: TEST_ADDRESSES,
    unlockVault: mockUnlockVault,
    refreshVaultAccounts: mockRefreshVaultAccounts,"""
assert s.count(old) == 1, 'test useWallet mock not found once'
s = s.replace(
    old,
    """    vaultAddresses: TEST_ADDRESSES,
    refreshVaultAccounts: mockRefreshVaultAccounts,""",
    1,
)

old = """      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
      ]);
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, '');"""
assert s.count(old) == 1, 'creates-vault assertions not found once'
s = s.replace(
    old,
    """      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
      ], '');""",
    1,
)

old = "  it('advances to step 4 with addresses when the post-unlock refresh fails', async () => {"
assert s.count(old) == 1, 'refresh-fails test name not found once'
s = s.replace(old, "  it('stays on step 3 when address derivation fails', async () => {", 1)

old = """      mockRefreshVaultAccounts.mockRejectedValueOnce(new Error('refresh failed'));
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, '');
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('completed');
      const text = mounted.div.textContent as string;
      expect(text).toContain('Your wallet is ready');
      expect(text).toContain(TEST_ADDRESSES.btc[0]);
      expect(text).toContain(TEST_ADDRESSES.eth[0]);
      expect(text).toContain(TEST_ADDRESSES.trx[0]);
      expect(text).toContain(TEST_ADDRESSES.ton[0]);
      expect(text).not.toContain('could not be saved');"""
assert s.count(old) == 1, 'refresh-fails test body not found once'
s = s.replace(
    old,
    """      mockRefreshVaultAccounts.mockRejectedValueOnce(new Error('refresh failed'));
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('pending');
      const text = mounted.div.textContent as string;
      expect(text).toContain('could not be saved');
      expect(text).not.toContain('Your wallet is ready');""",
    1,
)

old = "  it('stays on step 3 when the unlock itself fails', async () => {"
assert s.count(old) == 1, 'unlock-fails test name not found once'
s = s.replace(old, "  it('stays on step 3 when vault creation fails', async () => {", 1)

old = """      mockUnlockVault.mockRejectedValueOnce(new Error('unlock failed'));
      vi.mocked(isLocked).mockReturnValue(true);"""
assert s.count(old) == 1, 'unlock-fails test setup not found once'
s = s.replace(
    old,
    """      vi.mocked(createVault).mockRejectedValueOnce(new Error('save failed'));""",
    1,
)

old = "  it('passes a passphrase to unlock and records that one is used', async () => {"
assert s.count(old) == 1, 'passphrase test name not found once'
s = s.replace(old, "  it('passes a passphrase to the vault and records that one is used', async () => {", 1)

old = "      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, 'TREZOR');"
assert s.count(old) == 1, 'passphrase unlock assertion not found once'
s = s.replace(
    old,
    """      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
      ], 'TREZOR');""",
    1,
)

with open(TEST, 'w', encoding='utf-8') as f:
    f.write(s)
print('create-wallet.test.tsx: boundary mock + 4th arg + rewritten failure tests')
print('OK')
