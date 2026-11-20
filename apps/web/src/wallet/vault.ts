/**
 * Password-protected encrypted local vault.
 *
 * Follows OneKey's secret-envelope layering and MetaMask keyring-controller's
 * unlock/lock lifecycle as patterns only. The envelope in localStorage holds
 * only version, KDF parameters, salt, IV, ciphertext, recovery profileIds
 * and provenance metadata — never a mnemonic, seed, key or password.
 *
 * The decrypted mnemonic lives only transiently in this module's closure
 * while the vault is unlocked. It is never held in React state, component
 * refs, localStorage or logs. JavaScript strings are immutable, so "zeroing"
 * means dropping every reference to the value (and to the CryptoKey) as soon
 * as it is no longer needed; no copy is retained anywhere after lock().
 */

export const VAULT_STORAGE_KEY = 'bawa-vault';
export const VAULT_BACKUP_STORAGE_KEY = 'bawa-vault-backup';
export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_HASH = 'SHA-256';
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const VAULT_CIPHER = 'AES-GCM';
export const VAULT_KEY_BITS = 256;

export const VAULT_WRONG_PASSWORD = 'Incorrect password.';
export const VAULT_CORRUPTED = 'Vault is corrupted.';

/**
 * Typed vault failure. The numeric `code` is the contract; the message
 * text is kept separate in VAULT_ERROR_MESSAGES. Codes 1001–1005 match
 * the shared error catalogue (`wallet/errors.ts`, P1 lane) exactly;
 * 1006–1008 are proposed additions for that catalogue to adopt. The
 * merge swaps this local definition for an import of `BawaError` and
 * `WalletErrorCodes` — the numbers and messages do not change.
 */
export class VaultError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const VAULT_ERROR_CODES = {
  WRONG_PASSWORD: 1001,
  CORRUPTED: 1002,
  NOT_FOUND: 1003,
  LOCKED: 1004,
  EXISTS: 1005,
  UNKNOWN_VERSION: 1006,
  BACKUP_MISSING: 1007,
  BACKUP_CORRUPTED: 1008,
} as const;

export type VaultErrorCode =
  (typeof VAULT_ERROR_CODES)[keyof typeof VAULT_ERROR_CODES];

export const VAULT_ERROR_MESSAGES: Record<VaultErrorCode, string> = {
  [VAULT_ERROR_CODES.WRONG_PASSWORD]: VAULT_WRONG_PASSWORD,
  [VAULT_ERROR_CODES.CORRUPTED]: VAULT_CORRUPTED,
  [VAULT_ERROR_CODES.NOT_FOUND]: 'No vault exists.',
  [VAULT_ERROR_CODES.LOCKED]: 'Vault is locked.',
  [VAULT_ERROR_CODES.EXISTS]: 'A vault already exists.',
  [VAULT_ERROR_CODES.UNKNOWN_VERSION]: 'Vault version is not supported.',
  [VAULT_ERROR_CODES.BACKUP_MISSING]: 'No vault backup exists.',
  [VAULT_ERROR_CODES.BACKUP_CORRUPTED]: 'Vault backup is corrupted.',
};

function vaultError(code: VaultErrorCode): VaultError {
  return new VaultError(code, VAULT_ERROR_MESSAGES[code]);
}

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
  provenance?: KeyProvenance;
}

/**
 * Records where a vault's key came from. The flag alone is NOT
 * enforcement — a test-marked account must still be blocked at the send
 * boundary by other code.
 */
export interface KeyProvenance {
  source: 'created' | 'imported' | 'test' | 'unknown';
  isTesting: boolean;
}

/** Reusable test-identity fixture: marks a vault as test-only. */
export const TEST_PROVENANCE: KeyProvenance = Object.freeze({
  source: 'test',
  isTesting: true,
});

function isKeyProvenance(value: unknown): value is KeyProvenance {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as { source?: unknown; isTesting?: unknown };
  return (
    (candidate.source === 'created' ||
      candidate.source === 'imported' ||
      candidate.source === 'test' ||
      candidate.source === 'unknown') &&
    typeof candidate.isTesting === 'boolean'
  );
}

/**
 * Provenance of a validated envelope. Envelopes written before provenance
 * existed read as 'unknown'. A present-but-malformed provenance is
 * corruption.
 */
function provenanceFromEnvelope(envelope: VaultEnvelope): KeyProvenance {
  if (!Object.prototype.hasOwnProperty.call(envelope, 'provenance')) {
    return { source: 'unknown', isTesting: false };
  }
  const provenance: unknown = envelope.provenance;
  if (!isKeyProvenance(provenance)) {
    throw corruptError();
  }
  return { source: provenance.source, isTesting: provenance.isTesting };
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
    false,
    ['encrypt', 'decrypt'],
  );
}

