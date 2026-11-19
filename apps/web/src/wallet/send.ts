import Long from 'long';
import { TW } from '@trustwallet/wallet-core';
import { bytesToHex, keccak256 } from 'viem';
import { loadCore } from '../engine/boundary';
import type { ChainId } from '../engine/boundary';
import { deriveAddresses, withSigningKey } from './core';
import { getAdapter } from './adapters';
import {
  BROADCAST_DISABLED_MESSAGE,
  type UtxoInput,
} from './adapters/types';
import { CHAIN_DECIMALS, decimalToBaseUnits } from './format';

/**
 * Send flow (Fix Lane 3, Phase 4). Pure send-domain helpers on top of the
 * Phase 2 adapters and the Wallet Core 4.9.3 WASM engine. Nothing in this
 * module broadcasts: broadcast stays DISABLED until separately authorised
 * (see broadcastSigned). No function here logs or stores a secret.
 */

export type RecipientValidation =
  | { ok: true }
  | { ok: false; reason: string };

const CHAIN_NAMES: Record<ChainId, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  trx: 'TRON',
  ton: 'TON',
  sol: 'Solana',
  bsc: 'BNB Smart Chain',
  matic: 'Polygon',
  arb: 'Arbitrum One',
  op: 'OP Mainnet',
  base: 'Base',
  avax: 'Avalanche C-Chain',
  ltc: 'Litecoin',
  doge: 'Dogecoin',
};

/**
 * Validate a recipient address for a chain (Sol p1, landed 2026-11-19 in
 * 131.8s; assembled hands-on with the ChainId type imported from the
 * engine boundary instead of redefined). TON must be a mainnet
 * workchain-zero address: the third Base64 character (A-D) proves the
 * workchain byte is zero.
 */
export async function validateRecipient(
  chain: ChainId,
  address: string,
): Promise<RecipientValidation> {
  const recipient = address.trim();

  if (recipient.length === 0) {
    return { ok: false, reason: 'Recipient address is required.' };
  }

  const invalid: RecipientValidation = {
    ok: false,
    reason: 'Invalid ' + CHAIN_NAMES[chain] + ' address.',
  };

  // EQ/UQ require mainnet; the third Base64 character ensures workchain 0.
  if (chain === 'ton' && !/^(?:EQ|UQ)[A-D]/.test(recipient)) {
    return invalid;
  }

  try {
    const core = await loadCore();
    const coinTypes = {
      btc: core.CoinType.bitcoin,
      eth: core.CoinType.ethereum,
      trx: core.CoinType.tron,
      ton: core.CoinType.ton,
      sol: core.CoinType.solana,
      ltc: core.CoinType.litecoin,
      doge: core.CoinType.dogecoin,
      bsc: core.CoinType.smartChain,
      matic: core.CoinType.polygon,
      arb: core.CoinType.arbitrum,
      op: core.CoinType.optimism,
      base: core.CoinType.base,
      avax: core.CoinType.avalancheCChain,
    };

    return core.CoinTypeExt.validate(coinTypes[chain], recipient)
      ? { ok: true }
      : invalid;
  } catch {
    return invalid;
  }
}

export type SendPreview =
  | {
      ok: true;
      amountBaseUnits: string;
      feeBaseUnits: string;
      totalBaseUnits: string;
      feeNote: string;
    }
  | { ok: false; reason: string };

/**
 * BTC fee plan without any private key (hands-on, probe-proven
 * 2026-11-19): AnySigner.plan with privateKey: [] returns the same fee
 * (1410 sat for the 1-in/2-out fixture) as with the key, because planning
 * only needs UTXOs, addresses and the rate. The preview uses this so the
 * BTC fee shown is the real planned fee, not the sat/vB rate.
 */
async function planBtcFee(
  fromAddress: string,
  toAddress: string,
  amount: string,
  feeRateSatPerVB: string,
  utxos: UtxoInput[],
): Promise<
  { ok: true; feeBaseUnits: string } | { ok: false; reason: string }
