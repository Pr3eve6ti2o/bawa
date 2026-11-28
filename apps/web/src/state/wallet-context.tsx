import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { isRecord } from '../wallet/guards';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { availableFor, canRotateReceiveAddress, SUPPORTED_CHAINS } from '../wallet/chains';
import { watchOnlyFamilyChains } from '../wallet/watch-only-families';
import type { AdapterResult, AdapterTx } from '../wallet/adapters/types';
import { messageOf } from '../wallet/adapters/types';
import {
  DEFAULT_TOKENS,
  addCustomTokenToList,
  removeCustomTokenFromList,
  isDuplicateToken,
  readCustomTokens,
  readEnabledChains,
  tokenKeyOf,
  writeCustomTokens,
  writeEnabledChains,
  type TokenRecord,
} from '../wallet/tokens';
import * as vault from '../wallet/vault';
import {
  AUTO_LOCK_OPTIONS,
  autoLockDurationMs,
  readAutoLockEnabled,
  readAutoLockMinutes,
  writeAutoLockEnabled,
  writeAutoLockMinutes,
} from '../wallet/auto-lock';
import {
  readDevnetEnabled,
  writeDevnetEnabled,
} from '../wallet/devnet';
import { isPassphraseUsed } from '../wallet/passphrase';
import type { BalanceState } from '../wallet/balance-state';

export type { BalanceState } from '../wallet/balance-state';

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


// Adapter lazy-loading lives in ./ensure-adapters (single shared
// cache); re-exported here so the send screen keeps importing
// it from the wallet context.
import { ensureAdapters, ensureDevnetAdapters } from './ensure-adapters';
export { ensureAdapters, ensureDevnetAdapters };


// Token gaps, item 6 + item 8: the boot hydration effect used to
// iterate a stale four-chain list here, so a watch-only wallet stored
// for any other chain (e.g. SOL) was persisted but dropped on every
// reload — the Wallets screen showed "No wallets imported" and the
// Assets row stayed "Balance unavailable" until the wallet was
// re-added. Hydration now covers all 87 registry chains
// (ALL_CHAIN_IDS), like the initial-state checks above it.
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
const LABEL_MAX_LENGTH = 40;
type PerChain<T> = Record<ChainId, T>;
// Kept as a literal list, not SUPPORTED_CHAINS: the screen tests mock
// '../wallet/chains' with only {availableFor, chainConfig}, so importing
// SUPPORTED_CHAINS here breaks those suites at load time. Must stay in
// step with SUPPORTED_CHAINS (chains.test.ts pins that list).
const ALL_CHAIN_IDS = [
  'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom', 'zksync', 'cronos', 'kava', 'filecoin', 'zora', 'mode', 'fraxtal', 'berachain', 'sei', 'arbnova', 'worldchain', 'manta', 'unichain', 'ink', 'abstract', 'soneium', 'apechain', 'sonic', 'hyperevm', 'monad', 'ronin', 'immutable', 'fuse', 'velas', 'syscoin', 'theta', 'iotex', 'xlayer', 'boba', 'taiko', 'astar', 'telos', 'conflux', 'core', 'songbird', 'rootstock', 'pulsechain', 'xdc', 'chiliz', 'etc', 'flare', 'zetachain', 'hemi', 'bob', 'flowevm', 'cosmos', 'osmosis', 'xrp', 'stellar', 'polkadot', 'near', 'aptos', 'tezos', 'algorand', 'hedera', 'injective', 'celestia', 'dydx', 'seicosmos', 'axelar', 'noble', 'juno', 'cardano', 'kaspa', 'starknet',
] as const;

// Built from ALL_CHAIN_IDS (not SUPPORTED_CHAINS — see the note above):
// every chain gets a fresh value from make().
const perChain = <T,>(make: () => T): PerChain<T> =>
  Object.fromEntries(ALL_CHAIN_IDS.map((chain) => [chain, make()])) as PerChain<T>;

// 'locked' is reachable only with auto-lock enabled or before the first
// unlock of a vault with no stored key.
export type VaultState = 'no-vault' | 'locked' | 'unlocked';

// Lane G, Phase 3 — boot rehydration (Safe's persistStore + useHydrateStore
// pattern, Rabby's pending-guard pattern). Only PUBLIC derived addresses are
// persisted: an address is public data, exactly like the watch-only xpubs
// already stored under STORAGE_KEY. Keys, mnemonics, seeds and passphrases
// are never written here. The stored record is versioned (vercel-react-best-practices
// client-localstorage-schema: version and minimise localStorage data) and is
// only trusted when it matches the stored vault-account selection.
const VAULT_ADDRESSES_KEY = 'bawa-vault-addresses:v1';
// TEMPORARY devnet mode: devnet addresses persist under a separate key
// and never overwrite the mainnet record.
const VAULT_ADDRESSES_KEY_DEVNET = 'bawa-vault-addresses-devnet:v1';
// Last-good balances cache (the usePrices() pattern, prices.ts): public
// balance values with the address they belong to, so a boot never shows
// another account's balance. Entries older than this are ignored.
const BALANCE_CACHE_KEY = 'bawa:balances-cache:v1';
const BALANCE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

// BalanceState / BalanceStatus live in ../wallet/balance-state (see above).

type HistoryStatus = 'loading' | 'loaded' | 'empty' | 'unavailable' | 'error';
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
  // The mnemonic never enters state. SOL and TON addresses now vary
  // with account/index (Lane A); account 0 index 0 is unchanged.
  vaultState: VaultState;
  vaultAccount: { account: number; index: number };
  // Lane C, items 6/7/17: the accounts created from this vault's phrase
  // (indices; 0 is "Account 1"). One phrase holds many accounts.
  vaultAccounts: number[];
  // Lane C, item 6: true when the vault uses a recovery passphrase the
  // session does not know — account switches cannot re-derive then.
  vaultPassphraseNeeded: boolean;
  // Lane C, item 8: per-chain HD receive index (the next unused address
  // index) and the current HD receive address per chain (vault-derived;
  // null when the vault is locked or the passphrase is unknown).
  receiveIndices: ReceiveIndices;
  receiveAddresses: PerChain<string | null>;
  vaultAddresses: PerChain<string[]>;
  vaultProfileIds: string[] | null;
  balances: PerChain<BalanceState>;
  history: PerChain<HistoryState>;
  // Token discovery: balances keyed by tokenKey (`${chain}:${contract}`),
  // the chains the user has enabled (default: all 13), and the
  // user-added token records (defaults live in wallet/tokens.ts, not
  // here). Public data only; the vault is untouched.
  tokenBalances: Record<string, BalanceState>;
  enabledChains: ChainId[];
  customTokens: TokenRecord[];
  // True until boot hydration finishes (watch-only xpubs validated and
  // vault addresses rehydrated). Screens render a loading state, not an
  // error, while this is true (Rabby's pending-guard pattern).
  hydrating: boolean;
}

