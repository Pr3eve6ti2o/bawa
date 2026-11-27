/**
 * Password-protected encrypted vault (AES-GCM-256, PBKDF2 with 600,000 iterations).
 *
 * Merge 2 (layout-rebuild into adopt-proper) resolution - Lane A2: the
 * Merge 1 vault (versioned envelope migration via migrateEnvelope, key
 * provenance via vaultProvenance/isTestVault/TEST_PROVENANCE,
 * backup/restore via hasVaultBackup/writeVaultBackup/deleteVaultBackup/
 * restoreVaultFromBackup, and verifyVaultPassword) is merged with the
 * optional auto-lock vault (owner order 2026-11-20 ~23:11 IST,
 * docs/DECISIONS.md section 8, which supersedes the lock-removal
 * decision in section 7): lock()/unlock()/isLocked(), VaultState
 * 'locked' in the wallet context, and the auto-lock timer there.
 *
 * Auto-lock is OPTIONAL and OFF by default. Key persistence is owned by
 * the auto-lock setting (the key-storage invariant):
 * - OFF: the PBKDF2-derived key is exported (raw bytes, base64) and
 *   stored in localStorage under VAULT_KEY_STORAGE_KEY next to the
 *   envelope; on boot autoUnlock() reads it and the vault opens with no
 *   password prompt. createVault, unlock, changePassword and
 *   restoreVaultFromBackup all store the key this way while OFF.
 * - ON: no key is stored (enabling deletes it; changePassword deletes
 *   it too), so a reload or a lock leaves the vault genuinely locked and
 *   unlocking requires the password. The vault is still open in memory
 *   until the timer fires, lock() is called, or the page reloads.
 * Disabling auto-lock stores the in-memory key when unlocked
 * (storeCurrentKey); when locked it stores nothing - the next unlock()
 * stores the key because the preference is already off by then.
 *
 * Follows OneKey's secret-envelope layering as a pattern only. The envelope
 * in localStorage holds only version, KDF parameters, salt, IV, ciphertext,
 * recovery profileIds and provenance metadata - never a mnemonic, seed, key
 * or password.
 *
 * SECURITY TRADEOFF (owner decision, 2026-11-20): with auto-lock OFF the
 * raw vault key sits in localStorage next to the ciphertext it decrypts,
 * so anyone who can read this origin's localStorage can decrypt the vault
 * without the password. The mnemonic itself is still never stored in
 * plaintext, and the envelope stays AES-GCM-256 / PBKDF2 600k. This is the
 * standard "stay unlocked" pattern and the owner's explicit choice; with
 * auto-lock OFF the vault must never be described as locked. With
 * auto-lock ON there is no stored key while locked, so the lock is real.
 *
 * The backup (VAULT_BACKUP_STORAGE_KEY) is a verbatim copy of the primary
 * envelope - the same ciphertext, never plaintext. Restoring from it
 * re-derives the key from the password and stores it the auto-unlock way
 * ONLY when auto-lock is off (the key-storage invariant); with auto-lock
 * on, the restored vault is open in memory but locks on the next boot.
 * Deleting the vault deletes the backup too: a deleted vault must not be
 * resurrectable from a copy the user asked to delete.
 *
 * The decrypted mnemonic and key live only transiently in this module's
 * closure while the vault is open. They are never held in React state,
 * component refs, localStorage or logs. JavaScript strings are immutable,
 * so "zeroing" means dropping every reference to the value (and to the
 * CryptoKey) as soon as it is no longer needed; no copy is retained
 * anywhere after lock() or deleteVault(). The in-memory key
 * (unlockedKey) is what isLocked() reads: it is set by createVault,
 * autoUnlock, unlock, changePassword and restoreVaultFromBackup, and
 * cleared by lock() and deleteVault().
 *
 * Vault failures use the shared BawaError catalogue (wallet/errors.ts);
 * the messages are the same strings adopt-proper used as plain Errors.
 * One deliberate exception: withMnemonic / withMnemonicAsync throw a
 * plain Error ('Vault is not unlocked.') - the same throw covers the
 * no-vault and the locked cases, and no caller switches on the code for
 * this path. unlock() reuses decryptEnvelopeText, so a wrong password
 * throws the catalogue VAULT_WRONG_PASSWORD (1001) and a corrupt
 * envelope VAULT_CORRUPTED (1002), with the same messages the
 * layout-rebuild vault threw as plain Errors.
 */