> {
  const feeRate = toSafeInt(feeRateSatPerVB);
  const amountInt = toSafeInt(amount);
  if (
    feeRate === null ||
    amountInt === null ||
    utxos.some(
      (u) =>
        !/^[0-9a-fA-F]{64}$/.test(u.txid) ||
        !Number.isSafeInteger(u.vout) ||
        u.vout < 0 ||
        toSafeInt(u.valueBaseUnits) === null,
    )
  ) {
    return { ok: false, reason: 'Invalid BTC fee-planning inputs.' };
  }
  try {
    const core = await loadCore();
    const scriptObj = core.BitcoinScript.lockScriptForAddress(
      fromAddress,
      core.CoinType.bitcoin,
    );
    let encoded: Uint8Array;
    try {
      const script = new Uint8Array(scriptObj.data());
      const input = TW.Bitcoin.Proto.SigningInput.create({
        hashType: 1,
        amount: Long.fromNumber(amountInt),
        byteFee: Long.fromNumber(feeRate),
        toAddress,
        changeAddress: fromAddress,
        privateKey: [],
        utxo: utxos.map((u) => ({
          outPoint: {
            hash: reverseBytes(hexToBytes(u.txid)),
            index: u.vout,
          },
          script,
          amount: Long.fromNumber(toSafeInt(u.valueBaseUnits) as number),
        })),
      });
      encoded = TW.Bitcoin.Proto.SigningInput.encode(input).finish();
    } finally {
      scriptObj.delete();
    }
    const plan = TW.Bitcoin.Proto.TransactionPlan.decode(
      core.AnySigner.plan(encoded, core.CoinType.bitcoin),
    );
    if (plan.error !== TW.Common.Proto.SigningError.OK) {
      return { ok: false, reason: 'Transaction plan failed.' };
    }
    return { ok: true, feeBaseUnits: String(plan.fee) };
  } catch {
    return { ok: false, reason: 'BTC fee planning failed.' };
  }
}

/**
 * Amount + fee preview (Sol p2, landed 2026-11-19 in 136.4s; corrected
 * hands-on: Sol invented adapter fields (.ok / .balanceBaseUnits /
 * .feeBaseUnits / .note). The real contract is the AdapterResult
 * discriminated union in ./adapters/types.ts — {status:'ok', data} or
 * {status:'unavailable'|'error', reason} — and this version uses it.
 * TON fee-quote is blocked upstream, so a TON preview honestly reports
 * that instead of inventing a fee. BTC's fee quote is a sat/vB RATE, so
 * the BTC preview plans the transaction against the live UTXO set
 * (planBtcFee, no private key) and reports the real planned fee.
 */
export async function previewSendAmount(
  chain: ChainId,
  fromAddress: string,
  toAddress: string,
  amountDecimal: string,
): Promise<SendPreview> {
  const amount = decimalToBaseUnits(amountDecimal, CHAIN_DECIMALS[chain]);
  if (amount === null || BigInt(amount) <= 0n) {
    return { ok: false, reason: 'Enter a valid amount.' };
  }

  const adapter = getAdapter(chain);
  if (!adapter) {
    return { ok: false, reason: 'No adapter available for this chain.' };
  }

  const balance = await adapter.getBalance(fromAddress);
  if (balance.status !== 'ok') {
    return { ok: false, reason: balance.reason };
  }
  if (BigInt(amount) > BigInt(balance.data.valueBaseUnits)) {
    return { ok: false, reason: 'Amount exceeds available balance.' };
  }

  const fee = await adapter.estimateFee();
  if (fee.status !== 'ok') {
    return { ok: false, reason: fee.reason };
  }

  if (chain === 'btc') {
    const inputs = await adapter.getTxInputs(fromAddress);
    if (inputs.status !== 'ok') {
      return { ok: false, reason: inputs.reason };
    }
    if (inputs.data.kind !== 'utxo') {
      return { ok: false, reason: 'BTC adapter did not return UTXOs.' };
    }
    const planned = await planBtcFee(
      fromAddress,
      toAddress,
      amount,
      fee.data.feeBaseUnits,
      inputs.data.utxos,
    );
    if (!planned.ok) return planned;
    return {
      ok: true,
      amountBaseUnits: amount,
      feeBaseUnits: planned.feeBaseUnits,
      totalBaseUnits: (
        BigInt(amount) + BigInt(planned.feeBaseUnits)
      ).toString(),
      feeNote: `Planned fee at ${fee.data.feeBaseUnits} sat/vB from the live UTXO set.`,
    };
  }

  return {
    ok: true,
    amountBaseUnits: amount,
    feeBaseUnits: fee.data.feeBaseUnits,
    totalBaseUnits: (
      BigInt(amount) + BigInt(fee.data.feeBaseUnits)
    ).toString(),
    feeNote: fee.data.note,
  };
}

