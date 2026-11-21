import type { ChainId } from '../engine/boundary';

export type { ChainId };

export type CapabilityName =
  | 'derive'
  | 'restore'
  | 'receive'
  | 'balance'
  | 'history'
  | 'fee-quote'
  | 'unsigned-plan'
  | 'local-sign'
  | 'post-sign-verify';

export type CapabilityStatus =
  | 'verified'
  | 'blocked'
  | 'unsupported'
  | 'candidate';

export interface CapabilityEntry {
  status: CapabilityStatus;
  /** Short evidence reference. A capability with no evidence is never verified. */
  evidence: string;
}

export type Capabilities = Record<CapabilityName, CapabilityEntry>;

export interface ChainConfig {
  id: ChainId;
  displayName: string;
  symbol: string;
  /** Wallet Core CoinType property name. */
  coinTypeName: 'bitcoin' | 'ethereum' | 'tron' | 'ton';
  /** CAIP-2 network identifier (mainnet only). */
  networkId: string;
  /** CAIP-19 native asset identifier (slip44 namespace). */
  assetId: string;
  /** Pinned recovery profile. A path change changes recovered addresses. */
  profileId: string;
  /** Derivation path builder. TON ignores index: fully hardened, one address. */
  pathFor: (account: number, index: number) => string;
  /** Mainnet RPC endpoints. Empty means no endpoint configured yet. */
  rpcEndpoints: string[];
  /** EVM chain ID, or null for non-EVM chains. */
  evmChainId: number | null;
  capabilities: Capabilities;
}

/**
 * Phase 4 (Fix Lane 3, 2026-11-19): offline transaction construction, local
 * signing and post-sign verification are verified by apps/web/src/wallet/
 * send.test.ts plus the AnySigner probe runs (disposable keys, no broadcast).
 * TON post-sign-verify stays blocked: the signed BOC is not re-parsed (no
 * BOC parser vendored); verification is no-error + 32-byte hash + BOC magic.
 */
const verifiedBySendTests = (capability: CapabilityName): CapabilityEntry => ({
  status: 'verified',
  evidence:
    `Verified by apps/web/src/wallet/send.test.ts offline signing checks + ` +
    `AnySigner probe runs 2026-11-19 for ${capability} (no broadcast).`,
});

const verifiedByCoreTests = (capability: CapabilityName): CapabilityEntry => ({
  status: 'verified',
  evidence: `Verified by apps/web/src/wallet/core.test.ts ${capability} checks (2026-11-18).`,
});

/**
 * Phase 2 adapter capabilities (Fix Lane 2, 2026-11-19). balance/history/
 * fee-quote are verified only with evidence: the adapter's unit tests plus a
 * live mainnet cross-check against a second source on 2026-11-19. TON
 * fee-quote stays blocked: a TON fee depends on the unsigned message, which
 * is Phase 4 work — no fee number is ever invented.
 */
function capabilitiesForAdapterChain(
  chain: ChainId,
  feeQuoteVerified: boolean,
): Capabilities {
  const verifiedByAdapters = (capability: CapabilityName): CapabilityEntry => ({
    status: 'verified',
    evidence:
      `Verified by apps/web/src/wallet/adapters/${chain}.test.ts + live ` +
      `mainnet cross-check 2026-11-19 (second source) for ${capability}.`,
  });
  return {
    derive: verifiedByCoreTests('derive'),
    restore: verifiedByCoreTests('restore'),
    receive: verifiedByCoreTests('receive'),
    balance: verifiedByAdapters('balance'),
    history: verifiedByAdapters('history'),
    'fee-quote': feeQuoteVerified
      ? verifiedByAdapters('fee-quote')
      : {
          status: 'blocked',
          evidence:
            'TON fee-quote needs the unsigned message (Phase 4); no fee is invented.',
        },
    'unsigned-plan': verifiedBySendTests('unsigned-plan'),
    'local-sign': verifiedBySendTests('local-sign'),
    'post-sign-verify':
      chain === 'ton'
        ? {
            status: 'blocked',
            evidence:
              'TON signed BOC is not re-parsed (no BOC parser vendored); verification is no-error + 32-byte hash + BOC magic only.',
          }
        : verifiedBySendTests('post-sign-verify'),
  };
}

