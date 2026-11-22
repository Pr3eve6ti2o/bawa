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
 * instance). History, fee-quote and tx inputs are not built — they
 * report unavailable, never faked. Broadcast stays disabled.
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
