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
        | 'invalid-depth-metadata'
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

// Chains supported for mainnet destination validation (T31). The Web
// starter's ChainId ('btc' | 'eth' | 'trx') covers derivation; TON is
// documented-only there, but mainnet destinations must be validated
// for all four chains before any transaction preparation.
export type DestinationChain = 'btc' | 'eth' | 'trx' | 'ton';

// EIP-55 / checksum status of a validated destination. 'absent' is a
// structurally valid address carrying no checksum (all-lowercase or
// all-uppercase ETH); 'not-applicable' is a form with no checksum by
// design (TON raw form).
export type DestinationChecksum = 'verified' | 'absent' | 'not-applicable';

// Validation result for a user-supplied mainnet destination address.
// Reasons: 'empty' (blank input), 'invalid-format' (wrong shape, e.g.
// missing 0x, unknown bech32 HRP, TRON hex wire form), 'invalid-length',
// 'invalid-character', 'invalid-checksum' (Base58Check / bech32 /
// bech32m / EIP-55 / TON CRC16 mismatch), 'wrong-network' (a testnet
// address or testnet-only flag), 'unsupported-version' (an address
// version or witness version this module does not accept).
export type DestinationValidation =
  | {
      ok: true;
      chain: DestinationChain;
      checksum: DestinationChecksum;
      addressType: string;
    }
  | {
      ok: false;
      chain: DestinationChain;
      reason:
        | 'empty'
        | 'invalid-format'
        | 'invalid-length'
        | 'invalid-character'
        | 'invalid-checksum'
        | 'wrong-network'
        | 'unsupported-version';
      message: string;
    };

// Mainnet parameters selected for transaction preparation. Values are
// pinned with provenance in MAINNET_PARAMS (destination.ts); the
// confirmation thresholds are the register values (M-13,
// user-approved 2026-11-10) and confirmation policy is not a finality
// guarantee.
export interface MainnetParams {
  chain: DestinationChain;
  network: string;
  slip44CoinType: number;
  derivationPrefix: string;
  chainId: number | null;
  addressPrefix: string;
  confirmations: number;
  confirmationsUnit: string;
  confirmationsNote: string;
  sources: readonly string[];
  limitations: readonly string[];
}