function assertAccountIndex(account: number, index: number): void {
  if (
    !Number.isSafeInteger(account) ||
    account < 0 ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    throw new Error('Account and index must be non-negative integers.');
  }
}

/**
 * Capability registry, not a chain list: listing a chain never implies it can
 * do an operation. A chain is available for an operation only when
 * availableFor(capability) returns it (status verified).
 */

// BEGIN GENERATED CHAIN FACTS — do not hand-edit. Regenerate with: node scripts/generate-chains.mjs
// Drift check: from apps/web run `node scripts/generate-chains.mjs --check`;
// it exits 1 when this block differs from registry/capabilities.json.
// Capabilities, evidence, enablement and derivation behaviour stay
// hand-written in chains.ts — only the eight static facts per chain below
// are generated. The registry mixes upstream Wallet Core registry.json
// values with Bawa-added fields (profileId, rpcEndpoints, xpubVersion
// from SLIP-0132 version bytes — the upstream registry carries xpub
// labels only).
export const GENERATED_CHAIN_FACTS: Record<
  ChainId,
  Pick<
    ChainConfig,
    | 'displayName'
    | 'symbol'
    | 'coinTypeName'
    | 'networkId'
    | 'assetId'
    | 'profileId'
    | 'rpcEndpoints'
    | 'evmChainId'
  >
> = {
  btc: {
    displayName: 'Bitcoin',
    symbol: 'BTC',
    coinTypeName: 'bitcoin',
    networkId: 'bip122:000000000019d6689c085ae165831e93',
    assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
    profileId: 'bawa-btc-bip84-v1',
    rpcEndpoints: ['https://mempool.space/api'],
    evmChainId: null,
  },
  eth: {
    displayName: 'Ethereum',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    networkId: 'eip155:1',
    assetId: 'eip155:1/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    rpcEndpoints: ['https://ethereum-rpc.publicnode.com'],
    evmChainId: 1,
  },
  trx: {
    displayName: 'TRON',
    symbol: 'TRX',
    coinTypeName: 'tron',
    networkId: 'tron:0x2b6653dc',
    assetId: 'tron:0x2b6653dc/slip44:195',
    profileId: 'bawa-trx-bip44-v1',
    rpcEndpoints: ['https://api.trongrid.io'],
    evmChainId: null,
  },
  ton: {
    displayName: 'TON',
    symbol: 'TON',
    coinTypeName: 'ton',
    networkId: 'ton:-239',
    assetId: 'ton:-239/slip44:607',
    profileId: 'bawa-ton-v4r2-v1',
    rpcEndpoints: ['https://toncenter.com/api/v2/jsonRPC'],
    evmChainId: null,
  },
};
// END GENERATED CHAIN FACTS
export const CHAINS: Record<ChainId, ChainConfig> = {
  btc: {
    ...GENERATED_CHAIN_FACTS.btc,
    id: 'btc',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/84'/0'/${account}'/0/${index}`;
    },
    capabilities: capabilitiesForAdapterChain('btc', true),
  },
  eth: {
    // ETH adapter: viem public client against the pinned mainnet RPC.
    ...GENERATED_CHAIN_FACTS.eth,
    id: 'eth',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    capabilities: capabilitiesForAdapterChain('eth', true),
  },
  trx: {
    ...GENERATED_CHAIN_FACTS.trx,
    id: 'trx',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/195'/${account}'/0/${index}`;
    },
    capabilities: capabilitiesForAdapterChain('trx', true),
  },
  ton: {
    ...GENERATED_CHAIN_FACTS.ton,
    id: 'ton',
    pathFor: (account) => {
      assertAccountIndex(account, 0);
      // Fully hardened: one address per wallet, no index suffix.
      // Wallet V4 R2, workchain 0, wallet ID 698983191.
      return "m/44'/607'/0'";
    },
    capabilities: capabilitiesForAdapterChain('ton', false),
  },
};

export const SUPPORTED_CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton'];

/**
 * Solana profiles, named as UNSUPPORTED. No code path uses them and no Solana
 * support is added in this lane. The two profiles are distinct derivations
 * even at index 0 — never hard-code a single Solana path.
 */
export interface UnsupportedProfile {
  profileId: string;
  path: string;
  networkId: string;
  status: 'unsupported';
  note: string;
}

export const SOLANA_PROFILES: Readonly<Record<string, UnsupportedProfile>> = {
  'walletcore-solana-default-v1': {
    profileId: 'walletcore-solana-default-v1',
    path: "m/44'/501'/0'",
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    status: 'unsupported',
    note: 'Wallet Core Solana default profile. Unsupported in this lane.',
  },
  'solana-phantom-bip44change-v1': {
    profileId: 'solana-phantom-bip44change-v1',
    path: "m/44'/501'/{i}'/0'",
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    status: 'unsupported',
    note: 'OKX / Phantom bip44Change profile. Unsupported in this lane.',
  },
};

/**
 * SLIP-0010: Ed25519 allows hardened-only child derivation; a non-hardened
 * suffix on an ed25519 path is invalid. Throws an Error naming the path when
 * any component after m/ is non-hardened (no trailing apostrophe).
 */
export function assertHardenedEd25519Path(path: string): void {
  const components = path.split('/');
  if (components.length < 2 || components[0] !== 'm') {
    throw new Error(
      `Invalid Ed25519 derivation path (expected m/...): ${path}`,
    );
  }
  for (const component of components.slice(1)) {
    if (component.length === 0 || !component.endsWith("'")) {
      throw new Error(
        `Invalid Ed25519 derivation path ${path}: component ${component} ` +
          `is not hardened (SLIP-0010 allows hardened-only child derivation).`,
      );
    }
  }
}

// Module-load enforcement: a non-hardened ed25519 path fails import, never
// derivation. The TON path and every Solana profile path ({i} expanded to 0)
// are fully hardened; no existing path value is changed.
assertHardenedEd25519Path(CHAINS.ton.pathFor(0, 0));
for (const profile of Object.values(SOLANA_PROFILES)) {
  assertHardenedEd25519Path(profile.path.replace('{i}', '0'));
}

export function chainConfig(chain: ChainId): ChainConfig {
  const config = CHAINS[chain];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}.`);
  }
  return config;
}

