Add BIP-39 passphrase plumbing for the vault — no UI in this step. Three files only.

(1) New file apps/web/src/wallet/passphrase.ts: a boolean flag in localStorage under key 'bawa-vault-passphrase-used' ('1'/'0', default false). Export isPassphraseUsed(): boolean and setPassphraseUsed(used: boolean): void. The flag is not a secret — it only records that a passphrase was used.

(2) apps/web/src/wallet/vault.ts. Current code:
export async function unlock(password: string): Promise<void> {
  ...decrypts the envelope...
  unlockedKey = key;
  unlockedMnemonic = new TextDecoder().decode(plaintext);
}
export function lock(): void {
  unlockedKey = null;
  unlockedMnemonic = null;
}
Change unlock to unlock(password, passphrase = '') and store the passphrase in a new module-level `unlockedPassphrase: string | null` (declared beside unlockedKey/unlockedMnemonic); lock() clears it too. Export getSessionPassphrase(): string ('' when locked or no passphrase). Never store the passphrase in localStorage or log it.

(3) apps/web/src/state/wallet-context.tsx. Current code:
const unlockVault = useCallback(async (password: string) => {
  await vault.unlock(password);
  await refreshVaultAccounts();
}, [refreshVaultAccounts]);
...
derived = await vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic));
Change unlockVault to unlockVault(password, passphrase = ''): when isPassphraseUsed() is true (import it from '../wallet/passphrase') and no passphrase is given, throw 'This wallet uses a passphrase. Enter it to unlock.' before touching the vault; otherwise pass the passphrase to vault.unlock. Change the derive line to deriveVaultAddresses(mnemonic, vault.getSessionPassphrase()) — the vault module is already imported as `vault` there.

Return the full new passphrase.ts plus the exact changed hunks for vault.ts and wallet-context.tsx. Do not change any screen.
