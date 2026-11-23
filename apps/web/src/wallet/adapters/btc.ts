import {
  BROADCAST_DISABLED_MESSAGE,
  assertNetworkId,
  endpointHost,
  httpFetchTransport,
  messageOf,
  resolveEndpoints,
  toAdapterError,
  tryEndpoints,
  type AdapterBalance,
  type AdapterResult,
  type AdapterTx,
  type BroadcastResult,
  type ChainAdapter,
  type EndpointList,
  type FeeEstimate,
  type FetchTransport,
  type TxInput,
} from './types';
import { isRecord } from '../guards';
import { withRetry } from '../retry';

const NETWORK_ID = 'bip122:000000000019d6689c085ae165831e93';
const GENESIS_HASH = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const BASE_URL = 'https://mempool.space/api';
// Esplora-shaped backup, verified live 2026-11-23: /blocks/0 returns the
// mainnet genesis hash, /address/ returns chain_stats, /fee-estimates
// returns the per-target sat/vB map. It has no /v1/fees/recommended
// (mempool-only), so the fee read shape-falls-back per endpoint.
const FALLBACK_URL = 'https://blockstream.info/api';
const DECIMALS = 8;

export interface BtcAdapterOverrides {
  baseUrl?: string;
  /**
   * Ordered Esplora-shaped base URLs, or a resolver re-read on every
   * call (the RPC manager). Defaults to [baseUrl, blockstream] on
   * mainnet, [baseUrl] when a baseUrl override is given (devnet).
   */
  baseUrls?: EndpointList;
  /**
   * Injectable transport (item 2). Defaults to the single-attempt HTTP
   * transport; tests inject a fake instead of stubbing the global fetch.
   */
  transport?: FetchTransport;
  /**
   * Devnet overrides (temporary devnet mode): the network id, the
   * genesis hash the identity check pins, the explorer base, whether
   * testnet address forms are accepted, and the devnet broadcast.
   * Unset, the adapter is the mainnet adapter exactly as before.
   */
  networkId?: string;
  genesisHash?: string;
  explorerBaseUrl?: string;
  acceptTestnetAddresses?: boolean;
  broadcast?: (signedTx: unknown) => Promise<BroadcastResult>;
}



