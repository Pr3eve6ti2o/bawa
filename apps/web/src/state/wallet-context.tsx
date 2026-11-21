import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { availableFor } from '../wallet/chains';
import type { AdapterResult, AdapterTx } from '../wallet/adapters/types';
import { messageOf } from '../wallet/adapters/types';
import * as vault from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';
import type { BalanceState } from '../wallet/balance-state';

export type { BalanceState, BalanceStatus } from '../wallet/balance-state';

let vaultCorePromise: Promise<typeof import('../wallet/core')> | undefined;

function loadVaultCore(): Promise<typeof import('../wallet/core')> {
  if (!vaultCorePromise) {
    vaultCorePromise = import('../wallet/core').catch((error: unknown) => {
      vaultCorePromise = undefined;
      throw error;
    });
  }
  return vaultCorePromise;
}


let adaptersPromise: Promise<typeof import('../wallet/adapters')> | null = null;

// Lazy adapter loading: the adapter chunk (viem + adapters, ~3 MB) must not
// load before first paint. First caller imports it and registers the
// adapters once; concurrent callers share the promise. A rejected import
// clears the cache so a later call retries. Exported for the send screen,
// which also reads adapters but loads after the wallet context.
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


const CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton'];
// Maximum wallet-label length enforced at the storage boundary (T43
// r2b Fix (b)). The shortest 12-word English BIP-39 mnemonic is 47
// characters, an xprv is 111, and a 32-byte data key in hex is 64, so
// no complete secret of those forms fits in 40 characters, while
// ordinary labels ("Savings") are unaffected. This is a bound, not a
// guarantee: a shorter complete secret (e.g. a 23-character Chinese
// BIP-39 mnemonic, a 40-character Z85 key) or a secret fragment still
// fits — see REPORT.md. The label input also carries maxLength={40}.
// localStorage contains public watch-only data only (xpubs and labels), never secrets.
const STORAGE_KEY = 'bawa-watch-only-xpubs';
export const LABEL_MAX_LENGTH = 40;
type PerChain<T> = Record<ChainId, T>;
const perChain = <T,>(make: () => T): PerChain<T> => ({
  btc: make(),
  eth: make(),
  trx: make(),
  ton: make(),
  sol: make(),
  bsc: make(),
  matic: make(),
  arb: make(),
  op: make(),
  base: make(),
  avax: make(),
  ltc: make(),
  doge: make(),
});
const ALL_CHAIN_IDS = [
  'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge',
] as const;

// The vault has no lock state (owner order 2026-11-20): a vault that
// exists is always unlocked — autoUnlock() restores the mnemonic into the
// vault closure on boot, so 'unlocked' is the only state a stored vault
// can be in. There is no auto-lock timer, no inactivity detection and no
// password re-prompt. See vault.ts for the stored-key tradeoff.
export type VaultState = 'no-vault' | 'unlocked';

// Lane G, Phase 3 — boot rehydration (Safe's persistStore + useHydrateStore
// pattern, Rabby's pending-guard pattern). Only PUBLIC derived addresses are
// persisted: an address is public data, exactly like the watch-only xpubs
// already stored under STORAGE_KEY. Keys, mnemonics, seeds and passphrases
// are never written here. The stored record is versioned (vercel-react-best-practices
// client-localstorage-schema: version and minimise localStorage data) and is
// only trusted when it matches the stored vault-account selection.
const VAULT_ADDRESSES_KEY = 'bawa-vault-addresses:v1';
// Last-good balances cache (the usePrices() pattern, prices.ts): public
// balance values with the address they belong to, so a boot never shows
// another account's balance. Entries older than this are ignored.
const BALANCE_CACHE_KEY = 'bawa:balances-cache:v1';
export const BALANCE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

// BalanceState / BalanceStatus live in ../wallet/balance-state (see above).

export type HistoryStatus = 'loading' | 'loaded' | 'empty' | 'unavailable' | 'error';
export interface HistoryState {
  status: HistoryStatus;
  txs: AdapterTx[];
  reason?: string;
  /** True while a refetch is in flight and txs are the last good ones. */
  refreshing?: boolean;
  /** True when txs are the last good ones kept after a failed refetch. */
  stale?: boolean;
  /** Epoch ms when the last good txs were fetched. */
  fetchedAtMs?: number;
}

