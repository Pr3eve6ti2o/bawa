/**
 * Dogecoin adapter (token discovery).
 *
 * Native DOGE balance via BlockCypher's address-balance endpoint
 * (final_balance, satoshis). Chain identity rests on the chain
 * endpoint reporting name 'DOGE' (cached per instance: the endpoint
 * URL is fixed at construction). History, fee-quote and tx inputs are
 * not built — they report unavailable, never faked. Broadcast stays
 * disabled.
 *
 * Rate-limit note (verified live 2026-11-22): BlockCypher's free tier
 * serves these reads, but its per-second limits are not published;
 * a 429 surfaces as an error result through the bounded retry, and the
 * row falls back to "Balance unavailable" — never a fabricated value.
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
import { withRetry } from '../retry';

const NETWORK_ID =
  'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691';
const BASE_URL = 'https://api.blockcypher.com/v1/doge/main';
const SOURCE = 'blockcypher';
const DECIMALS = 8;

export interface DogeAdapterOverrides {
  baseUrl?: string;
  /** Injectable transport; defaults to the single-attempt HTTP transport. */
  transport?: FetchTransport;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const baseUrl = overrides.baseUrl ?? BASE_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  const readJson = (url: string, operation: string): Promise<unknown> =>
    withRetry(() => transport.request(url), { operation });
  let identityChecked = false;

  const requireMainnet = async (): Promise<AdapterResult<never> | null> => {
    if (identityChecked) return null;
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
      assertNetworkId(name, 'DOGE', SOURCE);
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    identityChecked = true;
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    if (!isDogeAddress(address)) {
      return { status: 'error', reason: 'Invalid Dogecoin address' };
    }
    const identity = await requireMainnet();
    if (identity) return identity;
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
    return {
      status: 'ok',
      data: {
        chain: 'doge',
        address,
        networkId: NETWORK_ID,
        valueBaseUnits: String(Math.trunc(finalBalance)),
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
    unavailable('History is not connected for Dogecoin yet.');

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
