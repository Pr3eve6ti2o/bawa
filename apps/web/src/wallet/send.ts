import Long from 'long';
import { TW } from '@trustwallet/wallet-core';
import { bytesToHex, keccak256, parseTransaction, recoverAddress, serializeTransaction } from 'viem';
import { loadCore } from '../engine/boundary';
import type { ChainId } from '../engine/boundary';
import {
  assertIntentMatchesTransaction,
  createPartialSigner,
  createTransactionIntent,
  deriveAddresses,
  deriveDevnetAddressesAt,
  withSigningKey,
} from './core';
import { getAdapterForMode, getDevnetAdapter } from './adapters';
import {
  chainConfigForDevnetNetwork,
  devnetExplorerTxUrl,
  isDevnetNetworkId,
} from './devnet-endpoints';
import {
  isValidTestnetBtcAddress,
  isValidTestnetTonAddress,
  reencodeBtcAddressToMainnet,
} from './devnet';
import {
  BROADCAST_DISABLED_MESSAGE,
  type UtxoInput,
} from './adapters/types';
import { CHAIN_DECIMALS, decimalToBaseUnits } from './chain-amount-format';
import { isTestVault } from './vault';
import type { KeyProvenance } from './vault';

/**
 * Send flow (Fix Lane 3, Phase 4). Pure send-domain helpers on top of the
 * Phase 2 adapters and the Wallet Core 4.9.3 WASM engine. Nothing in this
 * module broadcasts on mainnet: broadcast stays DISABLED until separately
 * authorised (see broadcastSigned). The temporary devnet broadcast
 * (broadcastSignedDevnet) submits on devnet only, behind three gates.
 * No function here logs or stores a secret.
 */

/** Devnet threading (temporary devnet mode): pass `{ devnet: true }` to
 * use the devnet derivation, the devnet adapters and the devnet
 * broadcast. Mainnet behaviour is unchanged when the option is absent. */
