/**
 * Password-only encrypted vault (AES-GCM-256, PBKDF2 with 600,000 iterations).
 *
 * Owner order 2026-11-28 ~22:25 IST (reversing the auto-unlock KEEP decision
 * of 2026-11-28 ~14:05 IST): the vault unlocks by PASSWORD ONLY, and the
 * password itself is OPTIONAL. The auto-unlock stored-key mechanism is
 * GONE: no derived key is ever written to storage, there is no
 * `bawa-vault-key` entry, no autoUnlock() bypass, and no code path reads a
 * stored key. The non-extractable IndexedDB key rework is superseded — it
 * was never implemented and must not be.
 *
 * How the password works:
 * - WITH a password: the envelope is AES-GCM-256 under PBKDF2(password,
 *   salt, 600k). The vault boots locked; unlock() with the password is
 *   the only way in. The derived key lives in memory only while the
 *   vault is open and is dropped by lock() — and by the auto-lock timer
 *   when the user enables it. A password change re-encrypts under a new
 *   key and cancels every existing Shamir backup-share set.
 * - WITHOUT a password: the user chose to run unprotected. The envelope
 *   keeps the same format, but the key is derived from the EMPTY password
 *   (PBKDF2('', salt, 600k)). Anyone with access to this origin can
 *   re-derive that key from the stored salt, so the seed is effectively
 *   unprotected: there is no lock, no password prompt, and the vault
 *   opens at boot. No device key or obfuscation is invented to pretend
 *   otherwise — the UI says plainly that anyone with the device can open
 *   the wallet. The envelope records hasPassword: false so the app can
 *   tell the two states apart; envelopes written before the flag existed
 *   all had a password and read as hasPassword: true.
 *
 * The only prompt-free open left is openVaultIfPasswordless(), which works
 * solely for a vault with no password set. A password vault returns false
 * from it and stays locked.
 *
 * Upgrade: a vault created before this change may still hold a
 * `bawa-vault-key` entry in localStorage. removeLegacyStoredKey() deletes
 * it on first run (called from the wallet context's boot effect). The entry
 * is never read by any code path.
 *
 * Backup shares: the open vault's key stays EXTRACTABLE in memory only
 * (deriveKey, extractable: true) so exportUnlockedKeyBytes() can split it
 * for Shamir shares. Extractability grants no new power: page JavaScript
 * can already read the mnemonic while the vault is unlocked, and the key
 * is never written to storage. A password change — including setting a
 * first password or removing one — derives a new key and cancels every
 * existing share set; create fresh shares afterwards.
 *
 * Follows OneKey's secret-envelope layering as a pattern only. The envelope
 * in localStorage holds only version, KDF parameters, salt, IV, ciphertext,
 * recovery profileIds, the hasPassword flag and provenance metadata - never
 * a mnemonic, seed, key or password.
 *
 * The backup (VAULT_BACKUP_STORAGE_KEY) is a verbatim copy of the primary
 * envelope - the same ciphertext, never plaintext. Restoring from it
 * re-derives the key from the password; the restored vault is open in
 * memory but a password vault locks on the next boot. Deleting the vault
 * deletes the backup too: a deleted vault must not be resurrectable from
 * a copy the user asked to delete.
 *
 * The decrypted mnemonic and key live only transiently in this module's
 * closure while the vault is open. They are never held in React state,
 * component refs, localStorage or logs. JavaScript strings are immutable,
 * so "zeroing" means dropping every reference to the value (and to the
 * CryptoKey) as soon as it is no longer needed; no copy is retained
 * anywhere after lock() or deleteVault(). The in-memory key
 * (unlockedKey) is what isLocked() reads: it is set by createVault,
 * unlock, changePassword and restoreVaultFromBackup, and
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
import { clearBackupDone } from './backup-state';

export const VAULT_STORAGE_KEY = 'bawa-vault';
export const VAULT_BACKUP_STORAGE_KEY = 'bawa-vault-backup';
/**
 * The localStorage key the REMOVED auto-unlock mechanism used for the raw
 * vault key (base64). Kept as a module-private constant for ONE purpose
 * only: removeLegacyStoredKey() deletes any entry a pre-change install
 * left behind. It is never read, never written, and never exported.
 */
const LEGACY_VAULT_KEY_STORAGE_KEY = 'bawa-vault-key';
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
  /**
   * True when the vault was created with a password, false when the user
   * chose no password (the key is then derived from the empty password —
   * see the module doc comment). Absent on envelopes written before this
   * flag existed; those all had a password and read as true.
   */
  hasPassword?: boolean;
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
 * isLocked() reads. It is NEVER written to storage: the removed auto-unlock
 * mechanism used to persist it, and that is gone (owner order 2026-11-28).
 * Set by createVault, unlock, changePassword and restoreVaultFromBackup;
 * cleared by lock() and deleteVault().
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
    // Extractable IN MEMORY ONLY, so the open vault's key can be exported
    // for backup shares (exportUnlockedKeyBytes). The key is never written
    // to storage — the removed auto-unlock mechanism was the only writer,
    // and it is gone. Page JavaScript can already read the mnemonic while
    // the vault is unlocked, so extractability grants no new power.
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
  // as 'unknown' (see provenanceFromEnvelope). Same for hasPassword: a
  // present-but-non-boolean value is corruption; a missing one reads as
  // true (every envelope written before the flag existed had a password).
  if (
    'hasPassword' in envelope &&
    typeof envelope.hasPassword !== 'boolean'
  ) {
    throw corruptError();
  }
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

