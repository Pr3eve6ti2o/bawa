// Refresh state machine for the web wallet (repo-study Phase 3, item 28).
//
// This module owns the balance/history refresh path that used to live
// inside state/wallet-context.tsx: per-chain adapter reads, request
// coalescing, last-good retention and sanitised failure reporting.
//
// - Safe reads only. Nothing here signs, builds or broadcasts a
//   transaction; broadcast stays disabled by standing owner order.
// - A failed refresh never throws to the caller. refreshBalances /
//   refreshHistory resolve with a RefreshReport listing every chain
//   that failed (operation, chain, attempts, exhausted, sanitised
//   reason). The wallet context stores the latest report in state, so
//   the failure is visible instead of swallowed by an empty catch.
// - Last-good retention: when an adapter read fails after a previous
//   success, the previous value (balances) / transactions (history)
//   and its lastOkAt are kept, and the status becomes error/unavailable
//   with the new reason. A failure is never presented as zero/empty.
// - Retry: Lane P1 owns apps/web/src/wallet/retry.ts (withRetry +
//   classifyRetryableError). Until it lands, this module carries its
//   own small retry loop (retryResult / retryThrowing below) with the
//   SAME semantics as P1's actual module (verified 2026-11-20 against
//   P1's retry.ts: 224 lines): max 3 attempts, 30 s total budget,
//   200 ms base delay doubling with full jitter, 5 s cap, retryable =
//   `Network error:` prefix or exact `HTTP 429|502|503|504`, terminal =
//   everything else, never attempt once the budget is spent (the delay
//   must fit inside it). At merge, delete the local loop and import
//   withRetry + classifyRetryableError from '../wallet/retry', passing
//   operation 'refreshBalances' / 'refreshHistory' (required there).
//   Two deltas remain for the merge: (1) P1 honours Retry-After only
//   for BawaError 2003 throws, which never surface as adapter-result
//   reason strings — the swap must throw adapter failures to get it;
//   (2) P1 reports via onEvent / setDefaultRetryEventListener, while
//   this loop reports attempts/exhausted in the RefreshReport only.
//   (Coordinator: verify the import against P1's actual module.)
// - Coalescing: a second refresh for the same addresses while one is
//   in flight joins the in-flight promise instead of starting a
//   second fetch. A refresh for different addresses starts fresh, and
//   the per-chain request counters drop the old fetch's late answers.
import type { ChainId } from '@bawa/contracts';
import type {
  AdapterBalance,
  AdapterResult,
  AdapterTx,
} from '../wallet/adapters/types';
import { availableFor } from '../wallet/chains';

export type BalanceStatus = 'loading' | 'zero' | 'available' | 'unavailable' | 'error';

export interface BalanceState {
  status: BalanceStatus;
  /** Raw native balance as a decimal string, when a provider returned one. */
  value?: string;
  /** Short machine-readable reason for unavailable/error (e.g. no-adapter). */
  reason?: string;
  /** Epoch ms of the last successful adapter read, if any. */
  lastOkAt?: number;
}

export type HistoryStatus = 'loading' | 'loaded' | 'empty' | 'unavailable' | 'error';

export interface HistoryState {
  status: HistoryStatus;
  txs: AdapterTx[];
  reason?: string;
  /** Epoch ms of the last successful adapter read, if any. */
  lastOkAt?: number;
}

export type RefreshOperation = 'refresh-balances' | 'refresh-history';

export interface RefreshFailure {
  operation: RefreshOperation;
  chain: ChainId;
  attempts: number;
  /** True when the retry budget/attempts ran out; false for a terminal refusal. */
  exhausted: boolean;
  /** Sanitised machine-readable code; never a raw error message. */
  reason: string;
}

export interface RefreshReport {
  operation: RefreshOperation;
  failures: RefreshFailure[];
  /** Epoch ms the refresh ran. */
  at: number;
}

const CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton'];