function isBtcAddress(address: string, acceptTestnet = false): boolean {
  if (address.length < 26) return false;
  if (acceptTestnet) {
    return (
      address.startsWith('tb1q') ||
      address.startsWith('tb1p') ||
      address.startsWith('m') ||
      address.startsWith('n') ||
      address.startsWith('2')
    );
  }
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
  // Devnet overrides default to the mainnet values, so a mainnet
  // adapter constructed without them is byte-for-byte the old one.
  const networkId = overrides.networkId ?? NETWORK_ID;
  const genesisHash = overrides.genesisHash ?? GENESIS_HASH;
  const explorerBaseUrl = overrides.explorerBaseUrl ?? 'https://mempool.space';
  const acceptTestnet = overrides.acceptTestnetAddresses ?? false;
  // RPC failover (UI/UX fixes, item 19): every read sweeps the endpoint
  // list in order (SOL pattern). The sweep itself is a raw transport
  // call per endpoint — no per-endpoint retry — and one withRetry wraps
  // the whole sweep, so a dead primary costs one attempt, not three.
  const defaultBaseUrls =
    overrides.baseUrl !== undefined ? [baseUrl] : [BASE_URL, FALLBACK_URL];
  const resolveBaseUrls = (): string[] =>
    overrides.baseUrls !== undefined
      ? resolveEndpoints(overrides.baseUrls, defaultBaseUrls)
      : [...defaultBaseUrls];
  const readJsonFrom = (
    urlFor: (base: string) => string,
    operation: string,
  ): Promise<{ raw: unknown; endpoint: string }> =>
    withRetry(
      () =>
        tryEndpoints(resolveBaseUrls(), (base) =>
          transport.request(urlFor(base)),
        ),
      { operation },
    ).then(({ result, endpoint }) => ({ raw: result, endpoint }));
  // Chain-identity check result, cached per instance: the genesis block
  // hash proves the endpoint serves the pinned network. The endpoint URL
  // is fixed at construction, so one check per instance is enough.
  let identityChecked = false;

  const requireNetwork = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      // /blocks/0 is the Esplora path both mempool.space and
      // blockstream.info serve (the old /v1/blocks/0 is mempool-only).
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/blocks/0`,
        'btc.identity',
      ));
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
      assertNetworkId(genesis, genesisHash, endpointHost(endpoint));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isBtcAddress(address, acceptTestnet)) {
      return { status: 'error', reason: 'Invalid Bitcoin address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/address/${address}`,
        'btc.getBalance',
      ));
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
    const source = endpointHost(endpoint);
    return {
      status: 'ok',
      data: {
        chain: 'btc',
        address,
        networkId,
        valueBaseUnits: balance.toString(),
        decimals: DECIMALS,
        source,
        fetchedAt: Date.now(),
      },
      source,
      fetchedAt: Date.now(),
    };
  };

  const getHistory = async (
    address: string,
    limit = 25,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isBtcAddress(address, acceptTestnet)) {
      return { status: 'error', reason: 'Invalid Bitcoin address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/address/${address}/txs`,
        'btc.getHistory',
      ));
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
    return { status: 'ok', data: txs, source: endpointHost(endpoint), fetchedAt: Date.now() };
  };

  /**
   * Fee rate for one endpoint: mempool's /v1/fees/recommended first,
   * Esplora's /fee-estimates map second (blockstream has no /v1 path —
   * a 404 there is a shape miss, not a failure). Any other error
   * aborts this endpoint so the sweep can try the next one.
   */
  const readFeeFor = async (base: string): Promise<number> => {
    try {
      const raw = await transport.request(`${base}/v1/fees/recommended`);
      const fastest = isRecord(raw) ? raw['fastestFee'] : undefined;
      if (typeof fastest === 'number') return Math.trunc(fastest);
    } catch (error: unknown) {
      if (messageOf(error) !== 'HTTP 404') throw error;
    }
    const raw = await transport.request(`${base}/fee-estimates`);
    const one = isRecord(raw) ? raw['1'] : undefined;
    if (typeof one === 'number' && Number.isFinite(one)) {
      return Math.max(1, Math.ceil(one));
    }
    throw new Error('Invalid response: expected a fee rate');
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    const identity = await requireNetwork();
    if (identity) return identity;
    let fee: number;
    let endpoint = BASE_URL;
    try {
      ({ result: fee, endpoint } = await withRetry(
        () => tryEndpoints(resolveBaseUrls(), readFeeFor),
        { operation: 'btc.estimateFee' },
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const source = endpointHost(endpoint);
    return {
      status: 'ok',
      data: {
        chain: 'btc',
        networkId,
        feeBaseUnits: String(fee),
        unit: 'sat/vB',
        note: 'Rate per virtual byte; multiply by tx vsize in Phase 4',
        source,
        fetchedAt: Date.now(),
      },
      source,
      fetchedAt: Date.now(),
    };
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    if (!isBtcAddress(address, acceptTestnet)) {
      return { status: 'error', reason: 'Invalid Bitcoin address' };
    }
    const identity = await requireNetwork();
    if (identity) return identity;
    let raw: unknown;
    let endpoint = BASE_URL;
    try {
      ({ raw, endpoint } = await readJsonFrom(
        (base) => `${base}/address/${address}/utxo`,
        'btc.getTxInputs',
      ));
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
      source: endpointHost(endpoint),
      fetchedAt: Date.now(),
    };
  };

  // Mainnet: always throws. Devnet: the injected devnet broadcast.
  const broadcast: ChainAdapter['broadcast'] =
    overrides.broadcast ??
    (async (_signedTx: unknown): Promise<never> => {
      throw new Error(BROADCAST_DISABLED_MESSAGE);
    });

  return {
    chain: 'btc',
    networkId,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
