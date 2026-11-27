import Long from 'long';
import { TW } from '@trustwallet/wallet-core';
import {
  SOL_ASSOCIATED_TOKEN_PROGRAM_ID,
  SOL_SYSTEM_PROGRAM_ID,
  SOL_TOKEN_PROGRAM_ID,
  SolPublicKey,
  SolTransaction,
  solKeypairPublicKey,
  solSystemTransferInstruction,
  type SolInstruction,
} from './solana-tx';
import { bytesToHex, keccak256, parseTransaction, recoverAddress, serializeTransaction } from 'viem';
import { loadCore } from '../engine/boundary';
import type { ChainId } from '../engine/boundary';
import { decodeBase58, encodeBase58 } from '../engine/address-codecs';
import { COIN_TYPE_KEY_FOR_CHAIN } from '../engine/coin-type-keys';
import { isValidKaspaAddress } from './kaspa-address';
import { isValidStarknetAddress } from './starknet-derive';
import { isEvmTxChain } from './watch-only-families';
import {
  createPartialSigner,
  deriveAddresses,
  deriveAddressesAt,
  deriveDevnetAddressesAt,
  withSigningKey,
} from './core';
import {
  assertIntentMatchesTransaction,
  createTransactionIntent,
  type SigningIntent,
} from './signing-intent';
import { chainConfig, pathFor } from './chains';
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
import {
  fetchTokenBalance,
} from './adapters/token-balances';
import { deriveAssociatedTokenAddress } from './adapters/token-balances';
import { normalizeEvmAddress } from './adapters/evm';
import {
  fetchSolanaAccountExists,
  fetchSolanaMinimumBalanceForRentExemption,
  SOL_LAMPORTS_PER_SIGNATURE,
  SOL_TOKEN_ACCOUNT_SIZE,
} from './adapters/sol';
import { tokenStandardFor, type TokenRecord } from './tokens';

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
type SendDevnetOptions = {
  devnet?: boolean;
  /**
   * The signer's message hash (0x-prefixed hex), when the signer
   * computed one. TON's jsonRPC sendBoc returns no hash, so the TON
   * devnet broadcast identifies the transaction by this hash instead.
   */
  messageHash?: string;
  /**
   * A-7: the intent created at review time in the UI, from the exact
   * details the user reviewed (recipient, amount, chain, token). The
   * EVM, EVM-token, SOL and SPL signers assert it against the
   * transaction being signed before any key is used; a mismatch
   * refuses with `intent-mismatch`. Absent for direct callers — the
   * signer's self-built intent below still runs as the fallback.
   */
  intent?: SigningIntent;
};

type RecipientValidation =
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
  zksync: 'ZKsync Era',
  cronos: 'Cronos',
  kava: 'Kava',
  filecoin: 'Filecoin',
  zora: 'Zora',
  mode: 'Mode',
  fraxtal: 'Fraxtal',
  berachain: 'Berachain',
  sei: 'Sei',
  arbnova: 'Arbitrum Nova',
  worldchain: 'World Chain',
  manta: 'Manta Pacific',
  unichain: 'Unichain',
  ink: 'Ink',
  abstract: 'Abstract',
  soneium: 'Soneium',
  apechain: 'ApeChain',
  sonic: 'Sonic',
  hyperevm: 'HyperEVM',
  monad: 'Monad',
  ronin: 'Ronin',
  immutable: 'Immutable zkEVM',
  fuse: 'Fuse',
  velas: 'Velas',
  syscoin: 'Syscoin',
  theta: 'Theta',
  iotex: 'IoTeX',
  xlayer: 'X Layer',
  boba: 'Boba Network',
  taiko: 'Taiko',
  astar: 'Astar',
  telos: 'Telos',
  conflux: 'Conflux eSpace',
  core: 'Core',
  songbird: 'Songbird',
  rootstock: 'Rootstock',
  pulsechain: 'PulseChain',
  xdc: 'XDC Network',
  chiliz: 'Chiliz',
  etc: 'Ethereum Classic',
  flare: 'Flare',
  zetachain: 'ZetaChain',
  hemi: 'Hemi',
  bob: 'BOB',
  flowevm: 'Flow EVM',
  cosmos: 'Cosmos Hub',
  osmosis: 'Osmosis',
  xrp: 'XRP Ledger',
  stellar: 'Stellar',
  polkadot: 'Polkadot',
  near: 'NEAR Protocol',
  aptos: 'Aptos',
  tezos: 'Tezos',
  algorand: 'Algorand',
  hedera: 'Hedera',
  injective: 'Injective',
  celestia: 'Celestia',
  dydx: 'dYdX',
  seicosmos: 'Sei (Cosmos)',
  axelar: 'Axelar',
  noble: 'Noble',
  juno: 'Juno',
  cardano: 'Cardano',
  kaspa: 'Kaspa',
  starknet: 'Starknet',
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
    // Lane 80-APP: the coin for the chain comes from the shared WASM
    // key table (all 87 chains), not a hardcoded 22-chain map — TON
    // has no entry there, so it keeps its direct lookup.
    const coin =
      chain === 'ton'
        ? core.CoinType.ton
        : (() => {
            const key = COIN_TYPE_KEY_FOR_CHAIN[chain];
            if (key === undefined) return undefined;
            return core.CoinType[key];
          })();
    if (coin === undefined) {
      // Kaspa and Starknet have no Wallet Core coin (their derivation
      // lives in wallet/kaspa-address.ts and wallet/starknet-derive.ts),
      // so Wallet Core cannot validate them — the in-app validators
      // decide instead. A valid address passes here and the send flow
      // then says plainly that sending on the chain isn't available
      // yet (the Cardano shape); a malformed one is still invalid.
      if (chain === 'kaspa') {
        return isValidKaspaAddress(recipient) ? { ok: true } : invalid;
      }
      if (chain === 'starknet') {
        return isValidStarknetAddress(recipient) ? { ok: true } : invalid;
      }
      return invalid;
    }

    return core.CoinTypeExt.validate(coin, recipient)
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

type SendFailureCode =
  | 'invalid-input'
  | 'invalid-mnemonic'
  | 'insufficient-funds'
  | 'insufficient-gas'
  | 'bad-nonce'
  | 'bad-seqno'
  | 'bad-blockhash'
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
/**
 * True when every BTC UTXO in the set is well-formed (64-hex txid,
 * non-negative safe-integer vout, numeric value). planBtcFee and
 * signBtcOffline validate the same shape; BtcSigningUtxo is
 * field-identical to UtxoInput, so one predicate covers both.
 */
function isValidBtcUtxoSet(utxos: readonly UtxoInput[]): boolean {
  return !utxos.some(
    (u) =>
      !/^[0-9a-fA-F]{64}$/.test(u.txid) ||
      !Number.isSafeInteger(u.vout) ||
      u.vout < 0 ||
      toSafeInt(u.valueBaseUnits) === null,
  );
}

/**
 * UTXO -> TrustWallet SigningInput utxo entries. The two BTC sites
 * (planBtcFee, signBtcOffline) differ only in the outer privateKey
 * field, not in this map.
 */
function btcSigningUtxos(utxos: readonly UtxoInput[], script: Uint8Array) {
  return utxos.map((u) => ({
    outPoint: {
      hash: reverseBytes(hexToBytes(u.txid)),
      index: u.vout,
    },
    script,
    amount: Long.fromNumber(toSafeInt(u.valueBaseUnits) as number),
  }));
}

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
    !isValidBtcUtxoSet(utxos)
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
        utxo: btcSigningUtxos(utxos, script),
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
/**
 * Shared fee-preview success result (TON fee-unknown placeholder, BTC
 * planned, and the generic branch of previewSendAmount all assemble
 * the same total = amount + fee). decimalToBaseUnits strips leading
 * zeros, so the TON '0'-fee total equals the amount exactly.
 */
function sendPreviewOk(
  amount: string,
  feeBaseUnits: string,
  feeNote: string,
  feeUnknown = false,
): Extract<SendPreview, { ok: true }> {
  return {
    ok: true,
    amountBaseUnits: amount,
    feeBaseUnits,
    totalBaseUnits: (BigInt(amount) + BigInt(feeBaseUnits)).toString(),
    feeNote,
    ...(feeUnknown ? { feeUnknown: true } : {}),
  };
}

