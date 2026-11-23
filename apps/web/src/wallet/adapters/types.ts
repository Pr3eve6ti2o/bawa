import type { ChainId } from '../../engine/boundary';
import { BawaError, WalletErrorCodes } from '../errors';

/**
 * Shared adapter contract (Fix Lane 2, Phase 2). Adapters are read-only
 * mainnet providers: they take public addresses only and never see a seed,
 * mnemonic, private key or xpub. Chain identity is checked, never inferred
 * from an address prefix. Broadcast is built but DISABLED (see
 * BROADCAST_DISABLED_MESSAGE) until separately authorised.
 */


export type AdapterResult<T> =
  | { status: 'ok'; data: T; source: string; fetchedAt: number }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

export interface AdapterBalance {
  chain: ChainId;
  address: string;
  networkId: string;
  /** Raw smallest-unit integer as a decimal string; never a float, never fiat. */
  valueBaseUnits: string;
  decimals: number;
  source: string;
  fetchedAt: number;
}

export type TxDirection = 'in' | 'out' | 'self';
export type TxStatus = 'confirmed' | 'pending' | 'failed';

export interface AdapterTx {
  hash: string;
  chain: ChainId;
  networkId: string;
  direction: TxDirection;
  /** Raw smallest-unit integer as a decimal string. */
  amountBaseUnits: string;
  /** The other side of the transfer, or null for self / unknown. */
  counterparty: string | null;
  /** Unix epoch milliseconds, or null when unknown. */
  timestamp: number | null;
  status: TxStatus;
  explorerUrl: string | null;
}

export interface FeeEstimate {
  chain: ChainId;
  networkId: string;
  /** Fee amount in the smallest unit (see `unit`), as a decimal string. */
  feeBaseUnits: string;
  unit: string;
  note: string;
  source: string;
  fetchedAt: number;
}

export interface UtxoInput {
  txid: string;
  vout: number;
  valueBaseUnits: string;
}

/** Transaction-construction inputs for Phase 4. One shape per chain family. */
export type TxInput =
  | { kind: 'utxo'; utxos: UtxoInput[] }
  | { kind: 'nonce'; nonce: number }
  | { kind: 'account'; balanceSun: string }
  | {
      kind: 'seqno';
      seqno: number;
      /**
       * TON wallet contract version the seqno was read for (item 4).
       * Present when the adapter was configured with a version; `send.ts`
       * (P3, item 8) must dispatch on this value instead of assuming V4R2.
       */
      walletVersion?: TonWalletVersion;
    };

/**
 * TON wallet contract versions the adapter understands (item 4, adapter
 * half). V4R2 is the default and the only version `send.ts` pins today;
 * V3R2 and V5R1 are the other versioned contracts in ton-org/ton
 * (`WalletContractV3R2`, `WalletContractV4`, `WalletContractV5R1`).
 * Unknown versions fail loudly at adapter construction — the wallet must
 * never silently disagree with itself about which contract an address
 * belongs to. The send-side dispatch is P3's (item 8); this lane only
 * records the version here and in the adapter.
 */
export type TonWalletVersion = 'v3r2' | 'v4r2' | 'v5r1';

export const TON_WALLET_VERSIONS: readonly TonWalletVersion[] = [
  'v3r2',
  'v4r2',
  'v5r1',
];

export const DEFAULT_TON_WALLET_VERSION: TonWalletVersion = 'v4r2';

/** Returns the version, or throws INVALID_INPUT on an unknown version. */
export function assertTonWalletVersion(version: string): TonWalletVersion {
  if (
    version === 'v3r2' ||
    version === 'v4r2' ||
    version === 'v5r1'
  ) {
    return version;
  }
  throw new BawaError(WalletErrorCodes.INVALID_INPUT, {
    operation: 'ton.version',
  });
}

