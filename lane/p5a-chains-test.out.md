```typescript
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
    expect(pathFor('bsc', 0, 0)).toBe("m/44'/60'/0'/0/0'");
    expect(pathFor('matic', 0, 0)).toBe("m/44'/60'/0'/0/0'");
    expect(pathFor('arb', 0, 0)).toBe("m/44'/60'/0'/0/0'");
    expect(pathFor('op', 0, 0)).toBe("m/44'/60'/0'/0/0'");
    expect(pathFor('base', 0, 0)).toBe("m/44'/60'/0'/0/0'");
    expect(pathFor('avax', 0, 0)).toBe("m/44'/60'/0'/0/0'");
    expect(pathFor('ltc', 0, 0)).toBe("m/84'/2'/0'/0/0'");
    expect(pathFor('doge', 0, 0)).toBe("m/44'/3'/0'/0/0'");
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
```