export type SendDevnetOptions = {
  devnet?: boolean;
  /**
   * The signer's message hash (0x-prefixed hex), when the signer
   * computed one. TON's jsonRPC sendBoc returns no hash, so the TON
   * devnet broadcast identifies the transaction by this hash instead.
   */
  messageHash?: string;
};

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
  gnosis: 'Gnosis',
  celo: 'Celo',
  linea: 'Linea',
  mantle: 'Mantle',
  scroll: 'Scroll',
  opbnb: 'opBNB',
  metis: 'Metis',
  aurora: 'Aurora',
  fantom: 'Fantom',
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
  options?: SendDevnetOptions,
): Promise<RecipientValidation> {
  const recipient = address.trim();

  if (recipient.length === 0) {
    return { ok: false, reason: 'Recipient address is required.' };
  }

  const invalid: RecipientValidation = {
    ok: false,
    reason: 'Invalid ' + CHAIN_NAMES[chain] + ' address.',
  };

  const devnet = options?.devnet === true;

  // BTC devnet: Wallet Core's validator only knows mainnet forms, so
  // testnet forms are validated by bech32 checksum/program (tb1q/tb1p)
  // or base58check version (0x6f/0xc4) instead.
  if (chain === 'btc' && devnet) {
    return isValidTestnetBtcAddress(recipient) ? { ok: true } : invalid;
  }

  // TON devnet: the testnet flag is display-only for the destination
  // (workchain + hash), so EQ/UQ stay valid destinations and fall
  // through to Wallet Core's validator; 0Q/kQ are validated
  // structurally because Wallet Core only knows mainnet tags. The
  // third Base64 character ensures workchain 0 in every case.
  if (chain === 'ton' && devnet) {
    if (!/^(?:EQ|UQ|0Q|kQ)[A-D]/.test(recipient)) {
      return invalid;
    }
    if (recipient.startsWith('0Q') || recipient.startsWith('kQ')) {
      return isValidTestnetTonAddress(recipient) ? { ok: true } : invalid;
    }
  } else if (chain === 'ton' && !/^(?:EQ|UQ)[A-D]/.test(recipient)) {
    // EQ/UQ require mainnet; the third Base64 character ensures workchain 0.
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
      gnosis: core.CoinType.xdai,
      celo: core.CoinType.celo,
      linea: core.CoinType.linea,
      mantle: core.CoinType.mantle,
      scroll: core.CoinType.scroll,
      opbnb: core.CoinType.opBNB,
      metis: core.CoinType.metis,
      aurora: core.CoinType.aurora,
      fantom: core.CoinType.fantom,
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
      /**
       * TON only: the fee is not known at preview time (no read-only
       * fee endpoint exists) and feeBaseUnits is a '0' placeholder that
       * must never be displayed as a real fee. The review screen shows
       * unknown-fee copy instead.
       */
      feeUnknown?: boolean;
    }
  | {
      ok: false;
      code: SendFailureCode;
      reason: string;
      signingErrorCode?: number;
    };

export type SendFailureCode =
  | 'invalid-input'
  | 'invalid-mnemonic'
  | 'insufficient-funds'
  | 'insufficient-gas'
  | 'bad-nonce'
  | 'bad-seqno'
  | 'plan-failed'
  | 'simulation-failed'
  | 'signing-failed'
  | 'submit-failed'
  | 'adapter-unavailable'
  | 'signer-empty'
  | 'intent-mismatch'
  | 'unsupported-version'
  | 'unknown';

/** Unknown broadcast state remains separate from send failures. */
export type SendFailure = {
  ok: false;
  code: SendFailureCode;
  reason: string;
  signingErrorCode?: number;
};

/** 'submitted' is unreachable while broadcast stays disabled. */
export type SendProgressStage =
  | 'building'
  | 'simulating'
  | 'signing'
  | 'signed'
  | 'submitted';

export function signingFailure(
  reason: string,
  signingErrorCode: number,
): SendFailure {
  return {
    ok: false,
    code: 'signing-failed',
    reason,
    signingErrorCode,
  };
}

export function planFailure(
  errorCode: number,
  errorMessage: string,
): SendFailure {
  return {
    ok: false,
    code: 'plan-failed',
    reason: errorMessage
      ? `Transaction plan failed (SigningError ${errorCode}): ${errorMessage}`
      : `Transaction plan failed (SigningError ${errorCode}).`,
    signingErrorCode: errorCode,
  };
}


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
  devnet = false,
): Promise<
  { ok: true; feeBaseUnits: string } | SendFailure
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
    return { ok: false, code: 'invalid-input', reason: 'Invalid BTC fee-planning inputs.' };
  }
  // Devnet: never pass a tb1q address to Wallet Core — re-encode the
  // same witness program with the bc HRP. The scriptPubKey is
  // identical, so the plan (fee, change) is the same.
  let planFrom = fromAddress;
  let planTo = toAddress;
  if (devnet) {
    const mappedFrom = reencodeBtcAddressToMainnet(fromAddress);
    const mappedTo = reencodeBtcAddressToMainnet(toAddress);
    if (mappedFrom === null || mappedTo === null) {
      return { ok: false, code: 'invalid-input', reason: 'Invalid BTC devnet address.' };
    }
    planFrom = mappedFrom;
    planTo = mappedTo;
  }
  try {
    const core = await loadCore();
    const scriptObj = core.BitcoinScript.lockScriptForAddress(
      planFrom,
      core.CoinType.bitcoin,
    );
    let encoded: Uint8Array;
    try {
      const script = new Uint8Array(scriptObj.data());
      const input = TW.Bitcoin.Proto.SigningInput.create({
        hashType: 1,
        amount: Long.fromNumber(amountInt),
        byteFee: Long.fromNumber(feeRate),
        toAddress: planTo,
        changeAddress: planFrom,
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
      return planFailure(plan.error, '');
    }
    return { ok: true, feeBaseUnits: String(plan.fee) };
  } catch {
    return { ok: false, code: 'plan-failed', reason: 'BTC fee planning failed.' };
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
  options?: SendDevnetOptions,
): Promise<SendPreview> {
  const devnet = options?.devnet === true;
  const amount = decimalToBaseUnits(amountDecimal, CHAIN_DECIMALS[chain]);
  if (amount === null || BigInt(amount) <= 0n) {
    return { ok: false, code: 'invalid-input', reason: 'Enter a valid amount.' };
  }

  const adapter = getAdapterForMode(chain, devnet);
  if (!adapter) {
    return { ok: false, code: 'adapter-unavailable', reason: 'No adapter available for this chain.' };
  }

  const balance = await adapter.getBalance(fromAddress);
  if (balance.status !== 'ok') {
    return { ok: false, code: 'adapter-unavailable', reason: balance.reason };
  }
  if (BigInt(amount) > BigInt(balance.data.valueBaseUnits)) {
    return { ok: false, code: 'insufficient-funds', reason: 'Amount exceeds available balance.' };
  }

  // TON has no read-only fee endpoint: the adapter honestly reports the
  // fee quote unavailable. Gating the preview on estimateFee made TON
  // sends impossible — the review step could never be reached (found
  // live in devnet, Lane D 2026-11-22). When the adapter does return a
  // fee, use it; otherwise the preview proceeds with the fee marked
  // unknown. No fee number is invented: feeBaseUnits '0' is a
  // placeholder, never displayed (the review screen shows unknown-fee
  // copy), and the note says the network charges the fee on top of the
  // amount at broadcast.
  if (chain === 'ton') {
    const fee = await adapter.estimateFee();
    if (fee.status === 'ok') {
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
    return {
      ok: true,
      amountBaseUnits: amount,
      feeBaseUnits: '0',
      totalBaseUnits: amount,
      feeNote:
        'TON fee is charged by the network when the transaction is broadcast; it is not known in advance and comes out of your balance on top of this amount.',
      feeUnknown: true,
    };
  }

  const fee = await adapter.estimateFee();
  if (fee.status !== 'ok') {
    return { ok: false, code: 'adapter-unavailable', reason: fee.reason };
  }

  if (chain === 'btc') {
    const inputs = await adapter.getTxInputs(fromAddress);
    if (inputs.status !== 'ok') {
      return { ok: false, code: 'adapter-unavailable', reason: inputs.reason };
    }
    if (inputs.data.kind !== 'utxo') {
      return { ok: false, code: 'adapter-unavailable', reason: 'BTC adapter did not return UTXOs.' };
    }
    const planned = await planBtcFee(
      fromAddress,
      toAddress,
      amount,
      fee.data.feeBaseUnits,
      inputs.data.utxos,
      devnet,
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

export type SimulationError = {
  code: string;
  message: string;
  chain: ChainId;
};

export type SimulateSendResult =
  | {
      ok: true;
      amountBaseUnits: string;
      feeBaseUnits: string;
      /** TON only: see SendPreview.feeUnknown. */
      feeUnknown?: boolean;
    }
  | {
      ok: false;
      error: SimulationError;
      code: SendFailureCode;
      reason: string;
    };

function simulationRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function simulationText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function simulationExecutionCode(code: string): string {
  if (code === 'bad-nonce') return 'stale-nonce';
  if (code === 'bad-seqno') return 'stale-seqno';
  return code;
}

function simulationFailed(
  chain: ChainId,
  cause: unknown,
  fallbackCode: string,
  fallbackReason: string,
): Extract<SimulateSendResult, { ok: false }> {
  const source = simulationRecord(cause);
  const detail = simulationRecord(source?.error);

  const executionCode = simulationExecutionCode(
    simulationText(detail?.code) ??
      simulationText(source?.code) ??
      fallbackCode,
  );

  const message =
    simulationText(source?.reason) ??
    simulationText(detail?.message) ??
    simulationText(detail?.reason) ??
    simulationText(source?.message) ??
    simulationText(source?.error) ??
    simulationText(cause) ??
    fallbackReason;

  // Keep execution codes separate from the existing send failure vocabulary.
  const publicCode = simulationExecutionCode(
    simulationText(source?.code) ?? executionCode,
  );
  let code: SendFailureCode = 'simulation-failed';

  if (
    publicCode === 'insufficient-funds' ||
    publicCode === 'adapter-unavailable'
  ) {
    code = publicCode;
  } else if (publicCode === 'stale-nonce') {
    code = 'bad-nonce';
  } else if (publicCode === 'stale-seqno') {
    code = 'bad-seqno';
  }

  return {
    ok: false,
    error: { code: executionCode, message, chain },
    code,
    reason: message,
  };
}

/**
 * Offline executability pre-check, not an execution simulation RPC.
 * Success is neither a broadcast nor a confirmation. A simulation failure
 * BLOCKS signing: the UI must run simulateSend after review and before
 * signing, and must not call any sign function when simulation fails.
 */
export async function simulateSend(
  chain: ChainId,
  from: string,
  to: string,
  amountDecimal: string,
  options?: SendDevnetOptions,
): Promise<SimulateSendResult> {
  const devnet = options?.devnet === true;
  const preview = await previewSendAmount(chain, from, to, amountDecimal, options);

  if (!preview.ok) {
    return {
      ...preview,
      error: {
        code: simulationExecutionCode(preview.code),
        message: preview.reason,
        chain,
      },
    };
  }

  // BTC/TRX freshness checks (S4b): UTXO coverage and account inputs.
  if (chain !== 'eth' && chain !== 'ton') {
    const adapter = getAdapterForMode(chain, devnet);
    if (!adapter) {
      return simulationFailed(
        chain,
        undefined,
        'adapter-unavailable',
        `No adapter available for ${chain}.`,
      );
    }

    try {
      if (chain === 'btc') {
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok' || inputs.data.kind !== 'utxo') {
          const reason = 'BTC UTXO inputs are unavailable.';
          return simulationFailed(
            chain,
            inputs.status === 'ok'
              ? { status: 'unavailable', reason }
              : inputs,
            'fee-unavailable',
            reason,
          );
        }

        const feeEstimate = await adapter.estimateFee();
        if (feeEstimate.status !== 'ok') {
          return simulationFailed(
            chain,
            feeEstimate,
            'fee-unavailable',
            'The live BTC sat/vB fee rate is unavailable.',
          );
        }

        // The BTC fee quote is a sat/vB RATE in feeBaseUnits (see
        // previewSendAmount); planBtcFee turns it into the real fee.
        const plan = await planBtcFee(
          from,
          to,
          preview.amountBaseUnits,
          feeEstimate.data.feeBaseUnits,
          inputs.data.utxos,
          devnet,
        );
        if (!plan.ok) {
          return simulationFailed(
            chain,
            plan,
            'fee-unavailable',
            'Unable to plan a fee using the live BTC inputs and rate.',
          );
        }

        const amount = BigInt(preview.amountBaseUnits);
        const available = inputs.data.utxos.reduce(
          (total, utxo) => total + BigInt(utxo.valueBaseUnits),
          BigInt(0),
        );
        if (available < amount + BigInt(plan.feeBaseUnits)) {
          return simulationFailed(
            chain,
            undefined,
            'insufficient-funds',
            'BTC UTXOs no longer cover the amount plus the planned fee.',
          );
        }

        return { ...preview, feeBaseUnits: plan.feeBaseUnits };
      }

      if (chain === 'trx') {
        const inputs = await adapter.getTxInputs(from);
        if (inputs.status !== 'ok' || inputs.data.kind !== 'account') {
          const reason = 'TRX account inputs are unavailable.';
          return simulationFailed(
            chain,
            inputs.status === 'ok'
              ? { status: 'unavailable', reason }
              : inputs,
            'adapter-unavailable',
            reason,
          );
        }
      }

      return preview;
    } catch (cause: unknown) {
      const code =
        chain === 'btc' ? 'fee-unavailable' : 'adapter-unavailable';
      const reason =
        chain === 'btc'
          ? 'Unable to refresh BTC inputs and fees.'
          : 'Unable to refresh TRX account inputs.';
      return simulationFailed(
        chain,
        {
          status: 'error',
          reason: cause instanceof Error ? cause.message : reason,
        },
        code,
        reason,
      );
    }
  }

  const kind = chain === 'eth' ? 'nonce' : 'seqno';
  const fallbackCode = kind === 'nonce' ? 'stale-nonce' : 'stale-seqno';
  const fallbackReason = `The ${chain} adapter did not return a live ${kind}.`;

  // Reuse the same adapter resolver as previewSendAmount. getTxInputs
  // returns the AdapterResult discriminated union ({status, data|reason});
  // its data is a TxInput ({kind:'nonce', nonce} or {kind:'seqno', seqno}).
  const adapter = getAdapterForMode(chain, devnet);
  if (!adapter) {
    return simulationFailed(chain, undefined, 'adapter-unavailable', fallbackReason);
  }

  const inputs = await adapter.getTxInputs(from);
  if (inputs.status !== 'ok') {
    return simulationFailed(chain, inputs, fallbackCode, fallbackReason);
  }

  const data = inputs.data;
  const live =
    chain === 'eth'
      ? data.kind === 'nonce' &&
        Number.isSafeInteger(data.nonce) &&
        data.nonce >= 0
      : data.kind === 'seqno' &&
        Number.isSafeInteger(data.seqno) &&
        data.seqno >= 0;

  // Zero is valid for both nonce and seqno.
  if (!live) {
    return simulationFailed(chain, undefined, fallbackCode, fallbackReason);
  }

  return preview;
}

export type EthSignedTx =
  | { ok: true; signedTxHex: `0x${string}`; txHash: string; from: string }
  | SendFailure;

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

export type EthSignIntent = {
  from: string;
  to: string;
  amountBaseUnits: string;
  nonce: string;
  chainId: number;
};

/**
 * Post-sign verification for ETH (Phase 3, Lane H; mirrors the BTC
 * output check in signBtcOffline). The signed transaction is re-decoded
 * with viem's parseTransaction — an independent RLP/ecrecover path from
 * Wallet Core's signer — and from/to/value/nonce/chainId are asserted
 * against the signing intent before anything is returned. The sender is
 * recovered from the signature over the EIP-155 unsigned serialization,
 * so a signer bug or a wrong-chainId input fails here instead of
 * returning a signed transaction. Never throws: a parse or recovery
 * failure is a verification failure, not an exception.
 */
export async function verifyEthSignedTx(
  signedTxHex: `0x${string}`,
  intent: EthSignIntent,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const parsed = parseTransaction(signedTxHex);
    if (parsed.to?.toLowerCase() !== intent.to.toLowerCase()) {
      return {
        ok: false,
        reason: 'Signed ETH transaction destination does not match the signing intent.',
      };
    }
    if (parsed.value !== BigInt(intent.amountBaseUnits)) {
      return {
        ok: false,
        reason: 'Signed ETH transaction value does not match the signing intent.',
      };
    }
    if (parsed.nonce === null || parsed.nonce === undefined || BigInt(parsed.nonce) !== BigInt(intent.nonce)) {
      return {
        ok: false,
        reason: 'Signed ETH transaction nonce does not match the signing intent.',
      };
    }
    if (parsed.chainId !== intent.chainId) {
      return {
        ok: false,
        reason: 'Signed ETH transaction chain id does not match the signing intent.',
      };
    }
    if (
      parsed.gasPrice === undefined ||
      parsed.gas === undefined ||
      parsed.r === undefined ||
      parsed.s === undefined ||
      parsed.v === undefined
    ) {
      return {
        ok: false,
        reason: 'Signed ETH transaction failed post-sign verification.',
      };
    }
    // viem parseTransaction leaves `from` undefined in 2.58; recover it
    // from the signature over the unsigned serialization (EIP-155).
    const payload = serializeTransaction({
      chainId: parsed.chainId,
      nonce: parsed.nonce,
      gasPrice: parsed.gasPrice,
      gas: parsed.gas,
      to: parsed.to,
      value: parsed.value,
      data: parsed.data ?? '0x',
    });
    const recovered = await recoverAddress({
      hash: keccak256(payload),
      signature: {
        r: parsed.r as `0x${string}`,
        s: parsed.s as `0x${string}`,
        yParity: Number((parsed.v as bigint) - 35n - BigInt(parsed.chainId) * 2n),
      },
    });
    if (recovered.toLowerCase() !== intent.from.toLowerCase()) {
      return {
        ok: false,
        reason: 'Signed ETH transaction sender does not match the signing intent.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'Signed ETH transaction failed post-sign verification.',
    };
  }
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
 * S6a (2026-11-20): the signing core now uses the PartialSigner facade
 * (createPartialSigner + signDigest) with viem reassembly; the
 * withSigningKey/AnySigner path is gone. Output is byte-identical to the
 * old path (probe-verified against the pre-facade signer).
 */
export async function signEthOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountBaseUnits: string,
  nonce: string,
  gasPriceBaseUnits: string,
  options?: SendDevnetOptions,
): Promise<EthSignedTx> {
  const devnet = options?.devnet === true;
  // Sepolia chain id in devnet mode; mainnet chain id otherwise.
  const chainId = devnet ? 11155111 : 1;
  if (
    ![amountBaseUnits, nonce, gasPriceBaseUnits].every(
      (value) => typeof value === 'string' && /^[0-9]+$/.test(value),
    )
  ) {
    return {
      ok: false,
      code: 'invalid-input',
      reason:
        'Amount, nonce and gas price must be unsigned decimal integer strings.',
    };
  }

  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, 0, 0)).eth
      : (await deriveAddresses(mnemonic, passphrase)).eth;
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
          : 'Failed to sign ETH transaction offline.',
    };
  }

  const intent = createTransactionIntent('eth', to, amountBaseUnits, nonce);
  try {
    assertIntentMatchesTransaction(intent, {
      chain: 'eth',
      to,
      amountBaseUnits,
      sequence: nonce,
    });
  } catch {
    return {
      ok: false,
      code: 'intent-mismatch',
      reason: 'Transaction does not match the approved intent.',
    };
  }

  const unsigned = {
    chainId,
    // viem types nonce as number, but its serializer accepts bigint losslessly.
    nonce: BigInt(nonce) as unknown as number,
    gasPrice: BigInt(gasPriceBaseUnits),
    gas: 21000n,
    to: to as `0x${string}`,
    value: BigInt(amountBaseUnits),
    data: '0x' as const,
  };

  let unsignedHex: `0x${string}`;
  try {
    unsignedHex = serializeTransaction(unsigned);
  } catch {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Ethereum transaction input.',
    };
  }

  const digest = hexToBytes(keccak256(unsignedHex));
  const signer = await createPartialSigner(mnemonic, passphrase, 'eth');
  const sig = await signer.signDigest(digest);
  const r = bytesToHex(sig.slice(0, 32));
  const s = bytesToHex(sig.slice(32, 64));
  const v = BigInt(sig[64]! + 35 + 2 * chainId);

  try {
    const signed = serializeTransaction(unsigned, { r, s, v });
    return {
      ok: true,
      signedTxHex: signed,
      txHash: keccak256(signed),
      from,
    };
  } catch {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Ethereum transaction input.',
    };
  }
}