export interface WalletContextValue extends WalletState {
  selectedChain: ChainId;
  addXpub(chain: ChainId, xpub: string, label: string): Promise<void>;
  /**
   * Lane B (Finish the Product): add a plain public address watch-only.
   * The address fans out to every chain in its family (all fifty-nine
   * 0x EVM chains for a 0x address — Lane 80-APP; the chain itself for
   * SOL/TRX/BTC/LTC/DOGE/TON and for the non-0x expanded chains).
   * Chains that already have a watch-only entry are skipped, never
   * overwritten — an existing extended-key entry keeps deriving its five
   * addresses. Returns which chains were added and which were skipped.
   */
  addWatchOnlyAddress(
    chain: ChainId,
    address: string,
    label: string,
  ): Promise<{ added: ChainId[]; skipped: ChainId[] }>;
  removeXpub(chain: ChainId): void;
  refreshChain(chain: ChainId): Promise<void>;
  setSelectedChain(chain: ChainId): void;
  lockVault(): void;
  unlockVault(password: string, passphrase?: string): Promise<void>;
  autoLockEnabled: boolean;
  autoLockMinutes: number;
  setAutoLockMinutes(minutes: number): void;
  setAutoLockEnabled(enabled: boolean): Promise<void>;
  /** TEMPORARY devnet mode: test networks, valueless tokens. */
  devnetEnabled: boolean;
  setDevnetEnabled(enabled: boolean): Promise<void>;
  setVaultAccount(account: number, index: number): Promise<void>;
  /** Switch to another account from the same phrase, keeping the address index. */
  selectVaultAccount(account: number): Promise<void>;
  /** Create `count` new accounts from the vault phrase; returns their indices. */
  createVaultAccounts(count: number): Promise<number[]>;
  /** (Re-)derive the HD receive addresses for the current account. */
  refreshReceiveAddresses(): Promise<void>;
  /** Advance one chain's receive index and derive its fresh address. */
  nextReceiveAddress(chain: ChainId): Promise<void>;
  /** Reset HD receive rotation to index 0 (new or deleted vault). */
  resetReceiveRotation(): void;
  /**
   * Lane C (bot use case): export the current account's extended public
   * key for one chain, so the owner can derive many receiving addresses
   * in their bot. Returns null when the vault is locked; throws for
   * TON/SOL, which have no extended public key (fully hardened paths).
   * The key is public data — it can never sign — but it reveals
   * addresses, balances and history, so the screen shows it only on
   * demand and never stores it.
   */
  exportAccountExtendedPublicKey(chain: ChainId): Promise<string | null>;
  refreshVaultAccounts(selection?: {
    account: number;
    index: number;
  }): Promise<void>;
  refreshBalances(): Promise<void>;
  refreshHistory(): Promise<void>;
  // Token balances refresh on demand (AssetRows calls it on mount and on
  // Retry; the Add Token dialog calls it after adding). It is NOT wired
  // into the provider boot effect: the provider tests derive real vault
  // addresses, and a boot-wired token refresh would fire live RPC calls
  // from unit tests. Native balances stay boot-wired; token balances are
  // asset-screen state, like prices (usePrices/useTokenPrices).
  refreshTokenBalances(): Promise<void>;
  setChainEnabled(chain: ChainId, enabled: boolean): void;
  addCustomToken(record: TokenRecord): { ok: true } | { ok: false; error: string };
  /**
   * Remove a user-added token (Lane C §6b fix): drops the record from
   * the custom list and persists the removal, then refreshes token
   * balances so the row disappears from the dashboard and /assets.
   * Default tokens are never in the custom list, so this can only
   * remove a token the user added — verified or unverified alike.
   */
  removeCustomToken(chain: ChainId, contract: string): { ok: true } | { ok: false; error: string };
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

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
  if (!vault.hasVault()) return 'no-vault';
  if (vault.isLocked()) return 'locked';
  return 'unlocked';
}

function computeBootVaultState(): VaultState {
  if (!vault.hasVault()) return 'no-vault';
  if (vault.hasStoredKey() && !readAutoLockEnabled()) return 'unlocked';
  return 'locked';
}

// Lane C, item 6: the vault uses a recovery passphrase the session does
// not know — derivation with '' would produce (and persist) the wrong
// addresses, so account switches must ask for it instead of deriving.
function computePassphraseNeeded(vaultState: VaultState): boolean {
  return (
    vaultState === 'unlocked' &&
    isPassphraseUsed() &&
    vault.getSessionPassphrase() === ''
  );
}

// Lane C, items 6/7/17: the accounts on record for this vault's phrase.
// A vault from before accounts existed has none stored: it holds
// Account 1. No vault means no accounts.
function syncedVaultAccounts(): number[] {
  if (!vault.hasVault()) return [];
  const stored = vault.readVaultAccounts();
  if (stored.length > 0) return stored;
  vault.writeVaultAccounts([0]);
  return [0];
}

// --- Lane G: central reason → human sentence map (Safe's cgw-errors.ts
// rule: "the status is never shown to the user"). No screen may render a
// raw reason: call this instead. Unknown provider reasons fall back to a
// generic sentence, never to the raw string. Kept in state and logs only.
export function humanReasonMessage(
  reason?: string,
  kind: 'balance' | 'history' | 'price' | 'track' | 'general' = 'balance',
): string {
  if (!reason) return '';

  const normalized = reason.toLowerCase();

  if (normalized.includes('no-adapter')) {
    switch (kind) {
      case 'history':
        return 'Transaction history is not connected for this chain yet.';
      case 'price':
        return 'Prices are not connected for this chain yet.';
      case 'track':
        return 'Tracking is not connected for this chain yet.';
      case 'general':
        return 'This feature is not connected yet.';
      default:
        return 'This chain is not connected yet.';
    }
  }

  if (normalized.includes('no-address')) {
    return 'No address is available for this chain yet.';
  }

  switch (normalized) {
    case 'unsupported':
    case 'unsupported-version':
    case 'version-not-allowed':
      return 'This is not supported for this chain yet.';
    case 'unavailable-chain-data':
      return 'Data for this chain is unavailable right now.';
    case 'stub':
      return 'This feature is not available yet.';
    case 'invalid-length':
    case 'invalid-checksum':
    case 'invalid-character':
    case 'invalid-base58':
    case 'invalid-point':
      return 'The address for this chain looks invalid.';
    case 'secret-like':
    case 'private-key':
      return 'That looks like a secret. Please check what you entered.';
  }

  if (normalized.includes('invalid') && normalized.includes('address')) {
    return 'The address for this chain looks invalid.';
  }

  if (kind === 'price') {
    switch (normalized) {
      case 'rate-limited':
        return 'Price feed rate-limited — try again shortly.';
      case 'network':
        return 'Could not reach the price feed — check your connection and retry.';
      case 'timeout':
        return 'Price feed timed out — retry.';
      case 'provider':
        return 'Price feed error — retry.';
    }
  }

  if (kind === 'track' && normalized === 'not-included') {
    return 'This transaction is not included in a block yet.';
  }

  if (isTransientReason(reason)) {
    return 'The network is busy or unreachable. Please try again in a moment.';
  }

  // A reason that already reads as a human sentence is shown as-is; the
  // map translates machine codes, it must not mangle informative messages.
  if (reason.includes(' ')) {
    return reason;
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

/**
 * Bounded-concurrency runner for the three refreshers (balances,
 * history, token balances). One shared instance per provider caps ALL
 * refresh network calls together — not per refresher.
 *
 * Why: unlocking a wallet used to fire the whole 43-row dashboard at
 * once — 22 native balance reads + 21 token balance reads + 7 history
 * reads + 2 CoinGecko batches, ~50 requests in the first second, most
 * of them JSON-RPC against the same free-tier hosts (14 EVM chains on
 * *.publicnode.com, each balance read a getChainId + getBalance pair).
 * The free tiers 429, fetchWithRetry retries each 3x, and the hero
 * reads "$0.00 (Partial)" on a wallet whose every balance is zero.
 * Four concurrent network calls, with retries inside the slot, keeps
 * the burst inside the free tier while the rows still settle in a few
 * seconds. Pure promise queueing — no timers — so fake-timer tests are
 * unaffected. The cap is deliberately small; raise it only with a live
 * 429 measurement behind the change.
 */
interface RefreshLimiter {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createRefreshLimiter(limit: number): RefreshLimiter {
  let active = 0;
  const queue: Array<() => void> = [];
  const release = (): void => {
    active -= 1;
    const next = queue.shift();
    if (next !== undefined) next();
  };
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = (): void => {
          active += 1;
          task().then(
            (value) => {
              release();
              resolve(value);
            },
            (error) => {
              release();
              reject(error);
            },
          );
        };
        if (active < limit) start();
        else queue.push(start);
      });
    },
  };
}