import {
  createWalletError,
  ERROR_MESSAGES,
  WalletErrorCodes,
} from './errors';
import { readAutoLockEnabled } from './auto-lock';

export const VAULT_STORAGE_KEY = 'bawa-vault';
export const VAULT_BACKUP_STORAGE_KEY = 'bawa-vault-backup';
/** localStorage key for the raw vault key (base64) that auto-unlock uses. */
export const VAULT_KEY_STORAGE_KEY = 'bawa-vault-key';
const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
/**
 * KDF iterations a stored envelope may carry (A-10). The wallet only
 * ever writes PBKDF2_ITERATIONS; the band allows a future increase
 * while keeping unlock fast and WebCrypto-legal: 0 / negative /
 * fractional values throw raw DOMExceptions, and a huge value wraps
 * through WebIDL (1e12 becomes ~3.6B) and hangs unlock for minutes.
 * Anything outside the band is corruption (VAULT_CORRUPTED), never a
 * raw error or a hang.
 */
const PBKDF2_ITERATIONS_MIN = 1;
const PBKDF2_ITERATIONS_MAX = 2_000_000;
const PBKDF2_HASH = 'SHA-256';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VAULT_CIPHER = 'AES-GCM';
const VAULT_KEY_BITS = 256;

/** 'Vault is corrupted.' — the catalogue message for VAULT_CORRUPTED. */
export const VAULT_CORRUPTED: string =
  ERROR_MESSAGES[WalletErrorCodes.VAULT_CORRUPTED];

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

/**
 * The derived key for the open vault, held in memory only. This is what
 * isLocked() reads and what storeCurrentKey() stores when auto-lock is
 * turned off. Set by createVault, autoUnlock, unlock, changePassword and
 * restoreVaultFromBackup; cleared by lock() and deleteVault(). Merge 1
 * removed it as dead (the no-lock vault never read it); Merge 2 restores
 * it because lock/unlock need the in-memory key.
 */
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
    // (owner decision — see the module doc comment) and so a restore can
    // store the key it derives from the password. The derived key is
    // never exposed outside this module except as stored key bytes.
    true,
    ['encrypt', 'decrypt'],
  );
}

function corruptError(): Error {
  return createWalletError(WalletErrorCodes.VAULT_CORRUPTED);
}

