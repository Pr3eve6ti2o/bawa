// BIP-39 passphrase flag (Fix Lane 1 open item (a), Sol p13a, landed
// 2026-11-19 in 149.9s). Non-secret metadata only: records that a
// passphrase was used, so unlock can require it. The passphrase itself is
// never persisted here — it lives only in the vault's unlocked session.
const PASSPHRASE_USED_KEY = 'bawa-vault-passphrase-used';

export function isPassphraseUsed(): boolean {
  return localStorage.getItem(PASSPHRASE_USED_KEY) === '1';
}

export function setPassphraseUsed(used: boolean): void {
  localStorage.setItem(PASSPHRASE_USED_KEY, used ? '1' : '0');
}
