/**
 * Read-only transaction tracking via mempool.space (BTC), Blockscout (ETH),
 * TronGrid (TRX) and TonCenter (TON). No API key is needed for any of them.
 * Included transactions are never presented as finalized: expose the
 * indexer's own status wording alongside confirmations, which may be
 * unknown (TronGrid and TonCenter report no block number here).
 * TonCenter has no hash-only lookup: a TON transaction is identified by
 * account address plus lt plus hash, so TON lookup needs the address.
 */
import type { ChainId } from '../engine/boundary';
import { getAdapter } from './adapters/index';
import { base64ToHex } from './adapters/ton';
import { fetchJson } from './adapters/types';
import type { AdapterResult, AdapterTx, TxStatus } from './adapters/types';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

export function parseBtcTx(raw: unknown, tipHeight: number | null): TrackedTx | null {
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

  let amount = 0;
  for (const output of raw.vout) {
    if (!isRecord(output) || !isNonNegativeInteger(output.value)) return null;
    amount += output.value;
    if (!Number.isSafeInteger(amount)) return null;
  }

  const firstInput = raw.vin[0];
  const prevout = isRecord(firstInput) && isRecord(firstInput.prevout)
    ? firstInput.prevout
    : null;
  const firstOutput = raw.vout[0];

  return {
    hash,
    chain: 'btc',
    networkId: 'bip122:000000000019d6689c085ae165831e93',
    status: status.confirmed ? 'confirmed' : 'pending',
    statusLabel: status.confirmed ? 'confirmed' : 'pending',
    confirmations: blockHeight === null || tipHeight === null
      ? null
      : tipHeight - blockHeight + 1,
    blockHeight,
    from: prevout === null ? null : stringOrNull(prevout.scriptpubkey_address),
    to: isRecord(firstOutput) ? stringOrNull(firstOutput.scriptpubkey_address) : null,
    amountBaseUnits: amount.toString(),
    feeBaseUnits: raw.fee.toString(),
    timestamp,
    explorerUrl: `https://mempool.space/tx/${hash}`,
    source: 'mempool.space',
    fetchedAt: Date.now(),
  };
}

export function parseEthTx(raw: unknown): TrackedTx | null {
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

  return {
    hash,
    chain: 'eth',
    networkId: 'eip155:1',
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
    explorerUrl: `https://eth.blockscout.com/tx/${hash}`,
    source: 'blockscout',
    fetchedAt: Date.now(),
  };
}

export function parseTrxTx(raw: unknown): TrackedTx | null {
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
      networkId: 'tron:0x2b6653dc',
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
      explorerUrl: `https://tronscan.org/#/transaction/${raw.txID}`,
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

export function parseTonTxEntry(raw: unknown): TrackedTx | null {
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
      networkId: 'ton:-239',
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
      explorerUrl: `https://tonviewer.com/transaction/${hash}`,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function lookupTon(hash: string, address: string | undefined): Promise<TrackerLookupResult> {
  if (!address) {
    return {
      status: 'unsupported',
      reason: 'TON lookups need the account address: TonCenter identifies a transaction by account, lt and hash, so paste the account address as well as the hash.',
    };
  }

  try {
    const target = /^[0-9a-f]{64}$/i.test(hash) ? hash.toLowerCase() : trackerTonHex(hash);
    if (!target) return { status: 'error', reason: 'Invalid TON transaction hash format.' };

    const raw: unknown = await fetchJson('https://toncenter.com/api/v2/jsonRPC', {
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
      if (
        !isRecord(entry) || !isRecord(entry.transaction_id) ||
        trackerTonHex(entry.transaction_id.hash) !== target
      ) continue;
      const data = parseTonTxEntry(entry);
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
export type LookupHandler = (
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
  opts?: { address?: string },
): Promise<TrackerLookupResult> {
  const registered = trackerLookupHandlers.get(chain);
  if (registered) {
    return registered(hash, opts ?? {});
  }
  if (chain !== 'btc' && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return {
      status: 'unsupported',
      reason: 'Transaction lookup is not supported for this chain yet.',
    };
  }

  if (
    chain === 'btc' &&
    (hash.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hash))
  ) {
    return { status: 'error', reason: 'Invalid Bitcoin transaction hash format.' };
  }
  if (
    chain === 'eth' &&
    (hash.length !== 66 || !/^0x[0-9a-fA-F]{64}$/.test(hash))
  ) {
    return { status: 'error', reason: 'Invalid Ethereum transaction hash format.' };
  }
  if (chain === 'trx') {
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
      return { status: 'error', reason: 'Invalid TRON transaction hash format.' };
    }
    try {
      const raw: unknown = await fetchJson('https://api.trongrid.io/wallet/gettransactionbyid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: hash }),
      });
      if (isRecord(raw) && Object.keys(raw).length === 0) {
        return { status: 'not-found' };
      }
      const data = parseTrxTx(raw);
      return data
        ? { status: 'ok', data }
        : { status: 'error', reason: 'Invalid response: expected a transaction' };
    } catch (error: unknown) {
      return { status: 'error', reason: messageOf(error) };
    }
  }
  if (chain === 'ton') {
    if (!/^[0-9a-f]{64}$/i.test(hash) && !/^[A-Za-z0-9+/]{43}=$/.test(hash)) {
      return { status: 'error', reason: 'Invalid TON transaction hash format.' };
    }
    return lookupTon(hash, opts?.address);
  }

  try {
    let data: TrackedTx | null;
    if (chain === 'btc') {
      const raw: unknown = await fetchJson(`https://mempool.space/api/tx/${hash}`);
      let tipHeight: number | null = null;
      try {
        const tip: unknown = await fetchJson(
          'https://mempool.space/api/blocks/tip/height',
        );
        if (isNonNegativeInteger(tip)) tipHeight = tip;
      } catch {
        // A tip-fetch failure leaves confirmations unknown, not the lookup failed.
      }
      data = parseBtcTx(raw, tipHeight);
    } else {
      const raw: unknown = await fetchJson(
        `https://eth.blockscout.com/api/v2/transactions/${hash}`,
      );
      if (isRecord(raw) && raw.message === 'Not found') {
        return { status: 'not-found' };
      }
      data = parseEthTx(raw);
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

export type TrackerActivityResult = AdapterResult<AdapterTx[]>;

// An empty 'ok' list means 'no transactions found', never 'unused address'.
// Indexer results may lag behind the chain; the UI says so.
export async function getRecentActivity(
  chain: ChainId,
  address: string,
  limit?: number,
): Promise<TrackerActivityResult> {
  const requested = limit ?? 10;
  const clamped = Math.max(1, Math.min(20, Math.trunc(Number.isNaN(requested) ? 10 : requested)));
  const adapter = getAdapter(chain);
  if (!adapter) {
    return { status: 'unavailable', reason: 'No history adapter is available for this chain.' };
  }
  return adapter.getHistory(address, clamped);
}
