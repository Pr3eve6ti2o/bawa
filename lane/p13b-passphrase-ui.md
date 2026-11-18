Add the BIP-39 passphrase UI — the plumbing already exists (do not re-implement it): isPassphraseUsed()/setPassphraseUsed() in wallet/passphrase.ts, vault.unlock(password, passphrase), getSessionPassphrase(), and unlockVault(password, passphrase) in wallet-context (throws when a passphrase is required but missing).

(1) apps/web/src/screens/create-wallet.tsx. Current password fields (inside the step-1 form fieldset):
<div className="space-y-2">
  <Label htmlFor="vault-password">Vault password</Label>
  <Input id="vault-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
</div>
<div className="space-y-2">
  <Label htmlFor="vault-password-confirm">Repeat vault password</Label>
  <Input id="vault-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
</div>
Add below them an optional passphrase field (id "vault-passphrase", type password, autocomplete off) with the note "Optional BIP-39 passphrase (25th word). It is never stored — you must enter it every time you unlock. It is not your vault password." Add a passphrase state variable, pass it to unlockVault(password, passphrase) after creation (the file already calls unlockVault(password) after createVault), and call setPassphraseUsed(passphrase.length > 0).

(2) apps/web/src/screens/import-wallet.tsx. Current save handler ends with:
await createVault(mnemonic, vaultPassword, profileIds);
setNormalizedMnemonic(null);
setVaultPassword('');
setVaultPasswordConfirm('');
await unlockVault(vaultPassword);
Add the same optional passphrase field to its vault-password form, a passphrase state variable, setPassphraseUsed(passphrase.length > 0), and pass the passphrase to unlockVault(vaultPassword, passphrase). Clear the passphrase field on save.

(3) apps/web/src/screens/lock.tsx (created by the lock-screen step; it has a password input id "lock-password" and calls unlockVault(password)): when isPassphraseUsed() is true, show a passphrase field (id "lock-passphrase") and pass it to unlockVault(password, passphrase); otherwise no passphrase field.

(4) apps/web/src/screens/send.tsx: pass getSessionPassphrase() from '../wallet/vault' instead of '' as the passphrase argument to signEthOffline, signBtcOffline, signTrxOffline and signTonOffline.

Return the exact changed hunks per file. Never log or store the passphrase.