/**
 * Shared transport interface (item 2, viem V3, small form). One interface
 * plus a registry-free default: http today, ws/fallback tomorrow, without
 * a client-composition rewrite. A transport performs one single-attempt
 * request; retry lives above it in `wallet/retry.ts` (`withRetry`), never
 * inside the transport. Adapters accept an optional `transport` override
 * so tests can inject a fake without stubbing the global `fetch`.
 */
export interface FetchTransport {
  request(url: string, init?: RequestInit, timeoutMs?: number): Promise<unknown>;
}

/** Default transport: one single-attempt `fetchJson` call, no retries. */
export const httpFetchTransport: FetchTransport = {
  request: (url, init, timeoutMs) => fetchJson(url, init, timeoutMs),
};

export const BROADCAST_DISABLED_MESSAGE =
  'Sending funds is switched off until it is separately approved.';

/**
 * What a broadcast returns. Mainnet adapters never return one: their
 * broadcast() always throws BROADCAST_DISABLED_MESSAGE. Devnet adapters
 * (temporary, see wallet/devnet-endpoints.ts) return this on success.
 */
export interface BroadcastResult {
  txHash: string;
  explorerUrl: string | null;
}

export interface ChainAdapter {
  chain: ChainId;
  /** CAIP-2 mainnet network identifier (see chains.ts). */
  networkId: string;
  getBalance(address: string): Promise<AdapterResult<AdapterBalance>>;
  getHistory(
    address: string,
    limit?: number,
  ): Promise<AdapterResult<AdapterTx[]>>;
  estimateFee(): Promise<AdapterResult<FeeEstimate>>;
  getTxInputs(address: string): Promise<AdapterResult<TxInput>>;
  /**
   * Mainnet adapters: built but DISABLED, always throws
   * BROADCAST_DISABLED_MESSAGE. Devnet adapters: broadcasts on the
   * devnet only and returns the transaction hash.
   */
  broadcast(signedTx: unknown): Promise<BroadcastResult>;
}

/**
 * Single-attempt JSON fetch with a timeout. No retries: a failed fetch is
 * reported (unavailable/error), never silently retried or replaced.
 */
export async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Network error: request timed out');
      }
      throw new Error(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new Error('Invalid response: expected JSON');
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Throws naming expected vs actual when the network identity differs. */
export function assertNetworkId(
  actual: string,
  expected: string,
  source: string,
): void {
  if (actual !== expected) {
    throw new Error(
      `Network identity mismatch from ${source}: expected ${expected}, got ${actual}.`,
    );
  }
}

// Single shared error-message helper for adapters and state.
export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
}

export function toAdapterError(
  error: unknown,
): { status: 'error'; reason: string } {
  return { status: 'error', reason: messageOf(error) };
}

/**
 * RPC failover (UI/UX fixes, item 19): tries each endpoint in order
 * for one read and returns the first success with the endpoint that
 * answered. A per-endpoint failure is swallowed and the next endpoint
 * is tried; only when every endpoint fails does the last error surface,
 * so the caller's withRetry can retry the whole sweep. The Solana
 * adapter's per-call primary→fallback is the pattern this generalises.
 * Never returns a partial result.
 */
export async function tryEndpoints<T>(
  endpoints: string[],
  attempt: (endpoint: string) => Promise<T>,
): Promise<{ result: T; endpoint: string }> {
  let lastError: unknown = new Error('No RPC endpoints configured.');
  for (const endpoint of endpoints) {
    try {
      return { result: await attempt(endpoint), endpoint };
    } catch (error: unknown) {
      lastError = error;
    }
  }
  throw lastError;
}

/** An endpoint list, or a resolver that returns the current list. */
export type EndpointList = string[] | (() => string[]);

/** Resolves an EndpointList to the concrete list for this call. */
export function resolveEndpoints(list: EndpointList | undefined, fallback: string[]): string[] {
  if (list === undefined) return [...fallback];
  const resolved = typeof list === 'function' ? list() : list;
  return resolved.length > 0 ? [...resolved] : [...fallback];
}

/** The hostname of an endpoint URL, or the raw string when unparseable. */
export function endpointHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
