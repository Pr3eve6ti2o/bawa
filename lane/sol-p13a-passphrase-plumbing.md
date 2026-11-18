### `apps/web/src/wallet/passphrase.ts` — full new file

```ts
const PASSPHRASE_USED_KEY = 'bawa-vault-passphrase-used';

// Non-secret metadata only; the passphrase itself is never persisted here.
export function isPassphraseUsed(): boolean {
  return localStorage.getItem(PASSPHRASE_USED_KEY) === '1';
}

export function setPassphraseUsed(used: boolean): void {
  localStorage.setItem(PASSPHRASE_USED_KEY, used ? '1' : '0');
}
```

### `apps/web/src/wallet/vault.ts` — changed hunks

```diff
@@
 let unlockedMnemonic: string | null = null;
+let unlockedPassphrase: string | null = null;

@@
-export async function unlock(password: string): Promise<void> {
+export async function unlock(password: string, passphrase = ''): Promise<void> {

@@
   unlockedKey = key;
   unlockedMnemonic = new TextDecoder().decode(plaintext);
+  unlockedPassphrase = passphrase;
 }

@@
 export function lock(): void {
   unlockedKey = null;
   unlockedMnemonic = null;
+  unlockedPassphrase = null;
 }
+
+export function getSessionPassphrase(): string {
+  return unlockedPassphrase ?? '';
+}
```

### `apps/web/src/state/wallet-context.tsx` — changed hunks

```diff
@@
 import * as vault from '../wallet/vault';
+import { isPassphraseUsed } from '../wallet/passphrase';

@@
-const unlockVault = useCallback(async (password: string) => {
-  await vault.unlock(password);
+const unlockVault = useCallback(async (password: string, passphrase = '') => {
+  if (isPassphraseUsed() && !passphrase) {
+    throw new Error('This wallet uses a passphrase. Enter it to unlock.');
+  }
+
+  await vault.unlock(password, passphrase);
   await refreshVaultAccounts();
 }, [refreshVaultAccounts]);

@@
-derived = await vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic));
+derived = await vault.withMnemonic((mnemonic) =>
+  deriveVaultAddresses(mnemonic, vault.getSessionPassphrase())
+);
```

If the context value explicitly declares an `unlockVault` function type, widen that declaration in the same file as well:

```diff
@@
-  unlockVault: (password: string) => Promise<void>;
+  unlockVault: (password: string, passphrase?: string) => Promise<void>;
```