export type EthSignedTx =
  | { ok: true; signedTxHex: `0x${string}`; txHash: string; from: string }
  | { ok: false; reason: string };

/**
 * Minimal big-endian byte encoding of a decimal integer string.
 * Zero is represented by an empty byte array (protobuf omission).
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
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes).reverse();
}

/** Safe-integer parse of a decimal string, or null when it is not one. */
function toSafeInt(decimal: string): number | null {
  if (!/^[0-9]+$/.test(decimal)) return null;
  const value = BigInt(decimal);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

/**
 * TRON base58 address to its 21 address bytes (0x41 version + 20-byte
 * hash). A TRON base58 address decodes to 25 bytes (version + hash +
 * 4-byte checksum); the checksum is verified by length/prefix only here —
 * the address itself is validated by validateRecipient before signing.
 */
export function tronAddressToBytes(address: string): Uint8Array {
  const alphabet =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const trimmed = address.trim();
  let value = 0n;
  for (const ch of trimmed) {
    const digit = alphabet.indexOf(ch);
    if (digit < 0) throw new Error('Invalid TRON address.');
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const decoded = hexToBytes(hex);
  // Leading '1's in base58 are zero bytes; TRON addresses have none, but
  // keep the count honest for a general decoder.
  let leading = 0;
  for (const ch of trimmed) {
    if (ch !== '1') break;
    leading += 1;
  }
  const full = new Uint8Array(leading + decoded.length);
  full.set(decoded, leading);
  if (full.length !== 25 || full[0] !== 0x41) {
    throw new Error('Invalid TRON address.');
  }
  return full.slice(0, 21);
}

/**
 * Offline ETH native-transfer signing (Sol p4, landed 2026-11-19 in 197.4s;
 * corrected hands-on). Sol called key.data(), but withSigningKey already
 * passes the raw 32 key bytes, so .data() would throw and the function
 * would always fail; this version uses the bytes directly. Dynamic imports
 * converted to static; an invalid mnemonic now returns its own reason.
 * Signing happens inside the withSigningKey callback: the key bytes are a
 * WASM-memory view freed when it returns (proven by the /tmp probe — a
 * copy-then-delete-first attempt failed with invalid-key error 15).
 * The encoded protobuf input (which contains a key copy) is zero-filled
 * after use. Nothing here broadcasts.
 */
export async function signEthOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountBaseUnits: string,
  nonce: string,
  gasPriceBaseUnits: string,
): Promise<EthSignedTx> {
  if (
    ![amountBaseUnits, nonce, gasPriceBaseUnits].every(
      (value) => typeof value === 'string' && /^[0-9]+$/.test(value),
    )
  ) {
    return {
      ok: false,
      reason:
        'Amount, nonce and gas price must be unsigned decimal integer strings.',
    };
  }

  let from: string;
  try {
    from = (await deriveAddresses(mnemonic, passphrase)).eth;
  } catch (error: unknown) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign ETH transaction offline.',
    };
  }

  const core = await loadCore();
  try {
    return await withSigningKey(
      mnemonic,
      passphrase,
      core.CoinType.ethereum,
      "m/44'/60'/0'/0/0",
      async (keyBytes) => {
        if (keyBytes.length !== 32) {
          return {
            ok: false as const,
            reason: 'Invalid Ethereum signing key length.',
          };
        }

        const input = TW.Ethereum.Proto.SigningInput.create({
          chainId: new Uint8Array([1]),
          nonce: minimalBigEndian(nonce),
          gasPrice: minimalBigEndian(gasPriceBaseUnits),
          gasLimit: minimalBigEndian('21000'),
          toAddress: to,
          transaction: {
            transfer: { amount: minimalBigEndian(amountBaseUnits) },
          },
          privateKey: keyBytes,
        });

        const encoded =
          TW.Ethereum.Proto.SigningInput.encode(input).finish();
        try {
          const output = TW.Ethereum.Proto.SigningOutput.decode(
            core.AnySigner.sign(encoded, core.CoinType.ethereum),
          );

          if (output.error !== TW.Common.Proto.SigningError.OK) {
            return {
              ok: false as const,
              reason: output.errorMessage || 'Signing failed.',
            };
          }

          const signedBytes = output.encoded;
          if (signedBytes.length === 0) {
            return {
              ok: false as const,
              reason: 'Signer returned an empty transaction.',
            };
          }

          // Finish all byte access before the disposable key is freed.
          return {
            ok: true as const,
            signedTxHex: bytesToHex(signedBytes),
            txHash: keccak256(signedBytes),
            from,
          };
        } finally {
          // The protobuf input contains a copy of the private key.
          encoded.fill(0);
        }
      },
    );
  } catch {
    return { ok: false, reason: 'Failed to sign ETH transaction offline.' };
  }
}

