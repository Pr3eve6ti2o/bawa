```tsx title="Destructure"
  const { vaultAddresses, refreshVaultAccounts } = useWallet();
```

```tsx title="Vault import"
import { createVault, hasVault } from '../wallet/vault';
```

```tsx title="handleConfirm"
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
  }
```

```tsx title="Step-3 button"
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? (progress ?? 'Saving…') : 'Confirm and create wallet'}
                </Button>
```