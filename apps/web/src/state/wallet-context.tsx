import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { ChainId, DerivedAddress, UiState, WatchOnlyWallet } from '@bawa/contracts';
import { deriveAddresses, validateWatchOnlyImport } from '../engine/boundary';

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

interface WalletState {
  xpubs: PerChain<WatchOnlyWallet | null>;
  addresses: PerChain<DerivedAddress[]>;
  uiState: PerChain<UiState>;
  errors: PerChain<string | null>;
  locked: boolean;
}

interface WalletContextValue extends WalletState {
  selectedChain: ChainId;
  addXpub(chain: ChainId, xpub: string, label: string): Promise<void>;
  removeXpub(chain: ChainId): void;
  refreshChain(chain: ChainId): Promise<void>;
  setSelectedChain(chain: ChainId): void;
  lock(): void;
  unlock(): Promise<void>;
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

export function WalletProvider({ children }: { children: ReactNode }) {
  // No state or refs may hold a mnemonic, seed, private key, private extended key,
  // vault key or data key. Only validated public watch-only wallets enter state.
  const [state, setState] = useState<WalletState>(() => ({
    xpubs: perChain<WatchOnlyWallet | null>(() => null),
    addresses: perChain<DerivedAddress[]>(() => []),
    uiState: perChain<UiState>(() => 'empty'),
    errors: perChain<string | null>(() => null),
    locked: false,
  }));
  const [selectedChain, setSelectedChain] = useState<ChainId>('btc');
  const [hydrated, setHydrated] = useState(false);
  const current = useRef(state);
  const additions = useRef(perChain(() => 0));
  const changed = useRef(perChain(() => false));
  const derivations = useRef(perChain(() => 0));
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

  // Locking only clears in-memory derived addresses; it is NOT a security boundary.
  // Public xpubs remain in state and storage. Unlocking re-derives their addresses.
  const lock = useCallback(() => {
    CHAINS.forEach(chain => { ++derivations.current[chain]; });
    update(previous => ({
      ...previous,
      locked: true,
      addresses: perChain<DerivedAddress[]>(() => []),
      uiState: perChain<UiState>(() => 'empty'),
      errors: perChain<string | null>(() => null),
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
  }), [state, selectedChain, addXpub, removeXpub, refreshChain, lock, unlock]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider.');
  return context;
}
