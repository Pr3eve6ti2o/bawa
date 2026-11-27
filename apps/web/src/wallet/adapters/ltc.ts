/**
 * Litecoin adapter (token discovery).
 *
 * Same mempool-API shape as the Bitcoin adapter (adapters/btc.ts):
 * genesis-block identity check, chain_stats balance, tx list history,
 * recommended fee rate, UTXO tx inputs — against litecoinspace, the
 * mempool.space-compatible Litecoin explorer. Broadcast stays disabled.
 */
import {
  createDisabledBroadcast,
  endpointHost,
  httpFetchTransport,
  resolveEndpoints,
  toAdapterError,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type ChainAdapter,
  type EndpointList,
  type FeeEstimate,
  type FetchTransport,
  type TxInput,
} from './types';
import { isRecord } from '../guards';
import {
  balanceResult,
  createMempoolReader,
  feeEstimateResult,
  mempoolHistoryResult,
  parseBlockcypherBalance,
  parseChainStatsBalance,
  readAddressJson,
  utxoInputsResult,
  verifyGenesisBlock,
} from './utxo-shared';

const NETWORK_ID =
  'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2';
const GENESIS_HASH = '12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2';
const BASE_URL = 'https://litecoinspace.org/api';
// BlockCypher is a different API shape (DOGE precedent): balance-only
// fallback, verified live 2026-11-23 — /addrs/{address}/balance returns
// final_balance in litoshi, and the chain endpoint reports name
// 'LTC.main'. History, fees and UTXOs stay mempool-only.
const BLOCKCYPHER_BASE = 'https://api.blockcypher.com/v1/ltc/main';
const BLOCKCYPHER_SOURCE = 'blockcypher';
const DECIMALS = 8;

interface LtcAdapterOverrides {
  baseUrl?: string;
  /**
   * Ordered mempool-shaped base URLs, or a resolver re-read on every
   * call (the RPC manager). Defaults to [baseUrl].
   */
  baseUrls?: EndpointList;
  /** BlockCypher base URL (balance fallback). */
  blockcypherBaseUrl?: string;
  /**
   * Injectable transport (item 2). Defaults to the single-attempt HTTP
   * transport; tests inject a fake instead of stubbing the global fetch.
   */
  transport?: FetchTransport;
}


function isLtcAddress(address: string): boolean {
  if (address.length < 26) return false;
  return (
    address.startsWith('ltc1q') ||
    address.startsWith('ltc1p') ||
    address.startsWith('L') ||
    address.startsWith('M')
  );
}

export function createLtcAdapter(
  overrides: LtcAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  const blockcypherBaseUrl = overrides.blockcypherBaseUrl ?? BLOCKCYPHER_BASE;
  // RPC failover (UI/UX fixes, item 19): every mempool-shaped read
  // sweeps the endpoint list in order (SOL pattern), one withRetry
  // around the whole sweep. BlockCypher is the balance-only fallback
  // when the mempool list is exhausted.
  const resolveBaseUrls = (): string[] =>
    resolveEndpoints(overrides.baseUrls, [baseUrl]);
  const readJsonFrom = createMempoolReader(transport, resolveBaseUrls);
  // Chain-identity check result, cached per instance: the genesis block
  // hash proves the endpoint serves Litecoin mainnet. The endpoint URL is
  // fixed at construction, so one check per instance is enough.
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let mempoolError: AdapterResult<never> | null = null;
    try {
      // /blocks/0 is the Esplora path every mempool instance serves
      // (the old /v1/blocks/0 is mempool-only).
      const { raw, endpoint } = await readJsonFrom(
        (base) => `${base}/blocks/0`,
        'ltc.identity',
      );
      const verified = verifyGenesisBlock(raw, endpoint, GENESIS_HASH);
      if (verified) {
        // A wrong genesis is a chain mismatch, not a transient failure:
        // fail closed, never fall back to BlockCypher for identity.
        return verified;
      }
      identityChecked = true;
      return null;
    } catch (error: unknown) {
      mempoolError = toAdapterError(error);
    }
    // Mempool list exhausted: BlockCypher's chain endpoint must report
    // name 'LTC.main'. A failure here reports the mempool error — the
    // primary failure is the one the owner needs to see.
    try {
      const raw = await transport.request(blockcypherBaseUrl);
      const name = isRecord(raw) ? raw['name'] : undefined;
      if (name !== 'LTC.main') {
        return {
          status: 'error',
          reason:
            'Network identity check failed: BlockCypher did not report LTC.main.',
        };
      }
    } catch {
      return mempoolError;
    }
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isLtcAddress(address)) {
      return { status: 'error', reason: 'Invalid Litecoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    try {
      const { raw, endpoint } = await readJsonFrom(
        (base) => `${base}/address/${address}`,
        'ltc.getBalance',
      );
      const parsed = parseChainStatsBalance(raw);
      if (!parsed.ok) {
        return { status: 'error', reason: parsed.reason };
      }
      return balanceResult(
        'ltc',
        NETWORK_ID,
        DECIMALS,
        parsed.balance.toString(),
        endpointHost(endpoint),
        address,
      );
    } catch {
      // Mempool list exhausted: BlockCypher balance (final_balance).
    }
    let raw: unknown;
    try {
      raw = await transport.request(
        `${blockcypherBaseUrl}/addrs/${address}/balance`,
      );
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const finalBalance = parseBlockcypherBalance(raw);
    if (finalBalance === undefined) {
      return { status: 'error', reason: 'Invalid response: expected final_balance' };
    }
    return balanceResult(
      'ltc',
      NETWORK_ID,
      DECIMALS,
      String(Math.trunc(finalBalance)),
      BLOCKCYPHER_SOURCE,
      address,
    );
  };

  const getHistory = async (
    address: string,
    limit = 25,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    const read = await readAddressJson(
      isLtcAddress(address),
      'Invalid Litecoin address',
      requireMainnet,
      readJsonFrom,
      (base) => `${base}/address/${address}/txs`,
      'ltc.getHistory',
      BASE_URL,
    );
    if (!read.ok) return read.result;
    const { raw, endpoint } = read;
    return mempoolHistoryResult(
      raw,
      {
        chain: 'ltc',
        networkId: NETWORK_ID,
        explorerBaseUrl: 'https://litecoinspace.org',
        address,
        limit,
      },
      endpoint,
    );
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/v1/fees/recommended`,
        'ltc.estimateFee',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const fastest = isRecord(raw) ? raw['fastestFee'] : undefined;
    if (typeof fastest !== 'number') {
      return { status: 'error', reason: 'Invalid response: expected a fee rate' };
    }
    return feeEstimateResult(
      'ltc',
      NETWORK_ID,
      String(Math.trunc(fastest)),
      'sat/vB',
      'Rate per virtual byte; multiply by tx vsize in Phase 4',
      endpoint,
    );
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    const read = await readAddressJson(
      isLtcAddress(address),
      'Invalid Litecoin address',
      requireMainnet,
      readJsonFrom,
      (base) => `${base}/address/${address}/utxo`,
      'ltc.getTxInputs',
      BASE_URL,
    );
    if (!read.ok) return read.result;
    return utxoInputsResult(read.raw, read.endpoint);
  };

  const broadcast = createDisabledBroadcast();

  return {
    chain: 'ltc',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
