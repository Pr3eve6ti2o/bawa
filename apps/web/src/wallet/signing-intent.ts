/**
 * Signing-intent model (split from wallet/core.ts, marketing-fix Lane 2).
 *
 * Pure, secret-free value model: intent construction/validation,
 * fingerprinting, the PartialSigner capability interface and its
 * structural checks, and the test-only zero signer. Nothing here
 * touches a mnemonic, a private key, or the WASM core handle — the
 * key-touching operations (createPartialSigner, withSigningKey) stay
 * in wallet/core.ts and import the helpers they need from here.
 * send.ts and evm-typed-data.ts depend on this module, not on core.
 */

import { hashMessage, hexToBytes, sha256, stringToHex } from 'viem';
import type { ChainId } from '../engine/boundary';

/** Sign-only capability; credentials and raw keys are never exposed. */
export interface PartialSigner {
  readonly chain: ChainId;
  readonly address: string;

  /** Exactly 32 bytes; returns raw 65-byte secp256k1 or 64-byte ed25519 signatures. */
  signDigest(digest: Uint8Array): Promise<Uint8Array>;

  /** ETH uses EIP-191; other chains use SHA-256 before signing. */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

/** Watch-only data, not a signing capability. */
export type AddressOnlyAccount = {
  readonly kind: 'address-only';
  readonly chain: ChainId;
  readonly address: string;
};

export type LocalAccount = {
  readonly kind: 'local';
  readonly chain: ChainId;
  readonly address: string;
  readonly signer: PartialSigner;
};

export type SigningIntent =
  | {
      readonly kind: 'transaction';
      readonly chain: ChainId;
      readonly to: string;
      readonly amountBaseUnits: string;
      /** ETH nonce, TON seqno, TRX block number; empty string for BTC. */
      readonly sequence: string;
    }
  | {
      readonly kind: 'message';
      readonly chain: ChainId;
      readonly messageHash: string;
    };

/** Build a secret-free transaction intent; preserve the exact strings for approval. */
export function createTransactionIntent(
  chain: ChainId,
  to: string,
  amountBaseUnits: string,
  sequence: string,
): SigningIntent {
  if (typeof to !== 'string' || to.trim().length === 0) {
    throw new Error('Invalid signing intent field "to": expected a non-empty string.');
  }

  if (
    typeof amountBaseUnits !== 'string' ||
    !/^[0-9]+$/.test(amountBaseUnits)
  ) {
    throw new Error(
      'Invalid signing intent field "amountBaseUnits": expected an unsigned decimal string.',
    );
  }

  if (
    typeof sequence !== 'string' ||
    (sequence !== '' && !/^[0-9]+$/.test(sequence))
  ) {
    throw new Error(
      'Invalid signing intent field "sequence": expected an unsigned decimal string or an empty string.',
    );
  }

  return Object.freeze({
    kind: 'transaction' as const,
    chain,
    to,
    amountBaseUnits,
    sequence,
  });
}

/** Build a secret-free message intent from a supplied hash; this does not sign. */
export function createMessageIntent(
  chain: ChainId,
  messageHash: string,
): SigningIntent {
  if (
    typeof messageHash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(messageHash)
  ) {
    throw new Error(
      'Invalid signing intent field "messageHash": expected 0x followed by exactly 64 hexadecimal characters.',
    );
  }

  return Object.freeze({
    kind: 'message' as const,
    chain,
    messageHash,
  });
}

/** Encode exact UTF-16 code units as length-prefixed ASCII, avoiding field ambiguity. */
function encodeSigningIntentField(value: string): string {
  let hex = '';
  for (let index = 0; index < value.length; index += 1) {
    hex += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return `${hex.length}:${hex}`;
}

/** Fingerprint fixed-order public fields for approval; hashing is not signing. */
export function intentFingerprint(intent: SigningIntent): string {
  const fields: readonly string[] =
    intent.kind === 'transaction'
      ? [
          intent.kind,
          String(intent.chain),
          intent.to,
          intent.amountBaseUnits,
          intent.sequence,
        ]
      : [intent.kind, String(intent.chain), intent.messageHash];

  const canonical =
    'bawa:signing-intent:v1|' +
    fields.map(encodeSigningIntentField).join('');

  return sha256(stringToHex(canonical));
}

/** Call before PartialSigner signing; sign only when the approved intent matches. */
export function assertIntentMatchesTransaction(
  intent: SigningIntent,
  tx: {
    readonly chain: ChainId;
    readonly to: string;
    readonly amountBaseUnits: string;
    readonly sequence: string;
  },
): void {
  if (intent.kind !== 'transaction') {
    throw new Error('Signing intent mismatch: kind (expected "transaction").');
  }

  const fields = ['chain', 'to', 'amountBaseUnits', 'sequence'] as const;
  for (const field of fields) {
    if (intent[field] !== tx[field]) {
      throw new Error(`Signing intent mismatch: ${field}.`);
    }
  }
}

export function isPartialSignerChain(value: unknown): value is ChainId {
  return value === 'btc' || value === 'eth' || value === 'trx' || value === 'ton';
}

export function assertPartialSignerDigest(digest: Uint8Array): void {
  if (!(digest instanceof Uint8Array) || digest.byteLength !== 32) {
    throw new Error('signDigest requires exactly 32 bytes');
  }
}

export function partialSignerSignatureLength(chain: ChainId): 64 | 65 {
  return chain === 'ton' ? 64 : 65;
}

export function hashPartialSignerMessage(
  chain: ChainId,
  message: Uint8Array,
): Uint8Array {
  if (!(message instanceof Uint8Array)) {
    throw new Error('signMessage requires a Uint8Array');
  }

  const bytes = Uint8Array.from(message);
  return hexToBytes(
    chain === 'eth' ? hashMessage({ raw: bytes }) : sha256(bytes),
  );
}

export function isPartialSigner(value: unknown): value is PartialSigner {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  // Accounts are wrappers/data: signing requires the capability itself.
  if (candidate.kind === 'address-only' || candidate.kind === 'local') {
    return false;
  }

  return (
    isPartialSignerChain(candidate.chain) &&
    typeof candidate.address === 'string' &&
    typeof candidate.signDigest === 'function' &&
    typeof candidate.signMessage === 'function'
  );
}

function partialSignerBadKind(value: unknown): string {
  if (value === null) return 'null';

  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.kind === 'string') {
      return candidate.kind || '(empty kind)';
    }
    if (Array.isArray(value)) return 'array';
  }

  // Do not include arbitrary input values or credentials in errors.
  return typeof value;
}

export function assertPartialSigner(
  value: unknown,
): asserts value is PartialSigner {
  if (!isPartialSigner(value)) {
    throw new Error(
      `Expected PartialSigner; bad kind: ${partialSignerBadKind(value)}`,
    );
  }
}

/** Test-only: fresh, deterministic all-zero signatures; signs nothing real. */
export function createNoopSigner(
  chain: ChainId,
  address: string,
): PartialSigner {
  if (!isPartialSignerChain(chain)) {
    throw new Error('Unsupported signer chain');
  }
  if (typeof address !== 'string') {
    throw new Error('Signer address must be a string');
  }

  async function signDigest(digest: Uint8Array): Promise<Uint8Array> {
    assertPartialSignerDigest(digest);
    return new Uint8Array(partialSignerSignatureLength(chain));
  }

  async function signMessage(message: Uint8Array): Promise<Uint8Array> {
    return signDigest(hashPartialSignerMessage(chain, message));
  }

  return Object.freeze({ chain, address, signDigest, signMessage });
}