// First paint is a pending state, never an error (Safe's useAsync /
// useTotalBalances rule: error only after the first attempt settles).
// Balances/history start at 'loading' when a fetch is about to run (see
// initialWalletState, which starts them unavailable when no fetch can run
// at all); a mount refresh resolves every chain out of it (no-adapter /
// no-address when no fetch can run).
const initialBalances = (): PerChain<BalanceState> =>
  perChain<BalanceState>(() => ({ status: 'loading' }));

const initialHistory = (): PerChain<HistoryState> =>
  perChain<HistoryState>(() => ({ status: 'loading', txs: [] }));

// No-fetch initial state: balances/history start unavailable with no
// address in memory (no fetch can run at all — see initialWalletState).
const clearedBalances = (): PerChain<BalanceState> =>
  perChain<BalanceState>(() => ({ status: 'unavailable', reason: 'no-address' }));

const clearedHistory = (): PerChain<HistoryState> =>
  perChain<HistoryState>(() => ({ status: 'unavailable', reason: 'no-address', txs: [] }));

interface WalletState {
  xpubs: PerChain<WatchOnlyWallet | null>;
  addresses: PerChain<DerivedAddress[]>;
  uiState: PerChain<UiState>;
  errors: PerChain<string | null>;
  // Vault-backed accounts. vaultAddresses are public derived addresses
  // (the selected vaultAccount, default account 0, index 0), safe in state.
  // The mnemonic never enters state. TON has one address per wallet and
  // ignores account/index.
  vaultState: VaultState;
  vaultAccount: { account: number; index: number };
  vaultAddresses: PerChain<string[]>;
  vaultProfileIds: string[] | null;
  balances: PerChain<BalanceState>;
  history: PerChain<HistoryState>;
  // True until boot hydration finishes (watch-only xpubs validated and
  // vault addresses rehydrated). Screens render a loading state, not an
  // error, while this is true (Rabby's pending-guard pattern).
  hydrating: boolean;
}

