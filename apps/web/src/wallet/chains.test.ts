import { describe, expect, it } from 'vitest';
import {
  assertHardenedEd25519Path,
  assertSupported,
  availableFor,
  canRotateReceiveAddress,
  capabilitiesFor,
  CHAINS,
  chainConfig,
  chainConfigForNetwork,
  GENERATED_CHAIN_FACTS,
  pathFor,
  profileFor,
  SOLANA_PROFILES,
  SUPPORTED_CHAINS,
} from './chains';
import { DEVNET_NETWORK_IDS } from './devnet-endpoints';

describe('chains registry', () => {
  it('supports exactly thirteen mainnet chains', () => {
    expect([...SUPPORTED_CHAINS].sort()).toEqual([
      'arb',
      'avax',
      'base',
      'bsc',
      'btc',
      'doge',
      'eth',
      'ltc',
      'matic',
      'op',
      'sol',
      'ton',
      'trx',
    ]);
    expect(Object.keys(CHAINS).sort()).toEqual([
      'arb',
      'avax',
      'base',
      'bsc',
      'btc',
      'doge',
      'eth',
      'ltc',
      'matic',
      'op',
      'sol',
      'ton',
      'trx',
    ]);
  });

  it('uses mainnet CAIP-2 network IDs', () => {
    expect(CHAINS.eth.networkId).toBe('eip155:1');
    expect(CHAINS.btc.networkId).toBe(
      'bip122:000000000019d6689c085ae165831e93',
    );
    expect(CHAINS.trx.networkId).toBe('tron:0x2b6653dc');
    expect(CHAINS.ton.networkId).toBe('ton:-239');
    expect(CHAINS.sol.networkId).toBe(
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    );
    expect(CHAINS.bsc.networkId).toBe('eip155:56');
    expect(CHAINS.matic.networkId).toBe('eip155:137');
    expect(CHAINS.arb.networkId).toBe('eip155:42161');
    expect(CHAINS.op.networkId).toBe('eip155:10');
    expect(CHAINS.base.networkId).toBe('eip155:8453');
    expect(CHAINS.avax.networkId).toBe('eip155:43114');
    expect(CHAINS.ltc.networkId).toBe(
      'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
    );
    expect(CHAINS.doge.networkId).toBe(
      'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
    );
  });

  it('uses CAIP-19 native asset IDs via the slip44 namespace', () => {
    expect(CHAINS.btc.assetId).toBe(
      'bip122:000000000019d6689c085ae165831e93/slip44:0',
    );
    expect(CHAINS.eth.assetId).toBe('eip155:1/slip44:60');
    expect(CHAINS.trx.assetId).toBe('tron:0x2b6653dc/slip44:195');
    expect(CHAINS.ton.assetId).toBe('ton:-239/slip44:607');
    expect(CHAINS.sol.assetId).toBe(
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
    );
    expect(CHAINS.bsc.assetId).toBe('eip155:56/slip44:714');
    expect(CHAINS.matic.assetId).toBe('eip155:137/slip44:966');
    expect(CHAINS.arb.assetId).toBe('eip155:42161/slip44:60');
    expect(CHAINS.op.assetId).toBe('eip155:10/slip44:60');
    expect(CHAINS.base.assetId).toBe('eip155:8453/slip44:60');
    expect(CHAINS.avax.assetId).toBe('eip155:43114/slip44:9000');
    expect(CHAINS.ltc.assetId).toBe(
      'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2',
    );
    expect(CHAINS.doge.assetId).toBe(
      'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691/slip44:3',
    );
  });

  it('derives account 0 index 0 paths from the pinned profiles', () => {
    expect(pathFor('btc', 0, 0)).toBe("m/84'/0'/0'/0/0");
    expect(pathFor('eth', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('trx', 0, 0)).toBe("m/44'/195'/0'/0/0");
    expect(pathFor('ton', 0, 0)).toBe("m/44'/607'/0'");
    expect(pathFor('sol', 0, 0)).toBe("m/44'/501'/0'");
    expect(pathFor('bsc', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('matic', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('arb', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('op', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('base', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('avax', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('ltc', 0, 0)).toBe("m/84'/2'/0'/0/0");
    expect(pathFor('doge', 0, 0)).toBe("m/44'/3'/0'/0/0");
    expect(profileFor('btc')).toBe('bawa-btc-bip84-v1');
    expect(profileFor('eth')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('trx')).toBe('bawa-trx-bip44-v1');
    expect(profileFor('ton')).toBe('bawa-ton-v4r2-v1');
    expect(profileFor('sol')).toBe('bawa-sol-bip44-v1');
    expect(profileFor('bsc')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('matic')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('arb')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('op')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('base')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('avax')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('ltc')).toBe('bawa-ltc-bip84-v1');
    expect(profileFor('doge')).toBe('bawa-doge-bip44-v1');
  });

  it('uses a fully hardened TON path with no index suffix', () => {
    expect(pathFor('ton', 0, 1)).toBe("m/44'/607'/0'");
    expect(pathFor('ton', 1, 0)).toBe("m/44'/607'/0'");
  });

  it('uses a fully hardened SOL path with no index suffix', () => {
    expect(pathFor('sol', 0, 1)).toBe("m/44'/501'/0'");
    expect(pathFor('sol', 1, 0)).toBe("m/44'/501'/0'");
  });

  it('lists all thirteen chains for derive, restore and receive', () => {
    expect(availableFor('derive')).toEqual([
      'btc',
      'eth',
      'trx',
      'ton',
      'sol',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'ltc',
      'doge',
    ]);
    expect(availableFor('restore')).toEqual([
      'btc',
      'eth',
      'trx',
      'ton',
      'sol',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'ltc',
      'doge',
    ]);
    expect(availableFor('receive')).toEqual([
      'btc',
      'eth',
      'trx',
      'ton',
      'sol',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'ltc',
      'doge',
    ]);
  });

  it('lists all thirteen chains for balance, seven chains for history, and three for fee-quote', () => {
    // Token discovery (2026-11-22): balance adapters now exist for all
    // 13 chains, so availableFor('balance') is the full registry.
    expect(availableFor('balance')).toEqual([
      'btc',
      'eth',
      'trx',
      'ton',
      'sol',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'ltc',
      'doge',
    ]);
    // Lane C, item 16 (2026-11-23): ltc/doge/sol history is verified —
    // adapters + live mainnet cross-check 2026-11-23 (second source).
    // The five non-ETH EVM chains stay blocked: no keyless public
    // history indexer exists for them (owner decision: keyed indexer).
    expect(availableFor('history')).toEqual([
      'btc',
      'eth',
      'trx',
      'ton',
      'sol',
      'ltc',
      'doge',
    ]);
    // TON fee-quote stays blocked: it needs the unsigned message (Phase 4).
    expect(availableFor('fee-quote')).toEqual(['btc', 'eth', 'trx']);
  });

  it('lists the four adapter chains for unsigned-plan and local-sign (Phase 4), and three for post-sign-verify', () => {
    expect(availableFor('unsigned-plan')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('local-sign')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON post-sign-verify stays blocked: the signed BOC is not re-parsed.
    expect(availableFor('post-sign-verify')).toEqual(['btc', 'eth', 'trx']);
  });

  it('marks the Phase 2 adapter capabilities verified with evidence, and the extended chains balance-verified with the rest blocked', () => {
    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      const caps = capabilitiesFor(chain);
      expect(caps.derive.status).toBe('verified');
      expect(caps.restore.status).toBe('verified');
      expect(caps.receive.status).toBe('verified');
      expect(caps.balance.status).toBe('verified');
      expect(caps.history.status).toBe('verified');
      expect(caps.balance.evidence).toContain('live mainnet cross-check 2026-11-19');
      expect(caps.history.evidence).toContain('live mainnet cross-check 2026-11-19');
      for (const capability of ['unsigned-plan', 'local-sign'] as const) {
        expect(caps[capability].status).toBe('verified');
        expect(caps[capability].evidence).toContain('send.test.ts');
      }
      if (chain === 'ton') {
        expect(caps['post-sign-verify'].status).toBe('blocked');
        expect(caps['post-sign-verify'].evidence).toContain('not re-parsed');
      } else {
        expect(caps['post-sign-verify'].status).toBe('verified');
        expect(caps['post-sign-verify'].evidence).toContain('send.test.ts');
      }
    }
    for (const chain of [
      'sol',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
      'ltc',
      'doge',
    ] as const) {
      const caps = capabilitiesFor(chain);
      expect(caps.derive.status).toBe('verified');
      expect(caps.restore.status).toBe('verified');
      expect(caps.receive.status).toBe('verified');
      // Token discovery (2026-11-22): balance is verified for the nine
      // extended chains (live mainnet cross-check 2026-11-22); the
      // send steps stay blocked — never faked.
      expect(caps.balance.status).toBe('verified');
      expect(caps.balance.evidence).toContain('live mainnet cross-check 2026-11-22');
      for (const capability of [
        'fee-quote',
        'unsigned-plan',
        'local-sign',
        'post-sign-verify',
      ] as const) {
        expect(caps[capability].status).toBe('blocked');
        expect(caps[capability].evidence).toContain('never faked');
      }
      // Lane C, item 16 (2026-11-23): history is verified for sol/ltc/
      // doge (adapters + live mainnet cross-check 2026-11-23, second
      // source) and stays blocked for the five non-ETH EVM chains —
      // no keyless public history indexer exists for them.
      if (chain === 'sol' || chain === 'ltc' || chain === 'doge') {
        expect(caps.history.status).toBe('verified');
        expect(caps.history.evidence).toContain('live mainnet cross-check 2026-11-23');
      } else {
        expect(caps.history.status).toBe('blocked');
        expect(caps.history.evidence).toContain('never faked');
      }
    }
    expect(capabilitiesFor('ton')['fee-quote'].status).toBe('blocked');
    expect(capabilitiesFor('ton')['fee-quote'].evidence).toContain('unsigned message');
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(capabilitiesFor(chain)['fee-quote'].status).toBe('verified');
    }
  });

  it('pins the Phase 2 adapter RPC endpoints and the token-discovery endpoints for the extended chains', () => {
    expect(CHAINS.btc.rpcEndpoints).toEqual(['https://mempool.space/api']);
    expect(CHAINS.eth.rpcEndpoints).toEqual([
      'https://ethereum-rpc.publicnode.com',
    ]);
    expect(CHAINS.trx.rpcEndpoints).toEqual(['https://api.trongrid.io']);
    expect(CHAINS.ton.rpcEndpoints).toEqual([
      'https://toncenter.com/api/v2/jsonRPC',
    ]);
    // Token discovery (2026-11-22): live-verified endpoints (Lane 1).
    // Polygon pins the -bor- host only — polygon-rpc.publicnode.com
    // returned empty twice and is never pinned.
    // Token gaps (2026-11-22, Lane 1): SOL retires
    // api.mainnet-beta.solana.com (browser 403) for publicnode primary +
    // Vibe Station fallback; DOGE adds SoChain primary ahead of
    // BlockCypher.
    expect(CHAINS.sol.rpcEndpoints).toEqual([
      'https://solana-rpc.publicnode.com',
      'https://public.rpc.solanavibestation.com',
    ]);
    expect(CHAINS.bsc.rpcEndpoints).toEqual([
      'https://bsc-rpc.publicnode.com',
    ]);
    expect(CHAINS.matic.rpcEndpoints).toEqual([
      'https://polygon-bor-rpc.publicnode.com',
    ]);
    expect(CHAINS.arb.rpcEndpoints).toEqual([
      'https://arbitrum-rpc.publicnode.com',
    ]);
    expect(CHAINS.op.rpcEndpoints).toEqual([
      'https://optimism-rpc.publicnode.com',
    ]);
    expect(CHAINS.base.rpcEndpoints).toEqual([
      'https://base-rpc.publicnode.com',
    ]);
    expect(CHAINS.avax.rpcEndpoints).toEqual([
      'https://avalanche-rpc.publicnode.com',
    ]);
    expect(CHAINS.ltc.rpcEndpoints).toEqual([
      'https://litecoinspace.org/api',
    ]);
    expect(CHAINS.doge.rpcEndpoints).toEqual([
      'https://sochain.com/api/v3',
      'https://api.blockcypher.com/v1/doge/main',
    ]);
  });

  it('throws a typed error naming the unavailable combination', () => {
    expect(() => assertSupported('ton', 'fee-quote')).toThrow(
      /chain ton \(ton:-239, profile bawa-ton-v4r2-v1\) cannot do fee-quote/,
    );
    expect(() => assertSupported('ton', 'post-sign-verify')).toThrow(
      /cannot do post-sign-verify/,
    );
    expect(() => assertSupported('ton', 'local-sign')).not.toThrow();
    expect(() => assertSupported('eth', 'balance')).not.toThrow();
    expect(() => assertSupported('eth', 'derive')).not.toThrow();
    expect(() => assertSupported('sol', 'balance')).not.toThrow();
    expect(() => assertSupported('sol', 'local-sign')).toThrow(
      /cannot do local-sign/,
    );
    expect(() => assertSupported('ltc', 'history')).not.toThrow();
    expect(() => assertSupported('sol', 'history')).not.toThrow();
    expect(() => assertSupported('doge', 'history')).not.toThrow();
    expect(() => assertSupported('bsc', 'history')).toThrow(/cannot do history/);
    expect(() => assertSupported('sol', 'derive')).not.toThrow();
  });

  it('has no non-mainnet network, asset or endpoint string in the registry', () => {
    const registryText = JSON.stringify(CHAINS) + JSON.stringify(SOLANA_PROFILES);
    expect(registryText).not.toMatch(/testnet|sepolia|nile/i);
  });

  it('keeps devnet network ids in the devnet module only', () => {
    // TEMPORARY devnet mode: testnet strings are allowed in
    // wallet/devnet-endpoints.ts (DEVNET_NETWORK_IDS) and nowhere in
    // the mainnet registry above. The mainnet resolver still rejects
    // every devnet network id, and the devnet resolver rejects every
    // mainnet id — the two registries never resolve each other.
    expect([...DEVNET_NETWORK_IDS].sort()).toEqual([
      'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      'eip155:11155111',
      'ton:-3',
      'tron:nile',
    ]);
    for (const networkId of DEVNET_NETWORK_IDS) {
      expect(() => chainConfigForNetwork(networkId)).toThrow(
        /Unsupported network/,
      );
    }
  });

  it('resolves chains by mainnet network ID and throws for anything else', () => {
    expect(chainConfigForNetwork('eip155:1').id).toBe('eth');
    expect(chainConfigForNetwork('ton:-239').id).toBe('ton');
    expect(() => chainConfigForNetwork('eip155:11155111')).toThrow(
      /Unsupported network/,
    );
    expect(
      chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp').id,
    ).toBe('sol');
    expect(
      chainConfigForNetwork(
        'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
      ).id,
    ).toBe('ltc');
  });

  it('names only the Solana phantom profile as unsupported', () => {
    const ids = Object.keys(SOLANA_PROFILES).sort();
    expect(ids).toEqual(['solana-phantom-bip44change-v1']);
    for (const profile of Object.values(SOLANA_PROFILES)) {
      expect(profile.status).toBe('unsupported');
    }
    const phantom = SOLANA_PROFILES['solana-phantom-bip44change-v1'];
    expect(phantom).toBeDefined();
    expect(phantom?.path).toBe("m/44'/501'/{i}'/0'");
    expect(availableFor('derive')).not.toContain('solana');
  });

  it('sets the EVM chain ID for the EVM chains only', () => {
    expect(CHAINS.eth.evmChainId).toBe(1);
    expect(CHAINS.bsc.evmChainId).toBe(56);
    expect(CHAINS.matic.evmChainId).toBe(137);
    expect(CHAINS.arb.evmChainId).toBe(42161);
    expect(CHAINS.op.evmChainId).toBe(10);
    expect(CHAINS.base.evmChainId).toBe(8453);
    expect(CHAINS.avax.evmChainId).toBe(43114);
    expect(CHAINS.btc.evmChainId).toBeNull();
    expect(CHAINS.trx.evmChainId).toBeNull();
    expect(CHAINS.ton.evmChainId).toBeNull();
    expect(CHAINS.sol.evmChainId).toBeNull();
    expect(CHAINS.ltc.evmChainId).toBeNull();
    expect(CHAINS.doge.evmChainId).toBeNull();
  });

  it('throws for an unknown chain', () => {
    expect(() => chainConfig('solana' as never)).toThrow(/Unsupported chain/);
  });
});

describe('capabilities.json registry shape and identity', () => {
  type RegistryCoin = {
    registryId: string;
    bawaChainId: 'btc' | 'eth' | 'trx' | 'ton' | null;
    coinTypeName: string;
    coinId: number;
    slip44: number | null;
    symbol: string;
    registrySymbol: string;
    decimals: number;
    curve: 'secp256k1' | 'ed25519';
    derivationTemplate: string;
    xpubVersion: string | null;
    evmChainId: number | null;
    status: 'supported' | 'prospective';
    displayName: string;
    networkId: string | null;
    assetId: string | null;
    profileId: string | null;
    rpcEndpoints: string[] | null;
  };

  const coinFields = [
    'registryId',
    'bawaChainId',
    'coinTypeName',
    'coinId',
    'slip44',
    'symbol',
    'registrySymbol',
    'decimals',
    'curve',
    'derivationTemplate',
    'xpubVersion',
    'evmChainId',
    'status',
    'displayName',
    'networkId',
    'assetId',
    'profileId',
    'rpcEndpoints',
  ] as const;

  const expectedSupportedCoins = {
    bitcoin: {
      registryId: 'bitcoin',
      bawaChainId: 'btc',
      coinTypeName: 'bitcoin',
      coinId: 0,
      slip44: null,
      symbol: 'BTC',
      registrySymbol: 'BTC',
      decimals: 8,
      curve: 'secp256k1',
      derivationTemplate: "m/84'/0'/{account}'/0/{index}",
      xpubVersion: '0x04b24746',
      evmChainId: null,
      status: 'supported',
      displayName: 'Bitcoin',
      networkId: 'bip122:000000000019d6689c085ae165831e93',
      assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
      profileId: 'bawa-btc-bip84-v1',
      rpcEndpoints: ['https://mempool.space/api'],
    },
    ethereum: {
      registryId: 'ethereum',
      bawaChainId: 'eth',
      coinTypeName: 'ethereum',
      coinId: 60,
      slip44: null,
      symbol: 'ETH',
      registrySymbol: 'ETH',
      decimals: 18,
      curve: 'secp256k1',
      derivationTemplate: "m/44'/60'/{account}'/0/{index}",
      xpubVersion: '0x0488b21e',
      evmChainId: 1,
      status: 'supported',
      displayName: 'Ethereum',
      networkId: 'eip155:1',
      assetId: 'eip155:1/slip44:60',
      profileId: 'bawa-evm-bip44-v1',
      rpcEndpoints: ['https://ethereum-rpc.publicnode.com'],
    },
    tron: {
      registryId: 'tron',
      bawaChainId: 'trx',
      coinTypeName: 'tron',
      coinId: 195,
      slip44: null,
      symbol: 'TRX',
      registrySymbol: 'TRX',
      decimals: 6,
      curve: 'secp256k1',
      derivationTemplate: "m/44'/195'/{account}'/0/{index}",
      xpubVersion: '0x0488b21e',
      evmChainId: null,
      status: 'supported',
      displayName: 'TRON',
      networkId: 'tron:0x2b6653dc',
      assetId: 'tron:0x2b6653dc/slip44:195',
      profileId: 'bawa-trx-bip44-v1',
      rpcEndpoints: ['https://api.trongrid.io'],
    },
    ton: {
      registryId: 'ton',
      bawaChainId: 'ton',
      coinTypeName: 'ton',
      coinId: 607,
      slip44: null,
      symbol: 'TON',
      registrySymbol: 'GRAM',
      decimals: 9,
      curve: 'ed25519',
      derivationTemplate: "m/44'/607'/0'",
      xpubVersion: null,
      evmChainId: null,
      status: 'supported',
      displayName: 'TON',
      networkId: 'ton:-239',
      assetId: 'ton:-239/slip44:607',
      profileId: 'bawa-ton-v4r2-v1',
      rpcEndpoints: ['https://toncenter.com/api/v2/jsonRPC'],
    },
  } as const;

  const implementedCoins = Object.entries(expectedSupportedCoins);
  const prospectiveCoinNames = [
    'solana',
    'smartchain',
    'polygon',
    'arbitrum',
    'optimism',
    'base',
    'avalanchec',
    'litecoin',
    'doge',
  ] as const;
  const coinNames = [
    ...Object.keys(expectedSupportedCoins),
    ...prospectiveCoinNames,
  ];

  // The seven registry coins with no live chain. Doge and base are NOT
  // here: the multichain-create merge made them live CHAINS entries (their
  // registry coins stay prospective — bawaChainId null — until the engine
  // supports them); they are covered by the next test instead.
  const prospectiveOnlyCoinNames = [
    'solana',
    'smartchain',
    'polygon',
    'arbitrum',
    'optimism',
    'avalanchec',
    'litecoin',
  ] as const;

  // Explicit allowlists, independent of the forbidden-words check. The
  // merged tree lists thirteen mainnet chains; only the four
  // engine-supported chains have supported registry coins.
  const mainnetNetworkIds = [
    'bip122:000000000019d6689c085ae165831e93',
    'eip155:1',
    'tron:0x2b6653dc',
    'ton:-239',
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    'eip155:56',
    'eip155:137',
    'eip155:42161',
    'eip155:10',
    'eip155:8453',
    'eip155:43114',
    'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
    'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
  ] as const;

  const supportedMainnetNetworkIds = [
    'bip122:000000000019d6689c085ae165831e93',
    'eip155:1',
    'tron:0x2b6653dc',
    'ton:-239',
  ] as const;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  function isHttpsUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  function hasCoinShape(
    coinName: string,
    value: unknown,
  ): value is RegistryCoin {
    if (!isRecord(value)) return false;

    // All listed fields are required; no additional fields are permitted.
    if (
      Object.keys(value).length !== coinFields.length ||
      !coinFields.every((field) =>
        Object.prototype.hasOwnProperty.call(value, field),
      )
    ) {
      return false;
    }

    if (
      value.registryId !== coinName ||
      !isNonEmptyString(value.coinTypeName) ||
      !isNonEmptyString(value.displayName) ||
      !isNonNegativeInteger(value.coinId) ||
      (value.slip44 !== null && !isNonNegativeInteger(value.slip44)) ||
      !isNonNegativeInteger(value.decimals) ||
      typeof value.symbol !== 'string' ||
      !/^[A-Z]+$/.test(value.symbol) ||
      typeof value.registrySymbol !== 'string' ||
      !/^[A-Z]+$/.test(value.registrySymbol) ||
      (value.curve !== 'secp256k1' && value.curve !== 'ed25519') ||
      !isNonEmptyString(value.derivationTemplate) ||
      !/^m(?:\/(?:\d+|\{account\}|\{index\})'?)+$/.test(
        value.derivationTemplate,
      ) ||
      (value.xpubVersion !== null &&
        (typeof value.xpubVersion !== 'string' ||
          !/^0x[0-9a-fA-F]{8}$/.test(value.xpubVersion))) ||
      (value.evmChainId !== null && !isNonNegativeInteger(value.evmChainId))
    ) {
      return false;
    }

    if (value.status === 'prospective') {
      return (
        value.bawaChainId === null &&
        value.networkId === null &&
        value.assetId === null &&
        value.profileId === null &&
        value.rpcEndpoints === null &&
        value.xpubVersion === null &&
        value.registrySymbol === value.symbol
      );
    }

    if (value.status !== 'supported') return false;

    return (
      typeof value.bawaChainId === 'string' &&
      ['btc', 'eth', 'trx', 'ton'].includes(value.bawaChainId) &&
      isNonEmptyString(value.networkId) &&
      /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/.test(value.networkId) &&
      isNonEmptyString(value.assetId) &&
      /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}\/slip44:\d+$/.test(
        value.assetId,
      ) &&
      isNonEmptyString(value.profileId) &&
      Array.isArray(value.rpcEndpoints) &&
      value.rpcEndpoints.length > 0 &&
      value.rpcEndpoints.every(isHttpsUrl) &&
      (value.curve === 'ed25519'
        ? value.xpubVersion === null
        : typeof value.xpubVersion === 'string') &&
      (value.bawaChainId === 'eth'
        ? isNonNegativeInteger(value.evmChainId)
        : value.evmChainId === null)
    );
  }

  function checkedCoin(coinName: string, value: unknown): RegistryCoin {
    if (!hasCoinShape(coinName, value)) {
      throw new Error(`Invalid registry coin: ${coinName}`);
    }
    return value;
  }

  async function readRegistryCoins(): Promise<Record<string, unknown>> {
    const { readFileSync } = await import('node:fs');
    // Resolve from this test file, not from the Vitest working directory.
    const registryUrl = new URL(
      '../../../../registry/capabilities.json',
      import.meta.url,
    );
    const registry: unknown = JSON.parse(readFileSync(registryUrl, 'utf8'));
    if (!isRecord(registry) || !isRecord(registry.coins)) {
      throw new Error('Registry must contain a coins object');
    }
    return registry.coins;
  }

  function supportedRegistryCoins(
    coins: Record<string, unknown>,
  ): RegistryCoin[] {
    return Object.entries(coins)
      .map(([coinName, value]) => checkedCoin(coinName, value))
      .filter((coin) => coin.status === 'supported');
  }

  function pathAtOrigin(template: string): string {
    return template
      .replace(/\{account\}/g, '0')
      .replace(/\{index\}/g, '0');
  }

  it('contains exactly the thirteen known coin entries', async () => {
    expect.assertions(1);
    const coins = await readRegistryCoins();
    expect(Object.keys(coins).sort()).toEqual([...coinNames].sort());
  });

  it.each(coinNames)(
    'validates required/permitted fields, symbols and decimals for %s',
    async (coinName) => {
      expect.assertions(5);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);

      expect(Object.keys(coin).sort()).toEqual([...coinFields].sort());
      expect(coin.symbol).toMatch(/^[A-Z]+$/);
      expect(coin.registrySymbol).toMatch(/^[A-Z]+$/);
      expect(Number.isInteger(coin.decimals)).toBe(true);
      expect(coin.decimals).toBeGreaterThanOrEqual(0);
    },
  );

  it('rejects missing required fields and unpermitted fields', () => {
    expect.assertions(3);
    const validConfig = expectedSupportedCoins.ethereum;
    const missingConfig: Record<string, unknown> = { ...validConfig };
    delete missingConfig.decimals;
    const extraConfig = { ...validConfig, unexpectedField: true };

    expect(() => checkedCoin('ethereum', validConfig)).not.toThrow();
    expect(() => checkedCoin('ethereum', missingConfig)).toThrow(
      /Invalid registry coin: ethereum/,
    );
    expect(() => checkedCoin('ethereum', extraConfig)).toThrow(
      /Invalid registry coin: ethereum/,
    );
  });

  it.each([
    ['a lowercase symbol', { symbol: 'Eth' }],
    ['fractional decimals', { decimals: 1.5 }],
    ['negative decimals', { decimals: -1 }],
    ['an HTTP RPC URL', { rpcEndpoints: ['http://example.com'] }],
    ['a malformed RPC URL', { rpcEndpoints: ['https://['] }],
  ] as const)(
    'rejects a locally built config with %s',
    (_reason, changes) => {
      expect.assertions(2);
      const validConfig = expectedSupportedCoins.ethereum;
      const badConfig = { ...validConfig, ...changes };

      expect(() => checkedCoin('ethereum', validConfig)).not.toThrow();
      expect(() => checkedCoin('ethereum', badConfig)).toThrow(
        /Invalid registry coin: ethereum/,
      );
    },
  );

  it.each(implementedCoins)(
    'pins all supported %s fields and aligns them with the live chain',
    async (coinName, expectedCoin) => {
      expect.assertions(5);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);
      const live = CHAINS[expectedCoin.bawaChainId];

      expect(coin).toEqual(expectedCoin);
      expect(live).toMatchObject({
        id: expectedCoin.bawaChainId,
        displayName: coin.displayName,
        symbol: coin.symbol,
        coinTypeName: coin.coinTypeName,
        networkId: coin.networkId,
        assetId: coin.assetId,
        profileId: coin.profileId,
        rpcEndpoints: coin.rpcEndpoints,
        evmChainId: coin.evmChainId,
      });
      expect(live).toHaveProperty(
        'symbol',
        expect.stringMatching(/^[A-Z]+$/),
      );
      expect(profileFor(expectedCoin.bawaChainId)).toBe(coin.profileId);
      expect(pathFor(expectedCoin.bawaChainId, 0, 0)).toBe(
        pathAtOrigin(coin.derivationTemplate),
      );
    },
  );

  it('allows only the thirteen explicitly listed mainnet network IDs', async () => {
    expect.assertions(2);
    const coins = await readRegistryCoins();

    expect(
      Object.values(CHAINS).map((chain) => chain.networkId).sort(),
    ).toEqual([...mainnetNetworkIds].sort());
    expect(
      supportedRegistryCoins(coins).map((coin) => coin.networkId).sort(),
    ).toEqual([...supportedMainnetNetworkIds].sort());
  });

  it('matches the EIP-155 numeric reference to evmChainId in both registries', async () => {
    expect.assertions(4);
    const coins = await readRegistryCoins();
    const ethereum = checkedCoin('ethereum', coins.ethereum);

    for (const config of [ethereum, CHAINS.eth]) {
      expect(config.networkId).toMatch(/^eip155:(0|[1-9]\d*)$/);
      expect(Number(config.networkId?.split(':')[1])).toBe(config.evmChainId);
    }
  });

  it.each(implementedCoins)(
    'keeps the %s asset network component identical to its CAIP-2 ID',
    async (coinName, expectedCoin) => {
      expect.assertions(3);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);
      const live = CHAINS[expectedCoin.bawaChainId];

      expect(coin.assetId?.split('/')[0]).toBe(coin.networkId);
      expect(live.assetId.split('/')[0]).toBe(live.networkId);
      expect(coin.assetId).toBe(`${coin.networkId}/slip44:${coin.coinId}`);
    },
  );

  it('has unique network IDs across the thirteen listed chains', async () => {
    expect.assertions(2);
    const coins = await readRegistryCoins();
    const liveIds = Object.values(CHAINS).map((chain) => chain.networkId);
    const registryIds = supportedRegistryCoins(coins).map(
      (coin) => coin.networkId,
    );

    expect(new Set(liveIds).size).toBe(13);
    expect(new Set(registryIds).size).toBe(4);
  });

  it('has unique account 0 index 0 derivation paths across the four engine chains', async () => {
    expect.assertions(3);
    const coins = await readRegistryCoins();
    // Only the four engine-supported chains: the seven coin-type-60 chains
    // (eth, bsc, matic, arb, op, base, avax) share m/44'/60'/0'/0/0 at
    // account 0 index 0 BY DESIGN — same coin type, same path — so path
    // uniqueness can only hold across the four engine chains. Verified
    // first-hand on the merged tree: 7 unique live paths across 13 chains.
    const livePaths = implementedCoins.map(([, coin]) =>
      pathFor(coin.bawaChainId, 0, 0),
    );
    const registryPaths = supportedRegistryCoins(coins).map((coin) =>
      pathAtOrigin(coin.derivationTemplate),
    );

    expect(new Set(livePaths).size).toBe(4);
    expect(new Set(registryPaths).size).toBe(4);
    const coinType60Chains = [
      'eth',
      'bsc',
      'matic',
      'arb',
      'op',
      'base',
      'avax',
    ] as const;
    expect(
      new Set(coinType60Chains.map((chain) => pathFor(chain, 0, 0))).size,
    ).toBe(1);
  });

  it.each(implementedCoins)(
    'parses every %s RPC URL and permits only HTTPS',
    async (coinName, expectedCoin) => {
      expect.assertions(4);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);
      const live = CHAINS[expectedCoin.bawaChainId];

      for (const endpoints of [coin.rpcEndpoints ?? [], live.rpcEndpoints]) {
        expect(endpoints.length).toBeGreaterThan(0);
        expect(endpoints.map((endpoint) => new URL(endpoint).protocol)).toEqual(
          endpoints.map(() => 'https:'),
        );
      }
    },
  );

  it.each(prospectiveOnlyCoinNames)(
    'keeps %s as prospective registry-only metadata, not a live chain',
    async (coinName) => {
      expect.assertions(5);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(coinName, coins[coinName]);

      expect(coin.status).toBe('prospective');
      expect(coin.bawaChainId).toBeNull();
      expect(coin).toMatchObject({
        networkId: null,
        assetId: null,
        profileId: null,
        rpcEndpoints: null,
        xpubVersion: null,
      });
      expect(coin.registrySymbol).toBe(coin.symbol);
      expect(() => chainConfig(coinName as never)).toThrow(/Unsupported chain/);
    },
  );

  it.each(['doge', 'base'] as const)(
    'keeps %s prospective in the registry but live-listed with balance verified and the rest blocked',
    async (chain) => {
      expect.assertions(9);
      const coins = await readRegistryCoins();
      const coin = checkedCoin(chain, coins[chain]);

      // Registry side: still prospective, no engine support yet.
      expect(coin.status).toBe('prospective');
      expect(coin.bawaChainId).toBeNull();
      expect(coin).toMatchObject({
        networkId: null,
        assetId: null,
        profileId: null,
        rpcEndpoints: null,
        xpubVersion: null,
      });
      expect(coin.registrySymbol).toBe(coin.symbol);
      // Live side: a listed chain with derive/restore/receive verified and
      // balance verified (token discovery, live mainnet cross-check
      // 2026-11-22); the other wallet capabilities stay blocked, never
      // faked.
      expect(chainConfig(chain)).toBeDefined();
      expect(capabilitiesFor(chain).derive.status).toBe('verified');
      expect(capabilitiesFor(chain).balance.status).toBe('verified');
      expect(capabilitiesFor(chain).balance.evidence).toContain('live mainnet cross-check 2026-11-22');
      expect(capabilitiesFor(chain).simulate.status).toBe('candidate');
    },
  );
});

describe('generated chain facts and ed25519 paths (S6b, item 22)', () => {
  // Marker lines copied verbatim from apps/web/scripts/generate-chains.mjs;
  // they are the contract the drift check enforces.
  const BEGIN_MARKER =
    '// BEGIN GENERATED CHAIN FACTS — do not hand-edit. Regenerate with: node scripts/generate-chains.mjs';
  const END_MARKER = '// END GENERATED CHAIN FACTS';

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  async function readRegistryCoins(): Promise<
    Record<string, Record<string, unknown>>
  > {
    const { readFileSync } = await import('node:fs');
    // Resolve from this test file, not from the Vitest working directory.
    const registryUrl = new URL(
      '../../../../registry/capabilities.json',
      import.meta.url,
    );
    const registry: unknown = JSON.parse(readFileSync(registryUrl, 'utf8'));
    if (!isRecord(registry) || !isRecord(registry.coins)) {
      throw new Error('Registry must contain a coins object');
    }
    return registry.coins as Record<string, Record<string, unknown>>;
  }

  async function readChainsSource(): Promise<string> {
    const { readFileSync } = await import('node:fs');
    const chainsUrl = new URL('./chains.ts', import.meta.url);
    return readFileSync(chainsUrl, 'utf8');
  }

  function supportedCoinFor(
    coins: Record<string, Record<string, unknown>>,
    chain: string,
  ): Record<string, unknown> {
    const coin = Object.values(coins).find(
      (entry) => entry.bawaChainId === chain,
    );
    if (!coin) {
      throw new Error(`No supported registry coin for chain ${chain}`);
    }
    return coin;
  }

  // Mirrors the single-value formatting in scripts/generate-chains.mjs
  // (tsValue). Byte-exactness of the whole block is the --check gate's job;
  // this pins that every registry value appears in the committed block in
  // the generator's format.
  function formatGeneratedValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length === 1) {
        return '[' + formatGeneratedValue(value[0]) + ']';
      }
      return (
        '[\n' +
        value.map((item) => '      ' + formatGeneratedValue(item) + ',').join('\n') +
        '\n    ]'
      );
    }
    throw new Error(
      `Cannot format generated value: ${JSON.stringify(value)}`,
    );
  }

  // The generator (S6a scope) emits facts only for the four
  // engine-supported chains. The nine multichain-create chains are live in
  // CHAINS but their registry coins carry bawaChainId: null, so the
  // generator emits nothing for them and these tests iterate the generated
  // keys, not SUPPORTED_CHAINS.
  const generatedChains = Object.keys(
    GENERATED_CHAIN_FACTS,
  ) as (keyof typeof GENERATED_CHAIN_FACTS)[];

  it('generates facts for exactly the four engine-supported chains', () => {
    expect([...generatedChains].sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
  });

  it.each(generatedChains)(
    'generated facts for %s agree with registry/capabilities.json',
    async (chain) => {
      expect.assertions(8);
      const coins = await readRegistryCoins();
      const coin = supportedCoinFor(coins, chain);
      const facts = GENERATED_CHAIN_FACTS[chain];
      expect(facts.displayName).toBe(coin.displayName as string);
      expect(facts.symbol).toBe(coin.symbol as string);
      expect(facts.coinTypeName).toBe(coin.coinTypeName as string);
      expect(facts.networkId).toBe(coin.networkId as string);
      expect(facts.assetId).toBe(coin.assetId as string);
      expect(facts.profileId).toBe(coin.profileId as string);
      expect(facts.rpcEndpoints).toEqual(coin.rpcEndpoints as string[]);
      expect(facts.evmChainId).toBe(coin.evmChainId as number | null);
    },
  );

  it('keeps exactly one generated-block marker pair in chains.ts, BEGIN before END', async () => {
    expect.assertions(3);
    const source = await readChainsSource();
    expect(source.split(BEGIN_MARKER).length - 1).toBe(1);
    expect(source.split(END_MARKER).length - 1).toBe(1);
    expect(source.indexOf(BEGIN_MARKER)).toBeLessThan(
      source.indexOf(END_MARKER),
    );
  });

  it.each(generatedChains)(
    'emits the %s generated block lines from the registry values (drift invariant)',
    async (chain) => {
      expect.assertions(9);
      const source = await readChainsSource();
      const coins = await readRegistryCoins();
      const coin = supportedCoinFor(coins, chain);
      const block = source.slice(
        source.indexOf(BEGIN_MARKER),
        source.indexOf(END_MARKER) + END_MARKER.length,
      );
      expect(block).toContain(`  ${chain}: {`);
      expect(block).toContain(
        `    displayName: ${formatGeneratedValue(coin.displayName)},`,
      );
      expect(block).toContain(
        `    symbol: ${formatGeneratedValue(coin.symbol)},`,
      );
      expect(block).toContain(
        `    coinTypeName: ${formatGeneratedValue(coin.coinTypeName)},`,
      );
      expect(block).toContain(
        `    networkId: ${formatGeneratedValue(coin.networkId)},`,
      );
      expect(block).toContain(
        `    assetId: ${formatGeneratedValue(coin.assetId)},`,
      );
      expect(block).toContain(
        `    profileId: ${formatGeneratedValue(coin.profileId)},`,
      );
      expect(block).toContain(
        `    rpcEndpoints: ${formatGeneratedValue(coin.rpcEndpoints)},`,
      );
      expect(block).toContain(
        `    evmChainId: ${formatGeneratedValue(coin.evmChainId)},`,
      );
    },
  );

  it('passes the fully hardened TON path, the live Solana path and the Phantom profile path', () => {
    expect.assertions(7);
    // The Wallet Core default Solana profile is live as CHAINS.sol
    // (profileId bawa-sol-bip44-v1, hardened path m/44'/501'/0'); it is NOT
    // in SOLANA_PROFILES any more — only the Phantom bip44Change profile
    // stays unsupported there.
    expect(SOLANA_PROFILES['walletcore-solana-default-v1']).toBeUndefined();
    expect(profileFor('sol')).toBe('bawa-sol-bip44-v1');
    const phantom = SOLANA_PROFILES['solana-phantom-bip44change-v1'];
    expect(phantom).toBeDefined();
    expect(() => assertHardenedEd25519Path(pathFor('ton', 0, 0))).not.toThrow();
    expect(() => assertHardenedEd25519Path(pathFor('sol', 0, 0))).not.toThrow();
    expect(() =>
      assertHardenedEd25519Path(phantom?.path.replace('{i}', '0') ?? ''),
    ).not.toThrow();
    // The Phantom placeholder form is itself fully hardened.
    expect(() => assertHardenedEd25519Path(phantom?.path ?? '')).not.toThrow();
  });

  it('throws naming the path for a non-hardened ed25519 component', () => {
    expect.assertions(3);
    for (const bad of [
      "m/44'/501'/0'/0",
      "m/44'/501'/0/0",
      "m/44'/607'/0/0",
    ]) {
      expect(() => assertHardenedEd25519Path(bad)).toThrow(bad);
    }
  });
});

