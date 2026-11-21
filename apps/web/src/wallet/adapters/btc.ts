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
import { withRetry } from '../retry';

const NETWORK_ID = 'bip122:000000000019d6689c085ae165831e93';
const GENESIS_HASH = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const BASE_URL = 'https://mempool.space/api';
const SOURCE = 'mempool.space';
const DECIMALS = 8;

export interface BtcAdapterOverrides {
  baseUrl?: string;
  /**
   * Injectable transport (item 2). Defaults to the single-attempt HTTP
   * transport; tests inject a fake instead of stubbing the global fetch.
   */
  transport?: FetchTransport;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBtcAddress(address: string): boolean {
  if (address.length < 26) return false;
  return (
    address.startsWith('bc1q') ||
    address.startsWith('bc1p') ||
    address.startsWith('1') ||
    address.startsWith('3')
  );
}

export function createBtcAdapter(
  overrides: BtcAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  // Idempotent reads only: every network read below is bounded-retry via
  // withRetry (item 2). Broadcast is never retried — it stays disabled.
  const readJson = (url: string, operation: string): Promise<unknown> =>
    withRetry(() => transport.request(url), { operation });
  // Chain-identity check result, cached per instance: the genesis block
  // hash proves the endpoint serves Bitcoin mainnet. The endpoint URL is
  // fixed at construction, so one check per instance is enough.
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let raw: unknown;
    try {
      raw = await readJson(`${baseUrl}/v1/blocks/0`, 'btc.identity');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const blocks = Array.isArray(raw) ? raw : [];
    const genesis = isRecord(blocks[0]) ? blocks[0]['id'] : undefined;
    if (typeof genesis !== 'string') {
      return {
        status: 'error',
        reason: 'Network identity check failed: no genesis block returned.',
      };
    }
    try {
      assertNetworkId(genesis, GENESIS_HASH, SOURCE);
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isBtcAddress(address)) {
      return { status: 'error', reason: 'Invalid Bitcoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await readJson(`${baseUrl}/address/${address}`, 'btc.getBalance');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const stats = isRecord(raw) ? raw['chain_stats'] : undefined;
    if (!isRecord(stats)) {
      return { status: 'error', reason: 'Invalid response: expected chain stats' };
    }
    const funded = stats['funded_txo_sum'];
    const spent = stats['spent_txo_sum'];
    if (typeof funded !== 'number' || typeof spent !== 'number') {
      return { status: 'error', reason: 'Invalid response: expected txo sums' };
    }
    // JSON numbers lose precision above Number.MAX_SAFE_INTEGER; fine for a
    // personal wallet, recorded limitation.
    const balance = BigInt(Math.trunc(funded)) - BigInt(Math.trunc(spent));
    return {
      status: 'ok',
      data: {
        chain: 'btc',
        address,
        networkId: NETWORK_ID,
        valueBaseUnits: balance.toString(),
        decimals: DECIMALS,
        source: SOURCE,
        fetchedAt: Date.now(),
      },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const getHistory = async (
    address: string,
    limit = 25,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isBtcAddress(address)) {
      return { status: 'error', reason: 'Invalid Bitcoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await readJson(`${baseUrl}/address/${address}/txs`, 'btc.getHistory');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    if (!Array.isArray(raw)) {
      return { status: 'error', reason: 'Invalid response: expected a transaction list' };
    }
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
        chain: 'btc',
        networkId: NETWORK_ID,
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
        explorerUrl: `https://mempool.space/tx/${txid}`,
      });
    }
    return { status: 'ok', data: txs, source: SOURCE, fetchedAt: Date.now() };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await readJson(`${baseUrl}/v1/fees/recommended`, 'btc.estimateFee');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const fastest = isRecord(raw) ? raw['fastestFee'] : undefined;
    if (typeof fastest !== 'number') {
      return { status: 'error', reason: 'Invalid response: expected a fee rate' };
    }
    return {
      status: 'ok',
      data: {
        chain: 'btc',
        networkId: NETWORK_ID,
        feeBaseUnits: String(Math.trunc(fastest)),
        unit: 'sat/vB',
        note: 'Rate per virtual byte; multiply by tx vsize in Phase 4',
        source: SOURCE,
        fetchedAt: Date.now(),
      },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    if (!isBtcAddress(address)) {
      return { status: 'error', reason: 'Invalid Bitcoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    try {
      raw = await readJson(`${baseUrl}/address/${address}/utxo`, 'btc.getTxInputs');
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    if (!Array.isArray(raw)) {
      return { status: 'error', reason: 'Invalid response: expected a UTXO list' };
    }
    const utxos: { txid: string; vout: number; valueBaseUnits: string }[] = [];
    for (const entry of raw) {
      if (!isRecord(entry)) continue;
      const txid = typeof entry['txid'] === 'string' ? entry['txid'] : '';
      const vout = typeof entry['vout'] === 'number' ? entry['vout'] : -1;
      const value = typeof entry['value'] === 'number' ? entry['value'] : NaN;
      if (!txid || vout < 0 || !Number.isFinite(value)) continue;
      utxos.push({ txid, vout, valueBaseUnits: String(Math.trunc(value)) });
    }
    return {
      status: 'ok',
      data: { kind: 'utxo', utxos },
      source: SOURCE,
      fetchedAt: Date.now(),
    };
  };

  const broadcast = async (_signedTx: unknown): Promise<never> => {
    throw new Error(BROADCAST_DISABLED_MESSAGE);
  };

  return {
    chain: 'btc',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
