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
  it('supports exactly four mainnet chains', () => {
    expect([...SUPPORTED_CHAINS].sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
    expect(Object.keys(CHAINS).sort()).toEqual(['btc', 'eth', 'ton', 'trx']);
  });

  it('uses mainnet CAIP-2 network IDs', () => {
    expect(CHAINS.eth.networkId).toBe('eip155:1');
    expect(CHAINS.btc.networkId).toBe(
      'bip122:000000000019d6689c085ae165831e93',
    );
    expect(CHAINS.trx.networkId).toBe('tron:0x2b6653dc');
    expect(CHAINS.ton.networkId).toBe('ton:-239');
  });

  it('uses CAIP-19 native asset IDs via the slip44 namespace', () => {
    expect(CHAINS.btc.assetId).toBe(
      'bip122:000000000019d6689c085ae165831e93/slip44:0',
    );
    expect(CHAINS.eth.assetId).toBe('eip155:1/slip44:60');
    expect(CHAINS.trx.assetId).toBe('tron:0x2b6653dc/slip44:195');
    expect(CHAINS.ton.assetId).toBe('ton:-239/slip44:607');
  });

  it('derives account 0 index 0 paths from the pinned profiles', () => {
    expect(pathFor('btc', 0, 0)).toBe("m/84'/0'/0'/0/0");
    expect(pathFor('eth', 0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(pathFor('trx', 0, 0)).toBe("m/44'/195'/0'/0/0");
    expect(pathFor('ton', 0, 0)).toBe("m/44'/607'/0'");
    expect(profileFor('btc')).toBe('bawa-btc-bip84-v1');
    expect(profileFor('eth')).toBe('bawa-evm-bip44-v1');
    expect(profileFor('trx')).toBe('bawa-trx-bip44-v1');
    expect(profileFor('ton')).toBe('bawa-ton-v4r2-v1');
  });

  it('uses a fully hardened TON path with no index suffix', () => {
    expect(pathFor('ton', 0, 1)).toBe("m/44'/607'/0'");
    expect(pathFor('ton', 1, 0)).toBe("m/44'/607'/0'");
  });

  it('rejects negative or non-integer account and index values', () => {
    expect(() => pathFor('eth', -1, 0)).toThrow();
    expect(() => pathFor('eth', 0, -1)).toThrow();
    expect(() => pathFor('eth', 0.5, 0)).toThrow();
  });

  it('lists all four chains for derive, restore and receive', () => {
    expect(availableFor('derive')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('restore')).toEqual(['btc', 'eth', 'trx', 'ton']);
    expect(availableFor('receive')).toEqual(['btc', 'eth', 'trx', 'ton']);
  });

  it('lists no chain for adapter and transaction capabilities', () => {
    for (const capability of [
      'balance',
      'history',
      'fee-quote',
      'unsigned-plan',
      'local-sign',
      'post-sign-verify',
    ] as const) {
      expect(availableFor(capability)).toEqual([]);
    }
  });

  it('marks derive, restore and receive verified and the rest blocked', () => {
    for (const chain of SUPPORTED_CHAINS) {
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
        expect(caps[capability].evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('throws a typed error naming the unavailable combination', () => {
    expect(() => assertSupported('eth', 'balance')).toThrow(
      /chain eth \(eip155:1, profile bawa-evm-bip44-v1\) cannot do balance/,
    );
    expect(() => assertSupported('ton', 'local-sign')).toThrow(
      /cannot do local-sign/,
    );
    expect(() => assertSupported('eth', 'derive')).not.toThrow();
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
    expect(() => chainConfigForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toThrow(
      /Unsupported network/,
    );
  });

  it('names both Solana profiles as unsupported and nothing else', () => {
    const ids = Object.keys(SOLANA_PROFILES).sort();
    expect(ids).toEqual([
      'solana-phantom-bip44change-v1',
      'walletcore-solana-default-v1',
    ]);
    for (const profile of Object.values(SOLANA_PROFILES)) {
      expect(profile.status).toBe('unsupported');
    }
    const walletcore = SOLANA_PROFILES['walletcore-solana-default-v1'];
    const phantom = SOLANA_PROFILES['solana-phantom-bip44change-v1'];
    expect(walletcore).toBeDefined();
    expect(phantom).toBeDefined();
    expect(walletcore?.path).toBe("m/44'/501'/0'");
    expect(phantom?.path).toBe("m/44'/501'/{i}'/0'");
    expect(availableFor('derive')).not.toContain('solana');
  });

  it('sets the EVM chain ID only for Ethereum', () => {
    expect(CHAINS.eth.evmChainId).toBe(1);
    expect(CHAINS.btc.evmChainId).toBeNull();
    expect(CHAINS.trx.evmChainId).toBeNull();
    expect(CHAINS.ton.evmChainId).toBeNull();
  });

  it('throws for an unknown chain', () => {
    expect(() => chainConfig('solana' as never)).toThrow(/Unsupported chain/);
  });
});