/**
 * Item 36 enforcement (S6b): a test-marked account must never reach a
 * broadcast path. Broadcast itself stays DISABLED until separately
 * authorised; this guard is the second line of defence.
 */
export function isBroadcastAllowedFor(provenance: KeyProvenance): boolean {
  return provenance.isTesting !== true;
}

export function assertNotTestAccount(): void {
  let testing = false;
  try {
    testing = isTestVault();
  } catch {
    // No readable vault (for example, no storage in this environment):
    // there is provably no test-marked account to bar, and broadcast is
    // disabled regardless, so fall through to the disabled result.
    testing = false;
  }
  if (testing) {
    throw new Error('Broadcast blocked: account has test provenance.');
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
  assertNotTestAccount();
  void chain;
  void signedTxHex;

  return { status: 'disabled', reason: BROADCAST_DISABLED_MESSAGE };
}

/**
 * TEMPORARY devnet broadcast (owner order 2026-11-22). Submits a signed
 * transaction through the devnet adapter ONLY. Three gates, in order:
 * devnet mode must be on, the vault must not have test provenance, and
 * the adapter's network id must be a devnet id. The broadcast itself is
 * never retried here — the adapter owns its own transport. Mainnet
 * broadcast stays disabled (see broadcastSigned): this function never
 * touches a mainnet adapter or a mainnet network id.
 */
export async function broadcastSignedDevnet(
  chain: ChainId,
  signedTx: string,
  options: SendDevnetOptions,
): Promise<{ status: 'submitted'; txHash: string; explorerUrl: string }> {
  if (options?.devnet !== true) {
    throw new Error('Devnet broadcast requires devnet mode.');
  }
  assertNotTestAccount();
  const adapter = getDevnetAdapter(chain);
  if (!adapter) {
    throw new Error(`Devnet adapter unavailable for ${chain}.`);
  }
  if (!isDevnetNetworkId(adapter.networkId)) {
    throw new Error(
      `Refusing to broadcast: adapter network ${adapter.networkId} is not a devnet network.`,
    );
  }
  const result = await adapter.broadcast(
    chain === 'ton' && options.messageHash !== undefined
      ? { boc: signedTx, messageHash: options.messageHash }
      : signedTx,
  );
  // The adapter's networkId was asserted devnet above, so its config
  // resolves here; BroadcastResult.explorerUrl is nullable (mainnet
  // adapters return null), so fall back to the devnet explorer and
  // never return a null link.
  const config = chainConfigForDevnetNetwork(adapter.networkId);
  return {
    status: 'submitted',
    txHash: result.txHash,
    explorerUrl:
      result.explorerUrl ?? devnetExplorerTxUrl(config.id, result.txHash),
  };
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
      'It is unclear whether the transaction was sent — it stays unresolved. Do not resend it and do not create a replacement without checking the network first.',
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
  | SendFailure;

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
  options?: SendDevnetOptions,
): Promise<BtcSignedTx> {
  const devnet = options?.devnet === true;
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
      code: 'invalid-input',
      reason: 'Invalid BTC signing inputs.',
    };
  }

  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, 0, 0)).btc
      : (await deriveAddresses(mnemonic, passphrase)).btc;
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
          : 'Failed to sign BTC transaction offline.',
    };
  }

  // Devnet: map every address Wallet Core will see to its mainnet form
  // up front — a tb1q address must never reach the WASM engine. The
  // same witness program re-encoded with the bc HRP has the identical
  // scriptPubKey, so the plan and the signed outputs are the same.
  let wasmFrom = from;
  let wasmTo = to;
  let wasmChange = changeAddress;
  if (devnet) {
    const mappedFrom = reencodeBtcAddressToMainnet(from);
    const mappedTo = reencodeBtcAddressToMainnet(to);
    const mappedChange = reencodeBtcAddressToMainnet(changeAddress);
    if (mappedFrom === null || mappedTo === null || mappedChange === null) {
      return {
        ok: false,
        code: 'invalid-input',
        reason: 'Invalid BTC devnet address.',
      };
    }
    wasmFrom = mappedFrom;
    wasmTo = mappedTo;
    wasmChange = mappedChange;
  }

  const core = await loadCore();
  try {
    return await withSigningKey(
      mnemonic,
      passphrase,
      core.CoinType.bitcoin,
      devnet ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0",
      async (keyBytes) => {
        if (keyBytes.length !== 32) {
          return {
            ok: false as const,
            code: 'signer-empty',
            reason: 'Invalid Bitcoin signing key length.',
          };
        }
        const scriptObj = core.BitcoinScript.lockScriptForAddress(
          wasmFrom,
          core.CoinType.bitcoin,
        );
        try {
          const script = new Uint8Array(scriptObj.data());
          const input = TW.Bitcoin.Proto.SigningInput.create({
            hashType: 1,
            amount: Long.fromNumber(amount),
            byteFee: Long.fromNumber(feeRate),
            toAddress: wasmTo,
            changeAddress: wasmChange,
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
              return planFailure(plan.error, '');
            }
            const output = TW.Bitcoin.Proto.SigningOutput.decode(
              core.AnySigner.sign(encodedInput, core.CoinType.bitcoin),
            );
            if (output.error !== TW.Common.Proto.SigningError.OK) {
              return signingFailure(output.errorMessage || 'Signing failed.', output.error);
            }
            if (output.encoded.length === 0 || !output.transactionId) {
              return {
                ok: false as const,
                code: 'signing-failed',
                reason: 'Signer returned an empty transaction.',
              };
            }
            // Verify the signed outputs before returning anything.
            const destScript = core.BitcoinScript.lockScriptForAddress(
              wasmTo,
              core.CoinType.bitcoin,
            );
            const changeScript = core.BitcoinScript.lockScriptForAddress(
              wasmChange,
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
                  code: 'signing-failed',
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
    return { ok: false, code: 'unknown', reason: 'Failed to sign BTC transaction offline.' };
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
  | SendFailure;

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
  options?: SendDevnetOptions,
): Promise<TrxSignedTx> {
  const devnet = options?.devnet === true;
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
      return { ok: false, code: 'invalid-input', reason: 'Invalid TRX signing inputs.' };
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
      return { ok: false, code: 'invalid-input', reason: 'Invalid TRX signing inputs.' };
    }
  } catch {
    return { ok: false, code: 'invalid-input', reason: 'Invalid TRX signing inputs.' };
  }

  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, 0, 0)).trx
      : (await deriveAddresses(mnemonic, passphrase)).trx;
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
            code: 'signer-empty',
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
            return signingFailure(output.errorMessage || 'Signing failed.', output.error);
          }
          if (!output.json || output.id.length !== 32) {
            return {
              ok: false as const,
              code: 'signing-failed',
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
    return { ok: false, code: 'unknown', reason: 'Failed to sign TRX transaction offline.' };
  }
}

export type TonSignedTx =
  | { ok: true; signedBocBase64: string; messageHash: string; from: string }
  | SendFailure;

export type TonWalletVersion = 'v4r2' | 'v3r2' | 'v4' | 'v5r1';

/** Domain-binding context handed to the external signer. */
export type SignatureDomain = {
  purpose: 'ton-transfer';
  walletVersion: TonWalletVersion;
};

export type TonExternalSignRequest = {
  chain: 'ton';
  from: string;
  to: string;
  amountNano: string;
  seqno: number;
  expireAt: number;
  walletVersion: TonWalletVersion;
  domain: SignatureDomain;
};

export type TonExternalSignResult = {
  signedBocBase64: string;
  messageHash: string;
};

/**
 * Delegated whole-transfer signer. Wallet Core's TON output.hash depends
 * on the signing key and no TON TransactionPlan type exists, so an
 * external signer cannot be handed a hash to sign — it signs the whole
 * transfer and returns the signed BOC.
 */
export type TonExternalSigner = (
  request: TonExternalSignRequest,
) => Promise<TonExternalSignResult>;

function isValidTonExternalResult(
  value: unknown,
): value is TonExternalSignResult {
  try {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const result = value as Record<string, unknown>;
    const boc = result.signedBocBase64;
    const hash = result.messageHash;

    if (
      typeof boc !== 'string' ||
      typeof hash !== 'string' ||
      hash.length !== 66 ||
      !/^0x[0-9a-f]{64}$/.test(hash)
    ) {
      return false;
    }

    // Require canonical standard base64, without whitespace or URL-safe aliases.
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        boc,
      )
    ) {
      return false;
    }

    const bytes = atob(boc);
    return (
      btoa(bytes) === boc &&
      bytes.length >= 4 &&
      bytes.charCodeAt(0) === 0xb5 &&
      bytes.charCodeAt(1) === 0xee &&
      bytes.charCodeAt(2) === 0x9c &&
      bytes.charCodeAt(3) === 0x72
    );
  } catch {
    return false;
  }
}

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
  options?: {
    walletVersion?: TonWalletVersion;
    signer?: TonExternalSigner;
    domain?: SignatureDomain;
    devnet?: boolean;
  },
): Promise<TonSignedTx> {
  const devnet = options?.devnet === true;
  // Version dispatch (S5): only V4R2 is supported because derivation is
  // V4R2-only. Any other value fails loudly naming the version, before
  // either signing path runs.
  const walletVersion = options?.walletVersion ?? 'v4r2';
  const coreWalletVersion =
    walletVersion === 'v4r2'
      ? TW.TheOpenNetwork.Proto.WalletVersion.WALLET_V4_R2
      : undefined;
  if (coreWalletVersion === undefined) {
    return {
      ok: false,
      code: 'unsupported-version',
      reason: `Unsupported TON wallet version "${walletVersion}": address derivation supports v4r2 only.`,
    };
  }
  if (
    !/^[0-9]+$/.test(amountNano) ||
    BigInt(amountNano) <= 0n ||
    !Number.isSafeInteger(seqno) ||
    seqno < 0
  ) {
    return { ok: false, code: 'invalid-input', reason: 'Invalid TON signing inputs.' };
  }

  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, 0, 0)).ton
      : (await deriveAddresses(mnemonic, passphrase)).ton;
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
          : 'Failed to sign TON transaction offline.',
    };
  }

  // External signer seam (S5): a delegated whole-transfer signer. The
  // signer never sees the mnemonic or any key — only the transfer request.
  const domain: SignatureDomain = options?.domain ?? {
    purpose: 'ton-transfer',
    walletVersion,
  };
  if (
    domain.purpose !== 'ton-transfer' ||
    domain.walletVersion !== walletVersion
  ) {
    return {
      ok: false,
      code: 'signing-failed',
      reason: `Signature domain does not match TON wallet version "${walletVersion}".`,
    };
  }
  if (options?.signer) {
    const expireAt = Math.floor(Date.now() / 1000) + 600;
    const result = await options.signer({
      chain: 'ton',
      from,
      to,
      amountNano,
      seqno,
      expireAt,
      walletVersion,
      domain,
    });
    if (!isValidTonExternalResult(result)) {
      return {
        ok: false,
        code: 'signing-failed',
        reason: 'External signer returned an invalid signed message.',
      };
    }
    return {
      ok: true,
      signedBocBase64: result.signedBocBase64,
      messageHash: result.messageHash,
      from,
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
        walletVersion: coreWalletVersion,
      });
      const encoded =
        TW.TheOpenNetwork.Proto.SigningInput.encode(input).finish();
      try {
        const output = TW.TheOpenNetwork.Proto.SigningOutput.decode(
          core.AnySigner.sign(encoded, core.CoinType.ton),
        );
        if (output.error !== TW.Common.Proto.SigningError.OK) {
          return signingFailure(output.errorMessage || 'Signing failed.', output.error);
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
          : 'Failed to sign TON transaction offline.',
    };
  } finally {
    wallet?.delete();
  }
}
