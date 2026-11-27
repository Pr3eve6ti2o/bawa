/**
 * Signing-intent model (split from wallet/core.ts, marketing-fix Lane 2).
 *
 * Pure, secret-free value model: intent construction/validation,
 * fingerprinting, the PartialSigner capability interface and its
 * structural checks, and the test-only zero signer. Nothing here
 * touches a mnemonic, a private key, or the WASM core handle — the
 * key-touching operations (createPartialSigner, withSigningKey) stay
 * in wallet/core.ts and import the helpers they need from here.
 * send.ts depends on this module, not on core. (Fix-all Lane H,
 * item 9: evm-typed-data.ts used to depend on it too; the module was
 * deleted — it had no consumer and no dApp-connect feature to serve.)
 */

import { hashMessage, hexToBytes, sha256, stringToHex } from 'viem';
import type { ChainId } from '../engine/boundary';
import { isEvmTxChain } from './watch-only-families';

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
      /**
       * Token-transfer recipient (EVM-token: the transfer(recipient)
       * inside the calldata; SPL: the owner of the destination token
       * account). Absent for native sends, where `to` already is the
       * recipient. A review-time intent carries it so signing binds
       * to the recipient the user reviewed, not just the contract.
       */
      readonly recipient?: string;
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
  recipient?: string,
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

  if (
    recipient !== undefined &&
    (typeof recipient !== 'string' || recipient.trim().length === 0)
  ) {
    throw new Error(
      'Invalid signing intent field "recipient": expected a non-empty string.',
    );
  }

  return Object.freeze({
    kind: 'transaction' as const,
    chain,
    to,
    amountBaseUnits,
    sequence,
    ...(recipient === undefined ? {} : { recipient }),
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
          ...(intent.recipient === undefined ? [] : [intent.recipient]),
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
    readonly recipient?: string;
  },
): void {
  if (intent.kind !== 'transaction') {
    throw new Error('Signing intent mismatch: kind (expected "transaction").');
  }

  const fields = ['chain', 'to', 'amountBaseUnits'] as const;
  for (const field of fields) {
    if (intent[field] !== tx[field]) {
      throw new Error(`Signing intent mismatch: ${field}.`);
    }
  }
  // A-7: the sequence (ETH nonce, TON seqno, TRX block number; empty
  // for BTC and SOL) is fetched live at signing and is not part of
  // what the user reviewed — a review-time intent carries '' here and
  // does not pin it. An intent created with a non-empty sequence
  // still pins it exactly, so a stale or swapped nonce/seqno still
  // refuses.
  if (intent.sequence !== '' && intent.sequence !== tx.sequence) {
    throw new Error('Signing intent mismatch: sequence.');
  }
  // A pinned recipient binds the transfer's real payee. The check
  // only runs when the intent carries one, so native sends (whose
  // `to` already is the recipient) are unaffected.
  if (intent.recipient !== undefined && intent.recipient !== tx.recipient) {
    throw new Error('Signing intent mismatch: recipient.');
  }
}

/**
 * Chains the PartialSigner facade can sign for: BTC, TRX, TON, and every
 * EVM-transaction chain (Lane 80-APP, 2026-11-24: the generalised EVM
 * signer covers all sixty — the 59 0x chains plus Ronin — with the
 * chain's own key; the 60'-path chains share the ETH key, the five
 * non-60 EVM chains use their own coin path). Filecoin, SOL, LTC,
 * DOGE and the non-EVM expanded chains have no signer here.
 */
export function isPartialSignerChain(value: unknown): value is ChainId {
  return (
    value === 'btc' ||
    value === 'trx' ||
    value === 'ton' ||
    (typeof value === 'string' && isEvmTxChain(value as ChainId))
  );
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
  // EIP-191 personal_sign is chain-agnostic: every EVM chain hashes a
  // message the same way. BTC/TRX/TON keep the plain SHA-256 hash.
  return hexToBytes(
    isEvmTxChain(chain) ? hashMessage({ raw: bytes }) : sha256(bytes),
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