/** Validates a version-1 envelope's shape; throws CORRUPTED otherwise. */
function validateV1Envelope(parsed: unknown): VaultEnvelope {
  const envelope = parsed as Partial<VaultEnvelope>;
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    envelope.kdf?.name !== 'PBKDF2' ||
    typeof envelope.kdf?.hash !== 'string' ||
    typeof envelope.kdf?.saltB64 !== 'string' ||
    typeof envelope.ivB64 !== 'string' ||
    typeof envelope.ciphertextB64 !== 'string' ||
    !Array.isArray(envelope.profileIds) ||
    !envelope.profileIds.every((id) => typeof id === 'string')
  ) {
    throw corruptError();
  }
  // KDF iterations are live input to WebCrypto (see the constants
  // above): validate the range here, at the envelope boundary, so no
  // bad value can reach deriveKey.
  const iterations = envelope.kdf?.iterations;
  if (
    typeof iterations !== 'number' ||
    !Number.isSafeInteger(iterations) ||
    iterations < PBKDF2_ITERATIONS_MIN ||
    iterations > PBKDF2_ITERATIONS_MAX
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
    throw createWalletError(WalletErrorCodes.VAULT_UNKNOWN_VERSION);
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

/**
 * Trial-decrypts an envelope without touching unlocked state. Returns the
 * plaintext and the derived key. Throws BawaError (code 1001) when
 * decryption fails and BawaError (code 1002) on undecodable base64.
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
    throw createWalletError(WalletErrorCodes.VAULT_CORRUPTED);
  }
  let key: CryptoKey;
  try {
    // Defence in depth: envelopes are range-checked at the read
    // boundary, so this cannot fail on iterations — but a key
    // derivation failure must still surface as corruption, never as
    // a raw WebCrypto error on the lock screen.
    key = await deriveKey(password, salt, envelope.kdf.iterations);
  } catch {
    throw createWalletError(WalletErrorCodes.VAULT_CORRUPTED);
  }
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
    throw createWalletError(WalletErrorCodes.VAULT_WRONG_PASSWORD);
  }
  return { text: new TextDecoder().decode(plaintext), key };
}

/**
 * Trial-decrypts an envelope with an already-imported key. Returns the
 * plaintext. Throws VAULT_WRONG_PASSWORD when the key does not match —
 * a wrong key and tampered ciphertext are indistinguishable by design.
 * Used by backup-share verification: the reconstructed key is proven
 * against the real envelope, because Shamir's combine() does not verify
 * reconstruction integrity itself.
 */
async function decryptEnvelopeWithKey(
  envelope: VaultEnvelope,
  key: CryptoKey,
): Promise<string> {
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    iv = fromBase64(envelope.ivB64);
    ciphertext = fromBase64(envelope.ciphertextB64);
  } catch {
    throw createWalletError(WalletErrorCodes.VAULT_CORRUPTED);
  }
  let plaintext: ArrayBuffer;
  try {
    plaintext = await globalThis.crypto.subtle.decrypt(
      { name: VAULT_CIPHER, iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw createWalletError(WalletErrorCodes.VAULT_WRONG_PASSWORD);
  }
  return new TextDecoder().decode(plaintext);
}

/**
 * Exports the raw bytes of the open vault's key (32 bytes), or null when
 * the vault is locked or there is no vault. Only the backup-shares flow
 * calls this, while the vault is unlocked and only after the user asks
 * to create shares. The bytes are held in screen state only until the
 * shares are made, then dropped; they are never written to storage or
 * logs. (Export works because every key this module holds is extractable:
 * deriveKey() creates extractable keys and autoUnlock() imports its key
 * extractable — see below. Page JavaScript can already read the mnemonic
 * while the vault is unlocked, so extractability grants no new power.)
 */
export async function exportUnlockedKeyBytes(): Promise<Uint8Array | null> {
  if (unlockedKey === null) {
    return null;
  }
  try {
    const raw = await globalThis.crypto.subtle.exportKey('raw', unlockedKey);
    return new Uint8Array(raw);
  } catch {
    return null;
  }
}

/**
 * Trial-decrypts the stored vault envelope with candidate key bytes —
 * the integrity check Shamir reconstruction needs. Returns true only
 * when the bytes are the vault's key; false for wrong bytes, a corrupt
 * envelope, or no vault. Never throws for a bad key.
 */
export async function verifyReconstructedKey(
  keyBytes: Uint8Array,
): Promise<boolean> {
  try {
    const envelope = readEnvelope();
    if (envelope === null) {
      return false;
    }
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: VAULT_CIPHER, length: VAULT_KEY_BITS },
      false,
      ['decrypt'],
    );
    await decryptEnvelopeWithKey(envelope, key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a vault. Throws if a vault already exists or the mnemonic is empty.
 * The derived key is stored only when auto-lock is off (see the module doc
 * comment), so the vault auto-unlocks on later boots; with auto-lock on no
 * key is stored and the vault locks on the next boot. Either way the vault
 * is open immediately after creation: the mnemonic and key stay in the
 * closure and are never written to storage. A verbatim backup of the
 * envelope is written at creation.
 */
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
    throw createWalletError(WalletErrorCodes.VAULT_EXISTS);
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
  // Store the key before the envelope: a failure here leaves no half-made
  // vault behind.
  if (!readAutoLockEnabled()) {
    await storeKey(key);
  }
  writeEnvelope(envelope);
  writeVaultBackup();
  // Lane C, items 6/7/17: a fresh phrase starts with one account,
  // Account 1. Further accounts are recorded by the wallet context.
  writeVaultAccounts([0]);
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
 * unlocked state and never throws for a wrong password; false for a wrong
 * password, a corrupt envelope, or no vault.
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
    // Extractable: backup shares need to export the open vault's key
    // (exportUnlockedKeyBytes), and a vault opened by auto-unlock must
    // offer shares exactly like one opened by unlock(). No new privilege:
    // page JavaScript can already read the mnemonic while unlocked, and
    // with auto-lock off the raw key is already in localStorage.
    key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: VAULT_CIPHER, length: VAULT_KEY_BITS },
      true,
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

/**
 * Unlocks the vault with the password. Reuses decryptEnvelopeText, so a
 * wrong password throws the catalogue VAULT_WRONG_PASSWORD (1001) and a
 * corrupt envelope VAULT_CORRUPTED (1002) - the same messages the
 * layout-rebuild vault threw as plain Errors. No vault throws catalogue
 * VAULT_NOT_FOUND (1003, 'No vault exists.'). The derived key is stored
 * only when auto-lock is off (the key-storage invariant); with auto-lock
 * on the vault is open in memory only, and a reload locks it again.
 * The session passphrase is set from the argument ('', the default, when
 * the wallet does not use one).
 */
export async function unlock(password: string, passphrase = ''): Promise<void> {
  const envelope = readEnvelope();
  if (envelope === null) {
    throw createWalletError(WalletErrorCodes.VAULT_NOT_FOUND);
  }
  const { text, key } = await decryptEnvelopeText(envelope, password);
  unlockedKey = key;
  unlockedMnemonic = text;
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
 *
 * The throw is a plain Error ('Vault is not unlocked.'), deliberately
 * NOT the catalogue's VAULT_LOCKED ('Vault is locked.'): the same throw
 * covers the no-vault case, where the locked message would be wrong.
 * No caller switches on the code for this path.
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
 * in the closure. The in-memory key is replaced with the newly derived
 * one; the stored key follows the auto-lock setting - replaced when
 * auto-lock is off so auto-unlock keeps working, deleted when on (a
 * stale old key must not survive). The backup is refreshed so the new
 * password restores. The stored recovery profileIds and the key
 * provenance are never changed: a restore needing another profile must
 * delete and recreate the vault explicitly.
 */
export async function changePassword(newPassword: string): Promise<void> {
  if (newPassword.length === 0) {
    throw new Error('Password must not be empty.');
  }
  const envelope = readEnvelope();
  if (envelope === null) {
    throw createWalletError(WalletErrorCodes.VAULT_NOT_FOUND);
  }
  const mnemonic = withMnemonic((m) => m);
  const preservedProvenance = provenanceFromEnvelope(envelope);
  const { envelope: next, key } = await encryptEnvelope(
    mnemonic,
    newPassword,
    envelope.profileIds,
    preservedProvenance,
  );
  if (readAutoLockEnabled()) {
    deleteStoredKey();
  } else {
    await storeKey(key);
  }
  writeEnvelope(next);
  writeVaultBackup();
  unlockedKey = key;
}

/**
 * Restores the primary vault from the backup after primary loss or
 * damage. The backup is proven to decrypt with the given password
 * BEFORE the primary is touched; a wrong password, missing backup or
 * corrupt backup leaves the primary exactly as it was. The derived key
 * is stored the auto-unlock way ONLY when auto-lock is off (the
 * key-storage invariant - Merge 2 decision: a restore follows the same
 * rule as createVault/unlock/changePassword, since the layout-rebuild
 * side had no restore to contradict it); with auto-lock on, no key is
 * stored and the restored vault locks on the next boot. Either way the
 * mnemonic and key are put in the closure, so the restored vault is
 * open immediately.
 */
export async function restoreVaultFromBackup(password: string): Promise<void> {
  const backupText = getStorage().getItem(VAULT_BACKUP_STORAGE_KEY);
  if (backupText === null) {
    throw createWalletError(WalletErrorCodes.VAULT_BACKUP_MISSING);
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
  const { text, key } = await decryptEnvelopeText(envelope, password);
  writeEnvelope(envelope);
  if (!readAutoLockEnabled()) {
    await storeKey(key);
  }
  unlockedKey = key;
  unlockedMnemonic = text;
  unlockedPassphrase = '';
}

/**
 * Deletes the vault, its stored key and its backup, dropping every
 * closure reference. The backup goes with the vault: a deleted vault
 * must not be resurrectable from a copy the user asked to delete.
 * The accounts created from its phrase go with it too (Lane C): a new
 * phrase starts over at Account 1. (HD receive rotation is reset by the
 * wallet context's resetReceiveRotation, called by the screen that
 * deletes the vault.)
 */
export function deleteVault(): void {
  getStorage().removeItem(VAULT_STORAGE_KEY);
  deleteStoredKey();
  deleteVaultBackup();
  clearVaultAccounts();
  unlockedKey = null;
  unlockedMnemonic = null;
  unlockedPassphrase = null;
}

// --- Lane C, items 6/7/17: vault accounts ---------------------------------
// One recovery phrase holds many named accounts. Account index 0 is
// "Account 1", index 1 is "Account 2", and so on. Only public account
// index numbers are persisted here — never a recovery phrase, passphrase
// or key. The vault owns the phrase; this record only says which
// accounts from it the user has created.
export const VAULT_ACCOUNTS_KEY = 'bawa-vault-accounts:v1';
const MAX_VAULT_ACCOUNTS = 200;
export const MAX_CREATE_AT_ONCE = 50;

/** "Account 1" for index 0, "Account 2" for index 1, and so on. */
export function accountName(account: number): string {
  if (!Number.isSafeInteger(account) || account < 0) {
    throw new RangeError('account must be a non-negative safe integer');
  }
  return `Account ${account + 1}`;
}

function cleanAccounts(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value.filter(
    (entry): entry is number =>
      Number.isSafeInteger(entry) && (entry as number) >= 0,
  );
  return [...new Set(cleaned)].sort((a, b) => a - b);
}

export function readVaultAccounts(): number[] {
  try {
    const raw = localStorage.getItem(VAULT_ACCOUNTS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== 1 ||
      !Array.isArray((parsed as { accounts?: unknown }).accounts)
    ) {
      return [];
    }
    return cleanAccounts((parsed as { accounts: unknown[] }).accounts).slice(
      0,
      MAX_VAULT_ACCOUNTS,
    );
  } catch {
    return [];
  }
}

export function writeVaultAccounts(accounts: number[]): void {
  if (
    accounts.some(
      (entry) => !Number.isSafeInteger(entry) || (entry as number) < 0,
    )
  ) {
    throw new RangeError(
      'accounts must be non-negative safe integers',
    );
  }
  const cleaned = cleanAccounts(accounts);
  if (cleaned.length > MAX_VAULT_ACCOUNTS) {
    throw new RangeError('too many accounts');
  }
  localStorage.setItem(
    VAULT_ACCOUNTS_KEY,
    JSON.stringify({ version: 1, accounts: cleaned }),
  );
}

/**
 * The merged list after creating `count` NEW accounts after the highest
 * existing one (Account 1 exists → 10 more gives Account 2–11).
 * Pure: it does not write anything.
 */
export function nextVaultAccounts(
  existing: number[],
  count: number,
): number[] {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > MAX_CREATE_AT_ONCE
  ) {
    throw new RangeError(
      `Count must be between 1 and ${MAX_CREATE_AT_ONCE}.`,
    );
  }
  const cleaned = cleanAccounts(existing);
  const highest = cleaned.length === 0 ? -1 : cleaned[cleaned.length - 1] as number;
  const next = [...cleaned];
  for (let offset = 1; offset <= count; offset += 1) {
    next.push(highest + offset);
  }
  if (next.length > MAX_VAULT_ACCOUNTS) {
    throw new RangeError('too many accounts');
  }
  return next;
}

export function clearVaultAccounts(): void {
  localStorage.removeItem(VAULT_ACCOUNTS_KEY);
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
    throw createWalletError(WalletErrorCodes.VAULT_NOT_FOUND);
  }
  const raw = getStorage().getItem(VAULT_STORAGE_KEY);
  if (raw === null) {
    throw createWalletError(WalletErrorCodes.VAULT_NOT_FOUND);
  }
  getStorage().setItem(VAULT_BACKUP_STORAGE_KEY, raw);
}

/** Removes the backup key. */
export function deleteVaultBackup(): void {
  getStorage().removeItem(VAULT_BACKUP_STORAGE_KEY);
}
