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
  | 'post-sign-verify'
  | 'simulate';

export type CapabilityStatus =
  | 'verified'
  | 'blocked'
  | 'unsupported'
  | 'candidate';

/**
 * How a capability's status was established. Only a live mainnet cross-check
 * justifies 'mainnet-confirmed'; anything the offline tests and probes
 * established — and every blocked or candidate entry — is 'probe-only'.
 * Never claim mainnet confirmation for anything the offline probes
 * established.
 */
export type EvidenceLevel = 'mainnet-confirmed' | 'probe-only';

export interface CapabilityEntry {
  status: CapabilityStatus;
  /** Short evidence reference. A capability with no evidence is never verified. */
  evidence: string;
  evidenceLevel: EvidenceLevel;
}

export type Capabilities = Record<CapabilityName, CapabilityEntry>;

export interface ChainConfig {
  id: ChainId;
  displayName: string;
  symbol: string;
  /** Wallet Core CoinType property name. */
  coinTypeName: 'bitcoin' | 'ethereum' | 'tron' | 'ton' | 'solana' | 'smartChain' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalancheCChain' | 'litecoin' | 'dogecoin' | 'xdai' | 'celo' | 'linea' | 'mantle' | 'scroll' | 'opBNB' | 'metis' | 'aurora' | 'fantom';
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
  evidenceLevel: 'probe-only',
  evidence:
    `Verified by apps/web/src/wallet/send.test.ts offline signing checks + ` +
    `AnySigner probe runs 2026-11-19 for ${capability} (no broadcast).`,
});

const verifiedByCoreTests = (capability: CapabilityName): CapabilityEntry => ({
  status: 'verified',
  evidenceLevel: 'probe-only',
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
    evidenceLevel: 'mainnet-confirmed',
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
          evidenceLevel: 'probe-only',
          evidence:
            'TON fee-quote needs the unsigned message (Phase 4); no fee is invented.',
        },
    'unsigned-plan': verifiedBySendTests('unsigned-plan'),
    'local-sign': verifiedBySendTests('local-sign'),
    'post-sign-verify':
      chain === 'ton'
        ? {
            status: 'blocked',
            evidenceLevel: 'probe-only',
            evidence:
              'TON signed BOC is not re-parsed (no BOC parser vendored); verification is no-error + 32-byte hash + BOC magic only.',
          }
        : verifiedBySendTests('post-sign-verify'),
    // Item 9 (chains half): declared only. The simulate-before-send phase
    // is owned by the send lane in send.ts; no simulation runs yet.
    // Simulation is a pre-check, never confirmation.
    simulate: {
      status: 'candidate',
      evidenceLevel: 'probe-only',
      evidence:
        'Candidate for item 9: the simulate-before-send phase is owned by ' +
        'the send lane in send.ts; no simulation runs yet. Simulation is ' +
        'a pre-check, never confirmation.',
    },
  };
}