export interface WalletContextValue extends WalletState {
  selectedChain: ChainId;
  addXpub(chain: ChainId, xpub: string, label: string): Promise<void>;
  removeXpub(chain: ChainId): void;
  refreshChain(chain: ChainId): Promise<void>;
  setSelectedChain(chain: ChainId): void;
  setVaultAccount(account: number, index: number): Promise<void>;
  refreshVaultAccounts(selection?: {
    account: number;
    index: number;
  }): Promise<void>;
  refreshBalances(): Promise<void>;
  refreshHistory(): Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readStored(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

// messageOf comes from ../wallet/adapters/types (repo-study's single
// shared error-message helper); the local duplicate is removed.
function computeVaultState(): VaultState {
  // No lock state: a stored vault is unlocked (autoUnlock restores the
  // mnemonic; see the mount effect). A vault that cannot auto-unlock
  // (legacy vault without a stored key) still reports 'unlocked' here;
  // derivation falls back to persisted addresses in refreshVaultAccounts.
  return vault.hasVault() ? 'unlocked' : 'no-vault';
}

// --- Lane G: central reason → human sentence map (Safe's cgw-errors.ts
// rule: "the status is never shown to the user"). No screen may render a
// raw reason: call this instead. Unknown provider reasons fall back to a
// generic sentence, never to the raw string. Kept in state and logs only.
export function humanReasonMessage(reason: string | undefined, kind: 'balance' | 'history'): string {
  if (reason === undefined || reason === '') return '';
  const lower = reason.toLowerCase();
  if (lower === 'no-adapter') {
    return kind === 'history'
      ? 'Transaction history is not connected for this chain yet.'
      : 'This chain is not connected yet.';
  }
  if (lower === 'no-address') return 'No address is available for this chain yet.';
  if (lower.includes('invalid') && lower.includes('address')) {
    return 'The address for this chain looks invalid.';
  }
  if (isTransientReason(reason)) {
    return 'The network is busy or unreachable. Please try again in a moment.';
  }
  return 'Please try again later.';
}

// Transient failures are the only ones worth retrying (the usePrices()
// retry set, plus HTTP 5xx): 429 / rate-limit, 5xx, timeouts and network
// errors. Anything else (bad address, malformed response, a provider's
// permanent refusal) fails immediately with no retry.
export function isTransientReason(reason: string | undefined): boolean {
  if (reason === undefined || reason === '') return false;
  const lower = reason.toLowerCase();
  return lower.includes('429')
    || lower.includes('rate limit')
    || lower.includes('rate-limit')
    || lower.includes('ratelimited')
    || /http 5\d\d/.test(lower)
    || lower.includes('timed out')
    || lower.includes('timeout')
    || lower.includes('network error')
    || lower.includes('failed to fetch');
}

function parseRetryAfterMs(reason: string): number | null {
  const match = /retry-after[:\s]+(\d+)/i.exec(reason);
  if (match === null || match[1] === undefined) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(30_000, seconds * 1000);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Bounded retries for read-only fetches (the usePrices() shape: 3 attempts,
// 1s then 2s delays, Retry-After honoured and capped at 30s). GET retries
// are inherently safe; a failed fetch never overwrites last-good data here
// — the caller decides that from the returned result.
async function fetchWithRetry<T>(
  fetchOnce: () => Promise<AdapterResult<T>>,
): Promise<AdapterResult<T>> {
  let last: AdapterResult<T> | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await fetchOnce();
    if (result.status === 'ok') return result;
    last = result;
    if (attempt === 2 || !isTransientReason(result.reason)) break;
    const retryAfterMs = parseRetryAfterMs(result.reason);
    const delayMs = retryAfterMs ?? 1000 * (attempt + 1);
    if (delayMs > 0) await sleep(delayMs);
  }
  // last is always set: the loop returns early only on 'ok', and breaks
  // after storing a non-ok result.
  return last as AdapterResult<T>;
}

// --- Lane G: persisted public vault addresses (see VAULT_ADDRESSES_KEY) ---
const isStoredAddress = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 && !/\s/.test(value);

interface PersistedVaultAddresses {
  account: number;
  index: number;
  addresses: PerChain<string[]>;
}

function readPersistedVaultAddresses(): PersistedVaultAddresses | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(VAULT_ADDRESSES_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const account = parsed.account;
    const index = parsed.index;
    if (typeof account !== 'number' || !Number.isSafeInteger(account) || account < 0) return null;
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) return null;
    if (!isRecord(parsed.addresses)) return null;
    const addresses = perChain<string[]>(() => []);
    for (const chain of ALL_CHAIN_IDS) {
      const entry: unknown = parsed.addresses[chain];
      if (entry === undefined) continue;
      if (!Array.isArray(entry) || entry.length > 8) return null;
      const list: string[] = [];
      for (const item of entry as unknown[]) {
        if (!isStoredAddress(item)) return null;
        list.push(item);
      }
      addresses[chain] = list;
    }
    return { account, index, addresses };
  } catch {
    return null;
  }
}

function persistVaultAddresses(
  account: number,
  index: number,
  addresses: PerChain<string[]>,
): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      VAULT_ADDRESSES_KEY,
      JSON.stringify({ version: 1, account, index, addresses }),
    );
  } catch {
    // Persistence is best-effort; the in-memory addresses still work.
  }
}

// --- Lane G: last-good balances cache (see BALANCE_CACHE_KEY) ---
interface CachedBalance {
  address: string;
  status: 'available' | 'zero';
  value: string;
  fetchedAtMs: number;
}

