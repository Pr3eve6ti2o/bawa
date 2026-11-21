/**
 * Password-protected encrypted vault (AES-GCM-256, PBKDF2 with 600,000 iterations).
 *
 * Auto-lock is OPTIONAL and OFF by default. When off, the derived key is stored
 * in this origin's localStorage under bawa-vault-key, and the vault auto-unlocks.
 * When on, no key is stored in localStorage, and unlocking requires the password.
 * Key persistence is owned by the auto-lock setting; unlock() stores the key only when auto-lock is off.
 *
 * Tradeoff: with auto-lock off, anyone who can read this origin's localStorage
 * can decrypt the vault without the password. The mnemonic itself is never
 * stored in plaintext.
 */

import { readAutoLockEnabled } from './auto-lock';

export const VAULT_STORAGE_KEY = 'bawa-vault';
/** localStorage key for the raw vault key (base64) that auto-unlock uses. */
export const VAULT_KEY_STORAGE_KEY = 'bawa-vault-key';
export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_HASH = 'SHA-256';
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const VAULT_CIPHER = 'AES-GCM';
export const VAULT_KEY_BITS = 256;

export const VAULT_CORRUPTED = 'Vault is corrupted.';

export const VAULT_WRONG_PASSWORD = 'Incorrect password.';

interface VaultEnvelope {
  version: number;
  kdf: {
    name: 'PBKDF2';
    hash: string;
    iterations: number;
    saltB64: string;
  };
  ivB64: string;
  ciphertextB64: string;
  profileIds: string[];
}

let unlockedKey: CryptoKey | null = null;
let unlockedMnemonic: string | null = null;
let unlockedPassphrase: string | null = null;

function getStorage(): Storage {
  return globalThis.localStorage;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const passwordKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: PBKDF2_HASH,
    },
    passwordKey,
    { name: VAULT_CIPHER, length: VAULT_KEY_BITS },
    // Extractable so the raw key can be exported and stored for auto-unlock
    // (owner decision — see the module doc comment). The derived key is
    // never exposed outside this module except as stored key bytes.
    true,
    ['encrypt', 'decrypt'],
  );
}

function readEnvelope(): VaultEnvelope | null {
  const raw = getStorage().getItem(VAULT_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(VAULT_CORRUPTED);
  }
  const envelope = parsed as Partial<VaultEnvelope>;
  if (
    envelope.version !== VAULT_VERSION ||
    envelope.kdf?.name !== 'PBKDF2' ||
    typeof envelope.kdf?.hash !== 'string' ||
    typeof envelope.kdf?.iterations !== 'number' ||
    typeof envelope.kdf?.saltB64 !== 'string' ||
    typeof envelope.ivB64 !== 'string' ||
    typeof envelope.ciphertextB64 !== 'string' ||
    !Array.isArray(envelope.profileIds) ||
    !envelope.profileIds.every((id) => typeof id === 'string')
  ) {
    throw new Error(VAULT_CORRUPTED);
  }
  return envelope as VaultEnvelope;
}