/**
 * Native-send fee coverage (A-1): the amount alone fitting the
 * balance is not enough — the fee comes out of the same balance.
 * Mirrors previewTokenSendAmount's insufficient-gas check. Returns
 * the failure, or null when amount + fee fits. Callers with an
 * unknown fee (TON) skip this: there is no fee number to check.
 */
function sendPreviewFeeShortfall(
  balanceBaseUnits: string,
  amountBaseUnits: string,
  feeBaseUnits: string,
): Extract<SendPreview, { ok: false }> | null {
  if (
    BigInt(amountBaseUnits) + BigInt(feeBaseUnits) >
    BigInt(balanceBaseUnits)
  ) {
    return {
      ok: false,
      code: 'insufficient-gas',
      reason: 'Amount plus the estimated fee exceeds available balance.',
    };
  }
  return null;
}

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
      const shortfall = sendPreviewFeeShortfall(
        balance.data.valueBaseUnits,
        amount,
        fee.data.feeBaseUnits,
      );
      if (shortfall !== null) return shortfall;
      return sendPreviewOk(amount, fee.data.feeBaseUnits, fee.data.note);
    }
    return sendPreviewOk(
      amount,
      '0',
      'TON fee is charged by the network when the transaction is broadcast; it is not known in advance and comes out of your balance on top of this amount.',
      true,
    );
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
    const shortfall = sendPreviewFeeShortfall(
      balance.data.valueBaseUnits,
      amount,
      planned.feeBaseUnits,
    );
    if (shortfall !== null) return shortfall;
    return sendPreviewOk(amount, planned.feeBaseUnits, `Planned fee at ${fee.data.feeBaseUnits} sat/vB from the live UTXO set.`);
  }

  const shortfall = sendPreviewFeeShortfall(
    balance.data.valueBaseUnits,
    amount,
    fee.data.feeBaseUnits,
  );
  if (shortfall !== null) return shortfall;
  return sendPreviewOk(amount, fee.data.feeBaseUnits, fee.data.note);
}

type SimulationError = {
  code: string;
  message: string;
  chain: ChainId;
};

type SimulateSendResult =
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

  // Freshness checks for the non-EVM, non-TON chains (S4b): BTC plans
  // the fee against the live UTXO set, TRX reads the live account,
  // SOL reads a live blockhash, and the remaining UTXO chains (LTC
  // today) check live UTXO coverage of the amount. DOGE's inputs are
  // honestly unavailable, so its check fails closed — but its preview
  // already refuses, so that path is unreachable from the UI today.
  // EVM and TON fall through to the generic nonce/seqno freshness
  // check below (Lane 80-APP: the old condition listed eth/bsc by
  // name, which would have let a new EVM chain skip the nonce check
  // and return the preview early).
  if (!isEvmTxChain(chain) && chain !== 'ton') {
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

      if (chain === 'sol') {
        // SOL has no nonce/seqno: freshness is a live blockhash.
        // Signing re-fetches one, but simulation must not pass on a
        // dead RPC. Same check as simulateTokenSend.
        const inputs = await adapter.getTxInputs(from);
        if (
          inputs.status !== 'ok' ||
          inputs.data.kind !== 'blockhash' ||
          inputs.data.blockhash.length === 0
        ) {
          const reason = 'The Solana adapter did not return a live blockhash.';
          return simulationFailed(
            chain,
            inputs.status === 'ok'
              ? { status: 'unavailable', reason }
              : inputs,
            'bad-blockhash',
            reason,
          );
        }
        return preview;
      }

      // Any other chain reaching here is a UTXO chain (LTC today):
      // the live UTXO set must cover the amount. No fee plan exists
      // for these chains, so this checks the amount only — the fee
      // is covered by the preview's amount + fee check above.
      const inputs = await adapter.getTxInputs(from);
      if (inputs.status !== 'ok' || inputs.data.kind !== 'utxo') {
        const reason = `The ${chain} adapter did not return live transaction inputs.`;
        return simulationFailed(
          chain,
          inputs.status === 'ok'
            ? { status: 'unavailable', reason }
            : inputs,
          'adapter-unavailable',
          reason,
        );
      }
      const available = inputs.data.utxos.reduce(
        (total, utxo) => total + BigInt(utxo.valueBaseUnits),
        BigInt(0),
      );
      if (available < BigInt(preview.amountBaseUnits)) {
        return simulationFailed(
          chain,
          undefined,
          'insufficient-funds',
          `The ${chain} UTXOs no longer cover the amount.`,
        );
      }

      return preview;
    } catch (cause: unknown) {
      const code =
        chain === 'btc' ? 'fee-unavailable' : 'adapter-unavailable';
      const reason =
        chain === 'btc'
          ? 'Unable to refresh BTC inputs and fees.'
          : chain === 'trx'
            ? 'Unable to refresh TRX account inputs.'
            : chain === 'sol'
              ? 'Unable to refresh the Solana blockhash.'
              : `Unable to refresh ${chain} transaction inputs.`;
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

  const kind = chain === 'ton' ? 'seqno' : 'nonce';
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
    chain === 'ton'
      ? data.kind === 'seqno' &&
        Number.isSafeInteger(data.seqno) &&
        data.seqno >= 0
      : data.kind === 'nonce' &&
        Number.isSafeInteger(data.nonce) &&
        data.nonce >= 0;

  // Zero is valid for both nonce and seqno.
  if (!live) {
    return simulationFailed(chain, undefined, fallbackCode, fallbackReason);
  }

  return preview;
}

type EthSignedTx =
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

type EthSignIntent = {
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
 * Offline EVM native-transfer signing (generalised from signEthOffline,
 * BSC send 2026-11-24). The same code signs any EVM chain: the chain id
 * comes from the registry (chains.ts evmChainId), the from address from
 * deriveAddresses()[chain], and the signing intent names the actual
 * chain, so the fingerprint binds it. The signing key is the chain's
 * own key (createPartialSigner takes the actual chain, Lane 80-APP,
 * 2026-11-24): the 60'-path chains share the ETH key, while the five
 * non-60'-path EVM chains — Filecoin (461'), Theta (500'), IoTeX (304'),
 * Rootstock (137'), Ethereum Classic (61') — sign with their own coin
 * path. The transaction is a legacy EIP-155 transfer (21000 gas, no
 * data); v is 27/28 + 2 * chainId. Devnet: only Ethereum Sepolia
 * exists — any other chain + devnet is refused, there is no BSC test
 * network in this wallet. Nothing here broadcasts.
 * (signEthOffline history: Sol p4, landed 2026-11-19; corrected
 * hands-on; S6a 2026-11-20: PartialSigner facade + viem reassembly,
 * byte-identical output to the old path.)
 */
