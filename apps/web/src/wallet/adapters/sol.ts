/**
 * Solana adapter (token gaps, item 1).
 *
 * Native SOL balance via JSON-RPC getBalance. Primary endpoint is
 * https://solana-rpc.publicnode.com (Lane 1, 2026-11-22: in-page 200,
 * getBalance 2368210 lamports for
 * 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM, re-confirmed at a later
 * slot with the identical value); fallback is
 * https://public.rpc.solanavibestation.com (same call, same value).
 * api.mainnet-beta.solana.com is RETIRED: it 403s browser requests
 * ("Access forbidden", re-confirmed for getBalance and getHealth).
 * Chain identity rests on getHealth returning 'ok' (cached per
 * instance). History is built on the same RPC: getSignaturesForAddress
 * plus getTransaction (jsonParsed), with direction and amount from the
 * address's pre/post balance delta. Fee-quote and tx inputs are not
 * built — they report unavailable, never faked. Broadcast stays
 * disabled.
 */
import {
  BROADCAST_DISABLED_MESSAGE,
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
import { withRetry } from '../retry';

const NETWORK_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const PRIMARY_URL = 'https://solana-rpc.publicnode.com';
const FALLBACK_URL = 'https://public.rpc.solanavibestation.com';
const PRIMARY_SOURCE = 'solana-publicnode';
const FALLBACK_SOURCE = 'solana-vibe-station';
const DECIMALS = 9;

export interface SolanaAdapterOverrides {
  baseUrl?: string;
  fallbackUrl?: string;
  /**
   * Ordered RPC list, or a resolver re-read on every call (the RPC
   * manager). Defaults to [baseUrl, fallbackUrl].
   */
  rpcUrls?: EndpointList;
  /** Injectable transport; defaults to the single-attempt HTTP transport. */
  transport?: FetchTransport;
}


const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function isSolanaAddress(address: string): boolean {
  return (
    address.length >= 32 &&
    address.length <= 44 &&
    [...address].every((ch) => BASE58_ALPHABET.includes(ch))
  );
}

/**
 * Parse one getTransaction (jsonParsed) result into an AdapterTx.
 * Direction and amount come from the address's pre/post balance delta
 * in the transaction's meta — the only per-address amounts the RPC
 * reports. Returns null when the shape is unusable (a skipped entry,
 * never a faked one).
 */
function solTx(
  raw: unknown,
  address: string,
  signature: string,
  signatureBlockTime: number,
): AdapterTx | null {
  if (!isRecord(raw) || isRecord(raw['error'])) return null;
  const result = isRecord(raw['result']) ? raw['result'] : null;
  if (result === null) return null;
  const meta = isRecord(result['meta']) ? result['meta'] : null;
  const transaction = isRecord(result['transaction'])
    ? result['transaction']
    : null;
  const message =
    transaction !== null && isRecord(transaction['message'])
      ? transaction['message']
      : null;
  const accountKeys =
    message !== null && Array.isArray(message['accountKeys'])
      ? message['accountKeys']
      : null;
  if (meta === null || accountKeys === null) return null;
  const preBalances = Array.isArray(meta['preBalances'])
    ? meta['preBalances']
    : null;
  const postBalances = Array.isArray(meta['postBalances'])
    ? meta['postBalances']
    : null;
  if (preBalances === null || postBalances === null) return null;
  const index = accountKeys.findIndex((key) => {
    if (typeof key === 'string') return key === address;
    return isRecord(key) && key['pubkey'] === address;
  });
  if (index === -1) return null;
  const pre = preBalances[index];
  const post = postBalances[index];
  if (typeof pre !== 'number' || typeof post !== 'number') return null;
  const delta = BigInt(Math.trunc(post)) - BigInt(Math.trunc(pre));
  const failed = meta['err'] !== null && meta['err'] !== undefined;
  const blockTime =
    typeof result['blockTime'] === 'number'
      ? result['blockTime']
      : signatureBlockTime;
  return {
    hash: signature,
    chain: 'sol',
    networkId: NETWORK_ID,
    direction: delta > 0n ? 'in' : delta < 0n ? 'out' : 'self',
    amountBaseUnits: (delta < 0n ? -delta : delta).toString(),
    counterparty: null,
    timestamp: Number.isFinite(blockTime) ? blockTime * 1000 : null,
    status: failed ? 'failed' : 'confirmed',
    explorerUrl: `https://explorer.solana.com/tx/${signature}`,
  };
}

export function createSolanaAdapter(
  overrides: SolanaAdapterOverrides = {},
): ChainAdapter {
  const baseUrl = overrides.baseUrl ?? PRIMARY_URL;
  const fallbackUrl = overrides.fallbackUrl ?? FALLBACK_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  const post = (url: string, method: string, params: unknown[]): Promise<unknown> =>
    transport.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  // Each RPC call tries the endpoints in order — on a transport
  // failure or a JSON-RPC error object — and reports the endpoint that
  // answered (UI/UX fixes, item 19: the list is resolver-supplied, so
  // the RPC manager's list applies without rebuilding the adapter).
  // The withRetry wrapper still bounds the whole sweep.
  const labelForEndpoint = (url: string): string => {
    if (url === PRIMARY_URL) return PRIMARY_SOURCE;
    if (url === FALLBACK_URL) return FALLBACK_SOURCE;
    return endpointHost(url);
  };
  const resolveRpcUrls = (): string[] =>
    resolveEndpoints(overrides.rpcUrls, [baseUrl, fallbackUrl]);
  const rpc = (
    method: string,
    params: unknown[],
    operation: string,
  ): Promise<{ raw: unknown; source: string }> =>
    withRetry(
      async () => {
        let lastError: unknown = new Error('No Solana endpoints configured.');
        for (const url of resolveRpcUrls()) {
          let raw: unknown;
          try {
            raw = await post(url, method, params);
          } catch (error: unknown) {
            lastError = error;
            continue;
          }
          if (isRecord(raw) && isRecord(raw['error'])) {
            lastError = new Error(
              typeof raw['error']['message'] === 'string'
                ? raw['error']['message']
                : 'RPC error',
            );
            continue;
          }
          return { raw, source: labelForEndpoint(url) };
        }
        throw lastError;
      },
      { operation },
    );
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let raw: unknown;
    try {
      ({ raw } = await rpc('getHealth', [], 'sol.identity'));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    if (!isRecord(raw) || raw['result'] !== 'ok') {
      const message =
        isRecord(raw) && isRecord(raw['error']) && typeof raw['error']['message'] === 'string'
          ? raw['error']['message']
          : 'Solana getHealth did not return ok.';
      return { status: 'error', reason: `Network identity check failed: ${message}` };
    }
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isSolanaAddress(address)) {
      return { status: 'error', reason: 'Invalid Solana address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    let source = PRIMARY_SOURCE;
    try {
      ({ raw, source } = await rpc('getBalance', [address], 'sol.getBalance'));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    if (isRecord(raw) && isRecord(raw['error'])) {
      const message =
        typeof raw['error']['message'] === 'string' ? raw['error']['message'] : 'RPC error';
      return { status: 'error', reason: message };
    }
    const result = isRecord(raw) ? raw['result'] : undefined;
    const value = isRecord(result) ? result['value'] : undefined;
    if (typeof value !== 'number' && typeof value !== 'string') {
      return { status: 'error', reason: 'Invalid response: expected a lamport balance' };
    }
    return {
      status: 'ok',
      data: {
        chain: 'sol',
        address,
        networkId: NETWORK_ID,
        valueBaseUnits: String(value),
        decimals: DECIMALS,
        source,
        fetchedAt: Date.now(),
      },
      source,
      fetchedAt: Date.now(),
    };
  };

  const unavailable = <T,>(reason: string): AdapterResult<T> => ({
    status: 'unavailable',
    reason,
  });

  const getHistory = async (
    address: string,
    limit = 25,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    if (!isSolanaAddress(address)) {
      return { status: 'error', reason: 'Invalid Solana address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
    let raw: unknown;
    let source = PRIMARY_SOURCE;
    try {
      ({ raw, source } = await rpc(
        'getSignaturesForAddress',
        [address, { limit }],
        'sol.getHistory',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    if (isRecord(raw) && isRecord(raw['error'])) {
      const message =
        typeof raw['error']['message'] === 'string'
          ? raw['error']['message']
          : 'RPC error';
      return { status: 'error', reason: message };
    }
    const signatures =
      isRecord(raw) && Array.isArray(raw['result']) ? raw['result'] : null;
    if (signatures === null) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a signature list',
      };
    }
    // The RPC returns newest first; that order is kept. One unreadable
    // transaction must not hide the rest, so failures are skipped.
    const txs: AdapterTx[] = [];
    for (const entry of signatures) {
      if (!isRecord(entry)) continue;
      const signature =
        typeof entry['signature'] === 'string' ? entry['signature'] : '';
      if (signature === '') continue;
      const blockTime =
        typeof entry['blockTime'] === 'number' ? entry['blockTime'] : NaN;
      let txRaw: unknown;
      try {
        ({ raw: txRaw } = await rpc(
          'getTransaction',
          [
            signature,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
          ],
          'sol.getHistory',
        ));
      } catch {
        continue;
      }
      const parsed = solTx(txRaw, address, signature, blockTime);
      if (parsed !== null) txs.push(parsed);
    }
    return { status: 'ok', data: txs, source, fetchedAt: Date.now() };
  };

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> =>
    unavailable('Fee-quote is not connected for Solana yet.');

  const getTxInputs = async (
    _address: string,
  ): Promise<AdapterResult<TxInput>> =>
    unavailable('Transaction inputs are not connected for Solana yet.');

  const broadcast = async (_signedTx: unknown): Promise<never> => {
    throw new Error(BROADCAST_DISABLED_MESSAGE);
  };

  return {
    chain: 'sol',
    networkId: NETWORK_ID,
    getBalance,
    getHistory,
    estimateFee,
    getTxInputs,
    broadcast,
  };
}