function capabilitiesForExtendedChain(chain: ChainId): Capabilities {
  return {
    derive: {
      status: 'verified',
      evidenceLevel: 'probe-only',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for derive.',
    },
    restore: {
      status: 'verified',
      evidenceLevel: 'probe-only',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for restore.',
    },
    receive: {
      status: 'verified',
      evidenceLevel: 'probe-only',
      evidence: 'Verified by Wallet Core 4.9.3 derivation probe 2026-11-20 (BIP-39 test-vector mnemonic; getAddressForCoin, explicit-key path and xpub round-trip agree; CoinTypeExt.validate true) + apps/web/src/wallet/core.test.ts extended-chain checks for receive.',
    },
    balance: {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} adapter in this lane; balance is blocked, never faked.`,
    },
    history: {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} adapter in this lane; history is blocked, never faked.`,
    },
    'fee-quote': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} adapter in this lane; fee-quote is blocked, never faked.`,
    },
    'unsigned-plan': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} send builder in this lane; unsigned-plan is blocked, never faked.`,
    },
    'local-sign': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} send builder in this lane; local-sign is blocked, never faked.`,
    },
    'post-sign-verify': {
      status: 'blocked',
      evidenceLevel: 'probe-only',
      evidence: `No ${chain} send builder in this lane; post-sign-verify is blocked, never faked.`,
    },
    // Item 9 (chains half): declared only. The simulate-before-send phase
    // is owned by the send lane in send.ts; no simulation runs yet.
    // Simulation is a pre-check, never confirmation.
    simulate: {
      status: 'candidate',
      evidenceLevel: 'probe-only',
      evidence:
        'Candidate for item 9: the simulate-before-send phase is owned by ' +
        'the send lane in send.ts; no simulation runs yet. Simulation is ' +
        'a pre-check, never confirmation.',
    },
  };
}

/**
 * Token-discovery balance capabilities (2026-11-22). Same as the extended
 * chain capabilities, except balance is verified: each new adapter has
 * unit tests plus a live mainnet cross-check against a second source on
 * 2026-11-22. History, fee-quote and send stay blocked — the adapters
 * either do not implement them or they have no live cross-check yet —
 * and are never faked.
 *
 * Lane C, item 16 (2026-11-23): historyVerified is true only for sol,
 * ltc and doge, whose adapters now have unit tests plus a live mainnet
 * cross-check 2026-11-23 (second source) for history. The five non-ETH
 * EVM chains stay blocked: no keyless public history indexer exists
 * for them (owner decision: Etherscan API key or another indexer).
 */
const BALANCE_EVIDENCE_2026_11_23 =
  'Verified by apps/web/src/wallet/adapters/evm.test.ts (generic EVM adapter) + '
  + 'live mainnet cross-check 2026-11-23 (two independent RPC endpoints agree '
  + 'on chain id and balance) for balance.';

function capabilitiesForBalanceChain(
  chain: ChainId,
  balanceEvidence?: string,
  historyVerified = false,
): Capabilities {
  const base = capabilitiesForExtendedChain(chain);
  return {
    ...base,
    balance: {
      status: 'verified',
      evidenceLevel: 'mainnet-confirmed',
      evidence:
        balanceEvidence ??
        `Verified by apps/web/src/wallet/adapters/${chain}.test.ts + live ` +
        `mainnet cross-check 2026-11-22 (second source) for balance.`,
    },
    history: historyVerified
      ? {
          status: 'verified',
          evidenceLevel: 'mainnet-confirmed',
          evidence:
            `Verified by apps/web/src/wallet/adapters/${chain}.test.ts + live ` +
            `mainnet cross-check 2026-11-23 (second source) for history.`,
        }
      : base.history,
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
  'btc' | 'eth' | 'trx' | 'ton',
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
    rpcEndpoints: [
      'https://mempool.space/api',
      'https://blockstream.info/api',
    ],
    evmChainId: null,
  },
  eth: {
    displayName: 'Ethereum',
    symbol: 'ETH',
    coinTypeName: 'ethereum',
    networkId: 'eip155:1',
    assetId: 'eip155:1/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    rpcEndpoints: [
      'https://ethereum-rpc.publicnode.com',
      'https://1rpc.io/eth',
    ],
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
    rpcEndpoints: ['https://solana-rpc.publicnode.com', 'https://public.rpc.solanavibestation.com'],
    evmChainId: null,
    capabilities: capabilitiesForBalanceChain('sol', undefined, true),
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
    rpcEndpoints: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.binance.org'],
    evmChainId: 56,
    capabilities: capabilitiesForBalanceChain('bsc'),
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
    rpcEndpoints: ['https://polygon-bor-rpc.publicnode.com'],
    evmChainId: 137,
    capabilities: capabilitiesForBalanceChain('matic'),
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
    rpcEndpoints: ['https://arbitrum-rpc.publicnode.com'],
    evmChainId: 42161,
    capabilities: capabilitiesForBalanceChain('arb'),
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
    rpcEndpoints: ['https://optimism-rpc.publicnode.com', 'https://mainnet.optimism.io'],
    evmChainId: 10,
    capabilities: capabilitiesForBalanceChain('op'),
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
    rpcEndpoints: ['https://base-rpc.publicnode.com'],
    evmChainId: 8453,
    capabilities: capabilitiesForBalanceChain('base'),
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
    rpcEndpoints: ['https://avalanche-rpc.publicnode.com', 'https://api.avax.network/ext/bc/C/rpc'],
    evmChainId: 43114,
    capabilities: capabilitiesForBalanceChain('avax'),
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
    rpcEndpoints: ['https://litecoinspace.org/api'],
    evmChainId: null,
    capabilities: capabilitiesForBalanceChain('ltc', undefined, true),
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
    rpcEndpoints: ['https://sochain.com/api/v3', 'https://api.blockcypher.com/v1/doge/main'],
    evmChainId: null,
    capabilities: capabilitiesForBalanceChain('doge', undefined, true),
  },
  gnosis: {
    id: 'gnosis',
    displayName: 'Gnosis',
    symbol: 'XDAI',
    coinTypeName: 'xdai',
    networkId: 'eip155:100',
    assetId: 'eip155:100/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://gnosis-rpc.publicnode.com',
      'https://rpc.gnosischain.com'],
    evmChainId: 100,
    capabilities: capabilitiesForBalanceChain('gnosis', BALANCE_EVIDENCE_2026_11_23),
  },
  celo: {
    id: 'celo',
    displayName: 'Celo',
    symbol: 'CELO',
    coinTypeName: 'celo',
    networkId: 'eip155:42220',
    assetId: 'eip155:42220/slip44:527',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://celo-rpc.publicnode.com',
      'https://forno.celo.org'],
    evmChainId: 42220,
    capabilities: capabilitiesForBalanceChain('celo', BALANCE_EVIDENCE_2026_11_23),
  },
  linea: {
    id: 'linea',
    displayName: 'Linea',
    symbol: 'ETH',
    coinTypeName: 'linea',
    networkId: 'eip155:59144',
    assetId: 'eip155:59144/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://linea-rpc.publicnode.com',
      'https://rpc.linea.build'],
    evmChainId: 59144,
    capabilities: capabilitiesForBalanceChain('linea', BALANCE_EVIDENCE_2026_11_23),
  },
  mantle: {
    id: 'mantle',
    displayName: 'Mantle',
    symbol: 'MNT',
    coinTypeName: 'mantle',
    networkId: 'eip155:5000',
    assetId: 'eip155:5000/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://mantle-rpc.publicnode.com',
      'https://rpc.mantle.xyz'],
    evmChainId: 5000,
    capabilities: capabilitiesForBalanceChain('mantle', BALANCE_EVIDENCE_2026_11_23),
  },
  scroll: {
    id: 'scroll',
    displayName: 'Scroll',
    symbol: 'ETH',
    coinTypeName: 'scroll',
    networkId: 'eip155:534352',
    assetId: 'eip155:534352/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://scroll-rpc.publicnode.com',
      'https://rpc.scroll.io'],
    evmChainId: 534352,
    capabilities: capabilitiesForBalanceChain('scroll', BALANCE_EVIDENCE_2026_11_23),
  },
  opbnb: {
    id: 'opbnb',
    displayName: 'opBNB',
    symbol: 'BNB',
    coinTypeName: 'opBNB',
    networkId: 'eip155:204',
    assetId: 'eip155:204/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://opbnb-rpc.publicnode.com',
      'https://opbnb-mainnet-rpc.bnbchain.org'],
    evmChainId: 204,
    capabilities: capabilitiesForBalanceChain('opbnb', BALANCE_EVIDENCE_2026_11_23),
  },
  metis: {
    id: 'metis',
    displayName: 'Metis',
    symbol: 'METIS',
    coinTypeName: 'metis',
    networkId: 'eip155:1088',
    assetId: 'eip155:1088/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://metis-rpc.publicnode.com',
      'https://andromeda.metis.io'],
    evmChainId: 1088,
    capabilities: capabilitiesForBalanceChain('metis', BALANCE_EVIDENCE_2026_11_23),
  },
  aurora: {
    id: 'aurora',
    displayName: 'Aurora',
    symbol: 'ETH',
    coinTypeName: 'aurora',
    networkId: 'eip155:1313161554',
    assetId: 'eip155:1313161554/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://mainnet.aurora.dev',
      'https://1rpc.io/aurora'],
    evmChainId: 1313161554,
    capabilities: capabilitiesForBalanceChain('aurora', BALANCE_EVIDENCE_2026_11_23),
  },
  fantom: {
    id: 'fantom',
    displayName: 'Fantom',
    symbol: 'FTM',
    coinTypeName: 'fantom',
    networkId: 'eip155:250',
    assetId: 'eip155:250/slip44:250',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account, index) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    rpcEndpoints: ['https://rpc.fantom.network',
      'https://rpc2.fantom.network'],
    evmChainId: 250,
    capabilities: capabilitiesForBalanceChain('fantom', BALANCE_EVIDENCE_2026_11_23),
  },
};

export const SUPPORTED_CHAINS: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom'];

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

/**
 * Lane C (bot use case): the account-level path an extended public key
 * covers — the path the bot appends `/0/<index>` to for receiving
 * addresses. BTC `m/84'/0'/0'`, LTC `m/84'/2'/0'`, DOGE `m/44'/3'/0'`,
 * every EVM chain and TRX `m/44'/60'/0'` / `m/44'/195'/0'`. TON and SOL
 * have no account path: their path is already the single address path.
 */
