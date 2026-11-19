# P2a — Implement the create-wallet step-4 fix (SELF-CONTAINED: you have no filesystem access, so work ONLY from the code pasted below and output ONLY the replacement text)

## Diagnosis (verified first-hand by the lane agent; do not re-diagnose)
In `apps/web/src/screens/create-wallet.tsx`, `handleConfirm` runs `createVault`, then `unlockVault`, then `refreshVaultAccounts`, then `setStep(4)` inside ONE try block. The real `unlockVault` also refreshes vault accounts, and that refresh ends by awaiting the balance/history refresh. In a real served browser that post-unlock refresh can fail AFTER the vault is created and unlocked (balances/history are already known-unavailable there), and the single catch then shows "The wallet could not be saved" and leaves the user stuck on step 3 — even though the wallet exists and its addresses are derived. The mocked test passes because its refresh mock resolves.

Fix: split the post-creation phase so a refresh failure cannot hide a created, unlocked wallet. The vault module already exports a synchronous `isLocked()` (true when locked, false once unlocked) — use it to tell the two failures apart. Do NOT change the verification logic, wallet creation, derivation, vault, signing, CSP, routing, any other screen, or any user-facing copy.

## Current code (verbatim, the ONLY parts you may change)
Import line:
```tsx
import { createVault, hasVault } from '../wallet/vault';
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
      await unlockVault(password, passphrase);
      setPassphrase('');
      await refreshVaultAccounts();
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

## Required change
1. Import `isLocked` from `'../wallet/vault'` alongside `createVault` and `hasVault`.
2. Wrap ONLY the `await unlockVault(password, passphrase); setPassphrase(''); await refreshVaultAccounts();` lines in an inner try/catch. In the inner catch: if `isLocked()` is true, rethrow the caught error (the unlock itself failed — the outer catch must still report it and stay on step 3). If the vault is unlocked, swallow the error and fall through to `setStep(4)` — the wallet is created and unlocked, and step 4 shows its derived addresses; the balance/history refresh failing must not block it. Add a brief comment explaining why. Everything else in the function stays byte-identical.

## Deliverable (output file ONLY — you change no files yourself)
Output exactly two fenced code blocks and nothing else except a 3-line note after them: (1) the new import line, (2) the COMPLETE new `handleConfirm` function. TypeScript + React, same style (2-space indent, single quotes). No real crypto, no secrets, no mnemonic or key material anywhere in the output.

## Hard limits
No real crypto, disposable test credentials only, never real user funds or seed phrases. Never print, log, or include a private key or mnemonic.
