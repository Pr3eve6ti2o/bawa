```typescript
// apps/web/src/engine/boundary.ts: replace ChainId.
export type ChainId = 'btc' | 'eth' | 'trx' | 'ton' | 'sol' | 'bsc' | 'matic' | 'arb' | 'op' | 'base' | 'avax' | 'ltc' | 'doge';
```

```typescript
// apps/web/src/engine/boundary.ts: insert before btc in ALLOWED_VERSIONS; leave all existing entries and comments untouched.
  sol: [], // Like TON, no xpub.
  bsc: ['0488b21e'],
  matic: ['0488b21e'],
  arb: ['0488b21e'],
  op: ['0488b21e'],
  base: ['0488b21e'],
  avax: ['0488b21e'],
  ltc: ['019da462'],
  doge: ['02facafd'],
```

```typescript
// apps/web/src/engine/boundary.ts: replace only the DERIVATION_PREFIXES type annotation.
Readonly<Record<Exclude<ChainId, 'ton' | 'sol'>, string>>
```

```typescript
// apps/web/src/engine/boundary.ts: insert before btc in DERIVATION_PREFIXES; leave all existing entries untouched.
  ltc: 'm/84\'/2\'/0\'/0',
  doge: 'm/44\'/3\'/0\'/0',
  bsc: 'm/44\'/60\'/0\'/0',
  matic: 'm/44\'/60\'/0\'/0',
  arb: 'm/44\'/60\'/0\'/0',
  op: 'm/44\'/60\'/0\'/0',
  base: 'm/44\'/60\'/0\'/0',
  avax: 'm/44\'/60\'/0\'/0',
```

```typescript
// apps/web/src/engine/boundary.ts: insert immediately after validateTonAddress.
export function validateSolanaAddress(
  address: string
): { ok: true } | { ok: false; reason: string; message: string } {
  const value = address.trim();

  if (value.length === 0) {
    return {
      ok: false,
      reason: 'empty',
      message: 'Solana address is required.',
    };
  }

  const words = value.split(/ +/);
  const isMnemonic =
    /^[a-z ]+$/i.test(value) && (words.length === 12 || words.length === 24);

  if (/\s/.test(value) || /^(?:xprv|zprv|tprv|yprv)/i.test(value) || isMnemonic) {
    return {
      ok: false,
      reason: 'secret-like',
      message: 'Use a public Solana address only.',
    };
  }

  function decodeBase58(input: string): Uint8Array | null {
    const bytes: number[] = [];

    for (const character of input) {
      const digit = BASE58_ALPHABET.indexOf(character);
      if (digit < 0) return null;

      let carry = digit;

      for (let i = 0; i < bytes.length; i++) {
        carry += (bytes[i] ?? 0) * 58;
        bytes[i] = carry & 0xff;
        carry >>>= 8;
      }

      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>>= 8;
      }
    }

    for (const character of input) {
      if (character !== '1') break;
      bytes.push(0);
    }

    return Uint8Array.from(bytes.reverse());
  }

  const decoded = decodeBase58(value);

  if (decoded?.length === 64) {
    return {
      ok: false,
      reason: 'secret-like',
      message: 'Use a public Solana address only.',
    };
  }

  if (decoded === null || decoded.length !== 32) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'Invalid Solana address length.',
    };
  }

  return { ok: true };
}
```

```typescript
// apps/web/src/engine/boundary.ts: in validateWatchOnlyImport, replace the TON routing condition; retain its existing body and error mapping.
chain === 'sol' || chain === 'ton'
```

```typescript
// apps/web/src/engine/boundary.ts: in validateWatchOnlyImport's address branch, replace only the validateTonAddress callee, preserving its argument.
(chain === 'sol' ? validateSolanaAddress : validateTonAddress)
```

```typescript
// apps/web/src/engine/boundary.ts: in deriveAddress, replace the TON early-return condition; retain its index check, failure handling, and trimmed return.
chain === 'sol' || chain === 'ton'
```

```typescript
// apps/web/src/engine/boundary.ts: in deriveAddress's address early-return block, replace only the validateTonAddress callee, preserving its argument.
(chain === 'sol' ? validateSolanaAddress : validateTonAddress)
```

```typescript
// apps/web/src/engine/boundary.ts: insert before btc in deriveAddress's existing coin map; leave the existing entries and subsequent operations untouched.
    ltc: core.CoinType.litecoin,
    doge: core.CoinType.dogecoin,
    bsc: core.CoinType.smartChain,
    matic: core.CoinType.polygon,
    arb: core.CoinType.arbitrum,
    op: core.CoinType.optimism,
    base: core.CoinType.base,
    avax: core.CoinType.avalancheCChain,
```