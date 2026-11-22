/**
 * Solana adapter (token discovery).
 *
 * Native SOL balance via JSON-RPC getBalance on the pinned mainnet
 * endpoint. Chain identity rests on getHealth returning 'ok' (cached
 * per instance: the endpoint URL is fixed at construction). History,
 * fee-quote and tx inputs are not built — they report unavailable,
 * never faked. Broadcast stays disabled.
 */
import {
  BROADCAST_DISABLED_MESSAGE,
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

const NETWORK_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const BASE_URL = 'https://api.mainnet-beta.solana.com';
const SOURCE = 'solana-mainnet-beta';
const DECIMALS = 9;

export interface SolanaAdapterOverrides {
  baseUrl?: string;
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
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  const rpc = (method: string, params: unknown[], operation: string): Promise<unknown> =>
    withRetry(
      () =>
        transport.request(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        }),
      { operation },
    );
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
    let raw: unknown;
    try {
      raw = await rpc('getHealth', [], 'sol.identity');
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
    try {
      raw = await rpc('getBalance', [address], 'sol.getBalance');
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
        source: SOURCE,
        fetchedAt: Date.now(),
      },
      source: SOURCE,
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