export async function signEvmOffline(
  chain: ChainId,
  mnemonic: string,
  passphrase: string,
  to: string,
  amountBaseUnits: string,
  nonce: string,
  gasPriceBaseUnits: string,
  options?: SendDevnetOptions,
): Promise<EthSignedTx> {
  const devnet = options?.devnet === true;
  // Mainnet chain id from the registry; Sepolia in devnet mode (ETH
  // only — no other EVM chain has a devnet here).
  let chainId: number;
  if (devnet) {
    if (chain !== 'eth') {
      return {
        ok: false,
        code: 'invalid-input',
        reason: `${chainConfig(chain).displayName} has no devnet network in this wallet.`,
      };
    }
    chainId = 11155111;
  } else {
    const evmChainId = chainConfig(chain).evmChainId;
    if (evmChainId === null) {
      return {
        ok: false,
        code: 'invalid-input',
        reason: `${chainConfig(chain).displayName} is not an EVM chain.`,
      };
    }
    chainId = evmChainId;
  }
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

  // Lane B (token-verify, 2026-11-24): a Ronin recipient arrives in
  // the wallet's own `ronin:` form — validateRecipient accepts it —
  // but viem only serialises 0x, so restore the 0x here. Without
  // this the sign fails after the user approved ("Invalid Ronin
  // transaction input."). Every other chain passes through unchanged.
  const toAddress = normalizeEvmAddress(to);

  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, 0, 0)).eth
      : (await deriveAddresses(mnemonic, passphrase))[chain];
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
          : `Failed to sign ${chainConfig(chain).displayName} transaction offline.`,
    };
  }

  // A-7: when the UI passes the intent created at review time, the
  // reviewed recipient and amount must match the transaction being
  // signed — a recipient or amount swapped between review and
  // signing refuses here, before any key is used. (The sequence is
  // not pinned by a review intent: it is fetched live at signing.
  // See signing-intent.ts.)
  if (options?.intent !== undefined) {
    try {
      assertIntentMatchesTransaction(options.intent, {
        chain,
        to: toAddress,
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
  }

  const intent = createTransactionIntent(chain, toAddress, amountBaseUnits, nonce);
  try {
    assertIntentMatchesTransaction(intent, {
      chain,
      to: toAddress,
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
    to: toAddress as `0x${string}`,
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
      reason: `Invalid ${chainConfig(chain).displayName} transaction input.`,
    };
  }

  const digest = hexToBytes(keccak256(unsignedHex));
  // The chain's own key signs: the 60'-path chains share the ETH key.
  const signer = await createPartialSigner(mnemonic, passphrase, chain);
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
      reason: `Invalid ${chainConfig(chain).displayName} transaction input.`,
    };
  }
}

/**
 * Ethereum entry point of the general EVM signer above. Same signature
 * as before, so existing callers and tests keep working unchanged.
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
  return signEvmOffline(
    'eth',
    mnemonic,
    passphrase,
    to,
    amountBaseUnits,
    nonce,
    gasPriceBaseUnits,
    options,
  );
}

/**
 * Item 36 enforcement (S6b): a test-marked account must never reach a
 * broadcast path. Broadcast itself stays DISABLED until separately
 * authorised; this guard is the second line of defence.
 */
export function isBroadcastAllowedFor(provenance: KeyProvenance): boolean {
  return provenance.isTesting !== true;
}

function assertNotTestAccount(): void {
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

interface BtcSigningUtxo {
  /** Display-order txid hex (64 characters), as returned by the adapter. */
  txid: string;
  vout: number;
  valueBaseUnits: string;
}

type BtcSignedTx =
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
/**
 * Standard dust threshold for a Bitcoin change output (546 sats, the
 * P2PKH dust limit — the largest standard dust value). Trust Wallet
 * Core drops the change output when the change is zero or at most
 * dust, folding it into the fee; the post-sign verification must
 * accept that (A-3).
 */
const BTC_DUST_SATS = 546;

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
    !isValidBtcUtxoSet(utxos)
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
            utxo: btcSigningUtxos(utxos, script),
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
              const plannedChange = Number(plan.change);
              if (
                !Number.isSafeInteger(plannedChange) ||
                plannedChange < 0
              ) {
                return {
                  ok: false as const,
                  code: 'signing-failed',
                  reason: 'Signed outputs do not match the plan.',
                };
              }
              const changeOut = outs.find(
                (o) =>
                  o.script !== null &&
                  o.script !== undefined &&
                  o.value !== null &&
                  o.value !== undefined &&
                  hexOf(o.script) === changeHex &&
                  Number(o.value) === plannedChange,
              );
              // Trust Wallet Core drops the change output when the
              // change is zero or dust (it is folded into the fee),
              // so a missing change output is a mismatch only when
              // the plan expected a real change output above dust.
              if (
                !destOut ||
                (changeOut === undefined && plannedChange > BTC_DUST_SATS)
              ) {
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

interface TrxBlockHeader {
  timestamp: number;
  number: number;
  txTrieRoot: string;
  parentHash: string;
  /** Base58 TRON address of the block witness. */
  witnessAddress: string;
}

type TrxSignedTx =
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

type TonSignedTx =
  | { ok: true; signedBocBase64: string; messageHash: string; from: string }
  | SendFailure;

export type TonWalletVersion = 'v4r2' | 'v3r2' | 'v4' | 'v5r1';

/** Domain-binding context handed to the external signer. */
type SignatureDomain = {
  purpose: 'ton-transfer';
  walletVersion: TonWalletVersion;
};

type TonExternalSignRequest = {
  chain: 'ton';
  from: string;
  to: string;
  amountNano: string;
  seqno: number;
  expireAt: number;
  walletVersion: TonWalletVersion;
  domain: SignatureDomain;
};

type TonExternalSignResult = {
  signedBocBase64: string;
  messageHash: string;
};

/**
 * Delegated whole-transfer signer. Wallet Core's TON output.hash depends
 * on the signing key and no TON TransactionPlan type exists, so an
 * external signer cannot be handed a hash to sign — it signs the whole
 * transfer and returns the signed BOC.
 */
type TonExternalSigner = (
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
    // Lane A: the vault account to sign from (default 0). The key path
    // and the from address follow it, so a send from account 1 signs
    // with the account-1 key (m/44'/607'/1'), not the account-0 key.
    account?: number;
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

  const account = options?.account ?? 0;
  if (!Number.isSafeInteger(account) || account < 0) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid TON signing account.',
    };
  }
  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, account, 0)).ton
      : (await deriveAddressesAt(mnemonic, passphrase, account, 0)).ton;
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
    const key = wallet.getKey(
      core.CoinType.ton,
      pathFor('ton', account, 0),
    );
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

// --- Token transfers (Lane 2: token sending) ------------------------------
// One transfer builder + offline signer per token standard, on the same
// pattern as the native signers above: the signing key never leaves the
// vault, the signed transaction is verified against its intent before
// it is returned, and nothing here broadcasts. The native signers are
// untouched — the EVM token signer duplicates the EVM signing core
// (serialize, keccak, ETH partial signer, EIP-155 v) rather than
// refactoring signEvmOffline, so the landed native path does not move.

/** Gas cap for an ERC-20 transfer call (a plain transfer uses ~51k-65k; the cap is a limit, not a charge — unused gas is refunded). */
export const ERC20_GAS_LIMIT = 100000n;

/** Upper-bound energy for a TRC-20 transfer, for the fee estimate (an existing holder costs ~14k energy, a new holder more; the estimate is labelled an upper bound). */
const TRC20_ENERGY_ESTIMATE = 65000n;

/** Fee-limit cap for a TRC-20 transfer transaction (100 TRX; a cap, not a charge). */
const TRC20_FEE_LIMIT_SUN = 100000000n;

/** TON attached to a Jetton transfer message (0.05 TON — the TON docs' Jetton-transfer example amount). */
const JETTON_ATTACHED_NANO = '50000000';

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

/**
 * ERC-20 transfer(address,uint256) calldata, encoded by hand (the
 * repo's raw-calldata style — see adapters/token-balances.ts): the
 * 4-byte selector, the 20-byte recipient left-padded to a 32-byte
 * word, the amount as a 32-byte big-endian word. Throws on a bad
 * recipient or amount.
 */
export function buildErc20TransferData(
  to: string,
  amountBaseUnits: string,
): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
    throw new Error('Invalid ERC-20 transfer recipient.');
  }
  if (!/^[0-9]+$/.test(amountBaseUnits)) {
    throw new Error('Invalid ERC-20 transfer amount.');
  }
  const amount = BigInt(amountBaseUnits);
  if (amount > (1n << 256n) - 1n) {
    throw new Error('Invalid ERC-20 transfer amount.');
  }
  const amountHex = amount.toString(16).padStart(64, '0');
  return `${ERC20_TRANSFER_SELECTOR}${to.toLowerCase().replace(/^0x/, '').padStart(64, '0')}${amountHex}`;
}

/** 32-byte big-endian encoding of a decimal integer string (a uint256 ABI word). */
function uint256BigEndian(decimal: string): Uint8Array {
  const value = BigInt(decimal);
  const hex = value.toString(16).padStart(64, '0');
  return hexToBytes(`0x${hex}`);
}

type EvmTokenSignIntent = {
  from: string;
  /** Token contract the transfer calls. */
  contract: string;
  /** Token recipient (inside the transfer calldata). */
  to: string;
  amountBaseUnits: string;
  nonce: string;
  chainId: number;
};

/**
 * Post-sign verification for an ERC-20 transfer (mirrors
 * verifyEthSignedTx): the signed transaction is re-decoded with viem
 * and contract / zero value / calldata / nonce / chain id / gas limit
 * are asserted against the signing intent, and the sender is recovered
 * from the signature. Never throws.
 */
