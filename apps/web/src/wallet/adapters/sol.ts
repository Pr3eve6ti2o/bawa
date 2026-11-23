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
 * instance). History, fee-quote and tx inputs are not built — they
 * report unavailable, never faked. Broadcast stays disabled.
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    _address: string,
  ): Promise<AdapterResult<AdapterTx[]>> =>
    unavailable('History is not connected for Solana yet.');

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
