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
  coinTypeName: 'bitcoin' | 'ethereum' | 'tron' | 'ton' | 'solana' | 'smartChain' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalancheCChain' | 'litecoin' | 'dogecoin';
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

function capabilitiesForExtendedChain(chain: ChainId): Capabilities {
  return {
    derive: {
      status: 'verified',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for derive.',
    },
    restore: {
      status: 'verified',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for restore.',
    },
    receive: {
      status: 'verified',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for receive.',
    },
    balance: {
      status: 'blocked',
      evidence: `No ${chain} adapter in this lane; balance is blocked, never faked.`,
    },
    history: {
      status: 'blocked',
      evidence: `No ${chain} adapter in this lane; history is blocked, never faked.`,
    },
    'fee-quote': {
      status: 'blocked',
      evidence: `No ${chain} adapter in this lane; fee-quote is blocked, never faked.`,
    },
    'unsigned-plan': {
      status: 'blocked',
      evidence: `No ${chain} send builder in this lane; unsigned-plan is blocked, never faked.`,
    },
    'local-sign': {
      status: 'blocked',
      evidence: `No ${chain} send builder in this lane; local-sign is blocked, never faked.`,
    },
    'post-sign-verify': {
      status: 'blocked',
      evidence: `No ${chain} send builder in this lane; post-sign-verify is blocked, never faked.`,
    },
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
export const CHAINS: Record<ChainId, ChainConfig> = {
  btc: {
    id: 'btc',
    displayName: 'Bitcoin',
    symbol: 'BTC',
    coinTypeName: 'bitcoin',
    networkId: 'bip122:000000000019d6689c085ae165831e93',
    assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
    profileId: 'bawa-btc-bip84-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/84'/0'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://mempool.space/api'],
    evmChainId: null,
    capabilities: capabilitiesForAdapterChain('btc', true),
  },
  eth: {
    id: 'eth',
    displayName: 'Ethereum',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    networkId: 'eip155:1',
    assetId: 'eip155:1/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    // ETH adapter: viem public client against the pinned mainnet RPC.
    rpcEndpoints: ['https://ethereum-rpc.publicnode.com'],
    evmChainId: 1,
    capabilities: capabilitiesForAdapterChain('eth', true),
  },
  trx: {
    id: 'trx',
    displayName: 'TRON',
    symbol: 'TRX',
    coinTypeName: 'tron',
    networkId: 'tron:0x2b6653dc',
    assetId: 'tron:0x2b6653dc/slip44:195',
    profileId: 'bawa-trx-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/195'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://api.trongrid.io'],
    evmChainId: null,
    capabilities: capabilitiesForAdapterChain('trx', true),
  },
  ton: {
    id: 'ton',
    displayName: 'TON',
    symbol: 'TON',
    coinTypeName: 'ton',
    networkId: 'ton:-239',
    assetId: 'ton:-239/slip44:607',
    profileId: 'bawa-ton-v4r2-v1',
    pathFor: (account) => {
      assertAccountIndex(account, 0);
      // Fully hardened: one address per wallet, no index suffix.
      // Wallet V4 R2, workchain 0, wallet ID 698983191.
      return "m/44'/607'/0'";
    },
    rpcEndpoints: ['https://toncenter.com/api/v2/jsonRPC'],
    evmChainId: null,
    capabilities: capabilitiesForAdapterChain('ton', false),
  },
  sol: {
    id: 'sol',
    displayName: 'Solana',
    symbol: 'SOL',
    coinTypeName: 'solana',
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    assetId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
    profileId: 'bawa-sol-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return "m/44'/501'/0'";
    },
    rpcEndpoints: [],
    evmChainId: null,
    capabilities: capabilitiesForExtendedChain('sol'),
  },
  bsc: {
    id: 'bsc',
    displayName: 'BNB Smart Chain',
    symbol: 'BNB',
    coinTypeName: 'smartChain',
    networkId: 'eip155:56',
    assetId: 'eip155:56/slip44:714',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: 56,
    capabilities: capabilitiesForExtendedChain('bsc'),
  },
  matic: {
    id: 'matic',
    displayName: 'Polygon',
    symbol: 'POL',
    coinTypeName: 'polygon',
    networkId: 'eip155:137',
    assetId: 'eip155:137/slip44:966',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: 137,
    capabilities: capabilitiesForExtendedChain('matic'),
  },
  arb: {
    id: 'arb',
    displayName: 'Arbitrum One',
    symbol: 'ETH',
    coinTypeName: 'arbitrum',
    networkId: 'eip155:42161',
    assetId: 'eip155:42161/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: 42161,
    capabilities: capabilitiesForExtendedChain('arb'),
  },
  op: {
    id: 'op',
    displayName: 'OP Mainnet',
    symbol: 'ETH',
    coinTypeName: 'optimism',
    networkId: 'eip155:10',
    assetId: 'eip155:10/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: 10,
    capabilities: capabilitiesForExtendedChain('op'),
  },
  base: {
    id: 'base',
    displayName: 'Base',
    symbol: 'ETH',
    coinTypeName: 'base',
    networkId: 'eip155:8453',
    assetId: 'eip155:8453/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: 8453,
    capabilities: capabilitiesForExtendedChain('base'),
  },
  avax: {
    id: 'avax',
    displayName: 'Avalanche C-Chain',
    symbol: 'AVAX',
    coinTypeName: 'avalancheCChain',
    networkId: 'eip155:43114',
    assetId: 'eip155:43114/slip44:9000',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: 43114,
    capabilities: capabilitiesForExtendedChain('avax'),
  },
  ltc: {
    id: 'ltc',
    displayName: 'Litecoin',
    symbol: 'LTC',
    coinTypeName: 'litecoin',
    networkId: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
    assetId: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2',
    profileId: 'bawa-ltc-bip84-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/84'/2'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: null,
    capabilities: capabilitiesForExtendedChain('ltc'),
  },
  doge: {
    id: 'doge',
    displayName: 'Dogecoin',
    symbol: 'DOGE',
    coinTypeName: 'dogecoin',
    networkId: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
    assetId: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691/slip44:3',
    profileId: 'bawa-doge-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/3'/${account}'/0/${index}`;
    },
    rpcEndpoints: [],
    evmChainId: null,
    capabilities: capabilitiesForExtendedChain('doge'),
  },
};

export const SUPPORTED_CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge'];

// The Wallet Core default Solana profile is now supported as bawa-sol-bip44-v1; only the Phantom bip44Change profile stays unsupported.
export interface UnsupportedProfile {
  profileId: string;
  path: string;
  networkId: string;
  status: 'unsupported';
  note: string;
}

export const SOLANA_PROFILES: Readonly<Record<string, UnsupportedProfile>> = {
  'solana-phantom-bip44change-v1': {
    profileId: 'solana-phantom-bip44change-v1',
    path: "m/44'/501'/{i}'/0'",
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    status: 'unsupported',
    note: 'OKX / Phantom bip44Change profile. Unsupported in this lane.',
  },
};

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