/**
 * Broadcast stub (Sol p5, landed 2026-11-19 in 29.3s; no corrections).
 * Always disabled: broadcast stays DISABLED until separately authorised.
 * This function never touches the network.
 */
export async function broadcastSigned(
  chain: ChainId,
  signedTxHex: string,
): Promise<{ status: 'disabled'; reason: string }> {
  void chain;
  void signedTxHex;

  return { status: 'disabled', reason: BROADCAST_DISABLED_MESSAGE };
}

/**
 * Ambiguous-broadcast rule (Sol p5; OneKey ServiceSend pattern): an
 * unknown outcome stays unresolved. Never resend, never blindly compose
 * a replacement — only independent reconciliation may resolve it.
 */
export function markBroadcastUnknown(txHash: string): {
  txHash: string;
  status: 'unknown';
  message: string;
} {
  return {
    txHash,
    status: 'unknown',
    message:
      'Broadcast outcome unknown — the transaction stays unresolved. Do not resend it and do not compose a replacement without independent reconciliation.',
  };
}

export interface BtcSigningUtxo {
  /** Display-order txid hex (64 characters), as returned by the adapter. */
  txid: string;
  vout: number;
  valueBaseUnits: string;
}

export type BtcSignedTx =
  | {
      ok: true;
      signedTxHex: `0x${string}`;
      txHash: string;
      from: string;
      feeBaseUnits: string;
    }
  | { ok: false; reason: string };

/**
 * Offline BTC signing (hands-on, probe-proven 2026-11-19). The plan and the
 * signature come from the same input; the fee and change are taken from the
 * plan, and the signed outputs are verified against the destination and
 * change scripts before returning. Byte order (proven by the /tmp probe):
 * Wallet Core's outPoint.hash is used verbatim in the serialized tx, so a
 * display-order txid must be REVERSED first. UTXOs are assumed to belong
 * to the from address (P2WPKH): this wallet only receives at its own
 * account-0 address in this lane, so the input script is derived from it.
 */