// Lazy adapter loading: the adapter chunk (viem + adapters, ~3 MB) must not
// load before first paint. First caller imports it and registers the
// adapters once; concurrent callers share the promise. A rejected import
// clears the cache so a later call retries. Exported for the send screen,
// which also reads adapters but loads after the wallet context.
let adaptersPromise: Promise<typeof import('../wallet/adapters')> | null = null;

export function ensureAdapters(): Promise<typeof import('../wallet/adapters')> {
  if (adaptersPromise) return adaptersPromise;
  const promise = import('../wallet/adapters').then((adapters) => {
    adapters.registerAllAdapters();
    return adapters;
  });
  adaptersPromise = promise;
  void promise.catch(() => {
    if (adaptersPromise === promise) adaptersPromise = null;
  });
  return promise;
}

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_TOTAL_BUDGET_MS = 30000;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 5000;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** P1's message-based classification, mirrored until retry.ts lands. */
function isRetryableMessage(message: string): boolean {
  return (
    message.startsWith('Network error:') ||
    /^HTTP (?:429|502|503|504)$/.test(message)
  );
}

/** Map a raw error message to a sanitised code (no addresses, URLs or payloads). */
function sanitiseReason(message: string): string {
  if (message.startsWith('Network error:')) {
    return message.includes('timed out') ? 'timeout' : 'network';
  }
  const http = /^HTTP (\d{3})/.exec(message);
  if (http) {
    switch (http[1]) {
      case '429':
        return 'rate-limited';
      case '404':
        return 'not-found';
      case '400':
        return 'bad-request';
      case '502':
      case '503':
      case '504':
        return 'provider-unavailable';
      default:
        return 'provider';
    }
  }
  if (message.startsWith('Invalid response:')) return 'invalid-response';
  if (message.startsWith('Invalid ') && message.includes('address')) return 'invalid-address';
  if (message.startsWith('Network identity mismatch')) return 'network-mismatch';
  return 'unknown';
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Jittered backoff before attempt n+1 (n is the attempt just failed, 1-based). */
function delayMsForAttempt(attempt: number): number {
  return (
    Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)) *
    Math.random()
  );
}

type RetryOutcome<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: unknown; attempts: number; exhausted: boolean };

/** Retry a throwing read; never throws — the outcome carries the last failure. */
async function retryThrowing<T>(
  fn: (attempt: number) => Promise<T>,
): Promise<RetryOutcome<T>> {
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    try {
      const value = await fn(attempt);
      return { ok: true, value, attempts: attempt };
    } catch (error) {
      if (!isRetryableMessage(messageOf(error))) {
        return { ok: false, error, attempts: attempt, exhausted: false };
      }
      if (
        attempt >= RETRY_MAX_ATTEMPTS ||
        Date.now() - startedAt >= RETRY_TOTAL_BUDGET_MS
      ) {
        return { ok: false, error, attempts: attempt, exhausted: true };
      }
      // Never attempt once the budget is spent: the delay must fit
      // inside what is left, exactly as P1's withRetry does.
      const delayMs = delayMsForAttempt(attempt);
      if (Date.now() - startedAt + delayMs > RETRY_TOTAL_BUDGET_MS) {
        return { ok: false, error, attempts: attempt, exhausted: true };
      }
      await sleep(delayMs);
      if (Date.now() - startedAt >= RETRY_TOTAL_BUDGET_MS) {
        return { ok: false, error, attempts: attempt, exhausted: true };
      }
    }
  }
}

/**
 * Retry an adapter read while it returns a retryable error. 'unavailable'
 * is structural, never retried; 'ok' ends the loop at once.
 */