function corruptError(): VaultError {
  return vaultError(VAULT_ERROR_CODES.CORRUPTED);
}

/** Validates a version-1 envelope's shape; throws CORRUPTED otherwise. */
function validateV1Envelope(parsed: unknown): VaultEnvelope {
  const envelope = parsed as Partial<VaultEnvelope>;
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    envelope.kdf?.name !== 'PBKDF2' ||
    typeof envelope.kdf?.hash !== 'string' ||
    typeof envelope.kdf?.iterations !== 'number' ||
    typeof envelope.kdf?.saltB64 !== 'string' ||
    typeof envelope.ivB64 !== 'string' ||
    typeof envelope.ciphertextB64 !== 'string' ||
    !Array.isArray(envelope.profileIds) ||
    !envelope.profileIds.every((id) => typeof id === 'string')
  ) {
    throw corruptError();
  }
  // A present-but-malformed provenance is corruption; a missing one reads
  // as 'unknown' (see provenanceFromEnvelope).
  provenanceFromEnvelope(envelope as VaultEnvelope);
  return envelope as VaultEnvelope;
}

type VaultMigrator = (parsed: unknown) => VaultEnvelope;

// Future migrators convert their source version to the current envelope.
// Version 1 passes through validation and has no migrator.
const VAULT_MIGRATORS: Partial<Record<number, VaultMigrator>> = {};

/**
 * Migration dispatcher for the vault envelope. Version 1 passes through
 * validation; any other version fails loudly with UNKNOWN_VERSION unless
 * a migrator is registered for it. Malformed envelopes fail CORRUPTED.
 */
export function migrateEnvelope(parsed: unknown): VaultEnvelope {
  if (parsed === null || typeof parsed !== 'object') {
    throw corruptError();
  }
  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== 'number') {
    throw corruptError();
  }
  if (version === VAULT_VERSION) {
    return validateV1Envelope(parsed);
  }
  const migrator = VAULT_MIGRATORS[version];
  if (!migrator) {
    throw vaultError(VAULT_ERROR_CODES.UNKNOWN_VERSION);
  }
  return migrator(parsed);
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
    throw corruptError();
  }
  // Outside the JSON-parse catch: an UNKNOWN_VERSION failure must not be
  // turned into CORRUPTED.
  return migrateEnvelope(parsed);
}

function writeEnvelope(envelope: VaultEnvelope): void {
  getStorage().setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

async function encryptEnvelope(
  mnemonic: string,
  password: string,
  profileIds: string[],
  provenance?: KeyProvenance,
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
      ...(provenance === undefined ? {} : { provenance: { ...provenance } }),
    },
    key,
  };
}

/** Creates a vault. Throws if a vault already exists or the mnemonic is empty. */
export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
  passphrase = '',
  provenance: KeyProvenance = { source: 'created', isTesting: false },
): Promise<void> {
  if (mnemonic.length === 0) {
    throw new Error('Mnemonic must not be empty.');
  }
  if (password.length === 0) {
    throw new Error('Password must not be empty.');
  }
  if (!isKeyProvenance(provenance)) {
    throw new Error('Invalid key provenance.');
  }
  if (hasVault()) {
    throw vaultError(VAULT_ERROR_CODES.EXISTS);
  }
  const storedProvenance: KeyProvenance = {
    source: provenance.source,
    isTesting: provenance.isTesting,
  };
  const { envelope, key } = await encryptEnvelope(
    mnemonic,
    password,
    profileIds,
    storedProvenance,
  );
  writeEnvelope(envelope);
  writeVaultBackup();
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

/** Stored key provenance, or null when there is no vault. */
export function vaultProvenance(): KeyProvenance | null {
  const envelope = readEnvelope();
  return envelope === null ? null : provenanceFromEnvelope(envelope);
}

/** True only when a vault exists and is marked as a test-only identity. */
export function isTestVault(): boolean {
  return vaultProvenance()?.isTesting === true;
}

/**
 * True when the password decrypts the stored envelope. Never changes
 * locked/unlocked state and never throws for a wrong password; false
 * for a wrong password, a corrupt envelope, or no vault.
 */
export async function verifyVaultPassword(password: string): Promise<boolean> {
  try {
    const envelope = readEnvelope();
    if (envelope === null) {
      return false;
    }
    // Trial decrypt only: discard the result.
    await decryptEnvelopeText(envelope, password);
    return true;
  } catch {
    return false;
  }
}

export function isLocked(): boolean {
  return unlockedKey === null;
}

/**
 * Unlocks the vault. Throws VAULT_WRONG_PASSWORD on a wrong password and
 * VAULT_CORRUPTED on a structurally invalid envelope.
 */
export async function unlock(password: string, passphrase = ''): Promise<void> {
  const envelope = readEnvelope();
  if (envelope === null) {
    throw vaultError(VAULT_ERROR_CODES.NOT_FOUND);
  }
  const { text, key } = await decryptEnvelopeText(envelope, password);
  unlockedKey = key;
  unlockedMnemonic = text;
  unlockedPassphrase = passphrase;
}

/** Locks the vault, dropping every reference to the key and the mnemonic. */
export function lock(): void {
  unlockedKey = null;
  unlockedMnemonic = null;
  unlockedPassphrase = null;
}

/**
 * Trial-decrypts an envelope without touching unlocked state. Returns the
 * plaintext and the derived key. Throws VAULT_WRONG_PASSWORD when
 * decryption fails and VAULT_CORRUPTED on undecodable base64.
 */
async function decryptEnvelopeText(
  envelope: VaultEnvelope,
  password: string,
): Promise<{ text: string; key: CryptoKey }> {
  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = fromBase64(envelope.kdf.saltB64);
    iv = fromBase64(envelope.ivB64);
    ciphertext = fromBase64(envelope.ciphertextB64);
  } catch {
    throw vaultError(VAULT_ERROR_CODES.CORRUPTED);
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
    throw vaultError(VAULT_ERROR_CODES.WRONG_PASSWORD);
  }
  return { text: new TextDecoder().decode(plaintext), key };
}