export function accountPathFor(chain: ChainId, account: number): string {
  const path = pathFor(chain, account, 0);
  if (chain === 'ton' || chain === 'sol') return path;
  return path.replace(/\/0\/0$/u, '');
}

/**
 * Whether a fresh receive address can be derived for this chain (Lane C,
 * item 8 — HD rotation). Solana and TON have one address per wallet by
 * design: their paths are fully hardened (`m/44'/501'/0'` and
 * `m/44'/607'/0'`) and ignore the account and index, so rotating would
 * change nothing — and changing the path would change existing users'
 * addresses. Every other chain rotates: a new index gives a new address.
 */
export function canRotateReceiveAddress(chain: ChainId): boolean {
  return chain !== 'sol' && chain !== 'ton';
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

/**
 * RPC endpoint overrides (UI/UX fixes, item 19).
 *
 * The registry lists each chain's known-good endpoints (primary first,
 * backup second where one was verified live). The owner can add a custom
 * RPC, promote a backup to primary, or reset — stored per chain under
 * one localStorage key. Adapters resolve their endpoint list lazily
 * through resolveRpcEndpoints, so a change applies on the next balance
 * refresh without rebuilding any adapter. Dogecoin is NOT managed here:
 * its adapter has a built-in SoChain/BlockCypher pair with different
 * API shapes, so a custom URL could not be applied honestly.
 */
export const RPC_OVERRIDES_KEY = 'bawa-rpc-overrides:v1';
export const MAX_RPC_ENDPOINTS_PER_CHAIN = 3;

/** The chains whose adapters consume resolveRpcEndpoints (all but Dogecoin). */
export const RPC_MANAGED_CHAINS: readonly ChainId[] = SUPPORTED_CHAINS.filter(
  (chain) => chain !== 'doge',
);

export interface RpcOverrideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): RpcOverrideStorage | undefined {
  try {
    const storage = globalThis.localStorage;
    return storage === undefined ? undefined : storage;
  } catch {
    return undefined;
  }
}

