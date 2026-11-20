import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { availableFor } from '../wallet/chains';
import type { AdapterTx } from '../wallet/adapters/types';
import * as vault from '../wallet/vault';
import { isPassphraseUsed } from '../wallet/passphrase';

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

export type VaultState = 'no-vault' | 'locked' | 'unlocked';

// Auto-lock (UI-UX spec §9; Phantom Immediately–1 day range, Rabby minutes
// preference + activity reset + restart-persisted deadline). 0 = Immediately:
// lock when the page is hidden. Minutes > 0: lock after that long without
// activity. The preference and the deadline persist in localStorage; the
// deadline is re-armed on unlock, on activity, and when the preference
// changes. Locking only clears in-memory vault access (same as lockVault);
// watch-only stays usable.
export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60, 1440] as const;
export const AUTO_LOCK_DEFAULT_MINUTES = 5;
const AUTO_LOCK_MINUTES_KEY = 'bawa-auto-lock-minutes';
const AUTO_LOCK_DEADLINE_KEY = 'bawa-auto-lock-deadline';

function readAutoLockMinutes(): number {
  try {
    if (typeof window === 'undefined') return AUTO_LOCK_DEFAULT_MINUTES;
    const raw = window.localStorage.getItem(AUTO_LOCK_MINUTES_KEY);
    const minutes = raw === null ? NaN : Number(raw);
    return (AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes)
      ? minutes
      : AUTO_LOCK_DEFAULT_MINUTES;
  } catch {
    return AUTO_LOCK_DEFAULT_MINUTES;
  }
}

function readAutoLockDeadline(): number | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(AUTO_LOCK_DEADLINE_KEY);
    const deadline = raw === null ? NaN : Number(raw);
    return Number.isFinite(deadline) ? deadline : null;
  } catch {
    return null;
  }
}

export type BalanceStatus = 'loading' | 'zero' | 'available' | 'unavailable' | 'error';

export interface BalanceState {
  status: BalanceStatus;
  /** Raw native balance as a decimal string, when a provider returned one. */
  value?: string;
  /** Short machine-readable reason for unavailable/error (e.g. no-adapter). */
  reason?: string;
}

export type HistoryStatus = 'loading' | 'loaded' | 'empty' | 'unavailable' | 'error';

export interface HistoryState {
  status: HistoryStatus;
  txs: AdapterTx[];
  reason?: string;
}

const initialBalances = (): PerChain<BalanceState> =>
  perChain<BalanceState>(() => ({ status: 'unavailable', reason: 'no-adapter' }));

const initialHistory = (): PerChain<HistoryState> =>
  perChain<HistoryState>(() => ({ status: 'unavailable', reason: 'no-adapter', txs: [] }));

interface WalletState {
  xpubs: PerChain<WatchOnlyWallet | null>;
  addresses: PerChain<DerivedAddress[]>;
  uiState: PerChain<UiState>;
  errors: PerChain<string | null>;
  locked: boolean;
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
}