/**
 * Restores the primary vault from the backup after primary loss or
 * damage. The backup is proven to decrypt with the given password
 * BEFORE the primary is touched; a wrong password, missing backup or
 * corrupt backup leaves the primary exactly as it was.
 */
export async function restoreVaultFromBackup(password: string): Promise<void> {
  const backupText = getStorage().getItem(VAULT_BACKUP_STORAGE_KEY);
  if (backupText === null) {
    throw vaultError(VAULT_ERROR_CODES.BACKUP_MISSING);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(backupText);
  } catch {
    throw corruptError();
  }
  // migrateEnvelope validates the shape and fails loudly (UNKNOWN_VERSION)
  // on a version this code cannot read; a corrupt backup fails CORRUPTED.
  const envelope = migrateEnvelope(parsed);
  // Verify before changing either the primary envelope or unlocked state.
  await decryptEnvelopeText(envelope, password);
  writeEnvelope(envelope);
  await unlock(password);
}

/** The BIP-39 passphrase for the current unlocked session ('' if none). */
export function getSessionPassphrase(): string {
  return unlockedPassphrase ?? '';
}

/**
 * Runs a callback with the decrypted mnemonic while the vault is unlocked.
 * Throws when locked. The mnemonic reference is dropped when the callback
 * returns; callers must not retain or log it.
 */
export function withMnemonic<T>(fn: (mnemonic: string) => T): T {
  if (unlockedMnemonic === null) {
    throw vaultError(VAULT_ERROR_CODES.LOCKED);
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
    throw vaultError(VAULT_ERROR_CODES.LOCKED);
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
    throw vaultError(VAULT_ERROR_CODES.NOT_FOUND);
  }
  const wasLocked = isLocked();
  await unlock(oldPassword);
  const mnemonic = unlockedMnemonic as string;
  const preservedProvenance = provenanceFromEnvelope(envelope);
  const { envelope: next } = await encryptEnvelope(
    mnemonic,
    newPassword,
    envelope.profileIds,
    preservedProvenance,
  );
  writeEnvelope(next);
  writeVaultBackup();
  if (wasLocked) {
    lock();
  } else {
    // Re-derive the in-memory key under the new password.
    await unlock(newPassword);
  }
}

/** Deletes the vault and its backup, and locks. */
export function deleteVault(): void {
  getStorage().removeItem(VAULT_STORAGE_KEY);
  deleteVaultBackup();
  lock();
}

/**
 * True only when the backup key holds an envelope this version can read.
 * A corrupt backup, or one with an unknown version, counts as absent
 * and never throws.
 */
export function hasVaultBackup(): boolean {
  try {
    const raw = getStorage().getItem(VAULT_BACKUP_STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    migrateEnvelope(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies the current primary envelope verbatim to the backup key.
 * The backup holds the same encrypted envelope, never plaintext.
 * Throws when there is no primary vault or it is unreadable.
 */
export function writeVaultBackup(): void {
  const envelope = readEnvelope();
  if (envelope === null) {
    throw vaultError(VAULT_ERROR_CODES.NOT_FOUND);
  }
  const raw = getStorage().getItem(VAULT_STORAGE_KEY);
  if (raw === null) {
    throw vaultError(VAULT_ERROR_CODES.NOT_FOUND);
  }
  getStorage().setItem(VAULT_BACKUP_STORAGE_KEY, raw);
}

/** Removes the backup key. */
export function deleteVaultBackup(): void {
  getStorage().removeItem(VAULT_BACKUP_STORAGE_KEY);
}
