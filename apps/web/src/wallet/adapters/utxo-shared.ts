/**
 * Shared mempool/Esplora-shaped UTXO adapter pieces (marketing-fix Lane 2).
 *
 * btc.ts and ltc.ts were near-copies (jscpd: 64 lines of history mapping,
 * plus the reader, identity check, balance parse and UTXO parse), trx.ts
 * shared the same endpoint-sweep reader, and doge.ts shared the
 * balance-result shape and the BlockCypher final_balance parse. Only the
 * per-chain parameters differ — chain id, network id, genesis hash,
 * explorer base, address shape, fallback strategy — and those stay in
 * the adapters. Everything here is pure or takes its dependencies as
 * arguments, so behaviour is identical by construction.
 */
import type { ChainId } from '../../engine/boundary';
import {
  assertNetworkId,
  endpointHost,
  toAdapterError,
  tryEndpoints,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type FeeEstimate,
  type FetchTransport,
  type TxInput,
} from './types';
import { isRecord } from '../guards';
import { withRetry } from '../retry';

type MempoolReader = (
  urlFor: (base: string) => string,
  operation: string,
) => Promise<{ raw: unknown; endpoint: string }>;

/**
 * Endpoint-sweep JSON reader (UI/UX fixes, item 19): every read sweeps
 * the endpoint list in order (SOL pattern). The sweep itself is a raw
 * transport call per endpoint — no per-endpoint retry — and one
 * withRetry wraps the whole sweep, so a dead primary costs one
 * attempt, not three.
 */
export function createMempoolReader(
  transport: FetchTransport,
  resolveBaseUrls: () => string[],
): MempoolReader {
  return (urlFor, operation) =>
    withRetry(
      () =>
        tryEndpoints(resolveBaseUrls(), (base) =>
          transport.request(urlFor(base)),
        ),
      { operation },
    ).then(({ result, endpoint }) => ({ raw: result, endpoint }));
}

/**
 * Genesis-block check against one mempool endpoint: parses the
 * /blocks/0 payload the caller already fetched, pins it to the
 * expected genesis hash, and returns the error result when the
 * endpoint serves another network (or no genesis at all). Returns
 * null when verified. The caller owns the per-instance cache flag
 * and any fallback strategy (LTC falls back to BlockCypher on a
 * transport failure, BTC fails closed) — this only verifies one
 * payload.
 */
export function verifyGenesisBlock(
  raw: unknown,
  endpoint: string,
  genesisHash: string,
): AdapterResult<never> | null {
  const blocks = Array.isArray(raw) ? raw : [];
  const genesis = isRecord(blocks[0]) ? blocks[0]['id'] : undefined;
  if (typeof genesis !== 'string') {
    return {
      status: 'error',
      reason: 'Network identity check failed: no genesis block returned.',
    };
  }
  try {
    assertNetworkId(genesis, genesisHash, endpointHost(endpoint));
  } catch (error: unknown) {
    return toAdapterError(error);
  }
  return null;
}

type ChainStatsBalance =
  | { ok: true; balance: bigint }
  | { ok: false; reason: string };

/**
 * Balance from a mempool /address/ payload's chain_stats: funded
 * minus spent. JSON numbers lose precision above
 * Number.MAX_SAFE_INTEGER; fine for a personal wallet, recorded
 * limitation (kept from the adapters).
 */
export function parseChainStatsBalance(raw: unknown): ChainStatsBalance {
  const stats = isRecord(raw) ? raw['chain_stats'] : undefined;
  if (!isRecord(stats)) {
    return { ok: false, reason: 'Invalid response: expected chain stats' };
  }
  const funded = stats['funded_txo_sum'];
  const spent = stats['spent_txo_sum'];
  if (typeof funded !== 'number' || typeof spent !== 'number') {
    return { ok: false, reason: 'Invalid response: expected txo sums' };
  }
  return {
    ok: true,
    balance: BigInt(Math.trunc(funded)) - BigInt(Math.trunc(spent)),
  };
}