export async function verifyEvmTokenSignedTx(
  signedTxHex: `0x${string}`,
  intent: EvmTokenSignIntent,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const parsed = parseTransaction(signedTxHex);
    if (parsed.to?.toLowerCase() !== intent.contract.toLowerCase()) {
      return {
        ok: false,
        reason: 'Signed token transaction contract does not match the signing intent.',
      };
    }
    if (parsed.value !== undefined && parsed.value !== 0n) {
      return {
        ok: false,
        reason: 'Signed token transaction value is not zero.',
      };
    }
    const expectedData = buildErc20TransferData(
      intent.to,
      intent.amountBaseUnits,
    );
    if ((parsed.data ?? '0x').toLowerCase() !== expectedData.toLowerCase()) {
      return {
        ok: false,
        reason: 'Signed token transaction calldata does not match the signing intent.',
      };
    }
    if (
      parsed.nonce === null ||
      parsed.nonce === undefined ||
      BigInt(parsed.nonce) !== BigInt(intent.nonce)
    ) {
      return {
        ok: false,
        reason: 'Signed token transaction nonce does not match the signing intent.',
      };
    }
    if (parsed.chainId !== intent.chainId) {
      return {
        ok: false,
        reason: 'Signed token transaction chain id does not match the signing intent.',
      };
    }
    if (parsed.gas !== ERC20_GAS_LIMIT) {
      return {
        ok: false,
        reason: 'Signed token transaction gas limit does not match the signing intent.',
      };
    }
    if (
      parsed.gasPrice === undefined ||
      parsed.r === undefined ||
      parsed.s === undefined ||
      parsed.v === undefined
    ) {
      return {
        ok: false,
        reason: 'Signed token transaction failed post-sign verification.',
      };
    }
    const payload = serializeTransaction({
      chainId: parsed.chainId,
      nonce: parsed.nonce,
      gasPrice: parsed.gasPrice,
      gas: parsed.gas,
      to: parsed.to,
      // viem parses a zero value as undefined; the check above has
      // already established it is zero when present.
      value: parsed.value ?? 0n,
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
        reason: 'Signed token transaction sender does not match the signing intent.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'Signed token transaction failed post-sign verification.',
    };
  }
}

/**
 * Offline ERC-20 transfer signing for any EVM chain (the generalised
 * EVM signer, token form). The transaction calls the token contract
 * with transfer(recipient, amount) calldata, value 0, gas 100000; the
 * chain id comes from the registry, the from address from
 * deriveAddresses()[chain], and the signing key is the chain's own key
 * (Lane 80-APP: the 60'-path chains share the ETH key, the five
 * non-60'-path EVM chains use their own coin path). The signing intent binds
 * the contract, the token amount, the nonce and the recipient — the
 * recipient is decoded from the transfer calldata at signing time and
 * checked against the intent (and again by verifyEvmTokenSignedTx
 * after signing).
 * Devnet: only Ethereum Sepolia exists, as for native sends. Nothing
 * here broadcasts.
 */
export async function signEvmTokenOffline(
  chain: ChainId,
  mnemonic: string,
  passphrase: string,
  tokenContract: string,
  to: string,
  amountBaseUnits: string,
  nonce: string,
  gasPriceBaseUnits: string,
  options?: SendDevnetOptions,
): Promise<EthSignedTx> {
  const devnet = options?.devnet === true;
  let chainId: number;
  if (devnet) {
    if (chain !== 'eth') {
      return {
        ok: false,
        code: 'invalid-input',
        reason: `${chainConfig(chain).displayName} has no devnet network in this wallet.`,
      };
    }
    chainId = 11155111;
  } else {
    const evmChainId = chainConfig(chain).evmChainId;
    if (evmChainId === null) {
      return {
        ok: false,
        code: 'invalid-input',
        reason: `${chainConfig(chain).displayName} is not an EVM chain.`,
      };
    }
    chainId = evmChainId;
  }
  if (
    ![amountBaseUnits, nonce, gasPriceBaseUnits].every(
      (value) => typeof value === 'string' && /^[0-9]+$/.test(value),
    ) ||
    !/^0x[0-9a-fA-F]{40}$/.test(tokenContract)
  ) {
    return {
      ok: false,
      code: 'invalid-input',
      reason:
        'Amount, nonce and gas price must be unsigned decimal integer strings, and the token contract must be an EVM address.',
    };
  }
  let calldata: string;
  try {
    // Lane B (token-verify, 2026-11-24): same Ronin normalisation
    // as signEvmOffline — a `ronin:` recipient is valid input and
    // must not fail the ERC-20 calldata build below.
    calldata = buildErc20TransferData(normalizeEvmAddress(to), amountBaseUnits);
  } catch {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid ERC-20 transfer recipient or amount.',
    };
  }

  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, 0, 0)).eth
      : (await deriveAddresses(mnemonic, passphrase))[chain];
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
          : `Failed to sign ${chainConfig(chain).displayName} token transaction offline.`,
    };
  }

  const recipient = normalizeEvmAddress(to).toLowerCase();
  const intent = createTransactionIntent(
    chain,
    tokenContract,
    amountBaseUnits,
    nonce,
    recipient,
  );
  try {
    // The recipient lives in the transfer calldata, not in the tx
    // `to` (that is the token contract): decode it from the calldata
    // that is actually being signed and bind the intent to it. The
    // calldata stores the address lowercased, so the intent
    // recipient is lowercased too.
    const calldataWord = calldata.slice(10, 74);
    const calldataRecipient = `0x${calldataWord.slice(-40)}`.toLowerCase();
    // A-7: the review-time intent, when passed, must match the
    // transaction being signed — same binding as the native EVM
    // signer, with the recipient read back from the calldata.
    if (options?.intent !== undefined) {
      assertIntentMatchesTransaction(options.intent, {
        chain,
        to: tokenContract,
        amountBaseUnits,
        sequence: nonce,
        recipient: calldataRecipient,
      });
    }
    assertIntentMatchesTransaction(intent, {
      chain,
      to: tokenContract,
      amountBaseUnits,
      sequence: nonce,
      recipient: calldataRecipient,
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
    nonce: BigInt(nonce) as unknown as number,
    gasPrice: BigInt(gasPriceBaseUnits),
    gas: ERC20_GAS_LIMIT,
    to: tokenContract as `0x${string}`,
    value: 0n,
    data: calldata as `0x${string}`,
  };

  let unsignedHex: `0x${string}`;
  try {
    unsignedHex = serializeTransaction(unsigned);
  } catch {
    return {
      ok: false,
      code: 'invalid-input',
      reason: `Invalid ${chainConfig(chain).displayName} token transaction input.`,
    };
  }

  const digest = hexToBytes(keccak256(unsignedHex));
  // The chain's own key signs (Lane 80-APP): the 60'-path chains share
  // the ETH key, the five non-60'-path EVM chains use their own coin path.
  const signer = await createPartialSigner(mnemonic, passphrase, chain);
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
      reason: `Invalid ${chainConfig(chain).displayName} token transaction input.`,
    };
  }
}

type Trc20SignedTx = TrxSignedTx;

/**
 * Offline TRC-20 transfer signing (mirrors signTrxOffline). Wallet
 * Core's dedicated transferTrc20Contract builds the
 * TriggerSmartContract call (transfer(address,uint256)) internally;
 * the fee limit is set to 100 TRX (a cap, not a charge — the network
 * burns only the energy actually used). The block header comes from
 * the live chain, as for native TRX. Nothing here broadcasts.
 */
export async function signTrc20Offline(
  mnemonic: string,
  passphrase: string,
  tokenContract: string,
  to: string,
  amountBaseUnits: string,
  blockHeader: TrxBlockHeader,
  options?: SendDevnetOptions,
): Promise<Trc20SignedTx> {
  const devnet = options?.devnet === true;
  const amount = toSafeInt(amountBaseUnits);
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
      return { ok: false, code: 'invalid-input', reason: 'Invalid TRC-20 signing inputs.' };
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
      return { ok: false, code: 'invalid-input', reason: 'Invalid TRC-20 signing inputs.' };
    }
  } catch {
    return { ok: false, code: 'invalid-input', reason: 'Invalid TRC-20 signing inputs.' };
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
          : 'Failed to sign TRC-20 transaction offline.',
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
            feeLimit: Long.fromNumber(Number(TRC20_FEE_LIMIT_SUN)),
            transferTrc20Contract: {
              contractAddress: tokenContract,
              ownerAddress: from,
              toAddress: to,
              amount: uint256BigEndian(amountBaseUnits),
            },
          },
          privateKey: keyBytes,
        });
        const encoded = TW.Tron.Proto.SigningInput.encode(input).finish();
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
    return { ok: false, code: 'unknown', reason: 'Failed to sign TRC-20 transaction offline.' };
  }
}