function writeEnvelope(envelope: VaultEnvelope): void {
  getStorage().setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

async function storeKey(key: CryptoKey): Promise<void> {
  const rawKey = await globalThis.crypto.subtle.exportKey('raw', key);
  getStorage().setItem(
    VAULT_KEY_STORAGE_KEY,
    toBase64(new Uint8Array(rawKey)),
  );
}

export async function storeCurrentKey(): Promise<boolean> {
  if (unlockedKey === null) {
    return false;
  }

  await storeKey(unlockedKey);
  return true;
}

export function deleteStoredKey(): void {
  localStorage.removeItem(VAULT_KEY_STORAGE_KEY);
}

export function hasStoredKey(): boolean {
  try {
    return localStorage.getItem(VAULT_KEY_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

async function encryptEnvelope(
  mnemonic: string,
  password: string,
  profileIds: string[],
): Promise<{ envelope: VaultEnvelope; key: CryptoKey }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: VAULT_CIPHER, iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );
  return {
    envelope: {
      version: VAULT_VERSION,
      kdf: {
        name: 'PBKDF2',
        hash: PBKDF2_HASH,
        iterations: PBKDF2_ITERATIONS,
        saltB64: toBase64(salt),
      },
      ivB64: toBase64(iv),
      ciphertextB64: toBase64(new Uint8Array(ciphertext)),
      profileIds: [...profileIds],
    },
    key,
  };
}

/**
 * Creates a vault. Throws if a vault already exists or the mnemonic is empty.
 * The derived key is stored (see the module doc comment) so the vault
 * auto-unlocks on later boots; the mnemonic stays in the closure and is
 * never written to storage. The vault is open immediately after creation.
 */
export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
  passphrase = '',
): Promise<void> {
  if (mnemonic.length === 0) {
    throw new Error('Mnemonic must not be empty.');
  }
  if (password.length === 0) {
    throw new Error('Password must not be empty.');
  }
  if (hasVault()) {
    throw new Error('A vault already exists.');
  }
  const { envelope, key } = await encryptEnvelope(mnemonic, password, profileIds);
  // Store the key before the envelope: a failure here leaves no half-made
  // vault behind.
  if (!readAutoLockEnabled()) {
    await storeKey(key);
  }
  writeEnvelope(envelope);
  unlockedKey = key;
  unlockedMnemonic = mnemonic;
  unlockedPassphrase = passphrase;
}

export function hasVault(): boolean {
  try {
    return readEnvelope() !== null;
  } catch {
    // A corrupted envelope still counts as a vault existing.
    return true;
  }
}

/** Stored recovery profileIds, or null when there is no vault. */
export function vaultProfiles(): string[] | null {
  const envelope = readEnvelope();
  return envelope === null ? null : [...envelope.profileIds];
}

/**
 * Auto-unlocks the vault: decrypts the stored envelope with the stored
 * key and puts the mnemonic (and the key) in the closure, so the vault is
 * open without a password prompt.
 *
 * Returns true when the mnemonic is available afterwards, false when
 * there is no vault, no stored key, or the envelope cannot be decrypted
 * (corrupted envelope, tampered ciphertext, or a key that does not match
 * the envelope). It never throws for a missing vault. A vault created
 * before the stored key existed cannot auto-unlock and returns false.
 *
 * The BIP-39 session passphrase cannot be restored from storage — it was
 * never persisted — so after an auto-unlock it is ''. Callers that derive
 * with a passphrase must not re-derive while the passphrase is unknown
 * (see wallet-context's refreshVaultAccounts guard).
 *
 * Already open is a no-op success: the in-session passphrase is kept.
 */
export async function autoUnlock(): Promise<boolean> {
  if (unlockedMnemonic !== null) {
    return true;
  }
  let envelope: VaultEnvelope | null;
  try {
    envelope = readEnvelope();
  } catch {
    return false;
  }
  if (envelope === null) {
    return false;
  }
  const storedKey = getStorage().getItem(VAULT_KEY_STORAGE_KEY);
  if (storedKey === null) {
    return false;
  }
  let keyBytes: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    keyBytes = fromBase64(storedKey);
    iv = fromBase64(envelope.ivB64);
    ciphertext = fromBase64(envelope.ciphertextB64);
  } catch {
    return false;
  }
  let key: CryptoKey;
  try {
    key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: VAULT_CIPHER, length: VAULT_KEY_BITS },
      false,
      ['decrypt'],
    );
  } catch {
    return false;
  }
  let plaintext: ArrayBuffer;
  try {
    plaintext = await globalThis.crypto.subtle.decrypt(
      { name: VAULT_CIPHER, iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    // A wrong stored key and tampered ciphertext are indistinguishable by
    // design; both fail authentication. Fail closed, no oracle.
    return false;
  }
  unlockedKey = key;
  unlockedMnemonic = new TextDecoder().decode(plaintext);
  unlockedPassphrase = '';
  return true;
}


export function isLocked(): boolean {
  return unlockedKey === null;
}

export async function unlock(password: string, passphrase = ''): Promise<void> {
  const envelope = readEnvelope();
  if (envelope === null) throw new Error('No vault exists.');

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;

  try {
    salt = fromBase64(envelope.kdf.saltB64);
    iv = fromBase64(envelope.ivB64);
    ciphertext = fromBase64(envelope.ciphertextB64);
  } catch {
    throw new Error(VAULT_CORRUPTED);
  }

  const key = await deriveKey(password, salt, envelope.kdf.iterations);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await globalThis.crypto.subtle.decrypt(
      { name: VAULT_CIPHER, iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new Error(VAULT_WRONG_PASSWORD);
  }

  unlockedKey = key;
  unlockedMnemonic = new TextDecoder().decode(plaintext);
  unlockedPassphrase = passphrase;
  if (!readAutoLockEnabled()) {
    await storeKey(key);
  }
}

export function lock(): void {
  unlockedKey = null;
  unlockedMnemonic = null;
  unlockedPassphrase = null;
}

/** The BIP-39 passphrase for the current session ('' if none). */
export function getSessionPassphrase(): string {
  return unlockedPassphrase ?? '';
}

/**
 * Runs a callback with the decrypted mnemonic while the vault is open.
 * Throws when no mnemonic is available (no vault, or a vault that could
 * not auto-unlock). The mnemonic reference is dropped when the callback
 * returns; callers must not retain or log it.
 */
export function withMnemonic<T>(fn: (mnemonic: string) => T): T {
  if (unlockedMnemonic === null) {
    throw new Error('Vault is not unlocked.');
  }
  return fn(unlockedMnemonic);
}

/**
 * Async form of withMnemonic (Phase 4 send): runs an async callback with
 * the decrypted mnemonic while the vault is open and awaits it, so the
 * mnemonic reference is dropped only after the async work finishes.
 * Throws when no mnemonic is available. Callers must not retain or log it.
 */
export async function withMnemonicAsync<T>(
  fn: (mnemonic: string) => Promise<T>,
): Promise<T> {
  if (unlockedMnemonic === null) {
    throw new Error('Vault is not unlocked.');
  }
  return fn(unlockedMnemonic);
}

/**
 * Re-encrypts the vault under a new password. There is no lock to verify
 * against, so only the new password is needed: the mnemonic is already
 * in the closure. The stored key is replaced with the newly derived one,
 * so auto-unlock keeps working. The stored recovery profileIds are never
 * changed: a restore needing another profile must delete and recreate the
 * vault explicitly.
 */
export async function changePassword(newPassword: string): Promise<void> {
  if (newPassword.length === 0) {
    throw new Error('Password must not be empty.');
  }
  const envelope = readEnvelope();
  if (envelope === null) {
    throw new Error('No vault exists.');
  }
  const mnemonic = withMnemonic((m) => m);
  const { envelope: next, key } = await encryptEnvelope(
    mnemonic,
    newPassword,
    envelope.profileIds,
  );
  if (readAutoLockEnabled()) {
    deleteStoredKey();
  } else {
    await storeKey(key);
  }
  writeEnvelope(next);
  unlockedKey = key;
}

/** Deletes the vault and its stored key, dropping every closure reference. */
export function deleteVault(): void {
  getStorage().removeItem(VAULT_STORAGE_KEY);
  deleteStoredKey();
  unlockedKey = null;
  unlockedMnemonic = null;
  unlockedPassphrase = null;
}