export function profileFor(chain: ChainId): string {
  return chainConfig(chain).profileId;
}

export function pathFor(chain: ChainId, account: number, index: number): string {
  return chainConfig(chain).pathFor(account, index);
}

export function capabilitiesFor(chain: ChainId): Capabilities {
  return chainConfig(chain).capabilities;
}

/** Chains whose status for the capability is verified. */
export function availableFor(capability: CapabilityName): ChainId[] {
  return SUPPORTED_CHAINS.filter(
    (chain) => CHAINS[chain].capabilities[capability].status === 'verified',
  );
}

/** Throws a typed error naming the exact unavailable combination. */
export function assertSupported(chain: ChainId, capability: CapabilityName): void {
  const config = chainConfig(chain);
  const entry = config.capabilities[capability];
  if (entry.status !== 'verified') {
    throw new Error(
      `Unsupported operation: chain ${chain} (${config.networkId}, profile ${config.profileId}) ` +
        `cannot do ${capability} — status ${entry.status}: ${entry.evidence}`,
    );
  }
}

const MAINNET_NETWORK_IDS: Readonly<Set<string>> = new Set(
  SUPPORTED_CHAINS.map((chain) => CHAINS[chain].networkId),
);

/** Looks a chain up by CAIP-2 network ID. Anything else throws, including non-mainnet IDs. */
export function chainConfigForNetwork(networkId: string): ChainConfig {
  if (!MAINNET_NETWORK_IDS.has(networkId)) {
    throw new Error(`Unsupported network: ${networkId}.`);
  }
  const found = SUPPORTED_CHAINS.find(
    (chain) => CHAINS[chain].networkId === networkId,
  );
  if (!found) {
    throw new Error(`Unsupported network: ${networkId}.`);
  }
  return CHAINS[found];
}
