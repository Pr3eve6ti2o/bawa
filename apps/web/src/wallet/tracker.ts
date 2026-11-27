/**
 * Read-only transaction tracking via mempool.space (BTC), Blockscout (ETH
 * and the other EVM chains), TronGrid (TRX), TonCenter (TON),
 * litecoinspace (LTC) and SoChain/BlockCypher (DOGE). No API key is needed
 * for any of them. Included transactions are never presented as
 * finalized: expose the indexer's own status wording alongside
 * confirmations, which may be unknown (TronGrid and TonCenter report no
 * block number here). TonCenter has no hash-only lookup: a TON
 * transaction is identified by account address plus lt plus hash, so
 * TON lookup needs the address. Solana has no lookup here yet: the
 * detail screen names that honestly instead of calling the signature
 * malformed (Lane P2-B).
 */
import type { ChainId } from '../engine/boundary';
import { chainConfig, SUPPORTED_CHAINS } from './chains';
import { isRecord } from './guards';
import { getAdapterForMode } from './adapters/index';
import { base64ToHex } from './adapters/ton';
import { sochainConfirmedToKoinu } from './adapters/doge';
import { fetchJson } from './adapters/types';
import type { AdapterResult, AdapterTx, TxStatus } from './adapters/types';

// Lane B (Finish the Product, 2026-11-23): the EVM chains whose hash
// lookup shares ETH's Blockscout v2 shape — same response, different
// host, network id and explorer. The first four were probed by curl;
// polygon/base/arbitrum were probed in headless Chromium (their
// txlist + v2 endpoints return real transactions to a browser fetch;
// curl gets 403 Cloudflare). Avalanche and Mantle history runs on
// Routescan's Etherscan-compatible API, whose tx-info shape differs, so
// their hash lookup stays unsupported (history itself works).
const BLOCKSCOUT_V2_CHAINS = [
  'eth',
  'op',
  'scroll',
  'celo',
  'aurora',
  'matic',
  'base',
  'arb',
] as const;

function isBlockscoutV2Chain(
  chain: ChainId,
): chain is (typeof BLOCKSCOUT_V2_CHAINS)[number] {
  return (BLOCKSCOUT_V2_CHAINS as readonly string[]).includes(chain);
}

/**
 * Lane B (token-verify, 2026-11-24): the Blockscout v2 hash lookup
 * covers every chain whose registry entry carries a
 * historyExplorerBase — the eight original chains above plus the ten
 * expanded chains whose v2 API hash-matched live on 2026-11-24
 * (mode, manta, ronin, fuse, syscoin, songbird, etc, flare,
 * zetachain, hemi). The wiring lane set the explorer base but never
 * extended this gate, so /track answered "not supported" for all ten
 * even though the lookup code below already reads the base from the
 * registry. Deriving the gate from the registry entry keeps the two
 * from drifting apart again.
 */
function hasBlockscoutV2Lookup(chain: ChainId): boolean {
  return (
    isBlockscoutV2Chain(chain) ||
    chainConfig(chain).historyExplorerBase !== undefined
  );
}

export interface TrackedTx {
  hash: string;
  chain: ChainId;
  networkId: string;
  status: TxStatus;
  statusLabel: string;
  confirmations: number | null;
  blockHeight: number | null;
  from: string | null;
  to: string | null;
  amountBaseUnits: string;
  feeBaseUnits: string | null;
  timestamp: number | null;
  explorerUrl: string;
  source: string;
  fetchedAt: number;
}

export type TrackerLookupResult =
  | { status: 'ok'; data: TrackedTx }
  | { status: 'not-found'; note?: string }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; reason: string };


function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return typeof error === 'string' ? error : 'Unknown error.';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

interface ParseBtcTxOpts {
  // Lane P2-B: the mempool.space shape is shared by Litecoin
  // (litecoinspace.org/api). Defaults keep the Bitcoin behaviour
  // exactly; the LTC branch passes its own chain, network id,
  // explorer and source. The network id is the Litecoin genesis
  // block hash, as recorded in adapters/ltc.ts.
  chain?: 'btc' | 'ltc';
  networkId?: string;
  explorerBase?: string;
  source?: string;
}

