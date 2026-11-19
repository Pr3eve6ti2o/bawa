import { describe, expect, it } from 'vitest';
import {
  assertSupported,
  availableFor,
  capabilitiesFor,
  CHAINS,
  chainConfig,
  chainConfigForNetwork,
  pathFor,
  profileFor,
  SOLANA_PROFILES,
  SUPPORTED_CHAINS,
} from './chains';

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

  it('lists the four adapter chains for balance and history, and three for fee-quote', () => {
    expect(availableFor('balance')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('history')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON fee-quote stays blocked: it needs the unsigned message (Phase 4).
    expect(availableFor('fee-quote')).toEqual(['btc', 'eth', 'trx']);
  });

  it('lists the four adapter chains for unsigned-plan and local-sign (Phase 4), and three for post-sign-verify', () => {
    expect(availableFor('unsigned-plan')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('local-sign')).toEqual(['btc', 'eth', 'trx', 'ton']);
    // TON post-sign-verify stays blocked: the signed BOC is not re-parsed.
    expect(availableFor('post-sign-verify')).toEqual(['btc', 'eth', 'trx']);
  });

  it('marks the Phase 2 adapter capabilities verified with evidence, and the extended chains blocked with never-faked evidence', () => {
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
      for (const capability of [
        'balance',
        'history',
        'fee-quote',
        'unsigned-plan',
        'local-sign',
        'post-sign-verify',
      ] as const) {
        expect(caps[capability].status).toBe('blocked');
        expect(caps[capability].evidence).toContain('never faked');
      }
    }
    expect(capabilitiesFor('ton')['fee-quote'].status).toBe('blocked');
    expect(capabilitiesFor('ton')['fee-quote'].evidence).toContain('unsigned message');
    for (const chain of ['btc', 'eth', 'trx'] as const) {
      expect(capabilitiesFor(chain)['fee-quote'].status).toBe('verified');
    }
  });

  it('pins the Phase 2 adapter RPC endpoints and empty endpoints for the extended chains', () => {
    expect(CHAINS.btc.rpcEndpoints).toEqual(['https://mempool.space/api']);
    expect(CHAINS.eth.rpcEndpoints).toEqual([
      'https://ethereum-rpc.publicnode.com',
    ]);
    expect(CHAINS.trx.rpcEndpoints).toEqual(['https://api.trongrid.io']);
    expect(CHAINS.ton.rpcEndpoints).toEqual([
      'https://toncenter.com/api/v2/jsonRPC',
    ]);
    expect(CHAINS.sol.rpcEndpoints).toEqual([]);
    expect(CHAINS.bsc.rpcEndpoints).toEqual([]);
    expect(CHAINS.matic.rpcEndpoints).toEqual([]);
    expect(CHAINS.arb.rpcEndpoints).toEqual([]);
    expect(CHAINS.op.rpcEndpoints).toEqual([]);
    expect(CHAINS.base.rpcEndpoints).toEqual([]);
    expect(CHAINS.avax.rpcEndpoints).toEqual([]);
    expect(CHAINS.ltc.rpcEndpoints).toEqual([]);
    expect(CHAINS.doge.rpcEndpoints).toEqual([]);
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
    expect(() => assertSupported('sol', 'balance')).toThrow(/cannot do balance/);
    expect(() => assertSupported('sol', 'local-sign')).toThrow(
      /cannot do local-sign/,
    );
    expect(() => assertSupported('ltc', 'history')).toThrow(/cannot do history/);
    expect(() => assertSupported('sol', 'derive')).not.toThrow();
  });

  it('has no non-mainnet network, asset or endpoint string in the registry', () => {
    const registryText = JSON.stringify(CHAINS) + JSON.stringify(SOLANA_PROFILES);
    expect(registryText).not.toMatch(/testnet|sepolia|nile/i);
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