describe('simulation and evidence levels (S7, items 9+23 chains halves)', () => {
  it.each(SUPPORTED_CHAINS)(
    'declares simulate as a candidate on %s, owned by the send lane',
    (chain) => {
      expect.assertions(4);
      const entry = capabilitiesFor(chain).simulate;
      expect(entry.status).toBe('candidate');
      expect(entry.evidence).toContain('item 9');
      expect(entry.evidence).toContain('send.ts');
      expect(entry.evidence).toContain('never confirmation');
    },
  );

  it('lists no chain for simulate and throws naming the combination', () => {
    expect.assertions(2);
    expect(availableFor('simulate')).toEqual([]);
    expect(() => assertSupported('eth', 'simulate')).toThrow(
      /cannot do simulate/,
    );
  });

  it.each(SUPPORTED_CHAINS)(
    'sets honest evidence levels for every capability on %s',
    (chain) => {
      expect.assertions(21);
      const caps = capabilitiesFor(chain);
      expect(Object.keys(caps).sort()).toEqual(
        [
          'derive',
          'restore',
          'receive',
          'balance',
          'history',
          'fee-quote',
          'unsigned-plan',
          'local-sign',
          'post-sign-verify',
          'simulate',
        ].sort(),
      );
      for (const name of Object.keys(caps) as Array<keyof typeof caps>) {
        const entry = caps[name];
        // Only a live mainnet cross-check justifies mainnet-confirmed:
        // balance, history and fee-quote where verified. Everything else
        // the offline tests and probes established is probe-only, and every
        // blocked or candidate entry is probe-only too.
        const expected =
          entry.status === 'verified' &&
          (name === 'balance' || name === 'history' || name === 'fee-quote')
            ? 'mainnet-confirmed'
            : 'probe-only';
        expect(entry.evidenceLevel).toBe(expected);
        // Cross-check the level against the evidence text itself.
        if (expected === 'mainnet-confirmed') {
          // A dated live mainnet cross-check justifies the level: the
          // Phase 2 chains were cross-checked 2026-11-19, the nine
          // token-discovery chains 2026-11-22, the ltc/doge/sol history
          // adapters 2026-11-23. Any of the dates is accepted; the rule
          // that a verified balance/history needs a dated cross-check
          // stays intact.
          expect(entry.evidence).toMatch(
            /live mainnet cross-check 2026-11-(19|22|23)/,
          );
        } else if (entry.status === 'verified') {
          expect(entry.evidence).toMatch(/send\.test\.ts|core\.test\.ts/);
        } else {
          expect(entry.evidence).not.toContain('live mainnet cross-check');
        }
      }
    },
  );
});

describe('canRotateReceiveAddress', () => {
  // Lane C, item 8: every chain rotates except SOL and TON, whose paths
  // are fully hardened (one address per wallet by design).
  it('rotates every chain except SOL and TON', () => {
    for (const chain of SUPPORTED_CHAINS) {
      expect(canRotateReceiveAddress(chain)).toBe(
        chain !== 'sol' && chain !== 'ton',
      );
    }
  });
});