/**
 * One-time upgrade cleanup (owner order 2026-11-28: auto-unlock removed).
 * Deletes any `bawa-vault-key` entry the removed stored-key mechanism left
 * in localStorage. It only ever DELETES — no code reads the entry any
 * more, and nothing here re-imports it. Safe to call on every boot:
 * removing an absent key is a no-op.
 */
export function removeLegacyStoredKey(): void {
  try {
    getStorage().removeItem(LEGACY_VAULT_KEY_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; a leftover key is inert — nothing reads it.
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
      // An empty password is a passwordless vault, not a missing value:
      // the flag is what the app reads to tell the two states apart.
      hasPassword: password.length > 0,
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
 * logs. (Export works because the key this module holds is extractable
 * in memory: deriveKey() creates extractable keys — see above. Page
 * JavaScript can already read the mnemonic while the vault is unlocked,
 * so extractability grants no new power.)
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
 * The password is OPTIONAL (owner order 2026-11-28): an empty password
 * creates a passwordless vault whose envelope key is derived from the empty
 * password — anyone with access to this origin can re-derive it, so the
 * vault is effectively unprotected (see the module doc comment). Either way
 * the vault is open immediately after creation: the mnemonic and key stay
 * in the closure and are never written to storage. No derived key is ever
 * stored. A verbatim backup of the envelope is written at creation.
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

/**
 * True when the vault was created with a password, false when the user
 * chose no password. False with no vault. Envelopes written before the
 * hasPassword flag existed all had a password and read as true. A
 * corrupt envelope reads as true, so nothing ever opens it without a
 * password. Synchronous: the flag lives on the envelope itself.
 */
export function vaultHasPassword(): boolean {
  try {
    const envelope = readEnvelope();
    if (envelope === null) {
      return false;
    }
    return envelope.hasPassword ?? true;
  } catch {
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


export function isLocked(): boolean {
  return unlockedKey === null;
}

/**
 * Unlocks the vault with the password. Reuses decryptEnvelopeText, so a
 * wrong password throws the catalogue VAULT_WRONG_PASSWORD (1001) and a
 * corrupt envelope VAULT_CORRUPTED (1002) - the same messages the
 * layout-rebuild vault threw as plain Errors. No vault throws catalogue
 * VAULT_NOT_FOUND (1003, 'No vault exists.'). The derived key lives in
 * memory only; a reload locks the vault again. The session passphrase is
 * set from the argument ('', the default, when the wallet does not use
 * one). This is the ONLY way into a password vault.
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
}

/**
 * Opens the vault without a password prompt — but ONLY when the vault has
 * no password set (its key is derived from the empty password). A password
 * vault returns false and stays locked: the password is the only way in.
 * No vault returns false. Already open is a no-op success: the in-session
 * passphrase is kept.
 *
 * The BIP-39 session passphrase is never persisted, so after opening a
 * passwordless vault it is ''. Callers that derive with a passphrase must
 * not re-derive while the passphrase is unknown (see wallet-context's
 * refreshVaultAccounts guard).
 */
export async function openVaultIfPasswordless(): Promise<boolean> {
  if (unlockedMnemonic !== null) {
    return true;
  }
  if (!hasVault()) {
    return false;
  }
  if (vaultHasPassword()) {
    return false;
  }
  try {
    await unlock('', '');
    return true;
  } catch {
    return false;
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
 * Throws when no mnemonic is available (no vault, or a locked vault).
 * The mnemonic reference is dropped when the callback
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
 * one. The backup is refreshed so the new password restores. The stored
 * recovery profileIds and the key provenance are never changed: a restore
 * needing another profile must delete and recreate the vault explicitly.
 *
 * An EMPTY new password REMOVES the password: the vault is re-encrypted
 * under the empty password and becomes passwordless (see the module doc
 * comment — effectively unprotected, no lock, opens at boot). Either way
 * a new key is derived, so every existing Shamir backup-share set is
 * cancelled: create fresh shares afterwards.
 */
export async function changePassword(newPassword: string): Promise<void> {
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
  writeEnvelope(next);
  writeVaultBackup();
  unlockedKey = key;
}

/**
 * Restores the primary vault from the backup after primary loss or
 * damage. The backup is proven to decrypt with the given password
 * BEFORE the primary is touched; a wrong password, missing backup or
 * corrupt backup leaves the primary exactly as it was. The mnemonic and
 * key are put in the closure, so the restored vault is open immediately;
 * a password vault locks on the next boot, a passwordless one (restored
 * with the empty password) opens at boot.
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
  unlockedKey = key;
  unlockedMnemonic = text;
  unlockedPassphrase = '';
}

/**
 * Deletes the vault and its backup, dropping every
 * closure reference. The backup goes with the vault: a deleted vault
 * must not be resurrectable from a copy the user asked to delete.
 * The accounts created from its phrase go with it too (Lane C): a new
 * phrase starts over at Account 1. (HD receive rotation is reset by the
 * wallet context's resetReceiveRotation, called by the screen that
 * deletes the vault.)
 */
export function deleteVault(): void {
  getStorage().removeItem(VAULT_STORAGE_KEY);
  // A deleted vault takes any leftover pre-change stored key with it:
  // the raw key is useless without its envelope, and leaving it behind
  // would keep bytes that must never sit in storage.
  removeLegacyStoredKey();
  deleteVaultBackup();
  clearVaultAccounts();
  clearVaultAccountNames();
  // S3-A: a deleted vault voids its backup-completion record, so a
  // fresh vault never inherits a previous wallet's "Backed up".
  clearBackupDone();
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

// --- Lane E, item 4a: custom account names --------------------------------
// A user can rename an account ("Savings", "Trading") instead of living
// with "Account 1 / Account 2". Names are public labels only — the
// account is still identified by its index, and a rename never touches
// the phrase, the keys, or any other account. Names live beside the
// accounts list (same versioning shape) and die with the vault, so a
// fresh phrase never inherits the old wallet's names.
export const VAULT_ACCOUNT_NAMES_KEY = 'bawa-vault-account-names:v1';
export const MAX_ACCOUNT_NAME_LENGTH = 40;

function cleanAccountName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
    return null;
  }
  return trimmed;
}

function cleanAccountNames(value: unknown): Record<number, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: Record<number, string> = {};
  for (const [key, entry] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const account = Number(key);
    if (!Number.isSafeInteger(account) || account < 0) continue;
    const cleaned = cleanAccountName(entry);
    if (cleaned === null) continue;
    out[account] = cleaned;
  }
  return out;
}

export function readVaultAccountNames(): Record<number, string> {
  try {
    const raw = localStorage.getItem(VAULT_ACCOUNT_NAMES_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== 1 ||
      (parsed as { names?: unknown }).names === null ||
      typeof (parsed as { names?: unknown }).names !== 'object'
    ) {
      return {};
    }
    return cleanAccountNames((parsed as { names: unknown }).names);
  } catch {
    return {};
  }
}

export function writeVaultAccountNames(
  names: Record<number, string>,
): void {
  for (const [key, entry] of Object.entries(names)) {
    const account = Number(key);
    if (!Number.isSafeInteger(account) || account < 0) {
      throw new RangeError('account names must use non-negative safe integers');
    }
    if (typeof entry !== 'string') {
      throw new RangeError('account names must be strings');
    }
    const trimmed = entry.trim();
    if (trimmed !== '' && trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
      throw new RangeError(
        `account names must be at most ${MAX_ACCOUNT_NAME_LENGTH} characters`,
      );
    }
  }
  localStorage.setItem(
    VAULT_ACCOUNT_NAMES_KEY,
    JSON.stringify({ version: 1, names: cleanAccountNames(names) }),
  );
}

export function clearVaultAccountNames(): void {
  localStorage.removeItem(VAULT_ACCOUNT_NAMES_KEY);
}

/**
 * The name an account shows in the UI: its custom name when one is
 * set, otherwise its default ("Account 1", "Account 2", …). Pure.
 */
export function displayAccountName(
  account: number,
  names: Readonly<Record<number, string>>,
): string {
  const custom = names[account];
  return custom !== undefined && custom.trim() !== ''
    ? custom
    : accountName(account);
}

/**
 * The names map after renaming one account. An empty name, or a name
 * identical to the default, clears the custom name (the account shows
 * its default again) instead of storing a redundant label. Pure: it
 * does not write anything. Throws for an invalid account or a name
 * over the length limit.
 */
export function renameAccountName(
  names: Readonly<Record<number, string>>,
  account: number,
  name: string,
): Record<number, string> {
  if (!Number.isSafeInteger(account) || account < 0) {
    throw new RangeError('account must be a non-negative safe integer');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
    throw new RangeError(
      `account name must be at most ${MAX_ACCOUNT_NAME_LENGTH} characters`,
    );
  }
  const next = { ...names };
  if (trimmed === '' || trimmed === accountName(account)) {
    delete next[account];
  } else {
    next[account] = trimmed;
  }
  return next;
}

/**
 * The names map after removing one account's custom name (used when
 * the account itself is deleted). Pure: it does not write anything.
 */
export function removeAccountName(
  names: Readonly<Record<number, string>>,
  account: number,
): Record<number, string> {
  const next = { ...names };
  delete next[account];
  return next;
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
