// Chains supported for public-key-only address derivation by the Web starter.
export type ChainId = 'btc' | 'eth' | 'trx';

// Alias for chains supported by the watch-only starter.
export type SupportedChain = ChainId;

// TON is documented-only, generation-only with no xpub, and unsupported by the Web starter.
export type DocumentedChain = ChainId | 'ton';

// Type-only signature for an indexed address derivation path.
export type DerivationPathFn = (index: number) => string;

// Paths: BTC m/84'/0'/0'/0/i; ETH m/44'/60'/0'/0/i; TRX m/44'/195'/0'/0/i.
export interface DerivationPaths {
  btc: DerivationPathFn;
  eth: DerivationPathFn;
  trx: DerivationPathFn;
}

// Validation results for user-supplied extended public keys.
export type ExtendedKeyValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'invalid-base58'
        | 'invalid-length'
        | 'invalid-checksum'
        | 'private-key'
        | 'version-not-allowed'
        | 'invalid-point';
      message: string;
    };

// A public address derived at an index on a supported chain.
export interface DerivedAddress {
  chain: ChainId;
  index: number;
  address: string;
}

// Watch-only wallet metadata containing a user-supplied extended public key.
export interface WatchOnlyWallet {
  chain: ChainId;
  // Public extended key, including BTC zpub; this field must never hold a private extended key.
  xpub: string;
  label: string;
  derivedCount: number;
}

// No real balances exist yet; real balance fetching is OPEN because no provider has been selected.
export type BalanceState =
  | { status: 'unavailable'; reason: string }
  | { status: 'mock'; reason: string; value: string };

// Required interface states, including app locking and failed gates.
export type UiState =
  | 'loading'
  | 'empty'
  | 'stale'
  | 'locked'
  | 'gate-failed'
  | 'error'
  | 'ready';

// The 14-screen contract; Review is a state of Send and Lock is an app state.
export type ScreenId =
  | 'welcome'
  | 'create-wallet'
  | 'import-wallet'
  | 'mnemonic-backup'
  | 'dashboard'
  | 'asset-list'
  | 'asset-detail'
  | 'receive'
  | 'send'
  | 'transaction-history'
  | 'transaction-detail'
  | 'network-selection'
  | 'wallet-management'
  | 'security-settings';

// Every mock value in the starter must carry this marker.
export interface MockMarker {
  mock: true;
  reason: string;
}

// The only send state the starter may express; no send may be presented as working.
export interface SendIntent {
  status: 'not-implemented';
  reason: string;
}

// Evidence labels distinguish verified implementation from documentation and unresolved work.
export type EvidenceLabel =
  | 'IMPLEMENTED_AND_VERIFIED'
  | 'DOCUMENTED_NOT_TESTED'
  | 'PROPOSED'
  | 'OPEN'
  | 'EXTERNALLY_DEPENDENT'
  | 'UNVERIFIED';

// Errors at the extended-public-key validation, WASM initialisation or address derivation boundary.
export interface EngineBoundaryError {
  code:
    | 'invalid-extended-key'
    | 'wasm-init-failed'
    | 'derivation-failed';
  message: string;
}
