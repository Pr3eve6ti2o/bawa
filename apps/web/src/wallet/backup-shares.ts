/**
 * Vault-key backup shares (N-of-M) via Privy `shamir-secret-sharing`
 * 0.0.4 (Apache-2.0, zero-dependency TypeScript Shamir's Secret Sharing,
 * independently audited by Cure53 and Zellic — see its README).
 *
 * What is split: the vault's raw 256-bit AES-GCM key (32 uniformly
 * random bytes), NEVER the recovery phrase. The words are not uniformly
 * random, so splitting them would leak structure; the vault key is the
 * uniformly random secret the library's README says to split ("encrypt
 * the value first and split the encryption key instead" — here the key
 * itself is the secret, exactly as the README's symmetric-key example).
 * A share set restores the vault key, and the vault key decrypts the
 * vault; the phrase itself never enters this module.
 *
 * LAZY-LOAD (bundle rule): the library is reached ONLY through the
 * dynamic import in loadShamir() below — there is no static import of
 * 'shamir-secret-sharing' anywhere in the app. It lands in its own
 * chunk, loaded when the Backup screen's Shares tab creates or checks shares,
 * and never enters the main bundle. Do not convert it to a static import.
 *
 * Integrity: combine() does NOT verify reconstruction — a mistyped,
 * foreign, or mixed-set share still yields 32 bytes. So every restore
 * is proven by trial-decrypting the real vault envelope with the
 * reconstructed key (verifyReconstructedKey in vault.ts); a failed trial
 * decryption is reported as "did not restore", never as a success.
 *
 * Encoding: shares are raw bytes, so each share is shown as one
 * copy-pasteable line, `bawa-share-v1:` plus standard base64 (44 chars
 * for a 33-byte share), and as a QR code on the Backup screen's Shares tab.
 * The prefix versions the format and makes a mistyped paste detectable.
 */

import { verifyReconstructedKey } from './vault';

/** Prefix for every user-facing share string; also the format version. */
export const BACKUP_SHARE_PREFIX = 'bawa-share-v1:';

/** The vault key is AES-GCM-256: 32 bytes. */
const VAULT_KEY_BYTES = 32;

/** A share is the 32 secret bytes plus one share-number byte. */
const SHARE_BYTES = VAULT_KEY_BYTES + 1;

/** Schemes the Backup screen's Shares tab offers. */
export const BACKUP_SHARE_SCHEMES: ReadonlyArray<{
  total: number;
  threshold: number;
  label: string;
}> = [
  { total: 3, threshold: 2, label: '2 of 3' },
  { total: 5, threshold: 2, label: '2 of 5' },
  { total: 5, threshold: 3, label: '3 of 5' },
];

/** User-facing error: the message is shown to the user as written. */
export class BackupSharesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupSharesError';
  }
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

/**
 * The library's only entry point. A dynamic import on purpose — see the
 * module comment. Do not convert this to a static import.
 */
async function loadShamir(): Promise<typeof import('shamir-secret-sharing')> {
  return import('shamir-secret-sharing');
}

function validateScheme(total: number, threshold: number): void {
  if (!Number.isSafeInteger(total) || total < 2 || total > 255) {
    throw new BackupSharesError(
      'The number of shares must be between 2 and 255.',
    );
  }
  if (
    !Number.isSafeInteger(threshold) ||
    threshold < 2 ||
    threshold > total
  ) {
    throw new BackupSharesError(
      'The number of shares needed must be at least 2 and no more than the total number of shares.',
    );
  }
}

/** Encodes one raw share as its user-facing string. */
export function encodeShare(share: Uint8Array): string {
  return BACKUP_SHARE_PREFIX + toBase64(share);
}

/**
 * Decodes one user-facing share string. Throws BackupSharesError with a
 * user-facing message for a missing prefix, bad base64, or wrong length.
 */
