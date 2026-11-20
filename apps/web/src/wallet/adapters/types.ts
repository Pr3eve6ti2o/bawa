import type { ChainId } from '../../engine/boundary';
import type { BalanceProvider } from '../balance-providers';

/**
 * Shared adapter contract (Fix Lane 2, Phase 2). Adapters are read-only
 * mainnet providers: they take public addresses only and never see a seed,
 * mnemonic, private key or xpub. Chain identity is checked, never inferred
 * from an address prefix. Broadcast is built but DISABLED (see
 * BROADCAST_DISABLED_MESSAGE) until separately authorised.
 */

export type AdapterStatus = 'ok' | 'unavailable' | 'error';

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
  | { kind: 'seqno'; seqno: number };

export const BROADCAST_DISABLED_MESSAGE =
  'Sending is not turned on yet. It needs to be enabled separately.';

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
  /** Built but DISABLED: always throws BROADCAST_DISABLED_MESSAGE. */
  broadcast(signedTx: unknown): Promise<never>;
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

/**
 * Legacy BalanceProvider view of an adapter, for wallet-context's
 * getBalanceProvider path. Ok maps to {value}; unavailable/error throw, so
 * the caller reports them as error (use getAdapter for the full
 * unavailable/error distinction).
 */
export function toBalanceProvider(adapter: ChainAdapter): BalanceProvider {
  return {
    getBalance: async (_chain: ChainId, address: string) => {
      const result = await adapter.getBalance(address);
      if (result.status !== 'ok') {
        throw new Error(result.reason);
      }
      return { value: result.data.valueBaseUnits };
    },
    getHistory: async (_chain: ChainId, address: string) => {
      const result = await adapter.getHistory(address);
      if (result.status !== 'ok') {
        return [];
      }
      return result.data;
    },
  };
}