function readCachedBalances(): Partial<Record<ChainId, CachedBalance>> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(BALANCE_CACHE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.balances)) return {};
    const out: Partial<Record<ChainId, CachedBalance>> = {};
    for (const chain of ALL_CHAIN_IDS) {
      const entry: unknown = parsed.balances[chain];
      if (!isRecord(entry)) continue;
      if (!isStoredAddress(entry.address)) continue;
      if (entry.status !== 'available' && entry.status !== 'zero') continue;
      if (typeof entry.value !== 'string' || entry.value === '') continue;
      if (typeof entry.fetchedAtMs !== 'number' || !Number.isFinite(entry.fetchedAtMs)) continue;
      out[chain] = {
        address: entry.address,
        status: entry.status,
        value: entry.value,
        fetchedAtMs: entry.fetchedAtMs,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function saveCachedBalances(entries: Partial<Record<ChainId, CachedBalance>>): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      BALANCE_CACHE_KEY,
      JSON.stringify({ version: 1, balances: entries }),
    );
  } catch {
    // Cache writes are best-effort.
  }
}

// Boot state: rehydrated public vault addresses (if any) plus last-good
// cached balances for those same addresses, labelled stale. Anything
// without a fresh-enough cached value starts at 'loading' — but only when
// a fetch is actually about to run (Safe's rule: the error/empty state
// must never be a placeholder before the first attempt, and equally a
// loading state must never stand in when no fetch can run at all). With
// no persisted addresses and no stored xpubs, nothing can ever load, so
// balances/history start at unavailable/no-address immediately — the
// no-vault first paint keeps showing 'Balance unavailable', not a
// skeleton that never resolves.
function initialWalletState(): WalletState {
  const persisted = readPersistedVaultAddresses();
  const stored = readStored();
  const hasPersistedAddress =
    persisted !== null
    && ALL_CHAIN_IDS.some((chain) => persisted.addresses[chain].length > 0);
  const hasStoredXpub = ALL_CHAIN_IDS.some((chain) => {
    const entry: unknown = stored[chain];
    return isRecord(entry) && typeof entry.xpub === 'string' && entry.xpub.trim() !== '';
  });
  const mayFetch = hasPersistedAddress || hasStoredXpub;
  const cached = readCachedBalances();
  const now = Date.now();
  const balances = mayFetch ? initialBalances() : clearedBalances();
  if (persisted !== null) {
    for (const chain of ALL_CHAIN_IDS) {
      const address = persisted.addresses[chain][0];
      const entry = cached[chain];
      if (address === undefined || entry === undefined) continue;
      if (entry.address !== address) continue;
      if (now - entry.fetchedAtMs > BALANCE_CACHE_MAX_AGE_MS) continue;
      balances[chain] = {
        status: entry.status,
        value: entry.value,
        stale: true,
        fetchedAtMs: entry.fetchedAtMs,
      };
    }
  }
  return {
    xpubs: perChain<WatchOnlyWallet | null>(() => null),
    addresses: perChain<DerivedAddress[]>(() => []),
    uiState: perChain<UiState>(() => 'empty'),
    errors: perChain<string | null>(() => null),
    vaultState: vault.hasVault() ? 'unlocked' : 'no-vault',
    vaultAccount: persisted === null
      ? { account: 0, index: 0 }
      : { account: persisted.account, index: persisted.index },
    vaultAddresses: persisted === null
      ? perChain<string[]>(() => [])
      : persisted.addresses,
    vaultProfileIds: null,
    balances,
    history: mayFetch ? initialHistory() : clearedHistory(),
    hydrating: true,
  };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // No state or refs may hold a mnemonic, seed, private key, private extended key,
  // vault key or data key. Only validated public watch-only wallets enter state.
  // vaultAddresses are public addresses derived from the vault; they are safe here.
  const [state, setState] = useState<WalletState>(() => initialWalletState());
  const [selectedChain, setSelectedChain] = useState<ChainId>('btc');
  const [hydrated, setHydrated] = useState(false);
  const current = useRef(state);
  const additions = useRef(perChain(() => 0));
  const changed = useRef(perChain(() => false));
  const derivations = useRef(perChain(() => 0));
  const vaultDerivations = useRef(0);
  const balanceRequests = useRef(perChain(() => 0));
  const historyRequests = useRef(perChain(() => 0));
  const lifetime = useRef(0);

  // Refs serialise commands and prevent stale asynchronous results being applied.
  const update = useCallback((change: (previous: WalletState) => WalletState) => {
    const next = change(current.current);
    current.current = next;
    setState(next);
  }, []);

  const setChain = useCallback((
    chain: ChainId, uiState: UiState, addresses: DerivedAddress[] = [], error: string | null = null,
  ) => {
    update(previous => ({
      ...previous,
      addresses: { ...previous.addresses, [chain]: addresses },
      uiState: { ...previous.uiState, [chain]: uiState },
      errors: { ...previous.errors, [chain]: error },
    }));
  }, [update]);

  const refreshChain = useCallback(async (chain: ChainId) => {
    const request = ++derivations.current[chain];
    const wallet = current.current.xpubs[chain];
    if (!wallet) {
      setChain(chain, 'empty');
      return;
    }
    setChain(chain, 'loading');
    try {
      const { deriveAddresses } = await import('../engine/boundary');
      const addresses = await deriveAddresses(chain, wallet.xpub, wallet.derivedCount);
      if (request !== derivations.current[chain]) return;
      setChain(chain, 'ready', addresses.map((address, index) => ({ chain, index, address })));
    } catch (error: unknown) {
      if (request === derivations.current[chain]) {
        setChain(chain, 'error', [], messageOf(error));
      }
    }
  }, [setChain]);

  const putWallet = useCallback((chain: ChainId, wallet: WatchOnlyWallet | null) => {
    update(previous => ({ ...previous, xpubs: { ...previous.xpubs, [chain]: wallet } }));
    return refreshChain(chain);
  }, [refreshChain, update]);

  const addXpub = useCallback(async (chain: ChainId, xpub: string, label: string) => {
    const request = ++additions.current[chain];
    const epoch = lifetime.current;
    const publicKey = xpub.trim();
    const { validateWatchOnlyImport } = await import('../engine/boundary');
    const validation = await validateWatchOnlyImport(chain, publicKey);
    if (!validation.ok) throw new Error(validation.message);
    if (epoch !== lifetime.current || request !== additions.current[chain]) return;
    changed.current[chain] = true;
    const trimmedLabel = label.trim();
    if (trimmedLabel.length > LABEL_MAX_LENGTH) {
      throw new Error(`Label must be at most ${LABEL_MAX_LENGTH} characters.`);
    }
    // For TON, xpub holds the validated TON public address (see
    // contracts). TON has one address because its path is fully hardened.
    const wallet = { chain, xpub: publicKey, label: trimmedLabel, derivedCount: chain === 'ton' ? 1 : 5 };
    await putWallet(chain, wallet);
  }, [putWallet]);

  const removeXpub = useCallback((chain: ChainId) => {
    ++additions.current[chain];
    changed.current[chain] = true;
    void putWallet(chain, null);
  }, [putWallet]);

  // Balances and history come from the Phase 2 adapters, gated on the
  // capability registry: a chain is readable only when its balance/history
  // capability is verified (availableFor). A failed fetch is reported as
  // unavailable/error, never as zero. Lane G, Phase 3 (Safe's
  // [data|undefined, error|undefined, loading] triple + RTK Query's
  // currentData rule): a refetch keeps the last good value visible
  // (refreshing) instead of replacing it with loading, and a failed
  // refetch keeps it labelled stale — an error state appears only when no
  // data exists at all. Transient failures retry boundedly (see
  // fetchWithRetry); the last good value is cached for the next boot.
  const refreshBalances = useCallback(async () => {
    const { getAdapter } = await ensureAdapters();
    // Every chain in the registry resolves out of the initial 'loading'
    // state here — not just the four balance chains — so no chain is left
    // showing a first-load skeleton forever. Chains without a verified
    // balance adapter resolve to unavailable/no-adapter below.
    await Promise.all(ALL_CHAIN_IDS.map(async (chain) => {
      const request = ++balanceRequests.current[chain];
      const setBalance = (balance: BalanceState) => {
        if (request !== balanceRequests.current[chain]) return;
        update(previous => ({
          ...previous,
          balances: { ...previous.balances, [chain]: balance },
        }));
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
      const address =
        current.current.vaultAddresses[chain][0] ??
        current.current.addresses[chain][0]?.address;
      if (!address) {
        setBalance({ status: 'unavailable', reason: 'no-address' });
        return;
      }
      const previous = current.current.balances[chain];
      const hasLastGood = previous.status === 'available' || previous.status === 'zero';
      if (hasLastGood) {
        setBalance({ ...previous, refreshing: true, stale: false });
      } else if (previous.status !== 'loading') {
        setBalance({ status: 'loading' });
      }
      const result = await fetchWithRetry(() => adapter.getBalance(address));
      if (request !== balanceRequests.current[chain]) return;
      if (result.status === 'ok') {
        const fetchedAtMs = Date.now();
        const next: BalanceState = result.data.valueBaseUnits === '0'
          ? { status: 'zero', value: '0', fetchedAtMs }
          : { status: 'available', value: result.data.valueBaseUnits, fetchedAtMs };
        setBalance(next);
        try {
          const cached = readCachedBalances();
          cached[chain] = {
            address,
            status: next.status === 'zero' ? 'zero' : 'available',
            value: next.value ?? '0',
            fetchedAtMs,
          };
          saveCachedBalances(cached);
        } catch {
          // Cache writes are best-effort.
        }
      } else if (hasLastGood) {
        setBalance({ ...previous, refreshing: false, stale: true, reason: result.reason });
      } else if (result.status === 'unavailable') {
        setBalance({ status: 'unavailable', reason: result.reason });
      } else {
        setBalance({ status: 'error', reason: result.reason });
      }
    }));
  }, [update]);

  const refreshHistory = useCallback(async () => {
    const { getAdapter } = await ensureAdapters();
    // See refreshBalances: every chain resolves out of 'loading' here.
    await Promise.all(ALL_CHAIN_IDS.map(async (chain) => {
      const request = ++historyRequests.current[chain];
      const setHistory = (history: HistoryState) => {
        if (request !== historyRequests.current[chain]) return;
        update(previous => ({
          ...previous,
          history: { ...previous.history, [chain]: history },
        }));
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
      const address =
        current.current.vaultAddresses[chain][0] ??
        current.current.addresses[chain][0]?.address;
      if (!address) {
        setHistory({ status: 'unavailable', reason: 'no-address', txs: [] });
        return;
      }
      const previous = current.current.history[chain];
      const hasLastGood = previous.status === 'loaded' || previous.status === 'empty';
      if (hasLastGood) {
        setHistory({ ...previous, refreshing: true, stale: false });
      } else if (previous.status !== 'loading') {
        setHistory({ status: 'loading', txs: [] });
      }
      const result = await fetchWithRetry(() => adapter.getHistory(address, 25));
      if (request !== historyRequests.current[chain]) return;
      if (result.status === 'ok') {
        const fetchedAtMs = Date.now();
        setHistory(
          result.data.length === 0
            ? { status: 'empty', txs: [], fetchedAtMs }
            : { status: 'loaded', txs: result.data, fetchedAtMs },
        );
      } else if (hasLastGood) {
        setHistory({ ...previous, refreshing: false, stale: true, reason: result.reason });
      } else if (result.status === 'unavailable') {
        setHistory({ status: 'unavailable', reason: result.reason, txs: [] });
      } else {
        setHistory({ status: 'error', reason: result.reason, txs: [] });
      }
    }));
  }, [update]);

  // Vault-backed accounts. An xpub can never be upgraded into signing keys:
  // spending requires vault creation or mnemonic restoration. Watch-only xpubs
  // stay a separate, explicitly labelled account type (see xpubs above).
  // `selection` is explicit so setVaultAccount never derives with a stale
  // captured vaultAccount: the caller passes the new selection in the same
  // call that stores it. Other callers pass nothing and the current
  // selection from current.current is used.
  const refreshVaultAccounts = useCallback(async (selection?: {
    account: number;
    index: number;
  }) => {
    const request = ++vaultDerivations.current;
    const vaultState = computeVaultState();
    const profileIds = vault.hasVault() ? vault.vaultProfiles() : null;
    const selected = selection ?? current.current.vaultAccount;
    // Derivation needs the mnemonic in the vault closure. autoUnlock()
    // restores it from the stored key when it is not there yet (e.g. after
    // a reload); it returns false for a vault that cannot auto-unlock
    // (legacy vault without a stored key). The BIP-39 session passphrase
    // is never persisted, so a passphrase wallet whose passphrase is
    // unknown must not re-derive: deriving with '' would produce (and
    // persist) the wrong addresses. In all of those cases the persisted
    // public addresses for this selection are still usable for public
    // balance reads (see VAULT_ADDRESSES_KEY). Any other selection has no
    // addresses in memory.
    const passphraseKnown =
      !isPassphraseUsed() || vault.getSessionPassphrase() !== '';
    if (
      vaultState !== 'unlocked' ||
      !passphraseKnown ||
      !(await vault.autoUnlock())
    ) {
      const persisted = readPersistedVaultAddresses();
      const restored =
        persisted !== null
          && persisted.account === selected.account
          && persisted.index === selected.index
          ? persisted.addresses
          : perChain<string[]>(() => []);
      update(previous => ({
        ...previous,
        vaultState,
        vaultProfileIds: profileIds,
        vaultAddresses: restored,
      }));
      return;
    }
    let derived: Record<ChainId, string>;
    try {
      const { deriveAddressesAt: deriveVaultAddressesAt } = await loadVaultCore();
      derived = await vault.withMnemonic((mnemonic) =>
        deriveVaultAddressesAt(
          mnemonic,
          // The passphrase lane (p13a) already landed: derive with the
          // session passphrase, never '' when one is in use.
          vault.getSessionPassphrase(),
          selected.account,
          selected.index,
        ),
      );
    } catch (error: unknown) {
      if (request !== vaultDerivations.current) return;
      update(previous => ({
        ...previous,
        vaultState,
        vaultProfileIds: profileIds,
        vaultAddresses: perChain<string[]>(() => []),
      }));
      throw error;
    }
    if (request !== vaultDerivations.current) return;
    const addresses: PerChain<string[]> = {
      btc: [derived.btc],
      eth: [derived.eth],
      trx: [derived.trx],
      ton: [derived.ton],
      sol: [derived.sol],
      bsc: [derived.bsc],
      matic: [derived.matic],
      arb: [derived.arb],
      op: [derived.op],
      base: [derived.base],
      avax: [derived.avax],
      ltc: [derived.ltc],
      doge: [derived.doge],
    };
    update(previous => ({
      ...previous,
      vaultState,
      vaultProfileIds: profileIds,
      vaultAddresses: addresses,
    }));
    // Persist the PUBLIC addresses only (never keys or the mnemonic), so a
    // reload or direct load can fetch balances/history without an unlock.
    persistVaultAddresses(selected.account, selected.index, addresses);
    // Balances/history load in the background: this function returns as
    // soon as the derived addresses are in state, so the wallet shows
    // immediately. A failed background refresh leaves the per-chain
    // error/unavailable state (or the previous state) and the dashboard
    // Retry button re-runs it; it never throws here.
    void refreshBalances()
      .finally(() => refreshHistory())
      .catch(() => {});
  }, [update, refreshBalances, refreshHistory]);

  // Switch the derived vault account. Validates like deriveAddressesAt
  // (which re-validates), stores the selection, then re-derives with the
  // NEW selection passed explicitly — never with captured state.
  const setVaultAccount = useCallback(async (account: number, index: number) => {
    if (!Number.isSafeInteger(account) || account < 0) {
      throw new RangeError('account must be a non-negative safe integer');
    }
    if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
      throw new RangeError(
        'index must be a non-negative safe integer below 0x80000000',
      );
    }
    const selection = { account, index };
    update(previous => ({ ...previous, vaultAccount: selection }));
    await refreshVaultAccounts(selection);
  }, [update, refreshVaultAccounts]);

  // No lock/unlock API (owner order 2026-11-20): the vault is always
  // unlocked — autoUnlock() restores the mnemonic on boot (see the
  // mount effect) and refreshVaultAccounts re-derives from it. The
  // lock screen, lockVault/unlockVault, the watch-only lock/unlock
  // and the auto-lock timer were removed with it.


  useEffect(() => {
    let cancelled = false;
    const saved = readStored();
    void Promise.all(CHAINS.map(async chain => {
      const entry = saved[chain];
      if (changed.current[chain] || !isRecord(entry) || typeof entry.xpub !== 'string') return;
      const publicKey = entry.xpub.trim();
      // An over-long stored label is dropped to '' (T43 r2b Fix (b)):
      // restore-to-'' rather than truncation, so a persisted prefix of
      // a pasted secret is not kept. The persistence effect below then
      // overwrites the stored label with ''.
      const rawLabel = typeof entry.label === 'string' ? entry.label.trim() : '';
      const label = rawLabel.length > LABEL_MAX_LENGTH ? '' : rawLabel;
      try {
        const { validateWatchOnlyImport } = await import('../engine/boundary');
        const validation = await validateWatchOnlyImport(chain, publicKey);
        if (!cancelled && !changed.current[chain]) {
          if (validation.ok) {
            // For TON, xpub holds the validated TON public address (see
            // contracts). TON has one address because its path is fully hardened.
            const wallet = { chain, xpub: publicKey, label, derivedCount: chain === 'ton' ? 1 : 5 };
            void putWallet(chain, wallet);
          }
          // Keep well-formed non-account keys and labels visible and stored for
          // investigation. putWallet triggers refreshChain; deriveAddresses ->
          // deriveAddress enforces validateAccountKey and throws the not-account-key
          // message before deriving any addresses. refreshChain catches the error
          // and sets the chain to the error state with that message.
          else if (validation.reason === 'not-account-key') {
            const wallet = { chain, xpub: publicKey, label, derivedCount: chain === 'ton' ? 1 : 5 };
            void putWallet(chain, wallet);
          }
        }
      } catch {
        // Ignore corrupt or unverifiable entries; never restore unvalidated data.
      }
    })).then(() => {
      if (!cancelled) {
        setHydrated(true);
        update(previous => ({ ...previous, hydrating: false }));
      }
    });
    return () => {
      cancelled = true;
      ++lifetime.current;
      CHAINS.forEach(chain => { ++derivations.current[chain]; });
    };
  }, [putWallet, update]);

  // Vault auto-unlock on mount: a stored vault's mnemonic is restored
  // into the vault closure (no password prompt), so the vault is open
  // from boot. vaultState/vaultProfileIds are read from storage at the
  // same time (no vault -> 'no-vault'). The public addresses rehydrated
  // from storage in initialWalletState need no unlock to be read; fresh
  // derivation happens in refreshVaultAccounts (e.g. setVaultAccount).
  useEffect(() => {
    let cancelled = false;
    void vault.autoUnlock().then(() => {
      if (cancelled) return;
      update(previous => ({
        ...previous,
        vaultState: computeVaultState(),
        vaultProfileIds: vault.hasVault() ? vault.vaultProfiles() : null,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [update]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.xpubs));
    } catch {
      // Storage may be unavailable; keep validated public data in memory.
    }
  }, [hydrated, state.xpubs]);

  // Boot refresh (Lane G, Phase 3): once hydration finishes, balances and
  // history load for the rehydrated vault or watch-only addresses, so a
  // direct load or reload shows data without an unlock. History starts
  // only after balances settle (the Lane B balance-before-history rule).
  useEffect(() => {
    if (!hydrated) return;
    void refreshBalances().finally(() => { void refreshHistory(); }).catch(() => {});
  }, [hydrated, refreshBalances, refreshHistory]);

  const value = useMemo<WalletContextValue>(() => ({
    ...state, selectedChain, setSelectedChain, addXpub, removeXpub, refreshChain,
    setVaultAccount, refreshVaultAccounts, refreshBalances, refreshHistory,
  }), [state, selectedChain, addXpub, removeXpub, refreshChain, setVaultAccount, refreshVaultAccounts, refreshBalances, refreshHistory]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider.');
  return context;
}