type JettonSignedTx = TonSignedTx;

/**
 * Offline TON Jetton transfer signing (mirrors signTonOffline's V4R2
 * path, with a Jetton payload). The message goes to the sender's
 * Jetton wallet (from fetchJettonWalletAddress), attaches 0.05 TON,
 * and carries the standard Jetton transfer body (op 0xf8a7ea5):
 * query id 0, the Jetton amount, the recipient as toOwner, the sender
 * as the response address, and a zero forward amount. Mode 3, as for
 * native TON. The signed BOC is verified the same way as a native TON
 * send (no-error result, 32-byte message hash, BOC magic) — its
 * contents are not re-parsed here (no BOC parser vendored), the same
 * recorded boundary as signTonOffline. Nothing here broadcasts.
 */
export async function signJettonOffline(
  mnemonic: string,
  passphrase: string,
  jettonWalletAddress: string,
  to: string,
  amountBaseUnits: string,
  seqno: number,
  options?: {
    walletVersion?: TonWalletVersion;
    devnet?: boolean;
    account?: number;
  },
): Promise<JettonSignedTx> {
  const devnet = options?.devnet === true;
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
    !/^[0-9]+$/.test(amountBaseUnits) ||
    BigInt(amountBaseUnits) <= 0n ||
    !Number.isSafeInteger(seqno) ||
    seqno < 0
  ) {
    return { ok: false, code: 'invalid-input', reason: 'Invalid Jetton signing inputs.' };
  }

  const account = options?.account ?? 0;
  if (!Number.isSafeInteger(account) || account < 0) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid TON signing account.',
    };
  }
  let from: string;
  try {
    from = devnet
      ? (await deriveDevnetAddressesAt(mnemonic, passphrase, account, 0)).ton
      : (await deriveAddressesAt(mnemonic, passphrase, account, 0)).ton;
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
          : 'Failed to sign Jetton transaction offline.',
    };
  }

  const core = await loadCore();
  let wallet: ReturnType<typeof core.HDWallet.createWithMnemonic> | null =
    null;
  try {
    wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
    if (!wallet) throw new Error('Unable to restore wallet.');
    const key = wallet.getKey(
      core.CoinType.ton,
      pathFor('ton', account, 0),
    );
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
            dest: jettonWalletAddress,
            amount: minimalBigEndian(JETTON_ATTACHED_NANO),
            mode: 3,
            jettonTransfer: {
              queryId: Long.fromNumber(0),
              jettonAmount: minimalBigEndian(amountBaseUnits),
              toOwner: to,
              responseAddress: from,
              forwardAmount: minimalBigEndian('0'),
            },
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
          : 'Failed to sign Jetton transaction offline.',
    };
  } finally {
    wallet?.delete();
  }
}

// --- Solana signing (minimal wire format, Lane C) ------------------------
// Wallet Core 4.9.3's Solana signer returns an `encoded` transaction
// that is not a valid Solana wire transaction (it does not parse with
// @solana/web3.js, contains none of the transaction's fields, and its
// signature does not verify against the correctly-built message) —
// verified first-hand 2026-11-24, for a native SOL transfer as well as
// a token transfer. So Solana is signed the way every Solana wallet
// signs it instead: a legacy transaction built from the derived
// ed25519 keypair (the 32-byte Wallet Core seed), signed and serialised
// to the standard wire format — the shape Phantom, Solflare and
// Backpack implement through the wallet-adapter standard, and Privy
// and WalletConnect/Reown use for sendTransaction. The builder is the
// minimal ./solana-tx module, not @solana/web3.js: web3.js cost
// ~180 KB minified for five names (Lane C measurement, token-verify
// programme), most of it CommonJS the bundler cannot tree-shake.
// send.test.ts keeps @solana/web3.js as a devDependency and checks
// byte-for-byte that this module's output is identical to web3.js's,
// and decodes it with Transaction.from + verifySignatures, so a drift
// from the wire format fails a test. The two SPL instructions below
// are built by hand (not via @solana/spl-token's builders): spl-token
// 0.4.15 is CommonJS that calls the bare global Buffer, which does not
// exist in a browser bundle — its builders throw ReferenceError there
// while passing in Node, so a vitest-only pass would hide a broken
// send. The layouts are copied from the installed spl-token 0.4.15
// source itself (instructions/transferChecked.js: TransferChecked = 12,
// data u8 + u64-LE amount + u8 decimals;
// instructions/associatedTokenAccount.js: Create takes six keys and
// empty data) and the unit tests decode the hand-built instructions
// with spl-token's own decoder, so the bytes are still checked against
// the canonical implementation. Broadcast stays disabled: these
// functions only produce a signed transaction, never submit one.

type SolSignedTx =
  | {
      ok: true;
      /** Serialised signed transaction, standard base64 (wire format). */
      signedTxBase64: string;
      /** First (fee-payer) signature, base58 — the transaction's id. */
      signature: string;
      from: string;
    }
  | SendFailure;

type SplSignedTx =
  | {
      ok: true;
      /** Serialised signed transaction, standard base64 (wire format). */
      signedTxBase64: string;
      /** First (fee-payer) signature, base58 — the transaction's id. */
      signature: string;
      from: string;
      /** True when the transaction creates the recipient's token account. */
      createdRecipientAta: boolean;
    }
  | SendFailure;

type SignSolOptions = SendDevnetOptions & {
  /**
   * The vault account to sign from (default 0), mirroring
   * signTonOffline: the key path and the from address follow it, so a
   * send from account 1 signs with the account-1 key, not account 0's.
   */
  account?: number;
};

/**
 * Standard base64 (not URL-safe) for a byte array. `Buffer` is not a
 * browser global and the `buffer` package is not in the bundle (Lane C
 * removed it with @solana/web3.js), so this module must not rely on a
 * Node global. Chunked like wallet/vault.ts so long transactions do not
 * blow the stack.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** A recent blockhash is 32 bytes, base58-encoded (32-44 characters). */
function isValidBlockhash(blockhash: string): boolean {
  const bytes = decodeBase58(blockhash);
  return bytes !== null && bytes.length === 32;
}

/** Base58 Solana address to a SolPublicKey, or null when malformed. */
function solanaAddressToPublicKey(address: string): SolPublicKey | null {
  const bytes = decodeBase58(address);
  if (bytes === null || bytes.length !== 32) return null;
  return new SolPublicKey(bytes);
}

/**
 * Sign a built SolTransaction with the vault's Solana key and
 * self-verify the exact failure the old Wallet Core signer had: the
 * serialised bytes must parse back with SolTransaction.from and the
 * signatures must verify. The derived keypair's public key must match
 * the sending address, so a derivation drift can never sign for the
 * wrong account. The seed bytes are wiped by withSigningKey after the
 * callback settles.
 */
async function signSolTransaction(
  mnemonic: string,
  passphrase: string,
  account: number,
  from: string,
  transaction: SolTransaction,
): Promise<
  | { ok: true; signedTxBase64: string; signature: string }
  | SendFailure
> {
  const core = await loadCore();
  try {
    return await withSigningKey(
      mnemonic,
      passphrase,
      core.CoinType.solana,
      pathFor('sol', account, 0),
      async (
        keyBytes,
      ): Promise<
        | { ok: true; signedTxBase64: string; signature: string }
        | SendFailure
      > => {
        if (keyBytes.length !== 32) {
          return {
            ok: false,
            code: 'signing-failed',
            reason: 'The Solana signing key is not a 32-byte seed.',
          };
        }
        const publicKey = solKeypairPublicKey(keyBytes);
        if (publicKey.toBase58() !== from) {
          return {
            ok: false,
            code: 'signing-failed',
            reason:
              'The Solana signing key does not match the sending address.',
          };
        }
        transaction.sign(keyBytes);
        const serialized = transaction.serialize();
        // Self-verify: parse the wire bytes back and check the
        // signatures, the fee payer and the blockhash. The old signer
        // failed this exact step — its `encoded` output did not parse.
        const parsed = SolTransaction.from(serialized);
        if (
          !parsed.verifySignatures() ||
          parsed.feePayer.toBase58() !== from ||
          parsed.recentBlockhash !== transaction.recentBlockhash
        ) {
          return {
            ok: false,
            code: 'signing-failed',
            reason: 'The signed Solana transaction failed verification.',
          };
        }
        const signature = parsed.signature;
        if (signature === null) {
          return {
            ok: false,
            code: 'signing-failed',
            reason: 'The signed Solana transaction has no signature.',
          };
        }
        return {
          ok: true,
          signedTxBase64: bytesToBase64(serialized),
          signature: encodeBase58(signature),
        };
      },
    );
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
          : 'Failed to sign Solana transaction offline.',
    };
  }
}

