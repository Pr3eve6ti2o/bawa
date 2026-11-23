
// Watch-only plain-address import (Finish the Product, Lane B, 2026-11-23).
// Owner order: an EVM/SOL/TRX/BTC address added watch-only must detect
// balances on ALL chains that address belongs to. So validateWatchOnlyImport
// accepts a plain address as well as an extended key, reports which kind
// it is, and deriveAddress returns that address at index 0 (index 0 only).
// Fixtures are the repo's own BIP-39 test-vector addresses
// (wallet/core.test.ts) plus the public Vitalik address (read-only).
import { describe, expect, it } from 'vitest';
import {
  deriveAddress,
  deriveAddresses,
  validateWatchOnlyImport,
} from './boundary';

const EVM_VECTOR_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const BTC_VECTOR_ADDRESS = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const TRX_VECTOR_ADDRESS = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const LTC_VECTOR_ADDRESS = 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh';
const DOGE_VECTOR_ADDRESS = 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC';
const VITALIK_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('watch-only plain-address import (Lane B)', () => {
  it('accepts a 0x address on any EVM chain and reports kind address', async () => {
    for (const chain of ['eth', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom'] as const) {
      await expect(
        validateWatchOnlyImport(chain, EVM_VECTOR_ADDRESS),
      ).resolves.toEqual({ ok: true, kind: 'address' });
    }
  });

  it('accepts the public Vitalik address as an EVM watch address', async () => {
    await expect(
      validateWatchOnlyImport('eth', VITALIK_ADDRESS),
    ).resolves.toEqual({ ok: true, kind: 'address' });
  });

  it('still accepts an extended key and reports kind xpub', async () => {
    await expect(
      validateWatchOnlyImport(
        'eth',
        'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
      ),
    ).resolves.toEqual({ ok: true, kind: 'xpub' });
  });

  it('accepts test-vector addresses on btc, trx, ltc and doge', async () => {
    await expect(
      validateWatchOnlyImport('btc', BTC_VECTOR_ADDRESS),
    ).resolves.toEqual({ ok: true, kind: 'address' });
    await expect(
      validateWatchOnlyImport('trx', TRX_VECTOR_ADDRESS),
    ).resolves.toEqual({ ok: true, kind: 'address' });
    await expect(
      validateWatchOnlyImport('ltc', LTC_VECTOR_ADDRESS),
    ).resolves.toEqual({ ok: true, kind: 'address' });
    await expect(
      validateWatchOnlyImport('doge', DOGE_VECTOR_ADDRESS),
    ).resolves.toEqual({ ok: true, kind: 'address' });
  });

  it('rejects an EVM address with a broken EIP-55 checksum', async () => {
    await expect(
      validateWatchOnlyImport(
        'eth',
        '0x9858EfFD232B4033E47d90003D41EC34EcaEda95',
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it('rejects a BTC address with a broken checksum', async () => {
    await expect(
      validateWatchOnlyImport(
        'btc',
        'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyv',
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it('rejects a TRX address with a broken checksum', async () => {
    await expect(
      validateWatchOnlyImport('trx', 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdI'),
    ).resolves.toMatchObject({ ok: false });
  });

  it('derives the plain address itself at index 0, on every family', async () => {
    expect(await deriveAddress('eth', EVM_VECTOR_ADDRESS, 0)).toBe(
      EVM_VECTOR_ADDRESS,
    );
    expect(await deriveAddress('bsc', EVM_VECTOR_ADDRESS, 0)).toBe(
      EVM_VECTOR_ADDRESS,
    );
    expect(await deriveAddress('btc', BTC_VECTOR_ADDRESS, 0)).toBe(
      BTC_VECTOR_ADDRESS,
    );
    expect(await deriveAddress('trx', TRX_VECTOR_ADDRESS, 0)).toBe(
      TRX_VECTOR_ADDRESS,
    );
    expect(await deriveAddress('ltc', LTC_VECTOR_ADDRESS, 0)).toBe(
      LTC_VECTOR_ADDRESS,
    );
    expect(await deriveAddress('doge', DOGE_VECTOR_ADDRESS, 0)).toBe(
      DOGE_VECTOR_ADDRESS,
    );
  });

  it('derives exactly one address for an address entry, whatever the count', async () => {
    expect(await deriveAddresses('eth', EVM_VECTOR_ADDRESS, 5)).toEqual([
      EVM_VECTOR_ADDRESS,
    ]);
    expect(await deriveAddresses('btc', BTC_VECTOR_ADDRESS, 1)).toEqual([
      BTC_VECTOR_ADDRESS,
    ]);
  });

  it('refuses index 1 for an address entry, like SOL and TON', async () => {
    await expect(deriveAddress('eth', EVM_VECTOR_ADDRESS, 1)).rejects.toThrow(
      'index out of range',
    );
  });
});