export async function signBtcOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountSats: string,
  utxos: BtcSigningUtxo[],
  byteFee: string,
  changeAddress: string,
): Promise<BtcSignedTx> {
  const amount = toSafeInt(amountSats);
  const feeRate = toSafeInt(byteFee);
  if (
    amount === null ||
    amount <= 0 ||
    feeRate === null ||
    feeRate <= 0 ||
    utxos.length === 0 ||
    utxos.some(
      (u) =>
        !/^[0-9a-fA-F]{64}$/.test(u.txid) ||
        !Number.isSafeInteger(u.vout) ||
        u.vout < 0 ||
        toSafeInt(u.valueBaseUnits) === null,
    )
  ) {
    return {
      ok: false,
      reason: 'Invalid BTC signing inputs.',
    };
  }

  let from: string;
  try {
    from = (await deriveAddresses(mnemonic, passphrase)).btc;
  } catch (error: unknown) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign BTC transaction offline.',
    };
  }

  const core = await loadCore();
  try {
    return await withSigningKey(
      mnemonic,
      passphrase,
      core.CoinType.bitcoin,
      "m/84'/0'/0'/0/0",
      async (keyBytes) => {
        if (keyBytes.length !== 32) {
          return {
            ok: false as const,
            reason: 'Invalid Bitcoin signing key length.',
          };
        }
        const scriptObj = core.BitcoinScript.lockScriptForAddress(
          from,
          core.CoinType.bitcoin,
        );
        try {
          const script = new Uint8Array(scriptObj.data());
          const input = TW.Bitcoin.Proto.SigningInput.create({
            hashType: 1,
            amount: Long.fromNumber(amount),
            byteFee: Long.fromNumber(feeRate),
            toAddress: to,
            changeAddress,
            privateKey: [keyBytes],
            utxo: utxos.map((u) => ({
              outPoint: {
                hash: reverseBytes(hexToBytes(u.txid)),
                index: u.vout,
              },
              script,
              amount: Long.fromNumber(toSafeInt(u.valueBaseUnits) as number),
            })),
          });
          const encodedInput =
            TW.Bitcoin.Proto.SigningInput.encode(input).finish();
          try {
            const plan = TW.Bitcoin.Proto.TransactionPlan.decode(
              core.AnySigner.plan(encodedInput, core.CoinType.bitcoin),
            );
            if (plan.error !== TW.Common.Proto.SigningError.OK) {
              return {
                ok: false as const,
                reason: 'Transaction plan failed.',
              };
            }
            const output = TW.Bitcoin.Proto.SigningOutput.decode(
              core.AnySigner.sign(encodedInput, core.CoinType.bitcoin),
            );
            if (output.error !== TW.Common.Proto.SigningError.OK) {
              return {
                ok: false as const,
                reason: output.errorMessage || 'Signing failed.',
              };
            }
            if (output.encoded.length === 0 || !output.transactionId) {
              return {
                ok: false as const,
                reason: 'Signer returned an empty transaction.',
              };
            }
            // Verify the signed outputs before returning anything.
            const destScript = core.BitcoinScript.lockScriptForAddress(
              to,
              core.CoinType.bitcoin,
            );
            const changeScript = core.BitcoinScript.lockScriptForAddress(
              changeAddress,
              core.CoinType.bitcoin,
            );
            try {
              const hexOf = (bytes: Uint8Array): string =>
                bytesToHex(bytes).slice(2);
              const destHex = hexOf(new Uint8Array(destScript.data()));
              const changeHex = hexOf(new Uint8Array(changeScript.data()));
              const outs = output.transaction?.outputs ?? [];
              const destOut = outs.find(
                (o) =>
                  o.script !== null &&
                  o.script !== undefined &&
                  o.value !== null &&
                  o.value !== undefined &&
                  hexOf(o.script) === destHex &&
                  Number(o.value) === amount,
              );
              const changeOut = outs.find(
                (o) =>
                  o.script !== null &&
                  o.script !== undefined &&
                  o.value !== null &&
                  o.value !== undefined &&
                  hexOf(o.script) === changeHex &&
                  Number(o.value) === Number(plan.change),
              );
              if (!destOut || !changeOut) {
                return {
                  ok: false as const,
                  reason: 'Signed outputs do not match the plan.',
                };
              }
            } finally {
              destScript.delete();
              changeScript.delete();
            }
            return {
              ok: true as const,
              signedTxHex: bytesToHex(output.encoded),
              txHash: output.transactionId,
              from,
              feeBaseUnits: String(plan.fee),
            };
          } finally {
            encodedInput.fill(0);
          }
        } finally {
          scriptObj.delete();
        }
      },
    );
  } catch {
    return { ok: false, reason: 'Failed to sign BTC transaction offline.' };
  }
}

