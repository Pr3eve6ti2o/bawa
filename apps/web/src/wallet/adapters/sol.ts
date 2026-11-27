/**
 * Solana adapter (token gaps, item 1).
 *
 * Native SOL balance via JSON-RPC getBalance. Primary endpoint is
 * https://solana-rpc.publicnode.com (Lane 1, 2026-11-22: in-page 200,
 * getBalance 2368210 lamports for
 * 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM, re-confirmed at a later
 * slot with the identical value); fallback is
 * https://solana.publicnode.com (same call, same value).
 * api.mainnet-beta.solana.com is RETIRED: it 403s browser requests
 * ("Access forbidden", re-confirmed for getBalance and getHealth).
 * Chain identity rests on getHealth returning 'ok' (cached per
 * instance). History is built on the same RPC: getSignaturesForAddress
 * plus getTransaction (jsonParsed), with direction and amount from the
 * address's pre/post balance delta. Fee-quote is the protocol
 * constant (5,000 lamports per signature); tx inputs are the live
 * recent blockhash via getLatestBlockhash. Broadcast stays disabled.
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
import { withRetry } from '../retry';

const NETWORK_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const PRIMARY_URL = 'https://solana-rpc.publicnode.com';
const FALLBACK_URL = 'https://solana.publicnode.com';
const PRIMARY_SOURCE = 'solana-publicnode';
const FALLBACK_SOURCE = 'solana-publicnode-alt';
const DECIMALS = 9;

/**
 * Base fee: 5,000 lamports per signature (Solana fee docs,
 * `lamports_per_signature`). A legacy transfer carries one signature,
 * so a SOL or SPL send costs 5,000 lamports plus, for a new token
 * account, the rent-exempt minimum — never a priority fee.
 */
export const SOL_LAMPORTS_PER_SIGNATURE = 5000;

/** SPL Token account size in bytes (the Account struct). */
export const SOL_TOKEN_ACCOUNT_SIZE = 165;

/**
 * One JSON-RPC call against the Solana endpoints, with the same sweep
 * as the adapter: endpoints in order, JSON-RPC error objects treated
 * as a failure of that endpoint, withRetry bounding the sweep. Throws
 * on failure — the standalone helpers below surface the reason to
 * their caller, which reports it instead of guessing.
 */