/**
 * Offline native SOL signing: one SystemProgram.transfer instruction
 * in a legacy transaction (feePayer + recentBlockhash), signed with
 * the derived ed25519 keypair. The blockhash comes from the adapter's
 * getTxInputs (getLatestBlockhash), like an EVM nonce. Solana has no
 * devnet network in this wallet, so devnet mode is refused.
 */
export async function signSolOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountBaseUnits: string,
  blockhash: string,
  options?: SignSolOptions,
): Promise<SolSignedTx> {
  if (options?.devnet === true) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Solana has no devnet network in this wallet.',
    };
  }
  if (
    !/^[0-9]+$/.test(amountBaseUnits) ||
    BigInt(amountBaseUnits) <= 0n ||
    !isValidBlockhash(blockhash)
  ) {
    return {
      ok: false,
      code: 'invalid-input',
      reason:
        'Amount must be a positive lamport integer and the blockhash must be a recent Solana blockhash.',
    };
  }
  const account = options?.account ?? 0;
  if (!Number.isSafeInteger(account) || account < 0) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Solana signing account.',
    };
  }
  const toPubkey = solanaAddressToPublicKey(to);
  if (toPubkey === null) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Solana recipient address.',
    };
  }
  let from: string;
  try {
    from = (await deriveAddressesAt(mnemonic, passphrase, account, 0)).sol;
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
          : 'Failed to sign Solana transaction offline.',
    };
  }
  const fromPubkey = solanaAddressToPublicKey(from);
  if (fromPubkey === null) {
    return {
      ok: false,
      code: 'unknown',
      reason: 'Failed to sign Solana transaction offline.',
    };
  }
  // A-7: the review-time intent, when passed, must match the
  // transaction being signed — a recipient or amount swapped between
  // review and signing refuses here, before any key is used. (The
  // sequence is '' for SOL on both sides.)
  if (options?.intent !== undefined) {
    try {
      assertIntentMatchesTransaction(options.intent, {
        chain: 'sol',
        to,
        amountBaseUnits,
        sequence: '',
      });
    } catch {
      return {
        ok: false,
        code: 'intent-mismatch',
        reason: 'Transaction does not match the approved intent.',
      };
    }
  }

  const intent = createTransactionIntent('sol', to, amountBaseUnits, '');
  try {
    assertIntentMatchesTransaction(intent, {
      chain: 'sol',
      to,
      amountBaseUnits,
      sequence: '',
    });
  } catch {
    return {
      ok: false,
      code: 'intent-mismatch',
      reason: 'Transaction does not match the approved intent.',
    };
  }
  const transaction = new SolTransaction({
    feePayer: fromPubkey,
    recentBlockhash: blockhash,
  });
  try {
    transaction.add(
      solSystemTransferInstruction(
        fromPubkey,
        toPubkey,
        BigInt(amountBaseUnits),
      ),
    );
  } catch {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Solana transfer amount.',
    };
  }
  const signed = await signSolTransaction(
    mnemonic,
    passphrase,
    account,
    from,
    transaction,
  );
  if (!signed.ok) return signed;
  return {
    ok: true,
    signedTxBase64: signed.signedTxBase64,
    signature: signed.signature,
    from,
  };
}

/**
 * Offline SPL token signing: a TransferChecked instruction (mint and
 * decimals checked on-chain) between the sender's and the recipient's
 * associated token accounts, derived with the verified ATA utility.
 * When the recipient has no token account for this mint yet,
 * `recipientAtaExists` is false and the transaction first creates it
 * (createAssociatedTokenAccountInstruction, funded by the sender with
 * the rent-exempt minimum) — the same sender-funded shape
 * `spl-token transfer --fund-recipient` produces. The caller checks
 * the recipient account live just before signing, so a race that
 * creates the account between preview and sign does not build a
 * transaction that would fail on broadcast. Token program is the
 * standard SPL Token program (Tokenkeg...); Token-2022 mints are not
 * supported — a TransferChecked against the wrong program would fail
 * on broadcast, so the mint's program is out of scope here.
 */
/** SPL Token instruction discriminator for TransferChecked (= 12). */
const SPL_TRANSFER_CHECKED_DISCRIMINATOR = 12;

/**
 * Build a CreateAssociatedTokenAccount instruction by hand — same six
 * keys and empty data as @solana/spl-token 0.4.15's
 * buildAssociatedTokenAccountInstruction (instructions/
 * associatedTokenAccount.js): payer (signer, writable), associated
 * token account (writable), owner, mint, System program, Token
 * program; program id is the Associated Token Program. Hand-built
 * because spl-token's builder calls the bare global Buffer, which
 * does not exist in a browser bundle (see the header comment).
 */
function createAssociatedTokenAccountInstruction(
  payer: SolPublicKey,
  associatedToken: SolPublicKey,
  owner: SolPublicKey,
  mint: SolPublicKey,
): SolInstruction {
  return {
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SOL_SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SOL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: SOL_ASSOCIATED_TOKEN_PROGRAM_ID,
    data: new Uint8Array(0),
  };
}

/**
 * Build a TransferChecked instruction by hand — same keys and data
 * layout as @solana/spl-token 0.4.15's createTransferCheckedInstruction
 * (instructions/transferChecked.js): keys source (writable), mint,
 * destination (writable), owner (signer); data is u8 discriminator
 * 12, u64 little-endian amount, u8 decimals; program id is the Token
 * program. Hand-built for the same bare-Buffer reason as above.
 */
function createTransferCheckedInstruction(
  source: SolPublicKey,
  mint: SolPublicKey,
  destination: SolPublicKey,
  owner: SolPublicKey,
  amount: bigint,
  decimals: number,
): SolInstruction {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, SPL_TRANSFER_CHECKED_DISCRIMINATOR);
  // Throws RangeError when amount is outside u64, like
  // Buffer.writeBigUInt64LE did — the caller maps it to invalid-input.
  view.setBigUint64(1, amount, true);
  view.setUint8(9, decimals);
  return {
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: SOL_TOKEN_PROGRAM_ID,
    data,
  };
}