/**
 * Final balance from a BlockCypher /addrs/{address}/balance payload.
 * Returns undefined when the shape is wrong; the caller reports
 * 'Invalid response: expected final_balance'.
 */
export function parseBlockcypherBalance(raw: unknown): number | undefined {
  const finalBalance = isRecord(raw) ? raw['final_balance'] : undefined;
  return typeof finalBalance === 'number' ? finalBalance : undefined;
}

/** ok balance result for a UTXO-family chain. */
export function balanceResult(
  chain: ChainId,
  networkId: string,
  decimals: number,
  valueBaseUnits: string,
  source: string,
  address: string,
): AdapterResult<AdapterBalance> {
  return {
    status: 'ok',
    data: {
      chain,
      address,
      networkId,
      valueBaseUnits,
      decimals,
      source,
      fetchedAt: Date.now(),
    },
    source,
    fetchedAt: Date.now(),
  };
}

interface MempoolHistoryOptions {
  chain: ChainId;
  networkId: string;
  explorerBaseUrl: string;
  address: string;
  limit: number;
}

/**
 * Mempool /address/{address}/txs payload mapped to AdapterTx rows.
 * Direction follows the rule both adapters document: 'self' only when
 * every output returns to this address (a send with change is an
 * 'out', not a self-transfer). Returns null when the payload is not a
 * list; the caller reports 'Invalid response: expected a transaction
 * list'.
 */
function parseMempoolHistory(
  raw: unknown,
  options: MempoolHistoryOptions,
): AdapterTx[] | null {
  if (!Array.isArray(raw)) return null;
  const { chain, networkId, explorerBaseUrl, address, limit } = options;
  const txs: AdapterTx[] = [];
  for (const entry of raw.slice(0, limit)) {
    if (!isRecord(entry)) continue;
    const txid = typeof entry['txid'] === 'string' ? entry['txid'] : '';
    const vin = Array.isArray(entry['vin']) ? entry['vin'] : [];
    const vout = Array.isArray(entry['vout']) ? entry['vout'] : [];
    const status = isRecord(entry['status']) ? entry['status'] : undefined;
    const confirmed = status?.['confirmed'] === true;
    const blockTime =
      typeof status?.['block_time'] === 'number' ? status['block_time'] : NaN;

    let inSum = 0n;
    let outToSelf = 0n;
    let outToOthers = 0n;
    let counterparty: string | null = null;
    for (const input of vin) {
      const prevout = isRecord(input) ? input['prevout'] : undefined;
      const addr =
        isRecord(prevout) && typeof prevout['scriptpubkey_address'] === 'string'
          ? prevout['scriptpubkey_address']
          : '';
      const value =
        isRecord(prevout) && typeof prevout['value'] === 'number'
          ? BigInt(Math.trunc(prevout['value']))
          : 0n;
      if (addr === address) {
        inSum += value;
      } else if (!counterparty && addr !== '') {
        counterparty = addr;
      }
    }
    for (const output of vout) {
      const addr =
        isRecord(output) && typeof output['scriptpubkey_address'] === 'string'
          ? output['scriptpubkey_address']
          : '';
      const value =
        isRecord(output) && typeof output['value'] === 'number'
          ? BigInt(Math.trunc(output['value']))
          : 0n;
      if (addr === address) {
        outToSelf += value;
      } else {
        outToOthers += value;
        if (!counterparty && addr !== '') counterparty = addr;
      }
    }
    const inVin = inSum > 0n;
    const inVout = outToSelf > 0n;
    // 'self' only when every output returns to this address (a send with
    // change is an 'out', not a self-transfer).
    const direction =
      inVin && inVout && outToOthers === 0n ? 'self' : inVout && !inVin ? 'in' : 'out';
    txs.push({
      hash: txid,
      chain,
      networkId,
      direction,
      amountBaseUnits:
        direction === 'in'
          ? outToSelf.toString()
          : direction === 'out'
            ? outToOthers.toString()
            : outToSelf.toString(),
      counterparty,
      timestamp: Number.isFinite(blockTime) ? blockTime * 1000 : null,
      status: confirmed ? 'confirmed' : 'pending',
      explorerUrl: `${explorerBaseUrl}/tx/${txid}`,
    });
  }
  return txs;
}

