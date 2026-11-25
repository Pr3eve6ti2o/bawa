// @vitest-environment jsdom
// Lane 3 (UX-major) — DIFFERENTIAL test (attest evidence E4): the new
// detectAddressFormat must agree with the pre-existing
// detectWatchOnlyChain (screens/import-wallet.tsx, Lane 5's file,
// in production since the watch-only work) on every format both
// cover. The legacy function is the independent oracle: it was
// written by another lane, in another session, and this test's
// expected values come from it at runtime, not from the new code.
//
// TWO documented divergences, asserted explicitly:
//   1. 0x + 64 hex: legacy says 'aptos' (an Aptos address shape);
//      the new detector says private-key. In a recipient field the
//      safe reading wins — it is warned about as a key, never sent.
//   2. bare base58 32–44 chars: legacy returns null (it has no
//      Solana pattern); the new detector says Solana. This is the
//      addition, not a disagreement.
import { describe, expect, it } from 'vitest';
import { detectAddressFormat } from './address-detection';
import { detectWatchOnlyChain } from '../screens/import-wallet';

const LEGACY_CASES: Array<[string, string]> = [
  ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'eth'],
  ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'btc'],
  ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'btc'],
  [`ltc1${'q'.repeat(38)}`, 'ltc'],
  [`L${'A'.repeat(33)}`, 'ltc'],
  [`D${'A'.repeat(33)}`, 'doge'],
  ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'trx'],
  [`UQ${'A'.repeat(46)}`, 'ton'],
  [`0:${'a'.repeat(64)}`, 'ton'],
  [`cosmos1${'a'.repeat(38)}`, 'cosmos'],
  [`osmo1${'a'.repeat(38)}`, 'osmosis'],
  [`inj1${'a'.repeat(38)}`, 'injective'],
  [`celestia1${'a'.repeat(38)}`, 'celestia'],
  [`dydx1${'a'.repeat(38)}`, 'dydx'],
  [`sei1${'a'.repeat(38)}`, 'seicosmos'],
  [`axelar1${'a'.repeat(38)}`, 'axelar'],
  [`noble1${'a'.repeat(38)}`, 'noble'],
  [`juno1${'a'.repeat(38)}`, 'juno'],
  [`r${'A'.repeat(28)}`, 'xrp'],
  [`f1${'a'.repeat(37)}`, 'filecoin'],
  [`ronin:${'a'.repeat(40)}`, 'ronin'],
  [`G${'A'.repeat(55)}`, 'stellar'],
  [`tz1${'A'.repeat(33)}`, 'tezos'],
  ['0.0.12345', 'hedera'],
  [`1${'A'.repeat(47)}`, 'polkadot'],
];

describe('differential: new detector vs legacy detectWatchOnlyChain', () => {
  it('agrees with the legacy detector on every shared format', () => {
    for (const [value, legacyChain] of LEGACY_CASES) {
      expect(detectWatchOnlyChain(value)).toBe(legacyChain);
      const found = detectAddressFormat(value);
      expect(found).not.toBeNull();
      if (found?.kind === 'evm') {
        // A bare 0x address has no single legacy chain; 'eth' is the
        // legacy representative for the 0x family.
        expect(legacyChain).toBe('eth');
      } else if (found?.kind === 'chain') {
        expect(found.chain).toBe(legacyChain);
      } else {
        throw new Error(`unexpected format for ${value}: ${found?.kind}`);
      }
    }
  });

  it('agrees on unknown shapes (both null)', () => {
    for (const value of ['hello world', '', '   ', '0x1234']) {
      expect(detectWatchOnlyChain(value)).toBeNull();
      expect(detectAddressFormat(value)).toBeNull();
    }
  });

  it('documents the 0x+64hex divergence: legacy aptos, new private-key warning', () => {
    const key = `0x${'11'.repeat(32)}`;
    expect(detectWatchOnlyChain(key)).toBe('aptos');
    expect(detectAddressFormat(key)).toEqual({
      kind: 'secret',
      secret: 'private-key',
    });
  });

  it('documents the Solana addition: legacy null, new Solana', () => {
    const sol = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    expect(detectWatchOnlyChain(sol)).toBeNull();
    expect(detectAddressFormat(sol)).toEqual({
      kind: 'chain',
      chain: 'sol',
      label: 'Solana',
    });
  });
});
