// Watch-only address families (Finish the Product, Lane B, 2026-11-23).
// Shape routing only — no checksum validation here; that lives in
// engine/boundary.ts. Fixtures are the repo's own test-vector addresses
// (BIP-39 "abandon ... about") plus the xpub fixtures from
// engine/boundary.test.ts, so no real wallet is involved.
import { describe, expect, it } from 'vitest';
import {
  EVM_WATCH_CHAINS,
  isEvmChain,
  watchOnlyFamilyChains,
  watchOnlyValueKind,
} from './watch-only-families';

// BIP-39 test-vector mnemonic addresses (apps/web/src/wallet/core.test.ts).
const EVM_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const BTC_ADDRESS = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const TRX_ADDRESS = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const LTC_ADDRESS = 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh';
const DOGE_ADDRESS = 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC';
// The same fixtures boundary.test.ts uses for extended keys.
const ETH_XPUB =
  'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz';
const BTC_ZPUB =
  'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9';
const LTC_LTUB =
  'Ltub2ZANw57Fi4JfMGenngwfZMqDrsccTf2m3qEjvLuk8faGXB973sSqGttAdKBvGSCLG9DXh2yxaUB9qpwQUe2zCCtrZPhjxGuMAWqL6F7Xrpd';
const DOGE_DPUB =
  'dpubZG2yVAE9cxzbb951cYM2av1gxG46wXAdAKDDJEcTLC7cSFUvHbVo8mMYqZDAe2dPyigxSve76Kvi537CVzxjyhZnNPCRBCm6HJKTqYSjKSn';

describe('watch-only address families', () => {
  it('lists fifty-nine EVM chains', () => {
    expect(EVM_WATCH_CHAINS).toHaveLength(59);
    expect(EVM_WATCH_CHAINS).toContain('eth');
    expect(EVM_WATCH_CHAINS).toContain('fantom');
    expect(EVM_WATCH_CHAINS).not.toContain('btc');
    expect(EVM_WATCH_CHAINS).not.toContain('sol');
  });

  it('fans an EVM chain out to all fifty-nine EVM chains', () => {
    for (const chain of EVM_WATCH_CHAINS) {
      expect(watchOnlyFamilyChains(chain)).toEqual(EVM_WATCH_CHAINS);
    }
    expect(isEvmChain('eth')).toBe(true);
    expect(isEvmChain('fantom')).toBe(true);
  });

  it('keeps every non-EVM chain in a family of one', () => {
    for (const chain of ['btc', 'trx', 'ton', 'sol', 'ltc', 'doge'] as const) {
      expect(watchOnlyFamilyChains(chain)).toEqual([chain]);
      expect(isEvmChain(chain)).toBe(false);
    }
  });

  it('recognises a 0x address as an address on every EVM chain', () => {
    for (const chain of EVM_WATCH_CHAINS) {
      expect(watchOnlyValueKind(chain, EVM_ADDRESS)).toBe('address');
      expect(watchOnlyValueKind(chain, EVM_ADDRESS.toLowerCase())).toBe(
        'address',
      );
    }
  });

  it('recognises test-vector addresses on their own chains', () => {
    expect(watchOnlyValueKind('btc', BTC_ADDRESS)).toBe('address');
    expect(watchOnlyValueKind('trx', TRX_ADDRESS)).toBe('address');
    expect(watchOnlyValueKind('ltc', LTC_ADDRESS)).toBe('address');
    expect(watchOnlyValueKind('doge', DOGE_ADDRESS)).toBe('address');
    // Legacy BTC forms are addresses too (genesis address, unfunded test
    // vector shape only — used here for format, never as a wallet).
    expect(
      watchOnlyValueKind('btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
    ).toBe('address');
    expect(watchOnlyValueKind('btc', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(
      'address',
    );
  });

  it('treats TON and SOL values as addresses (neither has an xpub)', () => {
    expect(
      watchOnlyValueKind('sol', 'GjJyeC1r2RgkuoCWMyPYkCWSGSGLcz266EaAkLA27AhL'),
    ).toBe('address');
    expect(
      watchOnlyValueKind('ton', 'UQAzWZa6nM5mJev91wGc7VCSfBoIsYRqKJpV78N8Add9-RKY'),
    ).toBe('address');
  });

  it('never mistakes an extended key for an address', () => {
    expect(watchOnlyValueKind('eth', ETH_XPUB)).toBe('xpub');
    expect(watchOnlyValueKind('bsc', ETH_XPUB)).toBe('xpub');
    expect(watchOnlyValueKind('btc', BTC_ZPUB)).toBe('xpub');
    // Ltub starts with L like a legacy LTC address, but its 111-char
    // length keeps it an xpub.
    expect(watchOnlyValueKind('ltc', LTC_LTUB)).toBe('xpub');
    expect(watchOnlyValueKind('doge', DOGE_DPUB)).toBe('xpub');
  });

  it('treats a malformed address-shaped value as an xpub (validation rejects it later)', () => {
    // Too short to be an address: the kind router must not claim it.
    expect(watchOnlyValueKind('eth', '0x1234')).toBe('xpub');
    expect(watchOnlyValueKind('btc', 'bc1q')).toBe('xpub');
    expect(watchOnlyValueKind('trx', 'T123')).toBe('xpub');
  });
});