/**
 * Mempool /address/{address}/utxo payload mapped to UTXO inputs.
 * Returns null when the payload is not a list; the caller reports
 * 'Invalid response: expected a UTXO list'.
 */
function parseUtxoEntries(
  raw: unknown,
): { txid: string; vout: number; valueBaseUnits: string }[] | null {
  if (!Array.isArray(raw)) return null;
  const utxos: { txid: string; vout: number; valueBaseUnits: string }[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const txid = typeof entry['txid'] === 'string' ? entry['txid'] : '';
    const vout = typeof entry['vout'] === 'number' ? entry['vout'] : -1;
    const value = typeof entry['value'] === 'number' ? entry['value'] : NaN;
    if (!txid || vout < 0 || !Number.isFinite(value)) continue;
    utxos.push({ txid, vout, valueBaseUnits: String(Math.trunc(value)) });
  }
  return utxos;
}

/**
 * Shared address-read prologue for the mempool adapters (btc.ts
 * getBalance/getHistory/getTxInputs, ltc.ts getHistory/getTxInputs):
 * validate the address, check the network identity, read one JSON
 * endpoint. Returns the raw payload and the endpoint that answered,
 * or the AdapterResult to return. LTC getBalance is deliberately NOT
 * converted: a mempool failure there falls through to the BlockCypher
 * fallback instead of returning an error.
 */
type AddressJsonRead =
  | { ok: true; raw: unknown; endpoint: string }
  | { ok: false; result: AdapterResult<never> };

export async function readAddressJson(
  isValid: boolean,
  invalidReason: string,
  requireIdentity: () => Promise<AdapterResult<never> | null>,
  readJsonFrom: MempoolReader,
  urlFor: (base: string) => string,
  operation: string,
  defaultEndpoint: string,
): Promise<AddressJsonRead> {
  if (!isValid) {
    return { ok: false, result: { status: 'error', reason: invalidReason } };
  }
  const identity = await requireIdentity();
  if (identity) return { ok: false, result: identity };
  let raw: unknown;
  let endpoint = defaultEndpoint;
  try {
    ({ raw, endpoint } = await readJsonFrom(urlFor, operation));
  } catch (error: unknown) {
    return { ok: false, result: toAdapterError(error) };
  }
  return { ok: true, raw, endpoint };
}

/** Shared getTxInputs tail: parse a UTXO list and report it. */
export function utxoInputsResult(
  raw: unknown,
  endpoint: string,
): AdapterResult<TxInput> {
  const utxos = parseUtxoEntries(raw);
  if (utxos === null) {
    return { status: 'error', reason: 'Invalid response: expected a UTXO list' };
  }
  return {
    status: 'ok',
    data: { kind: 'utxo', utxos },
    source: endpointHost(endpoint),
    fetchedAt: Date.now(),
  };
}

/** Shared getHistory tail: parse a mempool transaction list and report it. */
export function mempoolHistoryResult(
  raw: unknown,
  options: MempoolHistoryOptions,
  endpoint: string,
): AdapterResult<AdapterTx[]> {
  const txs = parseMempoolHistory(raw, options);
  if (txs === null) {
    return { status: 'error', reason: 'Invalid response: expected a transaction list' };
  }
  return { status: 'ok', data: txs, source: endpointHost(endpoint), fetchedAt: Date.now() };
}

/**
 * Shared estimateFee success result (btc/ltc/trx): the fee amount,
 * unit and note differ per chain; the envelope (source + fetchedAt
 * inside and outside data) is the same.
 */
export function feeEstimateResult(
  chain: ChainId,
  networkId: string,
  feeBaseUnits: string,
  unit: string,
  note: string,
  endpoint: string,
): AdapterResult<FeeEstimate> {
  const source = endpointHost(endpoint);
  return {
    status: 'ok',
    data: {
      chain,
      networkId,
      feeBaseUnits,
      unit,
      note,
      source,
      fetchedAt: Date.now(),
    },
    source,
    fetchedAt: Date.now(),
  };
}