async function solanaRpcCall(
  overrides: SolanaAdapterOverrides,
  method: string,
  params: unknown[],
  operation: string,
): Promise<{ raw: unknown; source: string }> {
  const baseUrl = overrides.baseUrl ?? PRIMARY_URL;
  const fallbackUrl = overrides.fallbackUrl ?? FALLBACK_URL;
  const transport = overrides.transport ?? httpFetchTransport;
  const post = (url: string): Promise<unknown> =>
    transport.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  const labelForEndpoint = (url: string): string => {
    if (url === PRIMARY_URL) return PRIMARY_SOURCE;
    if (url === FALLBACK_URL) return FALLBACK_SOURCE;
    return endpointHost(url);
  };
  const urls = resolveEndpoints(overrides.rpcUrls, [baseUrl, fallbackUrl]);
  return withRetry(
    async () => {
      let lastError: unknown = new Error('No Solana endpoints configured.');
      for (const url of urls) {
        let raw: unknown;
        try {
          raw = await post(url);
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
}

/**
 * True when the address holds an account on Solana (getAccountInfo
 * returns a value). Used by the SPL send path: a missing recipient
 * token account must be created in the same transaction, funded with
 * the rent-exempt minimum. Throws on RPC failure — a missing answer
 * is not proof the account is missing.
 */
export async function fetchSolanaAccountExists(
  address: string,
  overrides: SolanaAdapterOverrides = {},
): Promise<boolean> {
  const { raw } = await solanaRpcCall(
    overrides,
    'getAccountInfo',
    [address],
    'sol.accountExists',
  );
  const result = isRecord(raw) ? raw['result'] : undefined;
  // getAccountInfo returns { context, value: null | account }.
  return (
    isRecord(result) && result['value'] !== null && result['value'] !== undefined
  );
}

/**
 * Rent-exempt minimum in lamports for an account of `bytes` bytes
 * (getMinimumBalanceForRentExemption). A token account is 165 bytes;
 * live 2026-11-24 on PublicNode that is 1,488,440 lamports — the
 * 2,039,280 figure in older SPL docs is stale. Always read live, never
 * hardcode: the number moves as rent parameters change. Throws on RPC
 * failure or an unusable response.
 */
export async function fetchSolanaMinimumBalanceForRentExemption(
  bytes: number,
  overrides: SolanaAdapterOverrides = {},
): Promise<number> {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new Error('Account size must be a non-negative safe integer.');
  }
  const { raw } = await solanaRpcCall(
    overrides,
    'getMinimumBalanceForRentExemption',
    [bytes],
    'sol.rentExemption',
  );
  const value = isRecord(raw) ? raw['result'] : undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'Invalid response: expected a lamport rent-exemption minimum',
    );
  }
  return value;
}

interface SolanaAdapterOverrides {
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

  // Fix-all Lane H, item 12: getBalance/getHistory open identically
  // (address check + mainnet identity + the same RPC-error record
  // shape) — one helper each, so the shape is stated once.
  const checkAddress = async (
    address: string,
  ): Promise<AdapterResult<never> | null> => {
    if (!isSolanaAddress(address)) {
      return { status: 'error', reason: 'Invalid Solana address' };
    }
    return requireMainnet();
  };

  const rpcErrorMessage = (raw: unknown): string | null => {
    if (isRecord(raw) && isRecord(raw['error'])) {
      const message =
        typeof raw['error']['message'] === 'string' ? raw['error']['message'] : 'RPC error';
      return message;
    }
    return null;
  };

  const getBalance = async (
    address: string,
  ): Promise<AdapterResult<AdapterBalance>> => {
    const blocked = await checkAddress(address);
    if (blocked) return blocked;
    let raw: unknown;
    let source = PRIMARY_SOURCE;
    try {
      ({ raw, source } = await rpc('getBalance', [address], 'sol.getBalance'));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const rpcErr = rpcErrorMessage(raw);
    if (rpcErr !== null) return { status: 'error', reason: rpcErr };
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

  const getHistory = async (
    address: string,
    limit = 25,
  ): Promise<AdapterResult<AdapterTx[]>> => {
    const blocked = await checkAddress(address);
    if (blocked) return blocked;
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
    const rpcErr = rpcErrorMessage(raw);
    if (rpcErr !== null) return { status: 'error', reason: rpcErr };
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

  const estimateFee = async (): Promise<AdapterResult<FeeEstimate>> => {
    // The fee is the protocol constant, not an RPC quote: a legacy
    // transaction costs 5,000 lamports per signature and this wallet
    // never adds a priority fee, so a one-signature SOL or SPL send
    // costs exactly 5,000 lamports. getFeeForMessage would return the
    // same number for the built message; quoting the constant keeps
    // the preview honest without building the transaction twice.
    const now = Date.now();
    return {
      status: 'ok',
      data: {
        chain: 'sol',
        networkId: NETWORK_ID,
        feeBaseUnits: String(SOL_LAMPORTS_PER_SIGNATURE),
        unit: 'lamports',
        note: 'Base fee of 5,000 lamports for one signature; no priority fee is added.',
        source: 'solana-protocol',
        fetchedAt: now,
      },
      source: 'solana-protocol',
      fetchedAt: now,
    };
  };

  const getTxInputs = async (
    address: string,
  ): Promise<AdapterResult<TxInput>> => {
    const blocked = await checkAddress(address);
    if (blocked) return blocked;
    let raw: unknown;
    let source = PRIMARY_SOURCE;
    try {
      ({ raw, source } = await rpc(
        'getLatestBlockhash',
        [],
        'sol.getTxInputs',
      ));
    } catch (error: unknown) {
      return toAdapterError(error);
    }
    const rpcErr = rpcErrorMessage(raw);
    if (rpcErr !== null) return { status: 'error', reason: rpcErr };
    const result = isRecord(raw) ? raw['result'] : undefined;
    const value = isRecord(result) ? result['value'] : undefined;
    const blockhash = isRecord(value) ? value['blockhash'] : undefined;
    if (typeof blockhash !== 'string' || blockhash.length === 0) {
      return {
        status: 'error',
        reason: 'Invalid response: expected a recent blockhash',
      };
    }
    return {
      status: 'ok',
      data: { kind: 'blockhash', blockhash },
      source,
      fetchedAt: Date.now(),
    };
  };

  const broadcast = createDisabledBroadcast();

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