async function retryResult<T>(
  fn: (attempt: number) => Promise<AdapterResult<T>>,
): Promise<{
  result: AdapterResult<T>;
  attempts: number;
  exhausted: boolean;
}> {
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    const result = await fn(attempt);
    if (result.status !== 'error' || !isRetryableMessage(result.reason)) {
      return { result, attempts: attempt, exhausted: false };
    }
    if (
      attempt >= RETRY_MAX_ATTEMPTS ||
      Date.now() - startedAt >= RETRY_TOTAL_BUDGET_MS
    ) {
      return { result, attempts: attempt, exhausted: true };
    }
    // Never attempt once the budget is spent: the delay must fit
    // inside what is left, exactly as P1's withRetry does.
    const delayMs = delayMsForAttempt(attempt);
    if (Date.now() - startedAt + delayMs > RETRY_TOTAL_BUDGET_MS) {
      return { result, attempts: attempt, exhausted: true };
    }
    await sleep(delayMs);
    if (Date.now() - startedAt >= RETRY_TOTAL_BUDGET_MS) {
      return { result, attempts: attempt, exhausted: true };
    }
  }
}

export interface RefreshDeps {
  /** Vault-derived address, else first watch-only derived address, per chain. */
  getAddress(chain: ChainId): string | undefined;
  getBalance(chain: ChainId): BalanceState;
  getHistory(chain: ChainId): HistoryState;
  setBalance(chain: ChainId, state: BalanceState): void;
  setHistory(chain: ChainId, state: HistoryState): void;
}