export interface TrxBlockHeader {
  timestamp: number;
  number: number;
  txTrieRoot: string;
  parentHash: string;
  /** Base58 TRON address of the block witness. */
  witnessAddress: string;
}

export type TrxSignedTx =
  | { ok: true; signedTxJson: string; txId: string; from: string }
  | { ok: false; reason: string };

/**
 * Offline TRX signing (hands-on, probe-proven 2026-11-19). The block
 * header comes from the live chain (the UI fetches it read-only from
 * TronGrid at signing time); the signature is verified by the caller
 * against the transaction id. TRON signatures carry the recovery id as
 * 0/1, not 27/28. Nothing here broadcasts.
 */
export async function signTrxOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountSun: string,
  blockHeader: TrxBlockHeader,
): Promise<TrxSignedTx> {
  const amount = toSafeInt(amountSun);
  let headerBytes: {
    txTrieRoot: Uint8Array;
    parentHash: Uint8Array;
    witnessAddress: Uint8Array;
  };
  try {
    if (
      amount === null ||
      amount <= 0 ||
      !Number.isSafeInteger(blockHeader.timestamp) ||
      !Number.isSafeInteger(blockHeader.number)
    ) {
      return { ok: false, reason: 'Invalid TRX signing inputs.' };
    }
    headerBytes = {
      txTrieRoot: hexToBytes(blockHeader.txTrieRoot),
      parentHash: hexToBytes(blockHeader.parentHash),
      witnessAddress: tronAddressToBytes(blockHeader.witnessAddress),
    };
    if (
      headerBytes.txTrieRoot.length !== 32 ||
      headerBytes.parentHash.length !== 32
    ) {
      return { ok: false, reason: 'Invalid TRX signing inputs.' };
    }
  } catch {
    return { ok: false, reason: 'Invalid TRX signing inputs.' };
  }

  let from: string;
  try {
    from = (await deriveAddresses(mnemonic, passphrase)).trx;
  } catch (error: unknown) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign TRX transaction offline.',
    };
  }

  const core = await loadCore();
  try {
    return await withSigningKey(
      mnemonic,
      passphrase,
      core.CoinType.tron,
      "m/44'/195'/0'/0/0",
      async (keyBytes) => {
        if (keyBytes.length !== 32) {
          return {
            ok: false as const,
            reason: 'Invalid TRON signing key length.',
          };
        }
        const now = Date.now();
        const input = TW.Tron.Proto.SigningInput.create({
          transaction: {
            timestamp: Long.fromNumber(now),
            expiration: Long.fromNumber(now + 600000),
            blockHeader: {
              timestamp: Long.fromNumber(blockHeader.timestamp),
              txTrieRoot: headerBytes.txTrieRoot,
              parentHash: headerBytes.parentHash,
              number: Long.fromNumber(blockHeader.number),
              witnessAddress: headerBytes.witnessAddress,
              version: 0,
            },
            transfer: {
              ownerAddress: from,
              toAddress: to,
              amount: Long.fromNumber(amount),
            },
          },
          privateKey: keyBytes,
        });
        const encoded =
          TW.Tron.Proto.SigningInput.encode(input).finish();
        try {
          const output = TW.Tron.Proto.SigningOutput.decode(
            core.AnySigner.sign(encoded, core.CoinType.tron),
          );
          if (output.error !== TW.Common.Proto.SigningError.OK) {
            return {
              ok: false as const,
              reason: output.errorMessage || 'Signing failed.',
            };
          }
          if (!output.json || output.id.length !== 32) {
            return {
              ok: false as const,
              reason: 'Signer returned an empty transaction.',
            };
          }
          return {
            ok: true as const,
            signedTxJson: output.json,
            txId: bytesToHex(output.id).slice(2),
            from,
          };
        } finally {
          encoded.fill(0);
        }
      },
    );
  } catch {
    return { ok: false, reason: 'Failed to sign TRX transaction offline.' };
  }
}

