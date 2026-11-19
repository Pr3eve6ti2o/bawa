```typescript
/**
 * Read-only transaction tracking via mempool.space (BTC) and Blockscout (ETH).
 * Included transactions are never presented as finalized: expose the indexer's
 * own status wording alongside confirmations, which may be unknown.
 */
import type { ChainId } from '../engine/boundary';
import { fetchJson } from './adapters/types';
import type { TxStatus } from './adapters/types';

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
  if (
    hash === null || value === null ||
    (raw.status !== 'ok' && raw.status !== 'error') ||
    (raw.block_number !== null && !isNonNegativeInteger(raw.block_number)) ||
    !isNonNegativeInteger(raw.confirmations)
  ) return null;

  const parsedTime = typeof raw.timestamp === 'string'
    ? Date.parse(raw.timestamp)
    : NaN;
  const status: TxStatus = raw.status === 'error'
    ? 'failed'
    : raw.block_number === null ? 'pending' : 'confirmed';

  return {
    hash,
    chain: 'eth',
    networkId: 'eip155:1',
    status,
    statusLabel: raw.status,
    confirmations: raw.confirmations,
    blockHeight: raw.block_number,
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

export async function lookupTransaction(
  chain: ChainId,
  hash: string,
  opts?: { address?: string },
): Promise<TrackerLookupResult> {
  void opts;

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

  // TODO(part 2): Hook up TRX and TON transaction lookups.
  if (chain !== 'btc' && chain !== 'eth') {
    return {
      status: 'unsupported',
      reason: 'Transaction lookup for this chain lands in part 2.',
    };
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
```