export async function signSplOffline(
  mnemonic: string,
  passphrase: string,
  mint: string,
  to: string,
  amountBaseUnits: string,
  decimals: number,
  blockhash: string,
  recipientAtaExists: boolean,
  options?: SignSolOptions,
): Promise<SplSignedTx> {
  if (options?.devnet === true) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Solana has no devnet network in this wallet.',
    };
  }
  if (
    !/^[0-9]+$/.test(amountBaseUnits) ||
    BigInt(amountBaseUnits) <= 0n ||
    !Number.isSafeInteger(decimals) ||
    decimals < 0 ||
    decimals > 255 ||
    !isValidBlockhash(blockhash)
  ) {
    return {
      ok: false,
      code: 'invalid-input',
      reason:
        'Amount must be a positive token-base-unit integer, decimals must be 0-255, and the blockhash must be a recent Solana blockhash.',
    };
  }
  const account = options?.account ?? 0;
  if (!Number.isSafeInteger(account) || account < 0) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Solana signing account.',
    };
  }
  const mintPubkey = solanaAddressToPublicKey(mint);
  const toPubkey = solanaAddressToPublicKey(to);
  if (mintPubkey === null || toPubkey === null) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Solana token mint or recipient address.',
    };
  }
  let from: string;
  try {
    from = (await deriveAddressesAt(mnemonic, passphrase, account, 0)).sol;
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
          : 'Failed to sign Solana token transaction offline.',
    };
  }
  const fromPubkey = solanaAddressToPublicKey(from);
  if (fromPubkey === null) {
    return {
      ok: false,
      code: 'unknown',
      reason: 'Failed to sign Solana token transaction offline.',
    };
  }
  const senderAta = deriveAssociatedTokenAddress(from, mint);
  const recipientAta = deriveAssociatedTokenAddress(to, mint);
  if (senderAta === null || recipientAta === null) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid Solana token account address.',
    };
  }
  // The intent pins the recipient owner as well as the mint: the
  // recipient lives in the transfer instruction's destination token
  // account, so the assert below reads it back from the built
  // instruction instead of trusting the input twice.
  const intent = createTransactionIntent('sol', mint, amountBaseUnits, '', to);
  const transaction = new SolTransaction({
    feePayer: fromPubkey,
    recentBlockhash: blockhash,
  });
  let transferInstruction: SolInstruction;
  try {
    if (!recipientAtaExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey,
          new SolPublicKey(recipientAta),
          toPubkey,
          mintPubkey,
        ),
      );
    }
    transferInstruction = createTransferCheckedInstruction(
      new SolPublicKey(senderAta),
      mintPubkey,
      new SolPublicKey(recipientAta),
      fromPubkey,
      BigInt(amountBaseUnits),
      decimals,
    );
    transaction.add(transferInstruction);
  } catch {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'Invalid SPL transfer input.',
    };
  }
  try {
    // TransferChecked keys are [source, mint, destination, owner]:
    // the destination must be the recipient's token account for
    // this mint, or the instruction does not pay the intent's
    // recipient.
    const destination = transferInstruction.keys[2]?.pubkey.toBase58();
    // A-7: the review-time intent, when passed, must match the
    // transaction being signed — the recipient is the owner of the
    // destination token account, read back from the built
    // instruction, same as the fallback below.
    if (options?.intent !== undefined) {
      assertIntentMatchesTransaction(options.intent, {
        chain: 'sol',
        to: mint,
        amountBaseUnits,
        sequence: '',
        recipient: destination === recipientAta ? to : '',
      });
    }
    assertIntentMatchesTransaction(intent, {
      chain: 'sol',
      to: mint,
      amountBaseUnits,
      sequence: '',
      recipient: destination === recipientAta ? to : '',
    });
  } catch {
    return {
      ok: false,
      code: 'intent-mismatch',
      reason: 'Transaction does not match the approved intent.',
    };
  }
  const signed = await signSolTransaction(
    mnemonic,
    passphrase,
    account,
    from,
    transaction,
  );
  if (!signed.ok) return signed;
  return {
    ok: true,
    signedTxBase64: signed.signedTxBase64,
    signature: signed.signature,
    from,
    createdRecipientAta: !recipientAtaExists,
  };
}

// --- Token preview + simulation -------------------------------------------
// The screen's flow for a token send: preview (amount + fee, gated on
// the cached token balance) then, at signing time, a fresh simulate
// (live token balance + live chain inputs). A preview is only valid
// for the transaction it describes — the fee the screen shows is the
// fee the signer must not exceed, and the simulate re-checks it
// against live inputs before any key is used.

type TokenSendDeps = {
  fetchTokenBalance?: typeof fetchTokenBalance;
  /**
   * Solana-only, injectable for tests: whether an address holds an
   * account, and the rent-exempt minimum for a token account. Live
   * defaults hit the Solana RPC.
   */
  fetchSolanaAccountExists?: typeof fetchSolanaAccountExists;
  fetchSolanaRentExemption?: typeof fetchSolanaMinimumBalanceForRentExemption;
};

type TokenFeeEstimate =
  | {
      ok: true;
      /** Native fee (gas / energy / SOL signatures / '0' for TON-unknown). */
      feeBaseUnits: string;
      /** Extra native the send needs on top of the fee: SOL account rent, else '0'. */
      rentBaseUnits: string;
      /** Native attached to the message itself: 0.05 TON for a Jetton transfer, else '0'. */
      attachedBaseUnits: string;
      feeNote: string;
      feeUnknown?: boolean;
    }
  | { ok: false; code: SendFailureCode; reason: string };

/**
 * The native fee a token send costs on a chain — the estimate the
 * review screen shows, in the chain's native base units. Per family:
 * EVM — the adapter's native quote is gasPrice x 21000, so the gas
 * price is recovered by exact division and a token transfer is quoted
 * at the same gas price x 100000 gas. TRX — the adapter quotes SUN
 * per unit of energy and a TRC-20 transfer is estimated at 65000
 * energy (an upper bound, labelled as one). SOL — the 5,000-lamport
 * base fee for one signature, plus the live rent-exempt minimum when
 * the recipient has no token account for the mint yet (see the sol
 * branch below). TON — no read-only fee endpoint exists (the same honest
 * unknown as the native preview); the send attaches 0.05 TON to the
 * Jetton message. Devnet token sends exist only on ETH (Sepolia
 * ERC-20), TRX (Nile TRC-20) and TON (testnet Jetton).
 */
export async function estimateTokenSendFee(
  chain: ChainId,
  token: TokenRecord,
  options?: SendDevnetOptions,
  /**
   * Solana only: the recipient owner address. With it the rent is
   * exact (the recipient token account is checked live); without it
   * the rent is reported as 0 with a note, never guessed.
   */
  toAddress?: string,
  deps?: TokenSendDeps,
): Promise<TokenFeeEstimate> {
  const devnet = options?.devnet === true;
  if (devnet && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return {
      ok: false,
      code: 'invalid-input',
      reason: `${chainConfig(chain).displayName} has no devnet network in this wallet.`,
    };
  }
  if (chain === 'ton') {
    return {
      ok: true,
      feeBaseUnits: '0',
      rentBaseUnits: '0',
      attachedBaseUnits: JETTON_ATTACHED_NANO,
      feeNote:
        'TON fee is charged by the network when the transaction is broadcast; it is not known in advance. The Jetton transfer itself attaches 0.05 TON, which comes out of your balance on top of this amount.',
      feeUnknown: true,
    };
  }
  // SOL: a one-signature send costs the 5,000-lamport base fee. When
  // the recipient is known, the rent is exact too: a missing recipient
  // token account is created in the same transaction, funded with the
  // live rent-exempt minimum for a 165-byte token account (read live —
  // the 2,039,280 figure in older SPL docs is stale; PublicNode
  // returned 1,488,440 on 2026-11-24). Without a recipient the rent is
  // reported as 0 with a note, never guessed.
  if (chain === 'sol') {
    const baseFee = String(SOL_LAMPORTS_PER_SIGNATURE);
    if (toAddress === undefined) {
      return {
        ok: true,
        feeBaseUnits: baseFee,
        rentBaseUnits: '0',
        attachedBaseUnits: '0',
        feeNote:
          'Base fee of 5,000 lamports for one signature. If the recipient has no token account for this token yet, creating it costs the rent-exempt minimum on top of the fee.',
      };
    }
    const recipientAta = deriveAssociatedTokenAddress(
      toAddress,
      token.contract,
    );
    if (recipientAta === null) {
      return {
        ok: false,
        code: 'invalid-input',
        reason: 'Invalid Solana recipient address.',
      };
    }
    try {
      const exists = await (
        deps?.fetchSolanaAccountExists ?? fetchSolanaAccountExists
      )(recipientAta);
      if (exists) {
        return {
          ok: true,
          feeBaseUnits: baseFee,
          rentBaseUnits: '0',
          attachedBaseUnits: '0',
          feeNote:
            'Base fee of 5,000 lamports for one signature; the recipient already has a token account for this token.',
        };
      }
      const rent = await (
        deps?.fetchSolanaRentExemption ??
        fetchSolanaMinimumBalanceForRentExemption
      )(SOL_TOKEN_ACCOUNT_SIZE);
      return {
        ok: true,
        feeBaseUnits: baseFee,
        rentBaseUnits: String(rent),
        attachedBaseUnits: '0',
        feeNote:
          'Base fee of 5,000 lamports for one signature, plus ' +
          String(rent) +
          ' lamports to create the recipient token account (rent-exempt minimum).',
      };
    } catch (error: unknown) {
      return {
        ok: false,
        code: 'adapter-unavailable',
        reason:
          error instanceof Error
            ? error.message
            : 'The Solana token-account check failed.',
      };
    }
  }
  const adapter = getAdapterForMode(chain, devnet);
  if (!adapter) {
    return {
      ok: false,
      code: 'adapter-unavailable',
      reason: `No adapter available for ${chainConfig(chain).displayName}.`,
    };
  }
  const fee = await adapter.estimateFee();
  if (fee.status !== 'ok') {
    return { ok: false, code: 'adapter-unavailable', reason: fee.reason };
  }
  if (chain === 'trx') {
    return {
      ok: true,
      feeBaseUnits: (BigInt(fee.data.feeBaseUnits) * TRC20_ENERGY_ESTIMATE).toString(),
      rentBaseUnits: '0',
      attachedBaseUnits: '0',
      feeNote:
        'Upper-bound estimate at the current energy fee (65000 energy): the network charges only the energy actually used.',
    };
  }
  // EVM: the adapter quotes gasPrice x 21000 for a native transfer;
  // recover the gas price by exact division and quote the token
  // transfer at the same gas price x 100000 gas. A quote that is not
  // an exact multiple of 21000 is not a gas-price quote at all — the
  // estimate is refused rather than guessed from it.
  const nativeFee = BigInt(fee.data.feeBaseUnits);
  if (nativeFee % 21000n !== 0n) {
    return {
      ok: false,
      code: 'adapter-unavailable',
      reason: 'Fee quote does not match a 21000-gas transfer.',
    };
  }
  const gasPrice = nativeFee / 21000n;
  return {
    ok: true,
    feeBaseUnits: (gasPrice * ERC20_GAS_LIMIT).toString(),
    rentBaseUnits: '0',
    attachedBaseUnits: '0',
    feeNote:
      'Token-transfer estimate at current gas price, 100000 gas; not a final fee',
  };
}

