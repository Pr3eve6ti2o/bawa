// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEVNET_ENABLED_KEY,
  decodeBase58Check,
  decodeBtcBech32,
  encodeBtcBech32,
  isValidTestnetBtcAddress,
  isValidTestnetTonAddress,
  readDevnetEnabled,
  reencodeBtcAddressToMainnet,
  reencodeBtcAddressToTestnet,
  toTonTestnetUqAddress,
  writeDevnetEnabled,
} from './devnet';

beforeEach(() => {
  localStorage.clear();
});

describe('devnet mode flag', () => {
  it('defaults to off when storage is empty', () => {
    expect(readDevnetEnabled()).toBe(false);
  });

  it('round-trips the enabled setting', () => {
    writeDevnetEnabled(true);
    expect(readDevnetEnabled()).toBe(true);
    expect(localStorage.getItem(DEVNET_ENABLED_KEY)).toBe('1');
  });

  it('round-trips the disabled setting after enabling', () => {
    writeDevnetEnabled(true);
    writeDevnetEnabled(false);
    expect(readDevnetEnabled()).toBe(false);
    expect(localStorage.getItem(DEVNET_ENABLED_KEY)).toBe('0');
  });
});

describe('bech32 (BIP-173 / BIP-350)', () => {
  // BIP-173 test vector program: 751e76e8199196d454941c45d1b3a323f1433bd6.
  const PROGRAM = [
    0x75, 0x1e, 0x76, 0xe8, 0x19, 0x91, 0x96, 0xd4, 0x54, 0x94, 0x1c, 0x45,
    0xd1, 0xb3, 0xa3, 0x23, 0xf1, 0x43, 0x3b, 0xd6,
  ];

  it('encodes the BIP-173 test vector with the tb HRP', () => {
    expect(encodeBtcBech32('tb', 0, PROGRAM)).toBe(
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    );
  });

  it('encodes the BIP-173 test vector with the bc HRP', () => {
    expect(encodeBtcBech32('bc', 0, PROGRAM)).toBe(
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    );
  });

  it('decodes a tb1q address to its witness version and program', () => {
    const decoded = decodeBtcBech32(
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    );
    expect(decoded).toEqual({
      hrp: 'tb',
      witnessVersion: 0,
      program: PROGRAM,
    });
  });

  it('rejects a tb1q address with a broken checksum', () => {
    expect(
      decodeBtcBech32('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsy'),
    ).toBeNull();
  });

  it('round-trips a taproot program through bech32m', () => {
    const taprootProgram = Array.from({ length: 32 }, (_, i) => i);
    const encoded = encodeBtcBech32('tb', 1, taprootProgram);
    expect(encoded.startsWith('tb1p')).toBe(true);
    expect(decodeBtcBech32(encoded)).toEqual({
      hrp: 'tb',
      witnessVersion: 1,
      program: taprootProgram,
    });
  });
});

describe('BTC testnet re-encode', () => {
  it('re-encodes a bc1q address as tb1q with the same witness program', () => {
    expect(
      reencodeBtcAddressToTestnet(
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      ),
    ).toBe('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
  });

  it('re-encodes a tb1q address back as bc1q with the same witness program', () => {
    expect(
      reencodeBtcAddressToMainnet(
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      ),
    ).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
  });

  it('returns null when the input is not a bech32 address', () => {
    expect(reencodeBtcAddressToTestnet('not-an-address')).toBeNull();
    expect(reencodeBtcAddressToMainnet('not-an-address')).toBeNull();
  });

  it('re-encodes a testnet base58 P2PKH address to mainnet form', () => {
    // BIP-32 test vector 1 testnet address (version 0x6f).
    expect(
      reencodeBtcAddressToMainnet('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'),
    ).toBe('14JetYAhLevTRaePcAAX1vRMwaJt2QGRzp');
  });
});

describe('BTC testnet address validation', () => {
  it('accepts tb1q and tb1p addresses', () => {
    expect(
      isValidTestnetBtcAddress(
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      ),
    ).toBe(true);
    const taprootProgram = Array.from({ length: 32 }, (_, i) => i);
    expect(
      isValidTestnetBtcAddress(encodeBtcBech32('tb', 1, taprootProgram)),
    ).toBe(true);
  });

  it('accepts testnet base58 P2PKH (0x6f) and P2SH (0xc4) addresses', () => {
    expect(
      isValidTestnetBtcAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'),
    ).toBe(true);
    const decoded = decodeBase58Check('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn');
    expect(decoded?.version).toBe(0x6f);
  });

  it('rejects mainnet bc1q, bc1p, 1... and 3... addresses', () => {
    expect(
      isValidTestnetBtcAddress(
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      ),
    ).toBe(false);
    expect(
      isValidTestnetBtcAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
    ).toBe(false);
    expect(
      isValidTestnetBtcAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'),
    ).toBe(false);
  });

  it('rejects regtest (bcrt) and broken-checksum addresses', () => {
    expect(
      isValidTestnetBtcAddress(
        'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      ),
    ).toBe(false);
    expect(
      isValidTestnetBtcAddress(
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsy',
      ),
    ).toBe(false);
  });
});

describe('TON testnet address re-encode', () => {
  it('re-encodes a mainnet UQ address as a testnet UQ (0Q) address', () => {
    expect(
      toTonTestnetUqAddress(
        'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ',
      ),
    ).toBe('0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkT');
    expect(
      toTonTestnetUqAddress(
        'UQABI0VniavN7_7cuph2VDIQABEiM0RVZneImaq7zN3u_8gb',
      ),
    ).toBe('0QABI0VniavN7_7cuph2VDIQABEiM0RVZneImaq7zN3u_3OR');
  });

  it('throws for a testnet address or a malformed address', () => {
    expect(() =>
      toTonTestnetUqAddress(
        '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkT',
      ),
    ).toThrow();
    expect(() => toTonTestnetUqAddress('not-a-ton-address')).toThrow();
  });
});

describe('TON testnet address validation', () => {
  it('accepts testnet UQ (0Q) and EQ (kQ) addresses', () => {
    expect(
      isValidTestnetTonAddress(
        '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkT',
      ),
    ).toBe(true);
    expect(
      isValidTestnetTonAddress(
        'kQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHTW',
      ),
    ).toBe(true);
  });

  it('rejects mainnet UQ/EQ addresses', () => {
    expect(
      isValidTestnetTonAddress(
        'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ',
      ),
    ).toBe(false);
    expect(
      isValidTestnetTonAddress(
        'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
      ),
    ).toBe(false);
  });

  it('rejects a testnet address with a broken checksum', () => {
    expect(
      isValidTestnetTonAddress(
        '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkU',
      ),
    ).toBe(false);
  });
});
