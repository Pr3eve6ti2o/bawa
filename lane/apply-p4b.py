"""Lane A perf: apply Sol prompt-4b (fast confirm path in create-wallet).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p4b.py
"""
SCREEN = 'apps/web/src/screens/create-wallet.tsx'

with open(SCREEN, encoding='utf-8') as f:
    src = f.read()

old_des = "  const { vaultAddresses, unlockVault, refreshVaultAccounts } = useWallet();"
assert src.count(old_des) == 1, 'destructure not found once'
src = src.replace(old_des, "  const { vaultAddresses, refreshVaultAccounts } = useWallet();", 1)

old_imp = "import { createVault, hasVault, isLocked } from '../wallet/vault';"
assert src.count(old_imp) == 1, 'vault import not found once'
src = src.replace(old_imp, "import { createVault, hasVault } from '../wallet/vault';", 1)

old_fn = """  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy || mnemonic === null) return;
    setError(null);
    const allCorrect = confirmPositions.every((position) => {
      const entered = (confirmInputs[position] ?? '').trim().toLowerCase();
      return entered.length > 0 && entered === words[position];
    });
    if (!allCorrect) {
      setError(
        'One or more words do not match the recovery phrase you wrote down. Check your written copy and try again.',
      );
      return;
    }
    setIsBusy(true);
    try {
      const profileIds = SUPPORTED_CHAINS.map((chain) => profileFor(chain));
      await createVault(mnemonic, password, profileIds);
      setMnemonic(null);
      setPassword('');
      setConfirmPassword('');
      setPassphraseUsed(passphrase.length > 0);
      try {
        await unlockVault(password, passphrase);
        setPassphrase('');
        await refreshVaultAccounts();
      } catch (error) {
        if (isLocked()) throw error;
        // Balance/history refresh failures must not block a created, unlocked wallet.
      }
      setStep(4);
    } catch {
      // The mnemonic is already cleared above when creation succeeded;
      // clear again on any failure so no copy lingers.
      setMnemonic(null);
      setError(
        'The wallet could not be saved. If a vault was created, unlock it from Security; otherwise try again.',
      );
    } finally {
      setIsBusy(false);
    }
  }"""
assert src.count(old_fn) == 1, 'handleConfirm not found once'
src = src.replace(
    old_fn,
    """  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy || mnemonic === null) return;
    setError(null);
    const allCorrect = confirmPositions.every((position) => {
      const entered = (confirmInputs[position] ?? '').trim().toLowerCase();
      return entered.length > 0 && entered === words[position];
    });
    if (!allCorrect) {
      setError(
        'One or more words do not match the recovery phrase you wrote down. Check your written copy and try again.',
      );
      return;
    }
    setIsBusy(true);
    try {
      setProgress('Encrypting vault…');
      await yieldFrame();
      const profileIds = SUPPORTED_CHAINS.map((chain) => profileFor(chain));
      await createVault(mnemonic, password, profileIds, passphrase);
      setMnemonic(null);
      setPassword('');
      setConfirmPassword('');
      setPassphraseUsed(passphrase.length > 0);
      setProgress('Deriving addresses…');
      await yieldFrame();
      await refreshVaultAccounts();
      setPassphrase('');
      setStep(4);
    } catch {
      // The mnemonic is already cleared above when creation succeeded;
      // clear again on any failure so no copy lingers.
      setMnemonic(null);
      setError(
        'The wallet could not be saved. If a vault was created, unlock it from Security; otherwise try again.',
      );
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  }""",
    1,
)

old_btn = """                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? 'Saving…' : 'Confirm and create wallet'}
                </Button>"""
assert src.count(old_btn) == 1, 'step-3 button not found once'
src = src.replace(
    old_btn,
    """                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? (progress ?? 'Saving…') : 'Confirm and create wallet'}
                </Button>""",
    1,
)

with open(SCREEN, 'w', encoding='utf-8') as f:
    f.write(src)
print('create-wallet.tsx: fast confirm path (one PBKDF2, staged labels)')
print('OK')
