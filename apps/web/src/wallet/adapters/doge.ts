/**
 * Dogecoin adapter (token gaps, item 1).
 *
 * Native DOGE balance via SoChain's address-balance endpoint
 * (https://sochain.com/api/v3/balance/DOGE/{address}, plain GET, no
 * key; provider publishes 2,500 lookups/day/IP keyless). The response
 * shape is { status: 'success', data: { confirmed: '<decimal DOGE>',
 * unconfirmed: '<decimal DOGE>' } } — confirmed is converted to koinu
 * with exact string math, never floats. Lane 1 (2026-11-22): in-page
 * 200, confirmed "10007.79125175" DOGE for the repo-fixture address
 * DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K, agreeing exactly with
 * BlockCypher's final_balance 1000779125175 koinu. BlockCypher stays
 * as fallback (its 429-without-CORS failure is load-dependent, which
 * is why SoChain is primary). Chain identity rests on SoChain's
 * network_info reporting a live block count, falling back to
 * BlockCypher's chain endpoint reporting name 'DOGE' (cached per
 * instance). History is built the same way: SoChain v3 /transactions
 * (in + out, merged newest-first) with BlockCypher /full as fallback.
 * Fee-quote and tx inputs are not built — they report unavailable,
 * never faked. Broadcast stays disabled.
 */
import {
  BROADCAST_DISABLED_MESSAGE,
  assertNetworkId,
  httpFetchTransport,
  toAdapterError,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type ChainAdapter,
  type FeeEstimate,
  type FetchTransport,
  type TxInput,
} from './types';
import { isRecord } from '../guards';
import { withRetry } from '../retry';

const NETWORK_ID =
  'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691';
const SOCHAIN_BASE = 'https://sochain.com/api/v3';
const BLOCKCYPHER_BASE = 'https://api.blockcypher.com/v1/doge/main';
const SOCHAIN_SOURCE = 'sochain';
const BLOCKCYPHER_SOURCE = 'blockcypher';
const DECIMALS = 8;

export interface DogeAdapterOverrides {
  /** BlockCypher base URL (fallback). */
  baseUrl?: string;
  /** SoChain base URL (primary). */
  sochainBaseUrl?: string;
  /** Injectable transport; defaults to the single-attempt HTTP transport. */
  transport?: FetchTransport;
}

/**
 * Convert SoChain's decimal DOGE string to koinu (1 DOGE = 10^8
 * koinu) with exact string math — never a float, so 10007.79125175
 * maps to exactly 1000779125175. Returns null for a malformed value.
 */
export function sochainConfirmedToKoinu(confirmed: string): string | null {
  if (!/^\d+(\.\d{1,8})?$/.test(confirmed)) return null;
  const [whole, fraction = ''] = confirmed.split('.');
  const combined = (whole + fraction.padEnd(8, '0')).replace(/^0+(?=\d)/, '');
  return combined === '' ? '0' : combined;
}


/**
 * Parse one SoChain v3 /transactions page. Entries carry hash,
 * balance_change (signed decimal DOGE — the direction's ground truth),
 * time (unix seconds) and block. Returns null for a bad shape, so the
 * caller can fall back to BlockCypher.
 */
function sochainTxs(raw: unknown): AdapterTx[] | null {
  if (!isRecord(raw) || raw['status'] !== 'success') return null;
  const data = raw['data'];
  if (!isRecord(data) || !Array.isArray(data['transactions'])) return null;
  const txs: AdapterTx[] = [];
  for (const entry of data['transactions'] as unknown[]) {
    if (!isRecord(entry)) continue;
    const hash = typeof entry['hash'] === 'string' ? entry['hash'] : '';
    const change =
      typeof entry['balance_change'] === 'string'
        ? entry['balance_change']
        : '';
    const time = typeof entry['time'] === 'number' ? entry['time'] : NaN;
    if (hash === '' || !/^-?\d+(\.\d{1,8})?$/.test(change) || !Number.isFinite(time)) {
      continue;
    }
    const magnitude = change.startsWith('-') ? change.slice(1) : change;
    const koinu = sochainConfirmedToKoinu(magnitude);
    if (koinu === null) continue;
    txs.push({
      hash,
      chain: 'doge',
      networkId: NETWORK_ID,
      direction: change.startsWith('-')
        ? 'out'
        : koinu === '0'
          ? 'self'
          : 'in',
      amountBaseUnits: koinu,
      counterparty: null,
      timestamp: time * 1000,
      status: 'confirmed',
      explorerUrl: `https://dogechain.info/tx/${hash}`,
    });
  }
  return txs;
}

