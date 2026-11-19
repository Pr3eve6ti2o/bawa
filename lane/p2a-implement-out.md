```tsx
import { createVault, hasVault, isLocked } from '../wallet/vault';
```

```tsx
  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
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
  }
```

Only the import and inner try/catch are changed.
Locked-vault failures still reach the existing outer catch.
Unlocked-vault refresh failures now fall through to step 4.