export function parseBtcTx(raw: unknown, tipHeight: number | null, devnet = false, opts?: ParseBtcTxOpts): TrackedTx | null {
  if (
    !isRecord(raw) || !isRecord(raw.status) ||
    !Array.isArray(raw.vin) || !Array.isArray(raw.vout) ||
    (tipHeight !== null && !isNonNegativeInteger(tipHeight))
  ) return null;

  const hash = stringOrNull(raw.txid);
  const status = raw.status;
  if (
    hash === null || !isNonNegativeInteger(raw.fee) ||
    typeof status.confirmed !== 'boolean' || !raw.vin.every(isRecord)
  ) return null;

  let blockHeight: number | null = null;
  let timestamp: number | null = null;
  if (status.confirmed) {
    if (
      !isNonNegativeInteger(status.block_height) ||
      !isNonNegativeInteger(status.block_time)
    ) return null;
    blockHeight = status.block_height;
    timestamp = status.block_time * 1000;
  }

  const firstInput = raw.vin[0];
  const prevout = isRecord(firstInput) && isRecord(firstInput.prevout)
    ? firstInput.prevout
    : null;
  const sender =
    prevout === null ? null : stringOrNull(prevout.scriptpubkey_address);
  const firstOutput = raw.vout[0];

  // The amount sent is the value leaving the sender: outputs back to
  // the sender's own address are change, not sent value, and the
  // "to" is the first output that is not change. When the sender is
  // unknown (no prevout address) there is nothing to exclude, so the
  // old behaviour — sum everything, "to" is vout[0] — is kept.
  let amount = 0;
  let recipient: string | null = null;
  for (const output of raw.vout) {
    if (!isRecord(output) || !isNonNegativeInteger(output.value)) return null;
    const address = stringOrNull(output.scriptpubkey_address);
    const isChange =
      sender !== null && address !== null && address === sender;
    if (!isChange) {
      amount += output.value;
      if (recipient === null) recipient = address;
    }
    if (!Number.isSafeInteger(amount)) return null;
  }

  const chain = opts?.chain ?? 'btc';
  const networkId =
    opts?.networkId ??
    (devnet
      ? 'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043'
      : 'bip122:000000000019d6689c085ae165831e93');
  const explorerBase =
    opts?.explorerBase ??
    (devnet ? 'https://mempool.space/testnet4' : 'https://mempool.space');
  const source = opts?.source ?? 'mempool.space';

  return {
    hash,
    chain,
    networkId,
    status: status.confirmed ? 'confirmed' : 'pending',
    statusLabel: status.confirmed ? 'confirmed' : 'pending',
    // A tip behind the block is stale, not negative
    // confirmations: report unknown instead of a negative count.
    confirmations:
      blockHeight === null || tipHeight === null || tipHeight < blockHeight
        ? null
        : tipHeight - blockHeight + 1,
    blockHeight,
    from: sender,
    to:
      recipient ??
      (isRecord(firstOutput)
        ? stringOrNull(firstOutput.scriptpubkey_address)
        : null),
    amountBaseUnits: amount.toString(),
    feeBaseUnits: raw.fee.toString(),
    timestamp,
    explorerUrl: `${explorerBase}/tx/${hash}`,
    source,
    fetchedAt: Date.now(),
  };
}

interface ParseEthTxOpts {
  chain?: ChainId;
  networkId?: string;
  explorerBase?: string;
}

export function parseEthTx(
  raw: unknown,
  devnet = false,
  opts?: ParseEthTxOpts,
): TrackedTx | null {
  if (!isRecord(raw)) return null;

  const hash = stringOrNull(raw.hash);
  const value = stringOrNull(raw.value);
  const blockNumber = isNonNegativeInteger(raw.block_number)
    ? raw.block_number
    : null;
  if (
    hash === null || value === null ||
    (raw.status !== 'ok' && raw.status !== 'error')
  ) return null;

  const parsedTime = typeof raw.timestamp === 'string'
    ? Date.parse(raw.timestamp)
    : NaN;
  const status: TxStatus = raw.status === 'error'
    ? 'failed'
    : blockNumber === null ? 'pending' : 'confirmed';

  // Lane B: the Blockscout v2 shape is shared by ETH, Optimism, Scroll,
  // Celo and Aurora; the chain, network id and explorer come from the
  // caller (defaults keep the ETH behaviour exactly).
  const chain = opts?.chain ?? 'eth';
  const networkId =
    opts?.networkId ?? (devnet ? 'eip155:11155111' : 'eip155:1');
  const explorerBase =
    opts?.explorerBase ??
    (devnet
      ? 'https://sepolia.etherscan.io'
      : 'https://eth.blockscout.com');

  return {
    hash,
    chain,
    networkId,
    status,
    statusLabel: raw.status,
    confirmations: isNonNegativeInteger(raw.confirmations)
      ? raw.confirmations
      : null,
    blockHeight: blockNumber,
    from: isRecord(raw.from) ? stringOrNull(raw.from.hash) : null,
    to: isRecord(raw.to) ? stringOrNull(raw.to.hash) : null,
    amountBaseUnits: value,
    feeBaseUnits: isRecord(raw.fee) ? stringOrNull(raw.fee.value) : null,
    timestamp: Number.isFinite(parsedTime) ? parsedTime : null,
    explorerUrl: `${explorerBase}/tx/${hash}`,
    source: 'blockscout',
    fetchedAt: Date.now(),
  };
}

