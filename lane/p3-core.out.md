```typescript
// apps/web/src/wallet/core.ts: add after ton in DEFAULT_PATHS.
  sol: "m/44'/501'/0'",
  bsc: "m/44'/60'/0'/0/0",
  matic: "m/44'/60'/0'/0/0",
  arb: "m/44'/60'/0'/0/0",
  op: "m/44'/60'/0'/0/0",
  base: "m/44'/60'/0'/0/0",
  avax: "m/44'/60'/0'/0/0",
  ltc: "m/84'/2'/0'/0/0",
  doge: "m/44'/3'/0'/0/0",
```

```typescript
// apps/web/src/wallet/core.ts: insert in coinForChain after the ton case, before default.
    case 'sol':
      return core.CoinType.solana;
    case 'bsc':
      return core.CoinType.smartChain;
    case 'matic':
      return core.CoinType.polygon;
    case 'arb':
      return core.CoinType.arbitrum;
    case 'op':
      return core.CoinType.optimism;
    case 'base':
      return core.CoinType.base;
    case 'avax':
      return core.CoinType.avalancheCChain;
    case 'ltc':
      return core.CoinType.litecoin;
    case 'doge':
      return core.CoinType.dogecoin;
```

```typescript
// apps/web/src/wallet/core.ts: replace the return object in deriveAddresses.
  return {
    btc: addressFor('btc'),
    eth: addressFor('eth'),
    trx: addressFor('trx'),
    ton: addressFor('ton'),
    sol: addressFor('sol'),
    bsc: addressFor('bsc'),
    matic: addressFor('matic'),
    arb: addressFor('arb'),
    op: addressFor('op'),
    base: addressFor('base'),
    avax: addressFor('avax'),
    ltc: addressFor('ltc'),
    doge: addressFor('doge'),
  };
```

```typescript
// apps/web/src/wallet/core.ts: replace only the pubkey-form sentence inside deriveAddressesAt's doc comment.
 * Per-chain pubkey form: BTC compressed, ETH/TRX uncompressed, TON Ed25519;
 * SOL Ed25519 like TON; LTC/DOGE compressed like BTC;
 * BSC/MATIC/ARB/OP/BASE/AVAX uncompressed like ETH.
```

```typescript
// apps/web/src/wallet/core.ts: replace the pubkey declaration in deriveAddressesAt; leave the path line unchanged.
    const pubkey =
      chain === 'ton' || chain === 'sol'
        ? key.getPublicKeyEd25519()
        : key.getPublicKeySecp256k1(chain === 'btc' || chain === 'ltc' || chain === 'doge');
```

```typescript
// apps/web/src/wallet/core.ts: replace the return object in deriveAddressesAt.
  return {
    btc: addressFor('btc'),
    eth: addressFor('eth'),
    trx: addressFor('trx'),
    ton: addressFor('ton'),
    sol: addressFor('sol'),
    bsc: addressFor('bsc'),
    matic: addressFor('matic'),
    arb: addressFor('arb'),
    op: addressFor('op'),
    base: addressFor('base'),
    avax: addressFor('avax'),
    ltc: addressFor('ltc'),
    doge: addressFor('doge'),
  };
```

```typescript
// apps/web/src/wallet/core.ts: insert immediately after the TON rejection in deriveFromXpub, before index validation.
  if (chain === 'sol') {
    throw new Error('SOL uses fully hardened Ed25519 derivation and cannot derive children from an xpub.');
  }
```