export function createRefresh(deps: RefreshDeps): {
  refreshBalances(): Promise<RefreshReport>;
  refreshHistory(): Promise<RefreshReport>;
} {
  const balanceRequests: Record<ChainId, number> = { btc: 0, eth: 0, trx: 0, ton: 0 };
  const historyRequests: Record<ChainId, number> = { btc: 0, eth: 0, trx: 0, ton: 0 };
  const inflight: {
    balances?: { key: string; promise: Promise<RefreshReport> };
    history?: { key: string; promise: Promise<RefreshReport> };
  } = {};

  function addressKey(): string {
    return CHAINS.map((chain) => deps.getAddress(chain) ?? '').join('|');
  }

  function joinInflight(
    kind: 'balances' | 'history',
    key: string,
    run: () => Promise<RefreshReport>,
  ): Promise<RefreshReport> {
    const current = inflight[kind];
    if (current && current.key === key) return current.promise;
    const promise = run();
    inflight[kind] = { key, promise };
    return promise.finally(() => {
      if (inflight[kind]?.promise === promise) delete inflight[kind];
    });
  }

  async function runRefreshBalances(): Promise<RefreshReport> {
    const at = Date.now();
    const failures: RefreshFailure[] = [];
    const loaded = await retryThrowing(() => ensureAdapters());
    if (!loaded.ok) {
      // The chunk itself failed to load: no chain could be read. The
      // per-chain state is left untouched; the report is the outcome.
      for (const chain of CHAINS) {
        failures.push({
          operation: 'refresh-balances',
          chain,
          attempts: loaded.attempts,
          exhausted: loaded.exhausted,
          reason: 'adapter-load-failed',
        });
      }
      return { operation: 'refresh-balances', failures, at };
    }
    const { getAdapter } = loaded.value;
    await Promise.all(
      CHAINS.map(async (chain) => {
        const request = ++balanceRequests[chain];
        const setBalance = (state: BalanceState) => {
          if (request !== balanceRequests[chain]) return;
          deps.setBalance(chain, state);
        };
        if (!availableFor('balance').includes(chain)) {
          setBalance({ status: 'unavailable', reason: 'no-adapter' });
          return;
        }
        const adapter = getAdapter(chain);
        if (!adapter) {
          setBalance({ status: 'unavailable', reason: 'no-adapter' });
          return;
        }
        const address = deps.getAddress(chain);
        if (!address) {
          setBalance({ status: 'unavailable', reason: 'no-address' });
          return;
        }
        const previous = deps.getBalance(chain);
        setBalance({ status: 'loading' });
        const { result, attempts, exhausted } = await retryResult(async () => {
          try {
            return await adapter.getBalance(address);
          } catch (error) {
            return {
              status: 'error',
              reason: messageOf(error),
            } satisfies AdapterResult<AdapterBalance>;
          }
        });
        if (request !== balanceRequests[chain]) return;
        const now = Date.now();
        if (result.status === 'ok') {
          setBalance(
            result.data.valueBaseUnits === '0'
              ? { status: 'zero', value: '0', lastOkAt: now }
              : {
                  status: 'available',
                  value: result.data.valueBaseUnits,
                  lastOkAt: now,
                },
          );
        } else {
          // Keep the last good value (if any) with its timestamp; the
          // failure is a status + reason, never a zero.
          const kept =
            previous.value !== undefined
              ? { value: previous.value, lastOkAt: previous.lastOkAt }
              : {};
          setBalance({
            status: result.status,
            reason: result.reason,
            ...kept,
          });
          failures.push({
            operation: 'refresh-balances',
            chain,
            attempts,
            exhausted,
            reason: sanitiseReason(result.reason),
          });
        }
      }),
    );
    return { operation: 'refresh-balances', failures, at };
  }

  async function runRefreshHistory(): Promise<RefreshReport> {
    const at = Date.now();
    const failures: RefreshFailure[] = [];
    const loaded = await retryThrowing(() => ensureAdapters());
    if (!loaded.ok) {
      for (const chain of CHAINS) {
        failures.push({
          operation: 'refresh-history',
          chain,
          attempts: loaded.attempts,
          exhausted: loaded.exhausted,
          reason: 'adapter-load-failed',
        });
      }
      return { operation: 'refresh-history', failures, at };
    }
    const { getAdapter } = loaded.value;
    await Promise.all(
      CHAINS.map(async (chain) => {
        const request = ++historyRequests[chain];
        const setHistory = (state: HistoryState) => {
          if (request !== historyRequests[chain]) return;
          deps.setHistory(chain, state);
        };
        if (!availableFor('history').includes(chain)) {
          setHistory({ status: 'unavailable', reason: 'no-adapter', txs: [] });
          return;
        }
        const adapter = getAdapter(chain);
        if (!adapter) {
          setHistory({ status: 'unavailable', reason: 'no-adapter', txs: [] });
          return;
        }
        const address = deps.getAddress(chain);
        if (!address) {
          setHistory({ status: 'unavailable', reason: 'no-address', txs: [] });
          return;
        }
        const previous = deps.getHistory(chain);
        setHistory({ status: 'loading', txs: [] });
        const { result, attempts, exhausted } = await retryResult(async () => {
          try {
            return await adapter.getHistory(address, 25);
          } catch (error) {
            return {
              status: 'error',
              reason: messageOf(error),
            } satisfies AdapterResult<AdapterTx[]>;
          }
        });
        if (request !== historyRequests[chain]) return;
        const now = Date.now();
        if (result.status === 'ok') {
          setHistory(
            result.data.length === 0
              ? { status: 'empty', txs: [], lastOkAt: now }
              : { status: 'loaded', txs: result.data, lastOkAt: now },
          );
        } else {
          // Keep the last good transactions (if any) with their
          // timestamp; the failure is a status + reason, never empty.
          const kept =
            previous.txs.length > 0
              ? { txs: previous.txs, lastOkAt: previous.lastOkAt }
              : { txs: [] as AdapterTx[] };
          setHistory({
            status: result.status,
            reason: result.reason,
            ...kept,
          });
          failures.push({
            operation: 'refresh-history',
            chain,
            attempts,
            exhausted,
            reason: sanitiseReason(result.reason),
          });
        }
      }),
    );
    return { operation: 'refresh-history', failures, at };
  }

  return {
    refreshBalances: () => joinInflight('balances', addressKey(), runRefreshBalances),
    refreshHistory: () => joinInflight('history', addressKey(), runRefreshHistory),
  };
}
