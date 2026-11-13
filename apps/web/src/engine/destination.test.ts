import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  isSameDestination,
  selectMainnetParams,
  validateDestination,
  MAINNET_PARAMS,
} from './destination';
import * as destinationModule from './destination';
import type { DestinationChain } from '@bawa/contracts';

// Independent test-side helpers (node:crypto only, never the module
// under test): Base58Check encode/decode and CRC16-XMODEM.
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(input: string): Buffer {
  let value = 0n;
  for (const character of input) {
    value = value * 58n + BigInt(BASE58_ALPHABET.indexOf(character));
  }
  const reversed: number[] = [];
  while (value > 0n) {
    reversed.push(Number(value % 256n));
    value /= 256n;
  }
  let leadingZeroes = 0;
  while (input.charAt(leadingZeroes) === '1') leadingZeroes++;
  const out = Buffer.alloc(leadingZeroes + reversed.length);
  for (let i = 0; i < reversed.length; i++) {
    out[leadingZeroes + i] = reversed[reversed.length - 1 - i]!;
  }
  return out;
}

function base58Encode(bytes: Buffer): string {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let out = '';
  while (value > 0n) {
    out = BASE58_ALPHABET[Number(value % 58n)]! + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out;
}

function doubleSha256Checksum(payload: Buffer): Buffer {
  const once = createHash('sha256').update(payload).digest();
  return createHash('sha256').update(once).digest().subarray(0, 4);
}

// Re-version a Base58Check address payload (testnet variants).
function reversioned(address: string, version: number): string {
  const decoded = base58Decode(address);
  const payload = Buffer.concat([
    Buffer.from([version]),
    decoded.subarray(1, 21),
  ]);
  return base58Encode(
    Buffer.concat([payload, doubleSha256Checksum(payload)]),
  );
}

function crc16Xmodem(data: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function tonFromBase64Url(address: string): Buffer {
  return Buffer.from(
    address.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
}

function tonToBase64Url(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// The bounceable fixture re-encoded with the testnet-only flag (0x91)
// and a recomputed CRC: must be rejected as wrong-network.
function tonTestnetVariant(address: string): string {
  const bytes = tonFromBase64Url(address);
  bytes[0] = 0x91;
  const crc = crc16Xmodem(bytes.subarray(0, 34));
  bytes[34] = (crc >> 8) & 0xff;
  bytes[35] = crc & 0xff;
  return tonToBase64Url(bytes);
}

function tonRawForm(address: string): string {
  const bytes = tonFromBase64Url(address);
  return `0:${bytes.subarray(2, 34).toString('hex')}`;
}

// Independent test-side Bech32m encoder (BIP-350): encodes a witness
// program so the module's Bech32m verification is checked against an
// independently built string, not a recalled vector.
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GENERATORS = [
  0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
];

function testPolymod(values: readonly number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if (((top >> i) & 1) !== 0) {
        checksum ^= BECH32_GENERATORS[i]!;
      }
    }
  }
  return checksum;
}

function testHrpExpand(hrp: string): number[] {
  const expanded: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    expanded.push(hrp.charCodeAt(i) >> 5);
  }
  expanded.push(0);
  for (let i = 0; i < hrp.length; i++) {
    expanded.push(hrp.charCodeAt(i) & 31);
  }
  return expanded;
}

function bech32mEncode(
  hrp: string,
  version: number,
  programHex: string,
): string {
  const program = Buffer.from(programHex, 'hex');
  const data: number[] = [version];
  let accumulator = 0;
  let bits = 0;
  for (const byte of program) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      data.push((accumulator >> bits) & 31);
    }
  }
  if (bits > 0) data.push((accumulator << (5 - bits)) & 31);
  const polymod =
    testPolymod([...testHrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^
    0x2bc830a3;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return (
    hrp +
    '1' +
    [...data, ...checksum].map((value) => BECH32_CHARSET[value]!).join('')
  );
}

async function expectValid(
  chain: DestinationChain,
  address: string,
  addressType: string,
  checksum: 'verified' | 'absent' | 'not-applicable',
): Promise<void> {
  const result = await validateDestination(chain, address);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected valid: ${address}`);
  expect(result.chain).toBe(chain);
  expect(result.addressType).toBe(addressType);
  expect(result.checksum).toBe(checksum);
}

async function expectInvalid(
  chain: DestinationChain,
  address: string,
  reason:
    | 'empty'
    | 'invalid-format'
    | 'invalid-length'
    | 'invalid-character'
    | 'invalid-checksum'
    | 'wrong-network'
    | 'unsupported-version',
): Promise<void> {
  const result = await validateDestination(chain, address);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error(`expected invalid: ${address}`);
  expect(result.chain).toBe(chain);
  expect(result.reason).toBe(reason);
}

describe('validateDestination: BTC', () => {
  it('accepts P2PKH, P2SH, P2WPKH, P2WSH and P2TR mainnet addresses', async () => {
    await expectValid('btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'p2pkh', 'verified');
    await expectValid('btc', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'p2sh', 'verified');
    await expectValid('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'p2wpkh', 'verified');
    await expectValid('btc', 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', 'p2wsh', 'verified');
    await expectValid('btc', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', 'p2wpkh', 'verified');
    // P2TR address built by the test-side Bech32m encoder from a
    // 32-byte program (the x-coordinate of the secp256k1 generator
    // point, the BIP-173 example key): the module must verify Bech32m,
    // not a recalled vector. (The BIP-173 v1 example program is 40
    // bytes, not a valid Taproot program, so it is not used here.)
    const p2tr = bech32mEncode(
      'bc',
      1,
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    );
    await expectValid('btc', p2tr, 'p2tr', 'verified');
  });

  it('accepts the repo derivation fixtures', async () => {
    await expectValid('btc', 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd', 'p2wpkh', 'verified');
    await expectValid('btc', 'bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za', 'p2wpkh', 'verified');
  });

  it('rejects testnet addresses as wrong-network', async () => {
    await expectInvalid('btc', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'wrong-network');
    await expectInvalid('btc', reversioned('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 0x6f), 'wrong-network');
    await expectInvalid('btc', reversioned('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 0xc4), 'wrong-network');
  });

  it('rejects bad checksums, bad HRPs and mixed case', async () => {
    await expectInvalid('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5', 'invalid-checksum');
    await expectInvalid('btc', 'tc1qw508d6qejxtdg4y5r3zarvary0c5xw7kg3g4ty', 'invalid-format');
    await expectInvalid('btc', 'bc1Qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'invalid-character');
    // BIP-173-era witness-v1 address: it verifies under the superseded
    // Bech32 checksum (polymod 0x1, checked first-hand), but BIP-350
    // requires Bech32m for v1+, so it is rejected.
    await expectInvalid('btc', 'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7k7grplx', 'invalid-checksum');
  });

  it('rejects empty input', async () => {
    await expectInvalid('btc', '', 'empty');
    await expectInvalid('btc', '   ', 'empty');
  });
});

describe('validateDestination: ETH', () => {
  it('accepts EIP-55 checksummed addresses', async () => {
    await expectValid('eth', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'eoa', 'verified');
    await expectValid('eth', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359', 'eoa', 'verified');
    await expectValid('eth', '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB', 'eoa', 'verified');
    await expectValid('eth', '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb', 'eoa', 'verified');
    await expectValid('eth', '0x52908400098527886E0F7030069857D2E4169EE7', 'eoa', 'verified');
    await expectValid('eth', '0x8617E340B3D01FA5F11F306F4090FD50E238070D', 'eoa', 'verified');
    // EIP-55 "All Lower" test cases: their checksummed form IS
    // all-lowercase, so they verify.
    await expectValid('eth', '0xde709f2102306220921060314715629080e2fb77', 'eoa', 'verified');
    await expectValid('eth', '0x27b1fdb04752bbc536007a920d24acb045561c26', 'eoa', 'verified');
  });

  it('accepts uniform-case addresses with no checksum as absent', async () => {
    // Lowercase / uppercase of a mixed-case checksummed address: the
    // case pattern does not match EIP-55, so no checksum is present —
    // but the address itself is valid.
    await expectValid('eth', '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', 'eoa', 'absent');
    await expectValid('eth', '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED', 'eoa', 'absent');
  });

  it('accepts the repo derivation fixture', async () => {
    await expectValid('eth', '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7', 'eoa', 'verified');
  });

  it('rejects bad checksums, bad characters, bad lengths and missing 0x', async () => {
    await expectInvalid('eth', '0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'invalid-checksum');
    await expectInvalid('eth', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAez', 'invalid-character');
    await expectInvalid('eth', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeA', 'invalid-length');
    await expectInvalid('eth', '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'invalid-format');
    await expectInvalid('eth', '', 'empty');
  });
});

describe('validateDestination: TRX', () => {
  it('accepts base58check T addresses', async () => {
    await expectValid('trx', 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c', 'base58check', 'verified');
    await expectValid('trx', 'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B', 'base58check', 'verified');
    await expectValid('trx', 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8', 'base58check', 'verified');
    await expectValid('trx', 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL', 'base58check', 'verified');
  });

  it('rejects a one-character mutation, the hex form, foreign versions and legacy testnet', async () => {
    await expectInvalid('trx', 'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9d', 'invalid-checksum');
    await expectInvalid('trx', '415CBDD86A2FA8DC4BDDD8A8F69DBA48572EEC07FB', 'invalid-format');
    await expectInvalid('trx', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'unsupported-version');
    await expectInvalid('trx', reversioned('TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c', 0xa0), 'wrong-network');
    await expectInvalid('trx', '', 'empty');
  });
});

describe('validateDestination: TON', () => {
  it('accepts bounceable and non-bounceable friendly addresses', async () => {
    await expectValid('ton', 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn', 'non-bounceable', 'verified');
    await expectValid('ton', 'EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi', 'bounceable', 'verified');
    await expectValid('ton', 'EQDKbjIcfM6ezt8KjKJJLshZJJSqX7XOA4ff-W72r5gqPrHF', 'bounceable', 'verified');
    await expectValid('ton', 'UQDKbjIcfM6ezt8KjKJJLshZJJSqX7XOA4ff-W72r5gqPuwA', 'non-bounceable', 'verified');
  });

  it('accepts the raw form without a checksum', async () => {
    const raw = tonRawForm('UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn');
    expect(raw.startsWith('0:')).toBe(true);
    await expectValid('ton', raw, 'raw', 'not-applicable');
  });

  it('rejects the testnet flag, a one-character mutation and truncation', async () => {
    await expectInvalid('ton', tonTestnetVariant('EQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wDyEi'), 'wrong-network');
    await expectInvalid('ton', 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zm', 'invalid-checksum');
    await expectInvalid('ton', 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3z', 'invalid-length');
    await expectInvalid('ton', '', 'empty');
  });
});

describe('selectMainnetParams', () => {
  it('returns mainnet parameters per chain', () => {
    const expectations: Record<
      DestinationChain,
      { chainId: number | null; slip44: number; confirmations: number; unit: string }
    > = {
      btc: { chainId: null, slip44: 0, confirmations: 6, unit: 'blocks' },
      eth: { chainId: 1, slip44: 60, confirmations: 12, unit: 'blocks' },
      trx: { chainId: null, slip44: 195, confirmations: 19, unit: 'blocks' },
      ton: { chainId: null, slip44: 607, confirmations: 1, unit: 'masterchain seqno' },
    };
    for (const chain of Object.keys(expectations) as DestinationChain[]) {
      const params = selectMainnetParams(chain);
      expect(params.network).toBe('mainnet');
      expect(params.chainId).toBe(expectations[chain]!.chainId);
      expect(params.slip44CoinType).toBe(expectations[chain]!.slip44);
      expect(params.confirmations).toBe(expectations[chain]!.confirmations);
      expect(params.confirmationsUnit).toBe(expectations[chain]!.unit);
      expect(params.sources.length).toBeGreaterThan(0);
      for (const source of params.sources) {
        expect(source.startsWith('https://')).toBe(true);
      }
      expect(params.limitations.length).toBeGreaterThan(0);
      expect(params.limitations.every((entry) => entry.length > 0)).toBe(true);
      expect(Object.isFrozen(params)).toBe(true);
    }
    expect(Object.keys(MAINNET_PARAMS).sort()).toEqual([
      'btc',
      'eth',
      'ton',
      'trx',
    ]);
  });

  it('throws for an unknown chain', () => {
    expect(() =>
      selectMainnetParams('doge' as unknown as DestinationChain),
    ).toThrow('unknown chain');
  });
});

describe('module guards', () => {
  it('exports only validation and parameter selection — no send, sign or broadcast', () => {
    expect(Object.keys(destinationModule).sort()).toEqual([
      'MAINNET_PARAMS',
      'isSameDestination',
      'selectMainnetParams',
      'validateDestination',
    ]);
  });
});

describe('isSameDestination', () => {
  it('compares the whole address exactly', () => {
    const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    expect(isSameDestination(address, address)).toBe(true);
    expect(isSameDestination(`  ${address}  `, address)).toBe(true);
    expect(
      isSameDestination(
        address,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
      ),
    ).toBe(false);
    expect(
      isSameDestination(
        address,
        'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',
      ),
    ).toBe(false);
  });
});
