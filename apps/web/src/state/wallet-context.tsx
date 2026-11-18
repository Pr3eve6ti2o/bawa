import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { deriveAddresses, validateWatchOnlyImport } from '../engine/boundary';
import { deriveAddresses as deriveVaultAddresses } from '../wallet/core';
import { capabilitiesFor } from '../wallet/chains';
import { getBalanceProvider } from '../wallet/providers';
import * as vault from '../wallet/vault';

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
  btc: make(), eth: make(), trx: make(), ton: make(),
});

export type VaultState = 'no-vault' | 'locked' | 'unlocked';

export type BalanceStatus = 'loading' | 'zero' | 'available' | 'unavailable' | 'error';

export interface BalanceState {
  status: BalanceStatus;
  /** Raw native balance as a decimal string, when a provider returned one. */
  value?: string;
  /** Short machine-readable reason for unavailable/error (e.g. no-adapter). */
  reason?: string;
}

const initialBalances = (): PerChain<BalanceState> =>
  perChain<BalanceState>(() => ({ status: 'unavailable', reason: 'no-adapter' }));

interface WalletState {
  xpubs: PerChain<WatchOnlyWallet | null>;
  addresses: PerChain<DerivedAddress[]>;
  uiState: PerChain<UiState>;
  errors: PerChain<string | null>;
  locked: boolean;
  // Vault-backed accounts. vaultAddresses are public derived addresses
  // (account 0, index 0), safe in state. The mnemonic never enters state.
  vaultState: VaultState;
  vaultAddresses: PerChain<string[]>;
  vaultProfileIds: string[] | null;
  balances: PerChain<BalanceState>;
}

export interface WalletContextValue extends WalletState {
  selectedChain: ChainId;
  addXpub(chain: ChainId, xpub: string, label: string): Promise<void>;
  removeXpub(chain: ChainId): void;
  refreshChain(chain: ChainId): Promise<void>;
  setSelectedChain(chain: ChainId): void;
  lock(): void;
  unlock(): Promise<void>;
  unlockVault(password: string): Promise<void>;
  lockVault(): void;
  refreshVaultAccounts(): Promise<void>;
  refreshBalances(): Promise<void>;
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
    vaultAddresses: perChain<string[]>(() => []),
    vaultProfileIds: null,
    balances: initialBalances(),
  }));
  const [selectedChain, setSelectedChain] = useState<ChainId>('btc');
  const [hydrated, setHydrated] = useState(false);
  const current = useRef(state);
  const additions = useRef(perChain(() => 0));
  const changed = useRef(perChain(() => false));
  const derivations = useRef(perChain(() => 0));
  const vaultDerivations = useRef(0);
  const balanceRequests = useRef(perChain(() => 0));
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

  // Vault-backed accounts. An xpub can never be upgraded into signing keys:
  // spending requires vault creation or mnemonic restoration. Watch-only xpubs
  // stay a separate, explicitly labelled account type (see xpubs above).
  const refreshVaultAccounts = useCallback(async () => {
    const request = ++vaultDerivations.current;
    const vaultState = computeVaultState();
    const profileIds = vault.hasVault() ? vault.vaultProfiles() : null;
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
      derived = await vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic));
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
      },
    }));
  }, [update]);

  const unlockVault = useCallback(async (password: string) => {
    await vault.unlock(password);
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
    }));
  }, [update]);

  const refreshBalances = useCallback(async () => {
    await Promise.all(CHAINS.map(async (chain) => {
      const request = ++balanceRequests.current[chain];
      const capability = capabilitiesFor(chain).balance;
      const setBalance = (balance: BalanceState) => {
        if (request !== balanceRequests.current[chain]) return;
        update(previous => ({
          ...previous,
          balances: { ...previous.balances, [chain]: balance },
        }));
      };
      if (capability.status !== 'verified') {
        setBalance({ status: 'unavailable', reason: 'no-adapter' });
        return;
      }
      const provider = getBalanceProvider(chain);
      if (!provider) {
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
      try {
        const result = await provider.getBalance(chain, address);
        if (request !== balanceRequests.current[chain]) return;
        const value = result.value;
        setBalance(
          value === '0'
            ? { status: 'zero', value }
            : { status: 'available', value },
        );
      } catch (error: unknown) {
        setBalance({ status: 'error', reason: messageOf(error) });
      }
    }));
  }, [update]);

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
    unlockVault, lockVault, refreshVaultAccounts, refreshBalances,
  }), [state, selectedChain, addXpub, removeXpub, refreshChain, lock, unlock, unlockVault, lockVault, refreshVaultAccounts, refreshBalances]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider.');
  return context;
}
