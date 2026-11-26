// STON.fi Omniston TON order signing — Lane B (2026-11-27).
//
// The gap this closes: Bawa already signs TON transfers offline
// (signTonOffline in wallet/send.ts, V4R2) — but that signs a SINGLE
// transfer only (to + amount + seqno). Omniston orders need TON
// Connect-style signing of the order's messages
// (orderTx.messages from tonBuildSwap() / tonBuildEscrowTransfer()):
// an ordered list of { targetAddress, sendAmount, payload, stateInit? },
// each carrying an arbitrary contract-call body. The SDK builds the
// unsigned transaction; the wallet signs it.
//
// Engine choice: the existing Trust Wallet Core engine — NOT a new
// signer. Wallet Core's TON SigningInput takes a REPEATED list of
// Transfer messages, and each Transfer carries exactly the fields an
// order message needs:
//
//   dest          <- TonMessage.targetAddress
//   amount        <- TonMessage.sendAmount (minimal big-endian, as in
//                    signTonOffline)
//   mode 3        <- pay-fees-separately + ignore-action-phase-errors,
//                    the same mode signTonOffline uses, and the mode
//                    TON Connect wallets send with by default
//   customPayload <- TonMessage.payload, a raw one-cell BoC encoded in
//                    Base64 (Wallet Core's documented encoding; the
//                    SDK gives the same BoC as hex, so this is a
//                    byte-preserving hex -> base64 conversion)
//   stateInit     <- TonMessage.jettonWalletStateInit, same encoding
//
// So no @ton/core is needed to SIGN — it is a devDependency only, used
// by the tests to parse the signed BoC and verify the signature.
// The signed BoC is returned only. NOTHING here broadcasts, sends, or
// registers anything: execution needs the owner's separate broadcast
// authorisation, and the swap screen says so. QuoteId / HTLC secrets
// are the caller's concern — this function signs exactly the messages
// it is handed, in order, with nothing added or dropped.
//
// Limits, enforced loudly rather than silently worked around:
// - V4R2 wallets carry at most 4 outbound messages per external
//   message (the same limit TON Connect enforces per request). An
//   order with more messages fails instead of being split: the
//   Omniston TON wallet guide forbids dropping messages or splitting
//   the transaction silently.
// - The live order shape this was verified against (2026-11-27, real
//   RFQ 1 USDT on TON -> USDC on Base, quoteId
//   7fc458a6d46d6c9e1a19116cead9e8e546ee5083349c63cde89aa041175bc59e):
//   one message, 0.4 TON attached, a 3,162-byte payload BoC, no
//   stateInit. That exact message is the fixture in
//   stonfi-signing.test.ts.
import { TW } from '@trustwallet/wallet-core';
import type { TonTransaction } from '@ston-fi/omniston-sdk';
import { loadCore } from '../engine/boundary';
import { deriveAddressesAt } from './core';
import { pathFor } from './chains';
import { bytesToHex } from 'viem';
import type { SendFailure } from './send';

/** V4R2 wallet limit: at most 4 outbound messages per external message. */
export const STONFI_TON_MAX_MESSAGES = 4;

/** Send mode used for every order message (same as signTonOffline). */
const STONFI_TON_SEND_MODE = 3;

/** Default validity window, seconds (same as signTonOffline). */
const STONFI_TON_DEFAULT_VALIDITY_SECONDS = 600;

export type StonfiTonSignedOrder =
  | {
      ok: true;
      /** Signed external-message BoC, standard base64. Sign only — never sent. */
      signedBocBase64: string;
      /** 0x-prefixed 32-byte hash of the signed message. */
      messageHash: string;
      /** The TON address that signed (the wallet's from address). */
      from: string;
      /** Number of order messages signed, in order. */
      messageCount: number;
      /** Unix timestamp (seconds) the signed transaction expires at. */
      validUntil: number;
    }
  | SendFailure;

/**
 * Minimal big-endian byte encoding of a decimal integer string.
 * Zero is an empty byte array (protobuf omission). Mirrors the
 * helper in wallet/send.ts.
 */
function minimalBigEndian(decimal: string): Uint8Array {
  let value = BigInt(decimal);
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  return Uint8Array.from(bytes.reverse());
}