export function parseTrxTx(raw: unknown, devnet = false): TrackedTx | null {
  try {
    if (
      !isRecord(raw) || typeof raw.txID !== 'string' || !raw.txID ||
      !isRecord(raw.raw_data) || !Array.isArray(raw.raw_data.contract) ||
      !Array.isArray(raw.ret) || !isRecord(raw.ret[0]) ||
      typeof raw.ret[0].contractRet !== 'string'
    ) return null;

    const contracts: unknown[] = raw.raw_data.contract;
    const transfer = contracts.find((entry) =>
      isRecord(entry) && entry.type === 'TransferContract',
    );
    const contract = transfer ?? contracts[0];
    if (
      !isRecord(contract) || !isRecord(contract.parameter) ||
      !isRecord(contract.parameter.value)
    ) return null;

    const value = contract.parameter.value;
    const amount = transfer === undefined ? undefined : value.amount;
    if (
      amount !== undefined &&
      !(typeof amount === 'string' && /^\d+$/.test(amount)) &&
      !(typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0)
    ) return null;

    const contractRet = raw.ret[0].contractRet;
    return {
      chain: 'trx',
      networkId: devnet ? 'tron:nile' : 'tron:0x2b6653dc',
      hash: raw.txID,
      from: typeof value.owner_address === 'string' ? value.owner_address : null,
      to: typeof value.to_address === 'string' ? value.to_address : null,
      amountBaseUnits: amount === undefined ? '0' : String(amount),
      feeBaseUnits: null,
      timestamp: typeof raw.raw_data.timestamp === 'number' &&
        Number.isFinite(raw.raw_data.timestamp) ? raw.raw_data.timestamp : null,
      status: contractRet === 'SUCCESS' ? 'confirmed' : 'failed',
      statusLabel: contractRet,
      blockHeight: null,
      confirmations: null,
      source: 'trongrid',
      explorerUrl: devnet
        ? `https://nile.tronscan.org/#/transaction/${raw.txID}`
        : `https://tronscan.org/#/transaction/${raw.txID}`,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/** TonCenter transaction hashes are base64; returns lowercase hex or null. */
function trackerTonHex(hash: unknown): string | null {
  if (typeof hash !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(hash)) return null;
  try {
    return base64ToHex(hash);
  } catch {
    return null;
  }
}

export function parseTonTxEntry(raw: unknown, devnet = false): TrackedTx | null {
  try {
    if (!isRecord(raw) || !isRecord(raw.transaction_id)) return null;
    const hash = trackerTonHex(raw.transaction_id.hash);
    if (
      !hash ||
      (raw.out_msgs !== undefined && !Array.isArray(raw.out_msgs)) ||
      (raw.in_msg != null && !isRecord(raw.in_msg))
    ) return null;

    const messages: unknown[] = Array.isArray(raw.out_msgs) ? raw.out_msgs : [];
    const outgoing = messages.length > 0;
    const message = outgoing ? messages[0] : raw.in_msg;
    if (
      !isRecord(message) || typeof message.value !== 'string' ||
      !/^\d+$/.test(message.value) ||
      (outgoing && typeof message.destination !== 'string')
    ) return null;

    const source = isRecord(raw.in_msg) ? raw.in_msg.source : null;
    return {
      chain: 'ton',
      networkId: devnet ? 'ton:-3' : 'ton:-239',
      hash,
      from: typeof source === 'string' ? source : null,
      to: outgoing && typeof message.destination === 'string' ? message.destination : null,
      amountBaseUnits: message.value,
      feeBaseUnits: typeof raw.fee === 'string' ? raw.fee : null,
      timestamp: typeof raw.utime === 'number' && Number.isFinite(raw.utime * 1000)
        ? raw.utime * 1000 : null,
      status: 'confirmed',
      statusLabel: 'confirmed',
      blockHeight: null,
      confirmations: null,
      source: 'toncenter',
      explorerUrl: devnet
        ? `https://testnet.tonviewer.com/transaction/${hash}`
        : `https://tonviewer.com/transaction/${hash}`,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

const DOGE_NETWORK_ID =
  'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691';

/**
 * Lane P2-B: parse one SoChain v3 single-transaction response
 * (GET /api/v3/tx/DOGE/<hash>). The shape is the v3 vocabulary the
 * Dogecoin adapter already parses for /transactions (status, data,
 * time, block) with per-transaction inputs/outputs: data carries
 * txid, block_no, confirmations, time (unix seconds) and inputs /
 * outputs of {address, value} where value is a decimal DOGE string.
 * Strictly validated — a wrong shape returns null so the caller can
 * fall through to BlockCypher instead of showing invented numbers.
 * Amount is the value leaving the sender (outputs back to the first
 * input address are change), mirroring parseBtcTx; the fee is not
 * reported by this endpoint, so it stays null ("Not reported by the
 * indexer" on screen).
 */
export function parseDogeTx(raw: unknown, requestedHash: string): TrackedTx | null {
  try {
    if (!isRecord(raw) || raw.status !== 'success') return null;
    const data = raw.data;
    if (!isRecord(data)) return null;
    const hash = stringOrNull(data.txid);
    if (hash === null || hash.toLowerCase() !== requestedHash.toLowerCase()) return null;
    const blockHeight = isNonNegativeInteger(data.block_no) ? data.block_no : null;
    const confirmations = isNonNegativeInteger(data.confirmations) ? data.confirmations : null;
    const time = typeof data.time === 'number' && Number.isFinite(data.time) ? data.time : null;
    if (!Array.isArray(data.inputs) || !Array.isArray(data.outputs)) return null;
    const inputs = data.inputs as unknown[];
    const outputs = data.outputs as unknown[];
    const firstInput = inputs[0];
    const sender =
      isRecord(firstInput) && typeof firstInput.address === 'string'
        ? firstInput.address
        : null;
    let amount = 0n;
    let recipient: string | null = null;
    for (const output of outputs) {
      if (!isRecord(output)) return null;
      const address = typeof output.address === 'string' ? output.address : null;
      const value = typeof output.value === 'string' ? output.value : null;
      if (address === null || value === null) return null;
      const koinu = sochainConfirmedToKoinu(value);
      if (koinu === null) return null;
      const isChange = sender !== null && address === sender;
      if (!isChange) {
        amount += BigInt(koinu);
        if (recipient === null) recipient = address;
      }
    }
    const firstOutput = outputs[0];
    return {
      hash,
      chain: 'doge',
      networkId: DOGE_NETWORK_ID,
      status: blockHeight === null ? 'pending' : 'confirmed',
      statusLabel: blockHeight === null ? 'pending' : 'confirmed',
      confirmations,
      blockHeight,
      from: sender,
      to:
        recipient ??
        (isRecord(firstOutput) && typeof firstOutput.address === 'string'
          ? firstOutput.address
          : null),
      amountBaseUnits: amount.toString(),
      feeBaseUnits: null,
      timestamp: time === null ? null : time * 1000,
      explorerUrl: `https://dogechain.info/tx/${hash}`,
      source: 'sochain',
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Lane P2-B: parse one BlockCypher single-transaction object
 * (GET /v1/doge/main/txs/<hash>). The field names are the ones the
 * Dogecoin adapter already parses for /full history entries
 * (adapters/doge.ts blockcypherTxs): hash, inputs with addresses +
 * output_value, outputs with addresses + value, confirmed (ISO
 * string); the single-transaction object additionally carries
 * block_height, confirmations and fees. Strictly validated; null on
 * a wrong shape.
 */
export function parseBlockcypherDogeTx(raw: unknown, requestedHash: string): TrackedTx | null {
  try {
    if (!isRecord(raw)) return null;
    const hash = stringOrNull(raw.hash);
    if (hash === null || hash.toLowerCase() !== requestedHash.toLowerCase()) return null;
    if (!Array.isArray(raw.inputs) || !Array.isArray(raw.outputs)) return null;
    const inputs = raw.inputs as unknown[];
    const outputs = raw.outputs as unknown[];
    const firstInput = inputs[0];
    const sender =
      isRecord(firstInput) && Array.isArray(firstInput.addresses) && typeof firstInput.addresses[0] === 'string'
        ? (firstInput.addresses[0] as string)
        : null;
    let amount = 0n;
    let recipient: string | null = null;
    for (const output of outputs) {
      if (!isRecord(output)) return null;
      const addresses = Array.isArray(output.addresses) ? output.addresses : [];
      const address = typeof addresses[0] === 'string' ? (addresses[0] as string) : null;
      if (address === null) return null;
      if (typeof output.value !== 'number' || !Number.isSafeInteger(output.value) || output.value < 0) return null;
      const isChange = sender !== null && address === sender;
      if (!isChange) {
        amount += BigInt(output.value);
        if (recipient === null) recipient = address;
      }
    }
    const confirmed = typeof raw.confirmed === 'string' ? raw.confirmed : null;
    const timestamp = confirmed === null ? NaN : Date.parse(confirmed);
    const blockHeight = isNonNegativeInteger(raw.block_height) ? raw.block_height : null;
    const firstOutput = outputs[0];
    const firstOutputAddress =
      isRecord(firstOutput) && Array.isArray(firstOutput.addresses) && typeof firstOutput.addresses[0] === 'string'
        ? (firstOutput.addresses[0] as string)
        : null;
    return {
      hash,
      chain: 'doge',
      networkId: DOGE_NETWORK_ID,
      status: confirmed === null ? 'pending' : 'confirmed',
      statusLabel: confirmed === null ? 'pending' : 'confirmed',
      confirmations: isNonNegativeInteger(raw.confirmations) ? raw.confirmations : null,
      blockHeight,
      from: sender,
      to: recipient ?? firstOutputAddress,
      amountBaseUnits: amount.toString(),
      feeBaseUnits:
        typeof raw.fees === 'number' && Number.isSafeInteger(raw.fees) && raw.fees >= 0
          ? String(raw.fees)
          : null,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
      explorerUrl: `https://dogechain.info/tx/${hash}`,
      source: 'blockcypher',
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function lookupTon(hash: string, address: string | undefined, devnet = false): Promise<TrackerLookupResult> {
  if (!address) {
    return {
      status: 'unsupported',
      reason: 'TON lookups need the account address: TonCenter identifies a transaction by account, lt and hash, so paste the account address as well as the hash.',
    };
  }

  try {
    const target = /^[0-9a-f]{64}$/i.test(hash) ? hash.toLowerCase() : trackerTonHex(hash);
    if (!target) return { status: 'error', reason: 'Invalid TON transaction hash format.' };

    const raw: unknown = await fetchJson(devnet ? 'https://testnet.toncenter.com/api/v2/jsonRPC' : 'https://toncenter.com/api/v2/jsonRPC', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'getTransactions',
        params: { address, limit: 10 },
      }),
    });
    if (!isRecord(raw) || raw.ok !== true || !Array.isArray(raw.result)) {
      return { status: 'error', reason: 'Invalid response: expected a transaction list' };
    }

    const entries: unknown[] = raw.result;
    for (const entry of entries) {
      if (!isRecord(entry) || !isRecord(entry.transaction_id)) continue;
      const txHash = trackerTonHex(entry.transaction_id.hash);
      // The external message hash (what the send result screen displays)
      // arrives as the base64 in_msg.hash of the same transaction.
      const messageHash = isRecord(entry.in_msg)
        ? trackerTonHex(entry.in_msg.hash)
        : null;
      if (txHash !== target && messageHash !== target) continue;
      const data = parseTonTxEntry(entry, devnet);
      return data ? { status: 'ok', data } : { status: 'not-found' };
    }

    return {
      status: 'not-found',
      note: 'Checked the 10 most recent transactions for this account; the transaction may be older than that.',
    };
  } catch (error: unknown) {
    return { status: 'error', reason: messageOf(error) };
  }
}

/**
 * Extension point for future chains (Solana is not a ChainId yet): a lane
 * that adds a chain registers its lookup here instead of editing this file.
 */
type LookupHandler = (
  hash: string,
  opts: { address?: string },
) => Promise<TrackerLookupResult>;

const trackerLookupHandlers = new Map<string, LookupHandler>();

export function registerLookupHandler(chain: string, handler: LookupHandler): void {
  trackerLookupHandlers.set(chain, handler);
}

export async function lookupTransaction(
  chain: ChainId,
  hash: string,
  opts?: { address?: string; devnet?: boolean },
): Promise<TrackerLookupResult> {
  const devnet = opts?.devnet === true;
  const registered = trackerLookupHandlers.get(chain);
  if (registered) {
    return registered(hash, opts ?? {});
  }
  if (
    chain !== 'btc' &&
    chain !== 'trx' &&
    chain !== 'ton' &&
    chain !== 'ltc' &&
    chain !== 'doge' &&
    !hasBlockscoutV2Lookup(chain)
  ) {
    return {
      status: 'unsupported',
      reason: 'Transaction lookup is not supported for this chain yet.',
    };
  }

  if (
    (chain === 'btc' || chain === 'ltc' || chain === 'doge') &&
    (hash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hash))
  ) {
    return {
      status: 'error',
      reason:
        chain === 'ltc'
          ? 'Invalid Litecoin transaction hash format.'
          : chain === 'doge'
            ? 'Invalid Dogecoin transaction hash format.'
            : 'Invalid Bitcoin transaction hash format.',
    };
  }
  if (
    hasBlockscoutV2Lookup(chain) &&
    (hash.length !== 66 || !/^0x[0-9a-fA-F]{64}$/.test(hash))
  ) {
    return {
      status: 'error',
      reason:
        chain === 'eth'
          ? 'Invalid Ethereum transaction hash format.'
          : 'Invalid transaction hash format.',
    };
  }
  if (chain === 'trx') {
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
      return { status: 'error', reason: 'Invalid TRON transaction hash format.' };
    }
    try {
      const raw: unknown = await fetchJson(devnet ? 'https://nile.trongrid.io/wallet/gettransactionbyid' : 'https://api.trongrid.io/wallet/gettransactionbyid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: hash }),
      });
      if (isRecord(raw) && Object.keys(raw).length === 0) {
        return { status: 'not-found' };
      }
      const data = parseTrxTx(raw, devnet);
      return data
        ? { status: 'ok', data }
        : { status: 'error', reason: 'Invalid response: expected a transaction' };
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
  }
  if (chain === 'ltc') {
    // Lane P2-B: Litecoin shares Bitcoin's mempool.space shape on
    // litecoinspace.org/api, so parseBtcTx parses it with the LTC
    // chain, network id, explorer and source. Mainnet only: no
    // Litecoin testnet indexer is configured.
    if (devnet) {
      return {
        status: 'unsupported',
        reason: 'Transaction lookup for this chain is only available on mainnet.',
      };
    }
    try {
      const raw: unknown = await fetchJson(`https://litecoinspace.org/api/tx/${hash}`);
      let tipHeight: number | null = null;
      try {
        const tip: unknown = await fetchJson('https://litecoinspace.org/api/blocks/tip/height');
        if (isNonNegativeInteger(tip)) tipHeight = tip;
      } catch {
        // A tip-fetch failure leaves confirmations unknown, not the lookup failed.
      }
      const data = parseBtcTx(raw, tipHeight, false, {
        chain: 'ltc',
        networkId:
          'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
        explorerBase: 'https://litecoinspace.org',
        source: 'litecoinspace',
      });
      return data === null
        ? { status: 'error', reason: 'Unexpected transaction response shape.' }
        : { status: 'ok', data };
    } catch (error: unknown) {
      const reason = messageOf(error);
      return reason === 'HTTP 404'
        ? { status: 'not-found' }
        : { status: 'error', reason };
    }
  }
  if (chain === 'doge') {
    // Lane P2-B: Dogecoin lookup follows the adapter's own source
    // order (adapters/doge.ts) — SoChain primary, BlockCypher
    // fallback — because dogechain.info sends no CORS headers and
    // cannot be fetched from the browser. Mainnet only: no Dogecoin
    // testnet indexer is configured. A source that 404s or returns
    // an unparseable body falls through to the next source; only
    // when both fail is the outcome an error (or not-found when
    // BlockCypher 404s).
    if (devnet) {
      return {
        status: 'unsupported',
        reason: 'Transaction lookup for this chain is only available on mainnet.',
      };
    }
    try {
      const raw: unknown = await fetchJson(`https://sochain.com/api/v3/tx/DOGE/${hash}`);
      const data = parseDogeTx(raw, hash);
      if (data !== null) return { status: 'ok', data };
    } catch {
      // SoChain unreachable or 404: fall through to BlockCypher.
    }
    try {
      const raw: unknown = await fetchJson(`https://api.blockcypher.com/v1/doge/main/txs/${hash}`);
      const data = parseBlockcypherDogeTx(raw, hash);
      return data === null
        ? { status: 'error', reason: 'Unexpected transaction response shape.' }
        : { status: 'ok', data };
    } catch (error: unknown) {
      const reason = messageOf(error);
      return reason === 'HTTP 404'
        ? { status: 'not-found' }
        : { status: 'error', reason };
    }
  }
  if (chain === 'ton') {
    // The send result screen shows the hash with a 0x prefix; a user
    // pasting it verbatim must not fail format validation (Issue 6).
    const normalized =
      hash.startsWith('0x') || hash.startsWith('0X') ? hash.slice(2) : hash;
    if (!/^[0-9a-f]{64}$/i.test(normalized) && !/^[A-Za-z0-9+/]{43}=$/.test(normalized)) {
      return { status: 'error', reason: 'Invalid TON transaction hash format.' };
    }
    return lookupTon(normalized, opts?.address, devnet);
  }

  try {
    let data: TrackedTx | null;
    if (chain === 'btc') {
      const base = devnet ? 'https://mempool.space/testnet4/api' : 'https://mempool.space/api';
      const raw: unknown = await fetchJson(`${base}/tx/${hash}`);
      let tipHeight: number | null = null;
      try {
        const tip: unknown = await fetchJson(
          `${base}/blocks/tip/height`,
        );
        if (isNonNegativeInteger(tip)) tipHeight = tip;
      } catch {
        // A tip-fetch failure leaves confirmations unknown, not the lookup failed.
      }
      data = parseBtcTx(raw, tipHeight, devnet);
    } else {
      // Lane B: the Blockscout v2 lookup is shared by every chain
      // with a historyExplorerBase — the host, network id and explorer
      // come from the registry entry. Lookup is mainnet-only for the
      // non-ETH chains: no devnet indexer is configured for them.
      if (devnet && chain !== 'eth') {
        return {
          status: 'unsupported',
          reason:
            'Transaction lookup for this chain is only available on mainnet.',
        };
      }
      const config = chainConfig(chain);
      const explorerBase = devnet
        ? 'https://sepolia.etherscan.io'
        : (config.historyExplorerBase ?? 'https://eth.blockscout.com');
      const raw: unknown = await fetchJson(
        devnet
          ? `https://eth-sepolia.blockscout.com/api/v2/transactions/${hash}`
          : `${explorerBase}/api/v2/transactions/${hash}`,
      );
      if (isRecord(raw) && raw.message === 'Not found') {
        return { status: 'not-found' };
      }
      data = parseEthTx(raw, devnet, {
        chain,
        networkId: devnet ? 'eip155:11155111' : config.networkId,
        explorerBase,
      });
    }

    return data === null
      ? { status: 'error', reason: 'Unexpected transaction response shape.' }
      : { status: 'ok', data };
  } catch (error: unknown) {
    const reason = messageOf(error);
    return reason === 'HTTP 404'
      ? { status: 'not-found' }
      : { status: 'error', reason };
  }
}

export type AnyChainLookupResult =
  | { status: 'ok'; data: TrackedTx; chain: ChainId }
  | { status: 'not-found'; note?: string }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; reason: string };

/**
 * Lane P2-B: what shape a hash is, before any network call. A
 * 0x-prefixed 64-hex hash is EVM-shaped, a bare 64-hex hash is
 * shared by the UTXO chains and TRON (and TON, which needs an
 * address on top), and an 87–88 character base58 string is a Solana
 * signature. Anything else is not a transaction hash at all.
 */
export function hashShape(id: string): 'evm' | 'utxo' | 'sol' | null {
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) return 'evm';
  if (/^[0-9a-fA-F]{64}$/.test(id)) return 'utxo';
  if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(id)) return 'sol';
  return null;
}

/**
 * Lane P2-B (F30): resolve ANY real hash with the same lookup
 * /track uses, without the detail screen having to know the chain.
 * A 0x hash is tried on every Blockscout chain in parallel (ETH
 * first, so the common case wins the ordering); a 64-hex hash is
 * tried in turn on BTC, TRON, Litecoin and Dogecoin. A hit on any
 * chain wins; a lookup that errors on one chain never hides a hit
 * on another (an indexer 429 on Bitcoin must not dead-end a
 * Litecoin transaction). Only when every candidate errors is the
 * outcome an error; when at least one candidate answered
 * not-found, the hash is not on any chain we could reach, and a
 * note says so when some networks could not be reached at all.
 * Solana has no lookup here yet (Track answers 'unsupported' for
 * it too), so it is named honestly instead of resolved. In devnet
 * mode only the chains with a devnet indexer are tried.
 */
export async function lookupTransactionAnyChain(
  hash: string,
  opts?: { devnet?: boolean },
): Promise<AnyChainLookupResult> {
  const devnet = opts?.devnet === true;
  const shape = hashShape(hash);
  if (shape === null) {
    return { status: 'error', reason: 'Invalid transaction hash format.' };
  }
  if (shape === 'sol') {
    return {
      status: 'unsupported',
      reason:
        'Solana transactions cannot be looked up in the wallet yet. Check the transaction on Solscan.',
    };
  }
  if (shape === 'evm') {
    const candidates = (
      devnet
        ? ['eth']
        : SUPPORTED_CHAINS.filter((chain) => hasBlockscoutV2Lookup(chain))
    ) as ChainId[];
    const ordered: ChainId[] = [
      'eth',
      ...candidates.filter((chain) => chain !== 'eth'),
    ];
    const results = await Promise.all(
      ordered.map((chain) => lookupTransaction(chain, hash, opts)),
    );
    const paired = ordered.map((chain, index) => ({
      chain,
      result: results[index],
    }));
    for (const entry of paired) {
      if (entry.result !== undefined && entry.result.status === 'ok') {
        return { status: 'ok', data: entry.result.data, chain: entry.chain };
      }
    }
    if (results.every((result) => result.status === 'error')) {
      const firstError = results.find((result) => result.status === 'error');
      return {
        status: 'error',
        reason:
          firstError !== undefined && firstError.status === 'error'
            ? firstError.reason
            : 'Lookup failed.',
      };
    }
    return { status: 'not-found' };
  }
  const candidates: ChainId[] = devnet
    ? ['btc', 'trx']
    : ['btc', 'trx', 'ltc', 'doge'];
  let sawError = false;
  let firstError: string | null = null;
  let sawNotFound = false;
  for (const chain of candidates) {
    const result = await lookupTransaction(chain, hash, opts);
    if (result.status === 'ok') {
      return { status: 'ok', data: result.data, chain };
    }
    if (result.status === 'error') {
      sawError = true;
      firstError ??= result.reason;
      continue;
    }
    if (result.status === 'not-found') {
      sawNotFound = true;
    }
    // 'unsupported' (a devnet-only chain in the list, or a chain
    // that cannot look this hash up) is skipped, not an error.
  }
  if (!sawNotFound && sawError) {
    return { status: 'error', reason: firstError ?? 'Lookup failed.' };
  }
  return {
    status: 'not-found',
    note: sawError ? 'Some networks could not be reached; Retry may help.' : undefined,
  };
}

export type TrackerActivityResult = AdapterResult<AdapterTx[]>;

// An empty 'ok' list means 'no transactions found', never 'unused address'.
// Indexer results may lag behind the chain; the UI says so.
export async function getRecentActivity(
  chain: ChainId,
  address: string,
  limit?: number,
  opts?: { devnet?: boolean },
): Promise<TrackerActivityResult> {
  const requested = limit ?? 10;
  const clamped = Math.max(1, Math.min(20, Math.trunc(Number.isNaN(requested) ? 10 : requested)));
  const adapter = getAdapterForMode(chain, opts?.devnet === true);
  if (!adapter) {
    return { status: 'unavailable', reason: 'No history adapter is available for this chain.' };
  }
  return adapter.getHistory(address, clamped);
}
