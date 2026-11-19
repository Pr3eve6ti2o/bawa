```typescript
// apps/web/src/wallet/send.ts — CHAIN_NAMES
const CHAIN_NAMES: Record<ChainId, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  trx: 'TRON',
  ton: 'TON',
  sol: 'Solana',
  bsc: 'BNB Smart Chain',
  matic: 'Polygon',
  arb: 'Arbitrum One',
  op: 'OP Mainnet',
  base: 'Base',
  avax: 'Avalanche C-Chain',
  ltc: 'Litecoin',
  doge: 'Dogecoin',
};
```

```typescript
// apps/web/src/wallet/send.ts — validateRecipient: coinTypes
const coinTypes = {
  btc: core.CoinType.bitcoin,
  eth: core.CoinType.ethereum,
  trx: core.CoinType.tron,
  ton: core.CoinType.ton,
  ltc: core.CoinType.litecoin,
  doge: core.CoinType.dogecoin,
  bsc: core.CoinType.smartChain,
  matic: core.CoinType.polygon,
  arb: core.CoinType.arbitrum,
  op: core.CoinType.optimism,
  base: core.CoinType.base,
  avax: core.CoinType.avalancheCChain,
};
```

```typescript
// apps/web/src/wallet/format.ts — CHAIN_DECIMALS
const CHAIN_DECIMALS: Record<ChainId, number> = {
  btc: 8,
  eth: 18,
  trx: 6,
  ton: 9,
  sol: 9,
  bsc: 18,
  matic: 18,
  arb: 18,
  op: 18,
  base: 18,
  avax: 18,
  ltc: 8,
  doge: 8,
};
```

```typescript
// apps/web/src/state/wallet-context.tsx — perChain
const perChain = <T,>(make: () => T): PerChain<T> => ({
  btc: make(),
  eth: make(),
  trx: make(),
  ton: make(),
  sol: make(),
  bsc: make(),
  matic: make(),
  arb: make(),
  op: make(),
  base: make(),
  avax: make(),
  ltc: make(),
  doge: make(),
});
```

```typescript
// apps/web/src/state/wallet-context.tsx — refreshVaultAccounts: vaultAddresses
vaultAddresses: {
  btc: [derived.btc],
  eth: [derived.eth],
  trx: [derived.trx],
  ton: [derived.ton],
  sol: [derived.sol],
  bsc: [derived.bsc],
  matic: [derived.matic],
  arb: [derived.arb],
  op: [derived.op],
  base: [derived.base],
  avax: [derived.avax],
  ltc: [derived.ltc],
  doge: [derived.doge],
},
```

```typescript
// apps/web/src/screens/asset-rows.tsx — CHAIN_LOGOS / ChainLogo: please paste the current declarations and logo imports so I can preserve the existing img branch byte-for-byte, including its dimensions and adjacent chain name.
```

```typescript
// apps/web/src/screens/import-wallet.tsx — inputConfigByChain
const inputConfigByChain: Record<ChainId, ImportInputConfig> = {
  btc: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  eth: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  trx: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  ton: { label: 'TON public address', placeholder: 'UQ… or 0:…' },
  sol: { label: 'Solana public address', placeholder: 'GjJy…' },
  bsc: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  matic: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  arb: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  op: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  base: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  avax: { label: 'Account public key (xpub)', placeholder: 'xpub…' },
  ltc: { label: 'Account public key (Ltub)', placeholder: 'Ltub…' },
  doge: { label: 'Account public key (dgub)', placeholder: 'dgub…' },
};
```