export type TokenSendPreview =
  | {
      ok: true;
      token: TokenRecord;
      amountBaseUnits: string;
      feeBaseUnits: string;
      rentBaseUnits: string;
      attachedBaseUnits: string;
      feeNote: string;
      feeUnknown?: boolean;
    }
  | {
      ok: false;
      code: SendFailureCode;
      reason: string;
      signingErrorCode?: number;
    };

/**
 * Preview a token send: the amount in base units, the native fee, and
 * the native balance check (fee + rent + attached amount). The token
 * balance is a parameter — the screen's cached balance, never a live
 * read here; the sign step re-reads it live (simulateTokenSend).
 * A preview that fails is reported with the reason, never a guessed
 * fee. Mirrors previewSendAmount.
 */
export async function previewTokenSendAmount(
  chain: ChainId,
  token: TokenRecord,
  fromAddress: string,
  toAddress: string,
  amountDecimal: string,
  tokenBalanceBaseUnits: string | null,
  options?: SendDevnetOptions,
  deps?: TokenSendDeps,
): Promise<TokenSendPreview> {
  const devnet = options?.devnet === true;
  const standard = tokenStandardFor(chain);
  if (standard.standard === null) {
    return {
      ok: false,
      code: 'adapter-unavailable',
      reason: `${chainConfig(chain).displayName} has no token standard — only its native coin can be sent.`,
    };
  }
  if (token.chain !== chain) {
    return {
      ok: false,
      code: 'invalid-input',
      reason: 'The token is not on this network.',
    };
  }
  if (devnet && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return {
      ok: false,
      code: 'invalid-input',
      reason: `${chainConfig(chain).displayName} has no devnet network in this wallet.`,
    };
  }
  const amount = decimalToBaseUnits(amountDecimal, token.decimals);
  if (amount === null || BigInt(amount) <= 0n) {
    return { ok: false, code: 'invalid-input', reason: 'Enter a valid amount.' };
  }
  if (tokenBalanceBaseUnits === null) {
    return {
      ok: false,
      code: 'adapter-unavailable',
      reason: `The ${token.symbol} balance is not loaded yet.`,
    };
  }
  if (BigInt(amount) > BigInt(tokenBalanceBaseUnits)) {
    return {
      ok: false,
      code: 'insufficient-funds',
      reason: 'Amount exceeds available balance.',
    };
  }
  const fee = await estimateTokenSendFee(chain, token, options, toAddress, deps);
  if (!fee.ok) return fee;
  const adapter = getAdapterForMode(chain, devnet);
  if (!adapter) {
    return {
      ok: false,
      code: 'adapter-unavailable',
      reason: `No adapter available for ${chainConfig(chain).displayName}.`,
    };
  }
  const native = await adapter.getBalance(fromAddress);
  if (native.status !== 'ok') {
    return { ok: false, code: 'adapter-unavailable', reason: native.reason };
  }
  const needed =
    BigInt(fee.feeBaseUnits) +
    BigInt(fee.rentBaseUnits) +
    BigInt(fee.attachedBaseUnits);
  if (BigInt(native.data.valueBaseUnits) < needed) {
    return {
      ok: false,
      code: 'insufficient-gas',
      reason: `The ${chainConfig(chain).symbol} balance does not cover the estimated fee.`,
    };
  }
  return {
    ok: true,
    token,
    amountBaseUnits: amount,
    feeBaseUnits: fee.feeBaseUnits,
    rentBaseUnits: fee.rentBaseUnits,
    attachedBaseUnits: fee.attachedBaseUnits,
    feeNote: fee.feeNote,
    ...(fee.feeUnknown === true ? { feeUnknown: true } : {}),
  };
}

type SimulateTokenSendResult =
  | {
      ok: true;
      amountBaseUnits: string;
      feeBaseUnits: string;
      rentBaseUnits: string;
      attachedBaseUnits: string;
      feeNote: string;
      feeUnknown?: boolean;
    }
  | {
      ok: false;
      error: SimulationError;
      code: SendFailureCode;
      reason: string;
    };

/**
 * Re-check a token send at signing time: the token balance is read
 * live (never trusted from the cached preview), then the chain's live
 * inputs are checked — EVM nonce, TRX account balance against the
 * fee, TON seqno, SOL blockhash + token accounts. On a stale or bad
 * input the error names the cause; signing does not start. Mirrors
 * simulateSend.
 */
export async function simulateTokenSend(
  chain: ChainId,
  token: TokenRecord,
  from: string,
  to: string,
  amountDecimal: string,
  options?: SendDevnetOptions,
  deps?: TokenSendDeps,
): Promise<SimulateTokenSendResult> {
  const devnet = options?.devnet === true;
  const fetchBalance = deps?.fetchTokenBalance ?? fetchTokenBalance;
  const live = await fetchBalance({
    chain,
    contract: token.contract,
    ownerAddress: from,
    decimals: token.decimals,
  });
  if (live.status !== 'ok') {
    return simulationFailed(
      chain,
      live,
      'adapter-unavailable',
      `The ${token.symbol} balance could not be read.`,
    );
  }
  const preview = await previewTokenSendAmount(
    chain,
    token,
    from,
    to,
    amountDecimal,
    live.data.valueBaseUnits,
    options,
    deps,
  );
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
  const adapter = getAdapterForMode(chain, devnet);
  if (!adapter) {
    return simulationFailed(
      chain,
      undefined,
      'adapter-unavailable',
      `No adapter available for ${chainConfig(chain).displayName}.`,
    );
  }
  const txInputs = await adapter.getTxInputs(from);
  if (txInputs.status !== 'ok') {
    return simulationFailed(
      chain,
      txInputs,
      chain === 'ton' ? 'bad-seqno' : chain === 'sol' ? 'bad-blockhash' : 'bad-nonce',
      `The ${chainConfig(chain).displayName} adapter did not return live transaction inputs.`,
    );
  }
  const data = txInputs.data;
  if (chain === 'sol') {
    if (
      data.kind !== 'blockhash' ||
      typeof data.blockhash !== 'string' ||
      data.blockhash.length === 0
    ) {
      return simulationFailed(
        chain,
        undefined,
        'bad-blockhash',
        'The Solana adapter did not return a valid blockhash.',
      );
    }
  } else if (chain === 'ton') {
    if (
      data.kind !== 'seqno' ||
      !Number.isSafeInteger(data.seqno) ||
      data.seqno < 0
    ) {
      return simulationFailed(
        chain,
        undefined,
        'bad-seqno',
        'The TON adapter did not return a valid seqno.',
      );
    }
  } else if (chain === 'trx') {
    if (
      data.kind !== 'account' ||
      BigInt(data.balanceSun) < BigInt(preview.feeBaseUnits)
    ) {
      return simulationFailed(
        chain,
        undefined,
        'insufficient-funds',
        'The TRX balance no longer covers the estimated fee.',
      );
    }
  } else if (
    data.kind !== 'nonce' ||
    !Number.isSafeInteger(data.nonce) ||
    data.nonce < 0
  ) {
    return simulationFailed(
      chain,
      undefined,
      'bad-nonce',
      `The ${chainConfig(chain).displayName} adapter did not return a valid nonce.`,
    );
  }
  return { ...preview };
}