/** Hex string (with or without 0x) to bytes. Throws on odd/invalid hex. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('Invalid hex string.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Standard base64 for a byte array. `Buffer` is not a browser global,
 * so this is chunked btoa like wallet/send.ts.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Hex-encoded BoC bytes as standard base64 (byte-preserving). */
function hexBocToBase64(hex: string): string {
  return bytesToBase64(hexToBytes(hex));
}

function isValidOrderMessage(value: unknown): value is {
  targetAddress: string;
  sendAmount: string;
  payload: string;
  jettonWalletStateInit?: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  if (typeof message.targetAddress !== 'string' || message.targetAddress === '') {
    return false;
  }
  if (typeof message.sendAmount !== 'string' || !/^[0-9]+$/.test(message.sendAmount)) {
    return false;
  }
  if (typeof message.payload !== 'string') return false;
  try {
    if (message.payload !== '') hexToBytes(message.payload);
  } catch {
    return false;
  }
  if (
    message.jettonWalletStateInit !== undefined &&
    typeof message.jettonWalletStateInit !== 'string'
  ) {
    return false;
  }
  try {
    if (
      typeof message.jettonWalletStateInit === 'string' &&
      message.jettonWalletStateInit !== ''
    ) {
      hexToBytes(message.jettonWalletStateInit);
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Sign an Omniston TON order transaction offline with the vault key
 * (m/44'/607', V4R2, same derivation as signTonOffline) and return
 * the signed BoC only. The caller supplies the orderTx exactly as
 * the SDK built it (tonBuildSwap / tonBuildEscrowTransfer) plus the
 * wallet seqno; validUntil defaults to now + 600s. No broadcast, no
 * send, no registration — execution is a separate, owner-authorised
 * step.
 */
export async function signStonfiOrderTonOffline(
  mnemonic: string,
  passphrase: string,
  orderTx: TonTransaction,
  seqno: number,
  options?: {
    /** Vault account to sign from (default 0). Key and from address follow it. */
    account?: number;
    /** Unix timestamp (seconds) the transaction expires at. Must be in the future. */
    validUntil?: number;
    walletVersion?: 'v4r2';
  },
): Promise<StonfiTonSignedOrder> {
  const walletVersion = options?.walletVersion ?? 'v4r2';
  if (walletVersion !== 'v4r2') {
    return {
      ok: false,
      code: 'unsupported-version',
      reason: `Unsupported TON wallet version "${walletVersion}": address derivation supports v4r2 only.`,
    };
  }
  const messages = (orderTx as TonTransaction | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid STON.fi order: no messages to sign.',
    };
  }
  if (messages.length > STONFI_TON_MAX_MESSAGES) {
    return {
      ok: false,
      code: 'invalid-input',
      reason:
        `Invalid STON.fi order: ${messages.length} messages exceeds the ` +
        `V4R2 wallet limit of ${STONFI_TON_MAX_MESSAGES} per transaction. ` +
        'The order must not be split silently.',
    };
  }
  if (!messages.every(isValidOrderMessage)) {
    return {
      ok: false,
      code: 'invalid-input',
      reason:
        'Invalid STON.fi order message: each message needs a target ' +
        'address, a decimal nanotons amount, and a hex-encoded payload BoC.',
    };
  }
  if (!Number.isSafeInteger(seqno) || seqno < 0) {
    return { ok: false, code: 'invalid-input', reason: 'Invalid TON signing seqno.' };
  }
  const account = options?.account ?? 0;
  if (!Number.isSafeInteger(account) || account < 0) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid TON signing account.',
    };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const validUntil =
    options?.validUntil ?? nowSeconds + STONFI_TON_DEFAULT_VALIDITY_SECONDS;
  if (!Number.isSafeInteger(validUntil) || validUntil <= nowSeconds) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid TON signing validUntil: it must be in the future.',
    };
  }
  // Wallet Core signs the first transaction (seqno 0 — the wallet
  // deploy) with valid_until = UINT32_MAX, ignoring the requested
  // expiry: observed first-hand in stonfi-signing.test.ts (the
  // seqno-0 case reads back 4294967295 while seqno 3 and 7 round-trip
  // exactly). The returned validUntil is the effective one, so the
  // caller is never told a tighter expiry than the signed cell has.

  let from: string;
  try {
    from = (await deriveAddressesAt(mnemonic, passphrase, account, 0)).ton;
  } catch (error: unknown) {
    return {
      ok: false,
      code:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'invalid-mnemonic'
          : 'unknown',
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign STON.fi order offline.',
    };
  }

  const core = await loadCore();
  let wallet: ReturnType<typeof core.HDWallet.createWithMnemonic> | null = null;
  try {
    wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
    if (!wallet) throw new Error('Unable to restore wallet.');
    const key = wallet.getKey(core.CoinType.ton, pathFor('ton', account, 0));
    try {
      const seed = key.data();
      const pubkeyObj = key.getPublicKeyEd25519();
      let pub: Uint8Array;
      try {
        pub = new Uint8Array(pubkeyObj.data());
      } finally {
        pubkeyObj.delete();
      }
      const input = TW.TheOpenNetwork.Proto.SigningInput.create({
        privateKey: seed,
        publicKey: pub,
        messages: messages.map((message) => ({
          dest: message.targetAddress,
          amount: minimalBigEndian(message.sendAmount),
          mode: STONFI_TON_SEND_MODE,
          // Wallet Core takes the message body as a raw one-cell BoC
          // in Base64; the SDK gives the same BoC as hex.
          customPayload:
            message.payload === '' ? undefined : hexBocToBase64(message.payload),
          stateInit:
            message.jettonWalletStateInit === undefined ||
            message.jettonWalletStateInit === ''
              ? undefined
              : hexBocToBase64(message.jettonWalletStateInit),
        })),
        sequenceNumber: seqno,
        expireAt: validUntil,
        walletVersion: TW.TheOpenNetwork.Proto.WalletVersion.WALLET_V4_R2,
      });
      const encoded = TW.TheOpenNetwork.Proto.SigningInput.encode(input).finish();
      try {
        const output = TW.TheOpenNetwork.Proto.SigningOutput.decode(
          core.AnySigner.sign(encoded, core.CoinType.ton),
        );
        if (output.error !== TW.Common.Proto.SigningError.OK) {
          return {
            ok: false,
            code: 'signing-failed',
            reason: output.errorMessage || 'Signing failed.',
            signingErrorCode: output.error,
          };
        }
        if (!output.encoded || output.hash.length !== 32) {
          return {
            ok: false,
            code: 'signing-failed',
            reason: 'Signer returned an empty transaction.',
          };
        }
        return {
          ok: true,
          signedBocBase64: output.encoded,
          messageHash: bytesToHex(output.hash),
          from,
          messageCount: messages.length,
          // Effective expiry: UINT32_MAX for the seqno-0 deploy
          // transaction (see above), the requested value otherwise.
          validUntil: seqno === 0 ? 4294967295 : validUntil,
        };
      } finally {
        encoded.fill(0);
        seed.fill(0);
      }
    } finally {
      key.delete();
    }
  } catch (error: unknown) {
    return {
      ok: false,
      code:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'invalid-mnemonic'
          : 'unknown',
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign STON.fi order offline.',
    };
  } finally {
    wallet?.delete();
  }
}

/**
 * Convert an Omniston TON transaction to TON Connect messages, the
 * adaptation the Omniston TON wallet guide documents
 * (docs.ston.fi/developer-section/omniston/sdk/ton.md): address,
 * amount, payload and stateInit as base64 BoCs, every message kept
 * in order. The guide's Cell.fromHex(...).toBoc().toString('base64')
 * and this byte-preserving hex -> base64 conversion produce the
 * same bytes for a well-formed BoC. This is the shape a future
 * TonConnect send step takes — it does not send anything itself.
 */
export function stonfiOrderToTonConnectMessages(
  orderTx: TonTransaction,
): Array<{
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}> {
  return orderTx.messages.map((message) => ({
    address: message.targetAddress,
    amount: message.sendAmount,
    payload:
      message.payload === '' ? undefined : hexBocToBase64(message.payload),
    stateInit:
      message.jettonWalletStateInit === undefined ||
      message.jettonWalletStateInit === ''
        ? undefined
        : hexBocToBase64(message.jettonWalletStateInit),
  }));
}