/**
 * Parse a BlockCypher /full response. Direction follows the LTC
 * adapter's rule: 'self' only when every output returns to this
 * address (a send with change is an 'out', not a self-transfer).
 * Returns null for a bad shape.
 */
function blockcypherTxs(raw: unknown, address: string): AdapterTx[] | null {
  if (!isRecord(raw) || !Array.isArray(raw['txs'])) return null;
  const txs: AdapterTx[] = [];
  for (const entry of raw['txs'] as unknown[]) {
    if (!isRecord(entry)) continue;
    const hash = typeof entry['hash'] === 'string' ? entry['hash'] : '';
    if (hash === '') continue;
    const inputs = Array.isArray(entry['inputs']) ? entry['inputs'] : [];
    const outputs = Array.isArray(entry['outputs']) ? entry['outputs'] : [];
    let inSum = 0n;
    let outToSelf = 0n;
    let outToOthers = 0n;
    let counterparty: string | null = null;
    for (const input of inputs) {
      if (!isRecord(input)) continue;
      const addrs = Array.isArray(input['addresses'])
        ? (input['addresses'] as unknown[])
        : [];
      const value =
        typeof input['output_value'] === 'number'
          ? BigInt(Math.trunc(input['output_value']))
          : 0n;
      if (addrs.includes(address)) {
        inSum += value;
      } else if (!counterparty && typeof addrs[0] === 'string') {
        counterparty = addrs[0];
      }
    }
    for (const output of outputs) {
      if (!isRecord(output)) continue;
      const addrs = Array.isArray(output['addresses'])
        ? (output['addresses'] as unknown[])
        : [];
      const value =
        typeof output['value'] === 'number'
          ? BigInt(Math.trunc(output['value']))
          : 0n;
      if (addrs.includes(address)) {
        outToSelf += value;
      } else {
        outToOthers += value;
        if (!counterparty && typeof addrs[0] === 'string') {
          counterparty = addrs[0];
        }
      }
    }
    const inVin = inSum > 0n;
    const inVout = outToSelf > 0n;
    const direction =
      inVin && inVout && outToOthers === 0n
        ? 'self'
        : inVout && !inVin
          ? 'in'
          : 'out';
    const confirmed =
      typeof entry['confirmed'] === 'string' ? entry['confirmed'] : null;
    const timestamp = confirmed !== null ? Date.parse(confirmed) : NaN;
    txs.push({
      hash,
      chain: 'doge',
      networkId: NETWORK_ID,
      direction,
      amountBaseUnits:
        direction === 'in'
          ? outToSelf.toString()
          : direction === 'out'
            ? outToOthers.toString()
            : outToSelf.toString(),
      counterparty,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
      status: confirmed !== null ? 'confirmed' : 'pending',
      explorerUrl: `https://dogechain.info/tx/${hash}`,
    });
  }
  txs.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return txs;
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function isDogeAddress(address: string): boolean {
  return (
    address.length === 34 &&
    address.startsWith('D') &&
    [...address].every((ch) => BASE58_ALPHABET.includes(ch))
  );
}

export function createDogeAdapter(
  overrides: DogeAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? BLOCKCYPHER_BASE;
  const sochainBaseUrl = overrides.sochainBaseUrl ?? SOCHAIN_BASE;
  const transport = overrides.transport ?? httpFetchTransport;
  const readJson = (url: string, operation: string): Promise<unknown> =>
    withRetry(() => transport.request(url), { operation });
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    // Primary identity: SoChain network_info reports a live block count.
    try {
      const raw = await readJson(`${sochainBaseUrl}/network_info/DOGE`, 'doge.identity');
      const data = isRecord(raw) ? raw['data'] : undefined;
      if (
        isRecord(raw) &&
        raw['status'] === 'success' &&
        isRecord(data) &&
        typeof data['block_count'] === 'number' &&
        Number.isFinite(data['block_count'])
      ) {
        identityChecked = true;
        return null;
      }
    } catch {
      // Fall through to the BlockCypher identity check below.
    }
    // Fallback identity: BlockCypher's chain endpoint reports name DOGE.
    let raw: unknown;
    try {
      raw = await readJson(baseUrl, 'doge.identity');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const name = isRecord(raw) ? raw['name'] : undefined;
    if (typeof name !== 'string') {
      return {
        status: 'error',
        reason: 'Network identity check failed: no chain name returned.',
      };
    }
    try {
      assertNetworkId(name, 'DOGE', BLOCKCYPHER_SOURCE);
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    identityChecked = true;
    return null;
  };

  const balanceResult = (
    valueBaseUnits: string,
    source: string,
    address: string,
  ): AdapterResult<AdapterBalance> => ({
    status: 'ok',
    data: {
      chain: 'doge',
      address,
      networkId: NETWORK_ID,
      valueBaseUnits,
      decimals: DECIMALS,
      source,
      fetchedAt: Date.now(),
    },
    source,
    fetchedAt: Date.now(),
  });

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isDogeAddress(address)) {
      return { status: 'error', reason: 'Invalid Dogecoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    // Primary: SoChain confirmed balance (decimal DOGE string).
    try {
      const raw = await readJson(
        `${sochainBaseUrl}/balance/DOGE/${address}`,
        'doge.getBalance',
      );
      if (isRecord(raw) && raw['status'] === 'success') {
        const data = raw['data'];
        if (isRecord(data) && typeof data['confirmed'] === 'string') {
          const koinu = sochainConfirmedToKoinu(data['confirmed']);
          if (koinu !== null) {
            return balanceResult(koinu, SOCHAIN_SOURCE, address);
          }
        }
      }
    } catch {
      // Fall through to BlockCypher below.
    }
    // Fallback: BlockCypher final_balance (koinu).
    let raw: unknown;
    try {
      raw = await readJson(`${baseUrl}/addrs/${address}/balance`, 'doge.getBalance');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const finalBalance = isRecord(raw) ? raw['final_balance'] : undefined;
    if (typeof finalBalance !== 'number') {
      return { status: 'error', reason: 'Invalid response: expected final_balance' };
    }
    return balanceResult(String(Math.trunc(finalBalance)), BLOCKCYPHER_SOURCE, address);
  };

  const unavailable = <T,>(reason: string): AdapterResult<T> => ({
    status: 'unavailable',
    reason,
  });

  const getHistory = async (
    address: string,
    limit = 25,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isDogeAddress(address)) {
      return { status: 'error', reason: 'Invalid Dogecoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    // Primary: SoChain v3 transactions, in + out, merged newest-first.
    // A bad shape falls back to BlockCypher, like the balance does.
    try {
      const [rawIn, rawOut] = await Promise.all([
        readJson(
          `${sochainBaseUrl}/transactions/DOGE/${address}?direction=in`,
          'doge.getHistory',
        ),
        readJson(
          `${sochainBaseUrl}/transactions/DOGE/${address}?direction=out`,
          'doge.getHistory',
        ),
      ]);
      const fromIn = sochainTxs(rawIn);
      const fromOut = sochainTxs(rawOut);
      if (fromIn !== null && fromOut !== null) {
        const txs = [...fromIn, ...fromOut];
        txs.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        return {
          status: 'ok',
          data: txs.slice(0, limit),
          source: SOCHAIN_SOURCE,
          fetchedAt: Date.now(),
        };
      }
    } catch {
      // Fall through to BlockCypher below.
    }
    // Fallback: BlockCypher /full (inputs/outputs per transaction).
    let raw: unknown;
    try {
      raw = await readJson(
        `${baseUrl}/addrs/${address}/full?limit=${limit}`,
        'doge.getHistory',
      );
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const parsed = blockcypherTxs(raw, address);
    if (parsed === null) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a transaction list',
      };
    }
    return {
      status: 'ok',
      data: parsed.slice(0, limit),
      source: BLOCKCYPHER_SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> =>
    unavailable('Fee-quote is not connected for Dogecoin yet.');

  const getTxInputs = async (
    _address: string,
  ): Promise<AdapterResult<TxInput>> =>
    unavailable('Transaction inputs are not connected for Dogecoin yet.');

  const broadcast = async (_signedTx: unknown): Promise<never> => {
    throw new Error(BROADCAST_DISABLED_MESSAGE);
  };

  return {
    chain: 'doge',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
