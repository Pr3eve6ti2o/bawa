/**
 * Password-protected encrypted local vault.
 *
 * Follows OneKey's secret-envelope layering and MetaMask keyring-controller's
 * unlock/lock lifecycle as patterns only. The envelope in localStorage holds
 * only version, KDF parameters, salt, IV, ciphertext and recovery profileIds
 * — never a mnemonic, seed, key or password.
 *
 * The decrypted mnemonic lives only transiently in this module's closure
 * while the vault is unlocked. It is never held in React state, component
 * refs, localStorage or logs. JavaScript strings are immutable, so "zeroing"
 * means dropping every reference to the value (and to the CryptoKey) as soon
 * as it is no longer needed; no copy is retained anywhere after lock().
 */

export const VAULT_STORAGE_KEY = 'bawa-vault';
export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_HASH = 'SHA-256';
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const VAULT_CIPHER = 'AES-GCM';
export const VAULT_KEY_BITS = 256;

export const VAULT_WRONG_PASSWORD = 'Incorrect password.';
export const VAULT_CORRUPTED = 'Vault is corrupted.';

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
    false,
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

async function encryptEnvelope(
  mnemonic: string,
  password: string,
  profileIds: string[],
): Promise<VaultEnvelope> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: VAULT_CIPHER, iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );
  return {
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
  };
}

/** Creates a vault. Throws if a vault already exists or the mnemonic is empty. */
export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
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
  const envelope = await encryptEnvelope(mnemonic, password, profileIds);
  writeEnvelope(envelope);
  lock();
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

export function isLocked(): boolean {
  return unlockedKey === null;
}

/**
 * Unlocks the vault. Throws VAULT_WRONG_PASSWORD on a wrong password and
 * VAULT_CORRUPTED on a structurally invalid envelope.
 */
export async function unlock(password: string): Promise<void> {
  const envelope = readEnvelope();
  if (envelope === null) {
    throw new Error('No vault exists.');
  }
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
    // Wrong password and tampered ciphertext are indistinguishable by design;
    // both fail authentication. One fixed message, no oracle.
    throw new Error(VAULT_WRONG_PASSWORD);
  }
  unlockedKey = key;
  unlockedMnemonic = new TextDecoder().decode(plaintext);
}

/** Locks the vault, dropping every reference to the key and the mnemonic. */
export function lock(): void {
  unlockedKey = null;
  unlockedMnemonic = null;
}

/**
 * Runs a callback with the decrypted mnemonic while the vault is unlocked.
 * Throws when locked. The mnemonic reference is dropped when the callback
 * returns; callers must not retain or log it.
 */
export function withMnemonic<T>(fn: (mnemonic: string) => T): T {
  if (unlockedMnemonic === null) {
    throw new Error('Vault is locked.');
  }
  return fn(unlockedMnemonic);
}

/**
 * Async form of withMnemonic (Phase 4 send): runs an async callback with
 * the decrypted mnemonic while the vault is unlocked and awaits it, so the
 * mnemonic reference is dropped only after the async work finishes.
 * Throws when locked. Callers must not retain or log it.
 */
export async function withMnemonicAsync<T>(
  fn: (mnemonic: string) => Promise<T>,
): Promise<T> {
  if (unlockedMnemonic === null) {
    throw new Error('Vault is locked.');
  }
  return fn(unlockedMnemonic);
}

/**
 * Re-encrypts the vault under a new password. The stored recovery profileIds
 * are never changed: a restore needing another profile must delete and
 * recreate the vault explicitly.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length === 0) {
    throw new Error('Password must not be empty.');
  }
  const envelope = readEnvelope();
  if (envelope === null) {
    throw new Error('No vault exists.');
  }
  const wasLocked = isLocked();
  await unlock(oldPassword);
  const mnemonic = unlockedMnemonic as string;
  const next = await encryptEnvelope(mnemonic, newPassword, envelope.profileIds);
  writeEnvelope(next);
  if (wasLocked) {
    lock();
  } else {
    // Re-derive the in-memory key under the new password.
    await unlock(newPassword);
  }
}

/** Deletes the vault and locks. */
export function deleteVault(): void {
  getStorage().removeItem(VAULT_STORAGE_KEY);
  lock();
}
