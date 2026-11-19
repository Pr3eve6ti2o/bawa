```typescript
// apps/web/src/wallet/chains.ts: replace the ChainConfig coinTypeName line.
  coinTypeName: 'bitcoin' | 'ethereum' | 'tron' | 'ton' | 'solana' | 'smartChain' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalancheCChain' | 'litecoin' | 'dogecoin';
```

```typescript
// apps/web/src/wallet/chains.ts: insert immediately after capabilitiesForAdapterChain.
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
```

```typescript
// apps/web/src/wallet/chains.ts: insert these CHAINS entries immediately after the existing ton entry.
  sol: {
    displayName: 'Solana',
    symbol: 'SOL',
    coinTypeName: 'solana',
    networkId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    assetId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
    profileId: 'bawa-sol-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return "m/44'/501'/0'";
    },
    evmChainId: null,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('sol'),
  },
  bsc: {
    displayName: 'BNB Smart Chain',
    symbol: 'BNB',
    coinTypeName: 'smartChain',
    networkId: 'eip155:56',
    assetId: 'eip155:56/slip44:714',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    evmChainId: 56,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('bsc'),
  },
  matic: {
    displayName: 'Polygon',
    symbol: 'POL',
    coinTypeName: 'polygon',
    networkId: 'eip155:137',
    assetId: 'eip155:137/slip44:966',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    evmChainId: 137,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('matic'),
  },
  arb: {
    displayName: 'Arbitrum One',
    symbol: 'ETH',
    coinTypeName: 'arbitrum',
    networkId: 'eip155:42161',
    assetId: 'eip155:42161/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    evmChainId: 42161,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('arb'),
  },
  op: {
    displayName: 'OP Mainnet',
    symbol: 'ETH',
    coinTypeName: 'optimism',
    networkId: 'eip155:10',
    assetId: 'eip155:10/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    evmChainId: 10,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('op'),
  },
  base: {
    displayName: 'Base',
    symbol: 'ETH',
    coinTypeName: 'base',
    networkId: 'eip155:8453',
    assetId: 'eip155:8453/slip44:60',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    evmChainId: 8453,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('base'),
  },
  avax: {
    displayName: 'Avalanche C-Chain',
    symbol: 'AVAX',
    coinTypeName: 'avalancheCChain',
    networkId: 'eip155:43114',
    assetId: 'eip155:43114/slip44:9000',
    profileId: 'bawa-evm-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/60'/${account}'/0/${index}`;
    },
    evmChainId: 43114,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('avax'),
  },
  ltc: {
    displayName: 'Litecoin',
    symbol: 'LTC',
    coinTypeName: 'litecoin',
    networkId: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
    assetId: 'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2/slip44:2',
    profileId: 'bawa-ltc-bip84-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/84'/2'/${account}'/0/${index}`;
    },
    evmChainId: null,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('ltc'),
  },
  doge: {
    displayName: 'Dogecoin',
    symbol: 'DOGE',
    coinTypeName: 'dogecoin',
    networkId: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
    assetId: 'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691/slip44:3',
    profileId: 'bawa-doge-bip44-v1',
    pathFor: (account = 0, index = 0) => {
      assertAccountIndex(account, index);
      return `m/44'/3'/${account}'/0/${index}`;
    },
    evmChainId: null,
    rpcEndpoints: [],
    capabilities: capabilitiesForExtendedChain('doge'),
  },
```

```typescript
// apps/web/src/wallet/chains.ts: replace the array literal on the SUPPORTED_CHAINS line, preserving its declaration.
['btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge']
```

```typescript
// apps/web/src/wallet/chains.ts: replace the SOLANA_PROFILES comment with this; delete 'walletcore-solana-default-v1' and retain 'solana-phantom-bip44change-v1' and all its fields unchanged.
// The Wallet Core default Solana profile is now supported as bawa-sol-bip44-v1; only the Phantom bip44Change profile stays unsupported.
```