export const REFRESH_CONCURRENCY_LIMIT = 4;

// --- Lane G: persisted public vault addresses (see VAULT_ADDRESSES_KEY) ---
const isStoredAddress = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 && !/\s/.test(value);

interface PersistedVaultAddresses {
  account: number;
  index: number;
  addresses: PerChain<string[]>;
}

function readPersistedVaultAddresses(
  key: string = VAULT_ADDRESSES_KEY,
): PersistedVaultAddresses | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
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
  key: string = VAULT_ADDRESSES_KEY,
): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: 1, account, index, addresses }),
    );
  } catch {
    // Persistence is best-effort; the in-memory addresses still work.
  }
}

// --- Lane C, item 8: HD receive rotation ----------------------------------
// Which address index the Receive screen shows per chain. Rotating gives
// a fresh address (and QR) for the next payment, derived from the next
// unused index; the account address (index 0) never moves. The indices
// belong to the current vault's phrase: they reset when a vault is
// created or deleted (see resetReceiveRotation, called by the screens
// that create or delete a vault), and on account switch.
type ReceiveIndices = Partial<Record<ChainId, number>>;

export const RECEIVE_INDEX_KEY = 'bawa-receive-index:v1';

export function readReceiveIndices(): ReceiveIndices {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(RECEIVE_INDEX_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return {};
    const out: ReceiveIndices = {};
    for (const chain of ALL_CHAIN_IDS) {
      const value: unknown = parsed[chain];
      if (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
      ) {
        out[chain] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeReceiveIndices(indices: ReceiveIndices): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      RECEIVE_INDEX_KEY,
      JSON.stringify({ version: 1, ...indices }),
    );
  } catch {
    // Persistence is best-effort; the in-memory indices still work.
  }
}

/** Next unused index for a chain: one past the stored index (0 when none is stored yet). */
export function nextReceiveIndex(chain: ChainId, current: ReceiveIndices): number {
  const stored = current[chain];
  return (typeof stored === 'number' ? stored : 0) + 1;
}

export function resetReceiveIndices(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(RECEIVE_INDEX_KEY);
  } catch {
    // Best-effort; the in-memory indices are reset by the caller.
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
  // A locked boot never rehydrates persisted addresses into state.
  // TEMPORARY devnet mode: a reload while devnet is on boots into
  // devnet, reading the devnet record — never the mainnet one.
  const persisted =
    computeBootVaultState() === 'unlocked'
      ? readPersistedVaultAddresses(
          readDevnetEnabled() ? VAULT_ADDRESSES_KEY_DEVNET : VAULT_ADDRESSES_KEY,
        )
      : null;
  const bootVaultState = computeBootVaultState();
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
    vaultState: computeBootVaultState(),
    vaultAccount: persisted === null
      ? { account: 0, index: 0 }
      : { account: persisted.account, index: persisted.index },
    vaultAccounts: syncedVaultAccounts(),
    vaultPassphraseNeeded: computePassphraseNeeded(bootVaultState),
    receiveIndices: readReceiveIndices(),
    receiveAddresses: perChain<string | null>(() => null),
    vaultAddresses: persisted === null
      ? perChain<string[]>(() => [])
      : persisted.addresses,
    vaultProfileIds: null,
    balances,
    history: mayFetch ? initialHistory() : clearedHistory(),
    tokenBalances: {},
    enabledChains: readEnabledChains(),
    customTokens: readCustomTokens(),
    hydrating: true,
  };
}

/**
 * Balance state from a fetched base-units value: exactly '0' is a
 * zero balance, anything else is available. Shared by refreshBalances
 * and refreshTokenBalances.
 */