function readStoredOverrides(
  storage?: RpcOverrideStorage,
): Partial<Record<ChainId, string[]>> {
  const store = storage ?? defaultStorage();
  if (store === undefined) return {};
  let raw: string | null;
  try {
    raw = store.getItem(RPC_OVERRIDES_KEY);
  } catch {
    return {};
  }
  if (raw === null || raw === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const out: Partial<Record<ChainId, string[]>> = {};
  for (const chain of SUPPORTED_CHAINS) {
    const list = (parsed as Record<string, unknown>)[chain];
    if (!Array.isArray(list)) continue;
    const urls = list.filter(
      (entry): entry is string =>
        typeof entry === 'string' && validateRpcEndpoint(entry) === null,
    );
    if (urls.length > 0) {
      out[chain] = urls.slice(0, MAX_RPC_ENDPOINTS_PER_CHAIN);
    }
  }
  return out;
}

function writeStoredOverrides(
  overrides: Partial<Record<ChainId, string[]>>,
  storage?: RpcOverrideStorage,
): void {
  const store = storage ?? defaultStorage();
  if (store === undefined) return;
  const entries = Object.entries(overrides).filter(
    ([, list]) => list !== undefined && list.length > 0,
  );
  try {
    if (entries.length === 0) {
      store.removeItem(RPC_OVERRIDES_KEY);
    } else {
      store.setItem(RPC_OVERRIDES_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {
    // Storage full or unavailable: the in-memory list still applies for
    // this session's resolve calls through the passed storage; a
    // browser write failure never breaks a balance refresh.
  }
}

/** The effective endpoint list for a chain: the stored override, else the registry. */
export function resolveRpcEndpoints(
  chain: ChainId,
  storage?: RpcOverrideStorage,
): string[] {
  const stored = readStoredOverrides(storage)[chain];
  return stored !== undefined ? [...stored] : [...CHAINS[chain].rpcEndpoints];
}

/**
 * Validates a custom RPC URL. Returns null when valid, else a message
 * for the owner. Only https, no embedded credentials, no query or
 * fragment — a keyed RPC (one with ?apikey=) is out of scope by owner
 * rule, and credentials in a stored URL would leak into request logs.
 */
export function validateRpcEndpoint(url: string): string | null {
  if (url.length === 0 || url.length > 256) return 'Enter a valid RPC URL.';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Enter a valid RPC URL.';
  }
  if (parsed.protocol !== 'https:') return 'RPC URLs must use https.';
  if (parsed.username !== '' || parsed.password !== '') {
    return 'RPC URLs must not contain credentials.';
  }
  if (parsed.hostname === '') return 'Enter a valid RPC URL.';
  if (parsed.search !== '' || parsed.hash !== '') {
    return 'RPC URLs must not contain a query or fragment.';
  }
  return null;
}

export function addCustomRpcEndpoint(
  chain: ChainId,
  url: string,
  storage?: RpcOverrideStorage,
): { ok: true } | { ok: false; reason: string } {
  const invalid = validateRpcEndpoint(url);
  if (invalid !== null) return { ok: false, reason: invalid };
  const current = resolveRpcEndpoints(chain, storage);
  if (current.includes(url)) {
    return {
      ok: false,
      reason: 'That RPC endpoint is already listed for this chain.',
    };
  }
  if (current.length >= MAX_RPC_ENDPOINTS_PER_CHAIN) {
    return {
      ok: false,
      reason: `At most ${MAX_RPC_ENDPOINTS_PER_CHAIN} endpoints per chain.`,
    };
  }
  const overrides = readStoredOverrides(storage);
  overrides[chain] = [...current, url];
  writeStoredOverrides(overrides, storage);
  return { ok: true };
}

/**
 * Removes a custom endpoint. Registry endpoints are never removed —
 * the registry is the known-good set; a registry endpoint the owner
 * distrusts is demoted with promoteBackupEndpoint, not deleted.
 */
export function removeRpcEndpoint(
  chain: ChainId,
  url: string,
  storage?: RpcOverrideStorage,
): boolean {
  if (CHAINS[chain].rpcEndpoints.includes(url)) return false;
  const current = resolveRpcEndpoints(chain, storage);
  if (!current.includes(url)) return false;
  const next = current.filter((entry) => entry !== url);
  return persistRpcEndpoints(chain, next, storage);
}

/**
 * Persist an endpoint list: drop the override when it equals the
 * registry defaults, store it otherwise. Shared by removeRpcEndpoint
 * and promoteBackupEndpoint. False when the list is empty.
 */
function persistRpcEndpoints(
  chain: ChainId,
  next: string[],
  storage?: RpcOverrideStorage,
): boolean {
  if (next.length === 0) return false;
  const overrides = readStoredOverrides(storage);
  const defaults = CHAINS[chain].rpcEndpoints;
  if (
    next.length === defaults.length &&
    next.every((entry, index) => entry === defaults[index])
  ) {
    delete overrides[chain];
  } else {
    overrides[chain] = next;
  }
  writeStoredOverrides(overrides, storage);
  return true;
}

/** Swaps the first two endpoints of the effective list (backup becomes primary). */
export function promoteBackupEndpoint(
  chain: ChainId,
  storage?: RpcOverrideStorage,
): boolean {
  const current = resolveRpcEndpoints(chain, storage);
  if (current.length < 2) return false;
  const next = [current[1] as string, current[0] as string, ...current.slice(2)];
  return persistRpcEndpoints(chain, next, storage);
}

/** Promotes the backup for every managed chain that has one. Returns the chains changed. */
export function promoteBackupEndpointsAll(
  storage?: RpcOverrideStorage,
): ChainId[] {
  const changed: ChainId[] = [];
  for (const chain of RPC_MANAGED_CHAINS) {
    if (promoteBackupEndpoint(chain, storage)) changed.push(chain);
  }
  return changed;
}

export function resetRpcEndpoints(
  chain: ChainId,
  storage?: RpcOverrideStorage,
): void {
  const overrides = readStoredOverrides(storage);
  delete overrides[chain];
  writeStoredOverrides(overrides, storage);
}

export function resetAllRpcEndpoints(storage?: RpcOverrideStorage): void {
  const store = storage ?? defaultStorage();
  if (store === undefined) return;
  try {
    store.removeItem(RPC_OVERRIDES_KEY);
  } catch {
    // Ignore: the defaults apply when the key cannot be read anyway.
  }
}

/** The hostname of an endpoint URL, for display; the raw string when unparseable. */
export function rpcEndpointHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
