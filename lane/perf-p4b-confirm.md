# Lane A perf, prompt 4b: fast confirm path in create-wallet (self-contained)

You have no filesystem or shell access. Return ONLY replacement code blocks
in markdown code fences, labelled with the block they replace, nothing else.
Do not explain, do not invent other files.

## Context

`apps/web/src/screens/create-wallet.tsx`. A separate change (prompt 3)
made `createVault(mnemonic, password, profileIds, passphrase)` leave the
vault UNLOCKED with the session passphrase set — so the confirm step no
longer needs `unlockVault` (which re-derives PBKDF2 600k a second time).
A separate change (prompt 2c) made `refreshVaultAccounts()` return as
soon as the derived addresses are in state, with balances/history
loading in the background. This prompt rewires `handleConfirm` to use
both, and shows staged progress. The `progress` state from prompt 4a
exists: `const [progress, setProgress] = useState<string | null>(null);`
with a `yieldFrame` helper that yields one animation frame (falling back
to a zero-delay timeout). Assume both exist.

## Task

1. In the `useWallet()` destructure, remove `unlockVault` (no longer
   used in this file). Keep `vaultAddresses` and `refreshVaultAccounts`.
2. In the vault import, remove `isLocked` (no longer used in this file).
   Keep `createVault` and `hasVault`.
3. Rewrite `handleConfirm` (current code below) as:
   - validations and the all-correct check unchanged;
   - `setIsBusy(true)`; set `progress` to `'Encrypting vault…'`; yield
     one frame; `await createVault(mnemonic, password, profileIds,
     passphrase);` — note the 4th `passphrase` argument;
   - clear the mnemonic/password/passphrase state exactly as today
     (`setMnemonic(null)`, `setPassword('')`, `setConfirmPassword('')`,
     `setPassphraseUsed(passphrase.length > 0)`);
   - set `progress` to `'Deriving addresses…'`; yield one frame;
     `await refreshVaultAccounts();` — this now returns after the
     addresses are set; balances/history follow in the background;
   - `setPassphrase('')`; `setStep(4)`;
   - on error: clear the mnemonic, show the existing save-error text
     (unchanged); the old `isLocked()` rethrow branch is DELETED — a
     failure after a created vault is reported with that same text, and
     the user can unlock from Security (the error text already says so);
   - `finally`: `setIsBusy(false)` and clear `progress` to `null`.
4. Step-3 submit button label: `{isBusy ? (progress ?? 'Saving…') :
   'Confirm and create wallet'}` (current code below).
5. Do NOT change the step-4 screen, the word-confirmation logic, the
   vault password rules, or any security parameter.

## Acceptance

`tsc --noEmit` clean with the rest of the project unchanged; no
`unlockVault` or `isLocked` reference remains in this file; the confirm
step performs exactly ONE PBKDF2 derivation (inside `createVault`) and
shows step 4 without waiting for any provider fetch.

## Current code

Destructure:

```tsx
  const { vaultAddresses, unlockVault, refreshVaultAccounts } = useWallet();
```

Vault import:

```tsx
import { createVault, hasVault, isLocked } from '../wallet/vault';
```

`handleConfirm`:

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

Step-3 button:

```tsx
                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? 'Saving…' : 'Confirm and create wallet'}
                </Button>
```