function balanceStateFromValue(valueBaseUnits: string, fetchedAtMs: number): BalanceState {
  return valueBaseUnits === '0'
    ? { status: 'zero', value: '0', fetchedAtMs }
    : { status: 'available', value: valueBaseUnits, fetchedAtMs };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // No state or refs may hold a mnemonic, seed, private key, private extended key,
  // vault key or data key. Only validated public watch-only wallets enter state.
  // vaultAddresses are public addresses derived from the vault; they are safe here.
  const [state, setState] = useState<WalletState>(() => initialWalletState());
  const [selectedChain, setSelectedChain] = useState<ChainId>('btc');
  const [hydrated, setHydrated] = useState(false);

  const [autoLockEnabled, setAutoLockEnabledState] = useState<boolean>(() => readAutoLockEnabled());
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => readAutoLockMinutes());
  // TEMPORARY devnet mode (mirrors autoLockEnabled). The ref lets the
  // refresh callbacks see the new mode synchronously, before React
  // re-renders with the new state value.
  const [devnetEnabled, setDevnetEnabledState] = useState<boolean>(() => readDevnetEnabled());
  const devnetEnabledRef = useRef(devnetEnabled);
  const current = useRef(state);
  const additions = useRef(perChain(() => 0));
  const changed = useRef(perChain(() => false));
  const derivations = useRef(perChain(() => 0));
  const vaultDerivations = useRef(0);
  // Lane D (FIX-ALL): receive-address derivations have their own
  // generation. They used to share vaultDerivations with
  // refreshVaultAccounts, so when both ran concurrently the first
  // finisher's result was discarded as stale by the second one's
  // increment. lockVault bumps both (a lock invalidates either kind).
  const receiveDerivations = useRef(0);
  const balanceRequests = useRef(perChain(() => 0));
  const historyRequests = useRef(perChain(() => 0));
  // Per-token request generations (same stale-write guard as the
  // per-chain counters above, keyed by tokenKey).
  const tokenBalanceRequests = useRef<Record<string, number>>({});
  // Shared refresh limiter (see createRefreshLimiter): one instance
  // caps balances + history + token balances together at 4 concurrent
  // network calls, so the three refreshers can never re-form the burst.
  const refreshLimiter = useRef(createRefreshLimiter(REFRESH_CONCURRENCY_LIMIT));
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
  /**
   * Shared adapter-resolution prologue for the refresh callbacks:
   * load the mainnet or devnet adapters for the current mode and a
   * resolver that picks the right one per chain at call time.
   */
  const loadAdapters = useCallback(async () => {
    const adapters = devnetEnabledRef.current
      ? await ensureDevnetAdapters()
      : await ensureAdapters();
    const resolveAdapter = (chain: ChainId) =>
      devnetEnabledRef.current
        ? adapters.getDevnetAdapter(chain)
        : adapters.getAdapter(chain);
    return { adapters, resolveAdapter };
  }, []);

  const refreshBalances = useCallback(async () => {
    // Lane PERF: do not load the adapters chunk when no chain can fetch.
    // loadAdapters() pulls in the ~294 KB adapters chunk (viem + all
    // adapters); the old code called it before any per-chain check, so
    // a refresh with no fetchable chain - no verified adapter plus an
    // address - downloaded the chunk only to resolve every chain to
    // 'unavailable' with zero network calls. The check below mirrors
    // the per-chain gate exactly (verified capability + a real address),
    // so the early return resolves every chain the same way the full
    // path would have, without the chunk.
    const addressFor = (chain: ChainId): string | undefined =>
      current.current.vaultAddresses[chain][0] ??
      current.current.addresses[chain][0]?.address;
    const canFetch = ALL_CHAIN_IDS.some(
      (chain) => availableFor('balance').includes(chain) && Boolean(addressFor(chain)),
    );
    if (!canFetch) {
      const startMerge: Partial<Record<ChainId, BalanceState>> = {};
      for (const chain of ALL_CHAIN_IDS) {
        startMerge[chain] = !availableFor('balance').includes(chain)
          ? { status: 'unavailable', reason: 'no-adapter' }
          : { status: 'unavailable', reason: 'no-address' };
      }
      update(previous => ({
        ...previous,
        balances: { ...previous.balances, ...startMerge },
      }));
      return;
    }
    const { resolveAdapter } = await loadAdapters();
    // Every chain in the registry resolves out of the initial 'loading'
    // state here — not just the four balance chains — so no chain is left
    // showing a first-load skeleton forever. Chains without a verified
    // balance adapter resolve to unavailable/no-adapter below.
    //
    // Lane PERF: batch the state writes. The old code called update()
    // once per chain at start (loading/refreshing) and once per chain as
    // each fetch landed - up to ~44 provider updates per refresh, each
    // re-rendering every consumer (all 43 dashboard rows). Now one
    // update carries the start states + immediate resolutions, and one
    // update merges all fetched results. The per-chain request counters
    // still guard every write: a result merges only if its chain's
    // counter has not moved on since the fetch started.
    const requests: Partial<Record<ChainId, number>> = {};
    const startMerge: Partial<Record<ChainId, BalanceState>> = {};
    const results: Partial<Record<ChainId, BalanceState>> = {};
    const pending: Array<Promise<void> | null> = ALL_CHAIN_IDS.map((chain) => {
      const request = ++balanceRequests.current[chain];
      requests[chain] = request;
      if (!availableFor('balance').includes(chain)) {
        startMerge[chain] = { status: 'unavailable', reason: 'no-adapter' };
        return null;
      }
      const adapter = resolveAdapter(chain);
      if (!adapter) {
        startMerge[chain] = { status: 'unavailable', reason: 'no-adapter' };
        return null;
      }
      const address =
        current.current.vaultAddresses[chain][0] ??
        current.current.addresses[chain][0]?.address;
      if (!address) {
        startMerge[chain] = { status: 'unavailable', reason: 'no-address' };
        return null;
      }
      const previous = current.current.balances[chain];
      const hasLastGood = previous.status === 'available' || previous.status === 'zero';
      if (hasLastGood) {
        startMerge[chain] = { ...previous, refreshing: true, stale: false };
      } else if (previous.status !== 'loading') {
        startMerge[chain] = { status: 'loading' };
      }
      return (async () => {
        const result = await refreshLimiter.current.run(() =>
          fetchWithRetry(() => adapter.getBalance(address)),
        );
        if (request !== balanceRequests.current[chain]) return;
        if (result.status === 'ok') {
          const fetchedAtMs = Date.now();
          // Lane F (FIX-ALL): keep the answering host on the state, so
          // the Networks screen can show which RPC served this balance
          // (result.source is the adapter's answering endpoint — the
          // failover loop reports its own hostname, never the primary).
          const next = {
            ...balanceStateFromValue(result.data.valueBaseUnits, fetchedAtMs),
            source: result.source,
          };
          results[chain] = next;
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
          results[chain] = { ...previous, refreshing: false, stale: true, reason: result.reason };
        } else if (result.status === 'unavailable') {
          results[chain] = { status: 'unavailable', reason: result.reason };
        } else {
          results[chain] = { status: 'error', reason: result.reason };
        }
      })();
    });
    // Immediate resolutions + start states land in one update, before
    // any fetch completes - a chain with no adapter/address resolves at
    // once, exactly as before, instead of waiting behind the slowest
    // fetch.
    if (Object.keys(startMerge).length > 0) {
      update(previous => ({
        ...previous,
        balances: { ...previous.balances, ...startMerge },
      }));
    }
    const settled = await Promise.allSettled(
      pending.filter((task): task is Promise<void> => task !== null),
    );
    // Merge only chains whose request counter has not moved on since
    // their fetch started; a newer refresh owns those chains now.
    const freshResults: Partial<Record<ChainId, BalanceState>> = {};
    for (const chain of ALL_CHAIN_IDS) {
      const result = results[chain];
      if (result !== undefined && balanceRequests.current[chain] === requests[chain]) {
        freshResults[chain] = result;
      }
    }
    if (Object.keys(freshResults).length > 0) {
      update(previous => ({
        ...previous,
        balances: { ...previous.balances, ...freshResults },
      }));
    }
    // Preserve the old rejection contract: a chain whose fetch threw
    // rejects the refresh (callers catch it), but only after the other
    // chains' results have landed.
    for (const entry of settled) {
      if (entry.status === 'rejected') throw entry.reason;
    }
  }, [update, loadAdapters]);

  const refreshHistory = useCallback(async () => {
    // Lane PERF: same no-fetch early return as refreshBalances - do not
    // load the adapters chunk when no chain has a verified history
    // capability plus a real address.
    const addressFor = (chain: ChainId): string | undefined =>
      current.current.vaultAddresses[chain][0] ??
      current.current.addresses[chain][0]?.address;
    const canFetch = ALL_CHAIN_IDS.some(
      (chain) => availableFor('history').includes(chain) && Boolean(addressFor(chain)),
    );
    if (!canFetch) {
      const startMerge: Partial<Record<ChainId, HistoryState>> = {};
      for (const chain of ALL_CHAIN_IDS) {
        startMerge[chain] = !availableFor('history').includes(chain)
          ? { status: 'unavailable', reason: 'no-adapter', txs: [] }
          : { status: 'unavailable', reason: 'no-address', txs: [] };
      }
      update(previous => ({
        ...previous,
        history: { ...previous.history, ...startMerge },
      }));
      return;
    }
    const { resolveAdapter } = await loadAdapters();
    // See refreshBalances: every chain resolves out of 'loading' here.
    // Lane PERF: same batching as refreshBalances - one update for the
    // start states + immediate resolutions, one for all fetched results.
    const requests: Partial<Record<ChainId, number>> = {};
    const startMerge: Partial<Record<ChainId, HistoryState>> = {};
    const results: Partial<Record<ChainId, HistoryState>> = {};
    const pending: Array<Promise<void> | null> = ALL_CHAIN_IDS.map((chain) => {
      const request = ++historyRequests.current[chain];
      requests[chain] = request;
      if (!availableFor('history').includes(chain)) {
        startMerge[chain] = { status: 'unavailable', reason: 'no-adapter', txs: [] };
        return null;
      }
      const adapter = resolveAdapter(chain);
      if (!adapter) {
        startMerge[chain] = { status: 'unavailable', reason: 'no-adapter', txs: [] };
        return null;
      }
      const address =
        current.current.vaultAddresses[chain][0] ??
        current.current.addresses[chain][0]?.address;
      if (!address) {
        startMerge[chain] = { status: 'unavailable', reason: 'no-address', txs: [] };
        return null;
      }
      const previous = current.current.history[chain];
      const hasLastGood = previous.status === 'loaded' || previous.status === 'empty';
      if (hasLastGood) {
        startMerge[chain] = { ...previous, refreshing: true, stale: false };
      } else if (previous.status !== 'loading') {
        startMerge[chain] = { status: 'loading', txs: [] };
      }
      return (async () => {
        const result = await refreshLimiter.current.run(() =>
          fetchWithRetry(() => adapter.getHistory(address, 25)),
        );
        if (request !== historyRequests.current[chain]) return;
        if (result.status === 'ok') {
          const fetchedAtMs = Date.now();
          results[chain] =
            result.data.length === 0
              ? { status: 'empty', txs: [], fetchedAtMs }
              : { status: 'loaded', txs: result.data, fetchedAtMs };
        } else if (hasLastGood) {
          results[chain] = { ...previous, refreshing: false, stale: true, reason: result.reason };
        } else if (result.status === 'unavailable') {
          results[chain] = { status: 'unavailable', reason: result.reason, txs: [] };
        } else {
          results[chain] = { status: 'error', reason: result.reason, txs: [] };
        }
      })();
    });
    if (Object.keys(startMerge).length > 0) {
      update(previous => ({
        ...previous,
        history: { ...previous.history, ...startMerge },
      }));
    }
    const settled = await Promise.allSettled(
      pending.filter((task): task is Promise<void> => task !== null),
    );
    const freshResults: Partial<Record<ChainId, HistoryState>> = {};
    for (const chain of ALL_CHAIN_IDS) {
      const result = results[chain];
      if (result !== undefined && historyRequests.current[chain] === requests[chain]) {
        freshResults[chain] = result;
      }
    }
    if (Object.keys(freshResults).length > 0) {
      update(previous => ({
        ...previous,
        history: { ...previous.history, ...freshResults },
      }));
    }
    for (const entry of settled) {
      if (entry.status === 'rejected') throw entry.reason;
    }
  }, [update, loadAdapters]);

  // Token balances (token discovery): the 7 default tokens plus the
  // user-added ones, each read with its real on-chain balance via
  // fetchTokenBalance (ERC-20 eth_call / TRC-20 triggerconstant-
  // contract). Same last-good/stale shape as refreshBalances, same
  // bounded retry, same "never zero on failure" rule. A disabled
  // chain's tokens resolve unavailable/disabled and are hidden by the
  // asset rows. The token-balance module is dynamically imported so the
  // viem chunk stays out of first paint, like the adapters above.
  const refreshTokenBalances = useCallback(async () => {
    // TEMPORARY devnet mode (UI/UX fixes, item 2): token balances are
    // mainnet reads — ERC-20 eth_call / TRC-20 triggerconstant-contract
    // against mainnet RPCs and mainnet contracts. In devnet mode the
    // EVM addresses are the mainnet addresses (same m/44'/60' path),
    // so reading them would display the user's real mainnet token
    // balances inside test mode: mainnet leakage. Devnet has no token
    // contracts configured, so every token resolves unavailable with a
    // devnet reason and no network call is made. The request counters
    // are bumped first so an in-flight mainnet refresh cannot land
    // after this and overwrite the devnet state.
    if (devnetEnabledRef.current) {
      // Lane PERF: one update for all devnet tokens, not one per token.
      const devnetTokens = [...DEFAULT_TOKENS, ...current.current.customTokens];
      const devnetUnavailable: Record<string, BalanceState> = {};
      for (const token of devnetTokens) {
        const key = tokenKeyOf(token);
        tokenBalanceRequests.current[key] =
          (tokenBalanceRequests.current[key] ?? 0) + 1;
        devnetUnavailable[key] = { status: 'unavailable', reason: 'devnet-no-tokens' };
      }
      update((previous) => ({
        ...previous,
        tokenBalances: { ...previous.tokenBalances, ...devnetUnavailable },
      }));
      return;
    }
    const { fetchTokenBalance } = await import('../wallet/adapters/token-balances');
    const tokens = [...DEFAULT_TOKENS, ...current.current.customTokens];
    // Lane PERF: same batching as refreshBalances - one update for the
    // start states + immediate resolutions, one for all fetched results.
    const requests: Record<string, number> = {};
    const startMerge: Record<string, BalanceState> = {};
    const results: Record<string, BalanceState> = {};
    const pending: Array<Promise<void> | null> = tokens.map((token) => {
      const key = tokenKeyOf(token);
      const request = (tokenBalanceRequests.current[key] ?? 0) + 1;
      tokenBalanceRequests.current[key] = request;
      requests[key] = request;
      if (!current.current.enabledChains.includes(token.chain)) {
        startMerge[key] = { status: 'unavailable', reason: 'disabled' };
        return null;
      }
      const address =
        current.current.vaultAddresses[token.chain][0] ??
        current.current.addresses[token.chain][0]?.address;
      if (!address) {
        startMerge[key] = { status: 'unavailable', reason: 'no-address' };
        return null;
      }
      const previous = current.current.tokenBalances[key];
      const hasLastGood =
        previous !== undefined &&
        (previous.status === 'available' || previous.status === 'zero');
      if (hasLastGood) {
        startMerge[key] = { ...previous, refreshing: true, stale: false };
      } else if (previous === undefined || previous.status !== 'loading') {
        startMerge[key] = { status: 'loading' };
      }
      return (async () => {
        const result = await refreshLimiter.current.run(() =>
          fetchWithRetry(() =>
            fetchTokenBalance({
              chain: token.chain,
              contract: token.contract,
              ownerAddress: address,
              decimals: token.decimals,
            }),
          ),
        );
        if (request !== tokenBalanceRequests.current[key]) return;
        if (result.status === 'ok') {
          const next = balanceStateFromValue(result.data.valueBaseUnits, Date.now());
          results[key] = next;
        } else if (hasLastGood && previous !== undefined) {
          results[key] = { ...previous, refreshing: false, stale: true, reason: result.reason };
        } else if (result.status === 'unavailable') {
          results[key] = { status: 'unavailable', reason: result.reason };
        } else {
          results[key] = { status: 'error', reason: result.reason };
        }
      })();
    });
    if (Object.keys(startMerge).length > 0) {
      update(previous => ({
        ...previous,
        tokenBalances: { ...previous.tokenBalances, ...startMerge },
      }));
    }
    const settled = await Promise.allSettled(
      pending.filter((task): task is Promise<void> => task !== null),
    );
    const freshResults: Record<string, BalanceState> = {};
    for (const key of Object.keys(results)) {
      const result = results[key];
      if (result !== undefined && tokenBalanceRequests.current[key] === requests[key]) {
        freshResults[key] = result;
      }
    }
    if (Object.keys(freshResults).length > 0) {
      update(previous => ({
        ...previous,
        tokenBalances: { ...previous.tokenBalances, ...freshResults },
      }));
    }
    for (const entry of settled) {
      if (entry.status === 'rejected') throw entry.reason;
    }
  }, [update]);

  // Adding or removing a watch-only wallet re-fetches balances (and
  // history after them) for the new address set. Token gaps, item 6:
  // without this, a wallet added after boot kept its boot-time balance
  // state ('unavailable', no address) until a reload or a manual
  // refresh — the boot refresh runs only once at hydration. These live
  // below refreshBalances/refreshHistory so their stable identities can
  // be listed as dependencies.
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
    void refreshBalances().finally(() => { void refreshHistory(); }).catch(() => {});
  }, [putWallet, refreshBalances, refreshHistory]);

  // Lane B (Finish the Product): add a plain public address watch-only,
  // fanned out to every chain in its family. One 0x address is the same
  // address on all fifty-nine 0x EVM chains (Lane 80-APP), so importing
  // it watches all of
  // them; every other address family is a single chain. The stored value
  // is the address itself (derivedCount 1): refreshChain derives it via
  // the address branch of engine/boundary.ts deriveAddress, and the
  // balance/history/token refreshes then read it like any other
  // watch-only address — no per-chain special-casing downstream.
  // A chain that already has a watch-only entry is skipped, never
  // overwritten: replacing an extended-key entry with a single address
  // would silently drop its five derived addresses.
  const addWatchOnlyAddress = useCallback(async (chain: ChainId, address: string, label: string) => {
    const epoch = lifetime.current;
    const publicAddress = address.trim();
    const { validateWatchOnlyImport } = await import('../engine/boundary');
    const validation = await validateWatchOnlyImport(chain, publicAddress);
    if (!validation.ok) throw new Error(validation.message);
    if (validation.kind !== 'address') {
      throw new Error('Expected a public address for this import.');
    }
    if (epoch !== lifetime.current) return { added: [], skipped: [] };
    const trimmedLabel = label.trim();
    if (trimmedLabel.length > LABEL_MAX_LENGTH) {
      throw new Error(`Label must be at most ${LABEL_MAX_LENGTH} characters.`);
    }
    const family = watchOnlyFamilyChains(chain);
    const added: ChainId[] = [];
    const skipped: ChainId[] = [];
    for (const familyChain of family) {
      if (current.current.xpubs[familyChain] !== null) {
        skipped.push(familyChain);
        continue;
      }
      ++additions.current[familyChain];
      changed.current[familyChain] = true;
      const wallet: WatchOnlyWallet = {
        chain: familyChain,
        xpub: publicAddress,
        label: trimmedLabel,
        derivedCount: 1,
      };
      // putWallet awaits refreshChain, which derives the address; the
      // awaits are sequential so a late family member cannot overwrite
      // an earlier one's state.
      await putWallet(familyChain, wallet);
      added.push(familyChain);
    }
    if (added.length > 0) {
      void refreshBalances().finally(() => { void refreshHistory(); }).catch(() => {});
    }
    return { added, skipped };
  }, [putWallet, refreshBalances, refreshHistory]);

  const removeXpub = useCallback((chain: ChainId) => {
    ++additions.current[chain];
    changed.current[chain] = true;
    void putWallet(chain, null).finally(() => {
      void refreshBalances().finally(() => { void refreshHistory(); }).catch(() => {});
    });
  }, [putWallet, refreshBalances, refreshHistory]);

  // Enable/disable one registry chain. Persisted (public data only) and
  // kept in registry order. Enabling re-fetches the chain's native
  // balance and its tokens; disabling hides its rows (AssetRows filters
  // on enabledChains) and marks its tokens unavailable/disabled.
  const setChainEnabled = useCallback((chain: ChainId, enabled: boolean) => {
    const next = enabled
      ? [...current.current.enabledChains, chain]
      : current.current.enabledChains.filter((candidate) => candidate !== chain);
    const ordered = SUPPORTED_CHAINS.filter((candidate) => next.includes(candidate));
    writeEnabledChains(ordered);
    update(previous => ({ ...previous, enabledChains: ordered }));
    if (enabled) {
      void refreshBalances();
      void refreshTokenBalances();
    }
  }, [update, refreshBalances, refreshTokenBalances]);

  // Adds a user-verified token record (the Add Token dialog verifies
  // before calling). Duplicates are checked against the defaults AND
  // the custom list — adding USDC again must say "Already added", not
  // create a second row. Persisted (public data only), then its balance
  // is fetched.
  const addCustomToken = useCallback((record: TokenRecord) => {
    if (
      isDuplicateToken(
        [...DEFAULT_TOKENS, ...current.current.customTokens],
        record.chain,
        record.contract,
      )
    ) {
      return { ok: false as const, error: 'Already added' };
    }
    const result = addCustomTokenToList(current.current.customTokens, record);
    if ('error' in result) {
      return { ok: false as const, error: result.error };
    }
    writeCustomTokens(result.list);
    update(previous => ({ ...previous, customTokens: result.list }));
    void refreshTokenBalances();
    return { ok: true as const };
  }, [update, refreshTokenBalances]);

  // Remove a user-added token (Lane C §6b fix): the mirror of
  // addCustomToken — same persistence, same state update, same
  // balance refresh, so the row disappears everywhere at once.
  const removeCustomToken = useCallback((chain: ChainId, contract: string) => {
    const result = removeCustomTokenFromList(current.current.customTokens, chain, contract);
    if ('error' in result) {
      return { ok: false as const, error: result.error };
    }
    writeCustomTokens(result.list);
    update(previous => ({ ...previous, customTokens: result.list }));
    void refreshTokenBalances();
    return { ok: true as const };
  }, [update, refreshTokenBalances]);

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
    // Lane D (FIX-ALL): attempt autoUnlock FIRST. The old order read
    // computeVaultState() (in-memory lock state) before awaiting
    // autoUnlock(), and || short-circuited - so a call made before the
    // mount auto-unlock effect finished bailed to the persisted-restore
    // path without ever attempting the unlock, even though the comment
    // below promised autoUnlock restores the mnemonic. That made a boot
    // re-derivation silently no-op. autoUnlock is idempotent: an already
    // open vault returns true at once.
    const unlocked = await vault.autoUnlock();
    const vaultState = computeVaultState();
    const profileIds = vault.hasVault() ? vault.vaultProfiles() : null;
    const selected = selection ?? current.current.vaultAccount;
    const storedAccounts = syncedVaultAccounts();
    const passphraseNeeded = computePassphraseNeeded(vaultState);
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
      !unlocked
    ) {
      const persisted = readPersistedVaultAddresses(
        devnetEnabledRef.current ? VAULT_ADDRESSES_KEY_DEVNET : VAULT_ADDRESSES_KEY,
      );
      // While locked, derived addresses must remain hidden.
      const restored =
        vaultState === 'unlocked'
          && persisted !== null
          && persisted.account === selected.account
          && persisted.index === selected.index
          ? persisted.addresses
          : perChain<string[]>(() => []);
      update(previous => ({
        ...previous,
        vaultState,
        vaultProfileIds: profileIds,
        vaultAddresses: restored,
        vaultAccounts: storedAccounts,
        vaultPassphraseNeeded: passphraseNeeded,
      }));
      return;
    }
    let derived: Record<ChainId, string>;
    try {
      const core = await loadVaultCore();
      // TEMPORARY devnet mode: derive the testnet addresses (BTC at
      // m/84'/1'/..., TON testnet-flagged) and persist them under the
      // separate devnet key — the mainnet record is never overwritten.
      const devnet = devnetEnabledRef.current;
      derived = await vault.withMnemonic((mnemonic) =>
        devnet
          ? core.deriveDevnetAddressesAt(
              mnemonic,
              // The passphrase lane (p13a) already landed: derive with the
              // session passphrase, never '' when one is in use.
              vault.getSessionPassphrase(),
              selected.account,
              selected.index,
            )
          : core.deriveAddressesAt(
              mnemonic,
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
        vaultAccounts: storedAccounts,
        vaultPassphraseNeeded: passphraseNeeded,
      }));
      throw error;
    }
    if (request !== vaultDerivations.current) return;
    const addresses = Object.fromEntries(
      ALL_CHAIN_IDS.map((chain) => [chain, [derived[chain]]]),
    ) as PerChain<string[]>;
    update(previous => ({
      ...previous,
      vaultState,
      vaultProfileIds: profileIds,
      vaultAddresses: addresses,
      vaultAccounts: storedAccounts,
      vaultPassphraseNeeded: false,
    }));
    // Persist the PUBLIC addresses only (never keys or the mnemonic), so a
    // reload or direct load can fetch balances/history without an unlock.
    // In devnet mode the devnet record is written; the mainnet record
    // is left untouched, so toggling off restores it.
    persistVaultAddresses(
      selected.account,
      selected.index,
      addresses,
      devnetEnabledRef.current ? VAULT_ADDRESSES_KEY_DEVNET : VAULT_ADDRESSES_KEY,
    );
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
  // NEW selection passed explicitly — never with captured state. A new
  // account starts its HD receive rotation over (index 0 on every chain).
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
    resetReceiveIndices();
    update(previous => ({
      ...previous,
      vaultAccount: selection,
      receiveIndices: readReceiveIndices(),
      receiveAddresses: perChain<string | null>(() => null),
    }));
    await refreshVaultAccounts(selection);
  }, [update, refreshVaultAccounts]);

  // Lane C, item 7: switch to another account from the same phrase,
  // keeping the current address index.
  const selectVaultAccount = useCallback(async (account: number) => {
    await setVaultAccount(account, current.current.vaultAccount.index);
  }, [setVaultAccount]);

  // Lane C, items 6/7/17: create `count` NEW accounts from the vault
  // phrase (Account 1 exists → 10 more gives Account 2–11). Only public
  // index numbers are recorded; derivation happens on selection, so no
  // unlock is needed to create them. Returns the new indices.
  const createVaultAccounts = useCallback(async (count: number) => {
    if (!vault.hasVault()) {
      throw new Error('No vault exists yet. Create or import a wallet first.');
    }
    const merged = vault.nextVaultAccounts(current.current.vaultAccounts, count);
    const added = merged.filter(
      (account) => !current.current.vaultAccounts.includes(account),
    );
    vault.writeVaultAccounts(merged);
    update(previous => ({ ...previous, vaultAccounts: merged }));
    return added;
  }, [update]);

  // Lane C, item 8: (re-)derive the HD receive addresses for the current
  // account. Chains sharing one receive index are derived in a single
  // deriveAddressesAt call; Lane A: SOL and TON rotate through the same
  // call. A locked vault, or a passphrase the session does not know,
  // leaves every address unknown.
  const refreshReceiveAddresses = useCallback(async () => {
    // Lane D (FIX-ALL): own generation counter (see vaultDerivations
    // above) and autoUnlock attempted before the state check, for the
    // same short-circuit reason as refreshVaultAccounts.
    const request = ++receiveDerivations.current;
    const selection = current.current.vaultAccount;
    const indices = current.current.receiveIndices;
    const passphraseKnown =
      !isPassphraseUsed() || vault.getSessionPassphrase() !== '';
    const unlocked = await vault.autoUnlock();
    if (
      computeVaultState() !== 'unlocked' ||
      !passphraseKnown ||
      !unlocked
    ) {
      update(previous => ({
        ...previous,
        receiveAddresses: perChain<string | null>(() => null),
      }));
      return;
    }
    const out: PerChain<string | null> = perChain<string | null>(() => null);
    const rotatable = ALL_CHAIN_IDS.filter(
      (chain) => canRotateReceiveAddress(chain),
    );
    const byIndex = new Map<number, ChainId[]>();
    for (const chain of rotatable) {
      const index = indices[chain] ?? 0;
      const list = byIndex.get(index) ?? [];
      list.push(chain);
      byIndex.set(index, list);
    }
    try {
      const core = await loadVaultCore();
      const devnet = devnetEnabledRef.current;
      await vault.withMnemonicAsync(async (mnemonic) => {
        for (const [index, chains] of byIndex) {
          const all = devnet
            ? await core.deriveDevnetAddressesAt(
                mnemonic,
                vault.getSessionPassphrase(),
                selection.account,
                index,
              )
            : await core.deriveAddressesAt(
                mnemonic,
                vault.getSessionPassphrase(),
                selection.account,
                index,
              );
          for (const chain of chains) {
            out[chain] = all[chain];
          }
        }
      });
    } catch {
      if (request !== receiveDerivations.current) return;
      update(previous => ({
        ...previous,
        receiveAddresses: perChain<string | null>(() => null),
      }));
      return;
    }
    if (request !== receiveDerivations.current) return;
    update(previous => ({ ...previous, receiveAddresses: out }));
  }, [update]);

  // Lane C, item 8: advance one chain's receive index and derive its
  // fresh address. Lane A: every chain rotates, SOL and TON included.
  const nextReceiveAddress = useCallback(async (chain: ChainId) => {
    const indices = {
      ...current.current.receiveIndices,
      [chain]: nextReceiveIndex(chain, current.current.receiveIndices),
    };
    writeReceiveIndices(indices);
    update(previous => ({ ...previous, receiveIndices: indices }));
    await refreshReceiveAddresses();
  }, [update, refreshReceiveAddresses]);

  // A vault's receive indices belong to its phrase: a new phrase starts
  // at index 0, and a deleted vault leaves nothing to rotate. Called by
  // the screens that create or delete a vault.
  const resetReceiveRotation = useCallback(() => {
    resetReceiveIndices();
    update(previous => ({
      ...previous,
      receiveIndices: {},
      receiveAddresses: perChain<string | null>(() => null),
    }));
  }, [update]);

  // Lane C (bot use case): export the current account's extended public
  // key for one chain. Locked vault → null (the screen hides the key).
  // The mnemonic is borrowed inside the vault closure and never leaves
  // this function; only the public key is returned.
  const exportAccountExtendedPublicKey = useCallback(
    async (chain: ChainId): Promise<string | null> => {
      if (
        computeVaultState() !== 'unlocked' ||
        !(await vault.autoUnlock())
      ) {
        return null;
      }
      const core = await loadVaultCore();
      let result: string | null = null;
      await vault.withMnemonicAsync(async (mnemonic) => {
        result = await core.getAccountExtendedPublicKey(
          mnemonic,
          vault.getSessionPassphrase(),
          chain,
          current.current.vaultAccount.account,
        );
      });
      return result;
    },
    [],
  );

  const unlockVault = useCallback(async (password: string, passphrase = '') => {
    if (isPassphraseUsed() && !passphrase) {
      throw new Error('This wallet uses a passphrase. Enter it to unlock.');
    }
    await vault.unlock(password, passphrase);
    await refreshVaultAccounts();
  }, [refreshVaultAccounts]);

  const lockVault = useCallback(() => {
    ++vaultDerivations.current;
    ++receiveDerivations.current;
    vault.lock();
    update(previous => ({
      ...previous,
      vaultState: computeVaultState(),
      vaultProfileIds: vault.hasVault() ? vault.vaultProfiles() : null,
      vaultAddresses: perChain<string[]>(() => []),
      vaultPassphraseNeeded: false,
      receiveAddresses: perChain<string | null>(() => null),
      balances: clearedBalances(),
      history: clearedHistory(),
      tokenBalances: {},
    }));
  }, [update]);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    if (!(AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes)) return;
    writeAutoLockMinutes(minutes);
    setAutoLockMinutesState(minutes);
  }, []);

  // Toggling handles the key-storage invariant: enabling deletes the
  // stored key at once (the vault stays unlocked in memory until the
  // timer fires or the page reloads); disabling stores the key when the
  // vault is unlocked in memory. When the vault is locked, disabling
  // stores nothing here — the caller unlocks with the password
  // afterwards, and unlock() stores the key because the preference is
  // already off by then.
  const setAutoLockEnabled = useCallback(async (enabled: boolean) => {
    writeAutoLockEnabled(enabled);
    if (enabled) {
      vault.deleteStoredKey();
    } else {
      await vault.storeCurrentKey();
    }
    setAutoLockEnabledState(enabled);
  }, []);

  // TEMPORARY devnet mode (mirrors setAutoLockEnabled). The ref is
  // updated before the re-derivation so refreshVaultAccounts (and the
  // balance/history refreshes it triggers) see the new mode at once.
  // Toggling off re-derives the mainnet addresses from the untouched
  // mainnet record.
  const setDevnetEnabled = useCallback(async (enabled: boolean) => {
    writeDevnetEnabled(enabled);
    devnetEnabledRef.current = enabled;
    setDevnetEnabledState(enabled);
    await refreshVaultAccounts();
  }, [refreshVaultAccounts]);

  // NO persisted deadline: the removed timer honored a stored deadline across
  // reloads, so an earlier-session deadline could fire minutes early even though
  // the setting said 5 minutes. Always count the FULL chosen duration from the
  // last unlock or activity, in the live session only.
  useEffect(() => {
    if (state.vaultState !== "unlocked" || !autoLockEnabled) {
      return;
    }

    if (autoLockMinutes === 0) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          lockVault();
        }
      };

      const handlePageHide = () => {
        lockVault();
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("pagehide", handlePageHide);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("pagehide", handlePageHide);
      };
    }

    const armAutoLockTimer = () =>
      window.setTimeout(lockVault, autoLockDurationMs(autoLockMinutes));

    let autoLockTimerId = armAutoLockTimer();

    const handleActivity = () => {
      window.clearTimeout(autoLockTimerId);
      autoLockTimerId = armAutoLockTimer();
    };

    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("wheel", handleActivity, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("wheel", handleActivity);
      window.clearTimeout(autoLockTimerId);
    };
  }, [state.vaultState, autoLockEnabled, autoLockMinutes, lockVault]);


  useEffect(() => {
    let cancelled = false;
    const saved = readStored();
    void Promise.all(ALL_CHAIN_IDS.map(async chain => {
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
      ALL_CHAIN_IDS.forEach(chain => { ++derivations.current[chain]; });
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
        vaultAccounts: syncedVaultAccounts(),
        vaultPassphraseNeeded: computePassphraseNeeded(computeVaultState()),
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
  // Lane D (FIX-ALL): the boot ALSO re-derives the vault addresses when
  // the persisted record for the current mode/selection cannot serve
  // them - otherwise a reload strands the wallet with no addresses at
  // all. The strand is real: the devnet pill flips before its
  // re-derivation finishes, so navigating (or reloading) mid-derivation
  // kills the derivation before it persists the devnet record, and
  // nothing on the boot path re-derived - Receive settled on 'No
  // receiving address available for this chain' forever (E2E-02, 3 of 4
  // full runs; the immediate-reload probe reproduced 3/3). The
  // re-derivation runs beside the balance refresh, not before it, so
  // boot is not delayed behind a full derivation when the record is
  // present.
  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      await vault.autoUnlock();
      if (computeVaultState() !== 'unlocked') return;
      // A passphrase wallet whose passphrase is unknown must not
      // re-derive: deriving with '' would produce (and persist) the
      // wrong addresses (same guard as refreshVaultAccounts).
      if (isPassphraseUsed() && vault.getSessionPassphrase() === '') return;
      const persisted = readPersistedVaultAddresses(
        devnetEnabledRef.current ? VAULT_ADDRESSES_KEY_DEVNET : VAULT_ADDRESSES_KEY,
      );
      const selection = current.current.vaultAccount;
      const hasAddresses =
        persisted !== null
        && persisted.account === selection.account
        && persisted.index === selection.index
        && ALL_CHAIN_IDS.some((chain) => persisted.addresses[chain].length > 0);
      if (!hasAddresses) {
        await refreshVaultAccounts().catch(() => {});
      }
    })();
    // Lane PERF: skip the boot refresh when there is nothing for it
    // to do. The guard reads STATE, not storage: a stored xpub that
    // fails validation never becomes an in-state wallet, yet the
    // initial state still starts that chain at 'loading', and only the
    // boot refresh resolves it out to 'unavailable'
    // (wallet-context-lane-g.test: "starts at loading when a stored
    // xpub may yield an address"). A storage-based guard was tried
    // first and broke that test: the persistence effect (declared
    // above, same hydrated commit) overwrites the stored xpubs with
    // the in-state ones - all null for the invalid key - before this
    // effect reads storage, so the guard saw "nothing stored" and
    // skipped the refresh that would have resolved the chain.
    // The state itself encodes the need: initialWalletState starts
    // balances/history at 'loading' exactly when a fetch may run, at
    // 'unavailable' when none can, and restores cached balances as
    // stale - so a refresh is needed iff some chain is loading or
    // holds a stale cached value. In the pure no-wallet case every
    // chain is 'unavailable' with no stale value, so skipping changes
    // nothing; the re-derivation path above refreshes on its own when
    // it derives addresses, and a wallet created or added later
    // refreshes through its own callers (createVaultAccounts, addXpub),
    // never this effect.
    const needsBootRefresh = ALL_CHAIN_IDS.some((chain) => {
      const balance = current.current.balances[chain];
      const history = current.current.history[chain];
      return (
        balance.status === 'loading' ||
        balance.stale === true ||
        history.status === 'loading' ||
        history.stale === true
      );
    });
    if (!needsBootRefresh) return;
    void refreshBalances().finally(() => { void refreshHistory(); }).catch(() => {});
  }, [hydrated, refreshBalances, refreshHistory, refreshVaultAccounts]);

  const value = useMemo<WalletContextValue>(() => ({
    ...state, selectedChain, setSelectedChain, addXpub, addWatchOnlyAddress, removeXpub, refreshChain,
    setVaultAccount, selectVaultAccount, createVaultAccounts,
    refreshReceiveAddresses, nextReceiveAddress, resetReceiveRotation,
    exportAccountExtendedPublicKey,
    refreshVaultAccounts, refreshBalances, refreshHistory,
    refreshTokenBalances, setChainEnabled, addCustomToken, removeCustomToken,
    lockVault, unlockVault, autoLockEnabled, autoLockMinutes, setAutoLockMinutes, setAutoLockEnabled,
    devnetEnabled, setDevnetEnabled,
  }), [state, selectedChain, addXpub, addWatchOnlyAddress, removeXpub, refreshChain, setVaultAccount, selectVaultAccount, createVaultAccounts, refreshReceiveAddresses, nextReceiveAddress, resetReceiveRotation, exportAccountExtendedPublicKey, refreshVaultAccounts, refreshBalances, refreshHistory, refreshTokenBalances, setChainEnabled, addCustomToken, removeCustomToken, lockVault, unlockVault, autoLockEnabled, autoLockMinutes, setAutoLockMinutes, setAutoLockEnabled, devnetEnabled, setDevnetEnabled]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider.');
  return context;
}