export type TonSignedTx =
  | { ok: true; signedBocBase64: string; messageHash: string; from: string }
  | { ok: false; reason: string };

/**
 * Offline TON signing (hands-on, probe-proven 2026-11-19; V4R2 wallet,
 * mode 3 = pay-fees-separately + ignore-action-phase-errors). Uses the
 * HDWallet directly instead of withSigningKey: TON needs the Ed25519
 * public key from the same key object as the seed, and withSigningKey
 * yields seed bytes only. The seed view is zero-filled after signing and
 * the wallet/key objects deleted. Signed-BOC contents are NOT re-parsed
 * here (no BOC parser vendored): verification is the no-error result, a
 * 32-byte message hash, and the BOC magic prefix — recorded as a boundary
 * in REBUILD-EVIDENCE.md.
 */
export async function signTonOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountNano: string,
  seqno: number,
): Promise<TonSignedTx> {
  if (
    !/^[0-9]+$/.test(amountNano) ||
    BigInt(amountNano) <= 0n ||
    !Number.isSafeInteger(seqno) ||
    seqno < 0
  ) {
    return { ok: false, reason: 'Invalid TON signing inputs.' };
  }

  let from: string;
  try {
    from = (await deriveAddresses(mnemonic, passphrase)).ton;
  } catch (error: unknown) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign TON transaction offline.',
    };
  }

  const core = await loadCore();
  let wallet: ReturnType<typeof core.HDWallet.createWithMnemonic> | null =
    null;
  try {
    wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
    if (!wallet) throw new Error('Unable to restore wallet.');
    const key = wallet.getKey(core.CoinType.ton, "m/44'/607'/0'");
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
        messages: [
          {
            dest: to,
            amount: minimalBigEndian(amountNano),
            mode: 3,
          },
        ],
        sequenceNumber: seqno,
        expireAt: Math.floor(Date.now() / 1000) + 600,
        walletVersion:
          TW.TheOpenNetwork.Proto.WalletVersion.WALLET_V4_R2,
      });
      const encoded =
        TW.TheOpenNetwork.Proto.SigningInput.encode(input).finish();
      try {
        const output = TW.TheOpenNetwork.Proto.SigningOutput.decode(
          core.AnySigner.sign(encoded, core.CoinType.ton),
        );
        if (output.error !== TW.Common.Proto.SigningError.OK) {
          return {
            ok: false,
            reason: output.errorMessage || 'Signing failed.',
          };
        }
        if (!output.encoded || output.hash.length !== 32) {
          return {
            ok: false,
            reason: 'Signer returned an empty transaction.',
          };
        }
        return {
          ok: true,
          signedBocBase64: output.encoded,
          messageHash: bytesToHex(output.hash),
          from,
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
      reason:
        error instanceof Error && error.message === 'Invalid mnemonic.'
          ? 'Invalid mnemonic.'
          : 'Failed to sign TON transaction offline.',
    };
  } finally {
    wallet?.delete();
  }
}