export function decodeShare(text: string): Uint8Array {
  const trimmed = text.trim();
  if (!trimmed.startsWith(BACKUP_SHARE_PREFIX)) {
    throw new BackupSharesError(
      'That is not a Bawa backup share. Each share starts with "bawa-share-v1:".',
    );
  }
  const encoded = trimmed.slice(BACKUP_SHARE_PREFIX.length);
  if (
    encoded.length === 0 ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    throw new BackupSharesError(
      'That share is not valid base64. Copy the whole share, from "bawa-share-v1:" to the end.',
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(encoded);
  } catch {
    throw new BackupSharesError(
      'That share is not valid base64. Copy the whole share, from "bawa-share-v1:" to the end.',
    );
  }
  if (bytes.length !== SHARE_BYTES) {
    throw new BackupSharesError(
      'That share has the wrong length. Copy the whole share, from "bawa-share-v1:" to the end.',
    );
  }
  return bytes;
}

/**
 * Splits the vault key into `total` shares, any `threshold` of which
 * rebuild it. Returns the shares as user-facing strings. The key bytes
 * are the caller's to drop; this function keeps no copy.
 */
export async function createBackupShares(
  keyBytes: Uint8Array,
  total: number,
  threshold: number,
): Promise<string[]> {
  if (keyBytes.length !== VAULT_KEY_BYTES) {
    throw new BackupSharesError('The vault key has the wrong length.');
  }
  validateScheme(total, threshold);
  const { split } = await loadShamir();
  const shares = await split(keyBytes, total, threshold);
  return shares.map(encodeShare);
}

/**
 * Rebuilds the vault key from at least two share strings. Throws
 * BackupSharesError for too few, malformed, duplicated, or
 * uncombinable shares. A successful return is NOT proof the shares are
 * right — callers must trial-decrypt (checkBackupShares does this).
 */
export async function reconstructKeyBytes(
  shareTexts: string[],
): Promise<Uint8Array> {
  const texts = shareTexts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  if (texts.length < 2) {
    throw new BackupSharesError('Enter at least two shares.');
  }
  const shares = texts.map(decodeShare);
  // Interpolation needs distinct share numbers: two copies of one share
  // (or two shares with the same number) cannot rebuild anything.
  // Identical shares share a number, so this covers both cases. The
  // share number is the LAST byte of the share (the library writes it
  // at share[secretLength] in split() and reads share[shareLength - 1]
  // in combine()); share[0] is the first payload byte, not the number,
  // and two distinct shares collide on it with probability 1/256.
  const seenNumbers = new Set<number>();
  for (const share of shares) {
    const number = share[SHARE_BYTES - 1] as number;
    if (seenNumbers.has(number)) {
      throw new BackupSharesError(
        'Two of the shares are the same share. Enter a different share in each box.',
      );
    }
    seenNumbers.add(number);
  }
  let reconstructed: Uint8Array;
  try {
    const { combine } = await loadShamir();
    reconstructed = await combine(shares);
  } catch {
    throw new BackupSharesError(
      'Those shares could not be combined. Check that each share is copied in full.',
    );
  }
  if (reconstructed.length !== VAULT_KEY_BYTES) {
    throw new BackupSharesError(
      'Those shares did not rebuild a vault key. Check that each share is copied in full.',
    );
  }
  return reconstructed;
}

type BackupShareCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks a set of pasted shares against THIS vault: rebuilds the key and
 * trial-decrypts the vault envelope with it. Returns ok:true only when
 * the shares genuinely restore this vault. A set from another vault, a
 * corrupted share, or shares mixed across two sets all return ok:false
 * with a plain reason — combine() alone cannot tell those apart from a
 * good set, so the trial decryption is the verdict.
 */
export async function checkBackupShares(
  shareTexts: string[],
  threshold: number,
): Promise<BackupShareCheck> {
  if (!Number.isSafeInteger(threshold) || threshold < 2) {
    throw new BackupSharesError(
      'The number of shares needed must be at least 2.',
    );
  }
  const texts = shareTexts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  if (texts.length < threshold) {
    return {
      ok: false,
      reason: `Enter at least ${threshold} shares — this set needs ${threshold} to restore the vault.`,
    };
  }
  let keyBytes: Uint8Array;
  try {
    keyBytes = await reconstructKeyBytes(texts);
  } catch (cause) {
    return {
      ok: false,
      reason:
        cause instanceof Error
          ? cause.message
          : 'Those shares could not be checked.',
    };
  }
  // Wipe the reconstructed key bytes as soon as the trial decryption
  // is done (or throws): this local is the only copy, and dropping
  // the reference alone would leave the bytes in the buffer.
  let valid: boolean;
  try {
    valid = await verifyReconstructedKey(keyBytes);
  } finally {
    keyBytes.fill(0);
  }
  if (!valid) {
    return {
      ok: false,
      reason:
        'These shares did not restore this vault. Check that every share is copied in full, that no share is entered twice, and that all shares come from the same set.',
    };
  }
  return { ok: true };
}