export interface WalletContextValue extends WalletState {
  selectedChain: ChainId;
  addXpub(chain: ChainId, xpub: string, label: string): Promise<void>;
  removeXpub(chain: ChainId): void;
  refreshChain(chain: ChainId): Promise<void>;
  setSelectedChain(chain: ChainId): void;
  lock(): void;
  unlock(): Promise<void>;
  unlockVault(password: string, passphrase?: string): Promise<void>;
  lockVault(): void;
  autoLockMinutes: number;
  setAutoLockMinutes(minutes: number): void;
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

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message :
    isRecord(error) && typeof error.message === 'string' ? error.message : String(error);

function computeVaultState(): VaultState {
  if (!vault.hasVault()) return 'no-vault';
  return vault.isLocked() ? 'locked' : 'unlocked';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // No state or refs may hold a mnemonic, seed, private key, private extended key,
  // vault key or data key. Only validated public watch-only wallets enter state.
  // vaultAddresses are public addresses derived from the vault; they are safe here.
  const [state, setState] = useState<WalletState>(() => ({
    xpubs: perChain<WatchOnlyWallet | null>(() => null),
    addresses: perChain<DerivedAddress[]>(() => []),
    uiState: perChain<UiState>(() => 'empty'),
    errors: perChain<string | null>(() => null),
    locked: false,
    vaultState: 'no-vault',
    vaultAccount: { account: 0, index: 0 },
    vaultAddresses: perChain<string[]>(() => []),
    vaultProfileIds: null,
    balances: initialBalances(),
    history: initialHistory(),
  }));
  const [selectedChain, setSelectedChain] = useState<ChainId>('btc');
  const [hydrated, setHydrated] = useState(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(() => readAutoLockMinutes());
  const autoLockTimer = useRef<number | null>(null);
  const prevAutoLockMinutes = useRef<number>(autoLockMinutes);
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
    if (!wallet || current.current.locked) {
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
  // unavailable/error, never as zero.
  const refreshBalances = useCallback(async () => {
    const { getAdapter } = await ensureAdapters();
    await Promise.all(CHAINS.map(async (chain) => {
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
      setBalance({ status: 'loading' });
      const result = await adapter.getBalance(address);
      if (request !== balanceRequests.current[chain]) return;
      if (result.status === 'ok') {
        setBalance(
          result.data.valueBaseUnits === '0'
            ? { status: 'zero', value: '0' }
            : { status: 'available', value: result.data.valueBaseUnits },
        );
      } else if (result.status === 'unavailable') {
        setBalance({ status: 'unavailable', reason: result.reason });
      } else {
        setBalance({ status: 'error', reason: result.reason });
      }
    }));
  }, [update]);

  const refreshHistory = useCallback(async () => {
    const { getAdapter } = await ensureAdapters();
    await Promise.all(CHAINS.map(async (chain) => {
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
      setHistory({ status: 'loading', txs: [] });
      const result = await adapter.getHistory(address, 25);
      if (request !== historyRequests.current[chain]) return;
      if (result.status === 'ok') {
        setHistory(
          result.data.length === 0
            ? { status: 'empty', txs: [] }
            : { status: 'loaded', txs: result.data },
        );
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
    if (vaultState !== 'unlocked') {
      update(previous => ({
        ...previous,
        vaultState,
        vaultProfileIds: profileIds,
        vaultAddresses: perChain<string[]>(() => []),
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
    update(previous => ({
      ...previous,
      vaultState,
      vaultProfileIds: profileIds,
      vaultAddresses: {
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
      },
    }));
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

  const unlockVault = useCallback(async (password: string, passphrase = '') => {
    if (isPassphraseUsed() && !passphrase) {
      throw new Error('This wallet uses a passphrase. Enter it to unlock.');
    }

    await vault.unlock(password, passphrase);
    await refreshVaultAccounts();
  }, [refreshVaultAccounts]);

  const lockVault = useCallback(() => {
    ++vaultDerivations.current;
    vault.lock();
    update(previous => ({
      ...previous,
      vaultState: computeVaultState(),
      vaultProfileIds: vault.hasVault() ? vault.vaultProfiles() : null,
      vaultAddresses: perChain<string[]>(() => []),
      // Vault addresses are hidden: drop their balances/history too.
      balances: initialBalances(),
      history: initialHistory(),
    }));
  }, [update]);

  const clearAutoLockTimer = useCallback(() => {
    if (autoLockTimer.current !== null) {
      window.clearTimeout(autoLockTimer.current);
      autoLockTimer.current = null;
    }
  }, []);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    if (!(AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes)) return;
    try {
      window.localStorage.setItem(AUTO_LOCK_MINUTES_KEY, String(minutes));
    } catch {
      // Storage may be unavailable; keep the preference in memory.
    }
    setAutoLockMinutesState(minutes);
  }, []);

  // Auto-lock arming (spec §9). Runs only when the vault is unlocked or the
  // preference changes. A stored deadline that already passed (e.g. the
  // page was closed and reopened) locks immediately instead of re-arming.
  // Changing the preference re-arms from now; otherwise the stored
  // (activity-extended) deadline is honoured so a restart resumes the
  // remaining time. Activity resets the deadline; "Immediately" (0) locks
  // when the page is hidden instead of using a timer.
  useEffect(() => {
    if (state.vaultState !== 'unlocked') {
      clearAutoLockTimer();
      try {
        window.localStorage.removeItem(AUTO_LOCK_DEADLINE_KEY);
      } catch {
        // Storage may be unavailable; nothing to clear.
      }
      return;
    }
    if (autoLockMinutes === 0) {
      try {
        window.localStorage.removeItem(AUTO_LOCK_DEADLINE_KEY);
      } catch {
        // Storage may be unavailable; nothing to clear.
      }
      const onHidden = () => {
        if (document.visibilityState === 'hidden') lockVault();
      };
      const onPageHide = () => lockVault();
      document.addEventListener('visibilitychange', onHidden);
      window.addEventListener('pagehide', onPageHide);
      return () => {
        document.removeEventListener('visibilitychange', onHidden);
        window.removeEventListener('pagehide', onPageHide);
      };
    }
    const now = Date.now();
    const stored = readAutoLockDeadline();
    if (stored !== null && stored <= now) {
      lockVault();
      return;
    }
    const minutesChanged = prevAutoLockMinutes.current !== autoLockMinutes;
    prevAutoLockMinutes.current = autoLockMinutes;
    const deadline =
      minutesChanged || stored === null
        ? now + autoLockMinutes * 60_000
        : stored;
    try {
      window.localStorage.setItem(AUTO_LOCK_DEADLINE_KEY, String(deadline));
    } catch {
      // Storage may be unavailable; the in-memory timer still applies.
    }
    clearAutoLockTimer();
    autoLockTimer.current = window.setTimeout(() => {
      lockVault();
    }, deadline - now);
    const resetDeadline = () => {
      const next = Date.now() + autoLockMinutes * 60_000;
      try {
        window.localStorage.setItem(AUTO_LOCK_DEADLINE_KEY, String(next));
      } catch {
        // Storage may be unavailable; the in-memory timer still applies.
      }
      clearAutoLockTimer();
      autoLockTimer.current = window.setTimeout(() => {
        lockVault();
      }, autoLockMinutes * 60_000);
    };
    const activityEvents = ['pointerdown', 'keydown', 'wheel'] as const;
    activityEvents.forEach((event) =>
      window.addEventListener(event, resetDeadline, { passive: true }),
    );
    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetDeadline),
      );
      clearAutoLockTimer();
    };
  }, [state.vaultState, autoLockMinutes, lockVault, clearAutoLockTimer]);

  // Locking only clears in-memory derived addresses; it is NOT a security boundary.
  // Public xpubs remain in state and storage. Unlocking re-derives their addresses.
  // Locking also locks the vault and clears vault-derived addresses.
  const lock = useCallback(() => {
    CHAINS.forEach(chain => { ++derivations.current[chain]; });
    ++vaultDerivations.current;
    vault.lock();
    update(previous => ({
      ...previous,
      locked: true,
      addresses: perChain<DerivedAddress[]>(() => []),
      uiState: perChain<UiState>(() => 'empty'),
      errors: perChain<string | null>(() => null),
      vaultState: computeVaultState(),
      vaultProfileIds: vault.hasVault() ? vault.vaultProfiles() : null,
      vaultAddresses: perChain<string[]>(() => []),
      balances: initialBalances(),
      history: initialHistory(),
    }));
  }, [update]);

  const unlock = useCallback(async () => {
    update(previous => ({ ...previous, locked: false }));
    await Promise.all(CHAINS.map(chain => refreshChain(chain)));
  }, [refreshChain, update]);

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
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
      ++lifetime.current;
      CHAINS.forEach(chain => { ++derivations.current[chain]; });
    };
  }, [putWallet]);

  // Vault state is read from storage on mount (no vault -> 'no-vault').
  // Addresses are derived only after an explicit unlockVault(password).
  useEffect(() => {
    update(previous => ({
      ...previous,
      vaultState: computeVaultState(),
      vaultProfileIds: vault.hasVault() ? vault.vaultProfiles() : null,
    }));
  }, [update]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.xpubs));
    } catch {
      // Storage may be unavailable; keep validated public data in memory.
    }
  }, [hydrated, state.xpubs]);

  const value = useMemo<WalletContextValue>(() => ({
    ...state, selectedChain, setSelectedChain, addXpub, removeXpub, refreshChain, lock, unlock,
    unlockVault, lockVault, autoLockMinutes, setAutoLockMinutes, setVaultAccount, refreshVaultAccounts, refreshBalances, refreshHistory,
  }), [state, selectedChain, addXpub, removeXpub, refreshChain, lock, unlock, unlockVault, lockVault, autoLockMinutes, setAutoLockMinutes, setVaultAccount, refreshVaultAccounts, refreshBalances, refreshHistory]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider.');
  return context;
}
