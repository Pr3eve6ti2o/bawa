import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  deriveAddress,
  deriveAddresses,
  isEngineReady,
  validateExtendedKey,
} from './boundary';

const btcZpub =
  'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9';
// F-17: BIP-49 ypub, the BTC fixture zpub re-versioned to 049d7cb2. It is
// the same key, so the repo's bech32 derivation gives the same addresses;
// independently, bip-utils derives the BIP-49 P2SH address
// 34JdW53BKMNqjQXGU33G4N65VxbYdw6jFd at m/49'/0'/0'/0/0.
const btcYpub =
  'ypub6XYD5EHXRTjV5Ts4obsP9JGSgxcYzbxc1GcsWN73fjLXGXrpR3McpqJbko4xj3kFj41KRZpnymX4YbH6RTpUnKASUq94bKggxBAf5Wpvbv5';
const ethXpub =
  'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc';
const trxXpub =
  'xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF';

const fixtures = [
  {
    chain: 'btc',
    xpub: btcZpub,
    addresses: [
      'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
      'bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za',
    ],
  },
  {
    chain: 'eth',
    xpub: ethXpub,
    addresses: [
      '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
      '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    ],
  },
  {
    chain: 'trx',
    xpub: trxXpub,
    addresses: [
      'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
      'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B',
    ],
  },
] as const;

const addressCases = fixtures.flatMap(({ chain, xpub, addresses }) =>
  addresses.map((address, index) => ({ chain, xpub, index, address })),
);

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(input: string): Buffer {
  let value = 0n;

  for (const character of input) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) {
      throw new Error('Invalid base58 character');
    }
    value = value * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value % 256n));
    value /= 256n;
  }

  // Preserve the zero bytes represented by leading '1' characters.
  for (const character of input) {
    if (character !== '1') {
      break;
    }
    bytes.push(0);
  }

  return Buffer.from(bytes.reverse());
}

function encodeBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }

  let encoded = '';
  while (value > 0n) {
    encoded = BASE58_ALPHABET.charAt(Number(value % 58n)) + encoded;
    value /= 58n;
  }

  for (const byte of bytes) {
    if (byte !== 0) {
      break;
    }
    encoded = '1' + encoded;
  }

  return encoded;
}

function checksum(payload: Uint8Array): Buffer {
  const firstHash = createHash('sha256').update(payload).digest();
  return createHash('sha256').update(firstHash).digest().subarray(0, 4);
}

function mutatePayload(
  publicKey: string,
  mutate: (payload: Buffer) => void,
): string {
  const payload = decodeBase58(publicKey).subarray(0, -4);
  mutate(payload);
  return encodeBase58(Buffer.concat([payload, checksum(payload)]));
}

describe.sequential('watch-only engine boundary', () => {
  it('is uninitialised before any derivation', () => {
    expect(isEngineReady()).toBe(false);
  });

  it.each(fixtures)(
    'recognises the public $chain fixture on its own chain',
    async ({ chain, xpub }) => {
      await expect(validateExtendedKey(xpub, chain)).resolves.toMatchObject({
        ok: true,
      });
    },
  );

  it('rejects an extended key with a corrupted checksum', async () => {
    const replacement = ethXpub.endsWith('1') ? '2' : '1';
    const corrupted = ethXpub.slice(0, -1) + replacement;

    await expect(validateExtendedKey(corrupted, 'eth')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid-checksum',
    });
  });

  it('rejects a BTC version when validating for ETH', async () => {
    await expect(validateExtendedKey(btcZpub, 'eth')).resolves.toMatchObject({
      ok: false,
      reason: 'version-not-allowed',
    });
  });

  it('rejects a private-key marker constructed from a public fixture', async () => {
    const privateKeyVector = mutatePayload(ethXpub, (payload) => {
      payload[45] = 0x00;
    });

    await expect(
      validateExtendedKey(privateKeyVector, 'eth'),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'private-key',
    });
  });

  it('rejects an invalid compressed public point', async () => {
    const invalidPoint = mutatePayload(btcZpub, (payload) => {
      payload[45] = 0x02;
      payload.fill(0xff, 46, 78);
    });

    await expect(validateExtendedKey(invalidPoint, 'btc')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid-point',
    });
  });

  it('rejects a character outside the base58 alphabet', async () => {
    const invalidBase58 = ethXpub.slice(0, 10) + '0' + ethXpub.slice(10);

    await expect(
      validateExtendedKey(invalidBase58, 'eth'),
    ).resolves.toMatchObject({
      ok: false,
      reason: 'invalid-base58',
    });
  });

  it('rejects an extended key with an invalid decoded length', async () => {
    const truncated = ethXpub.slice(0, 50);

    await expect(validateExtendedKey(truncated, 'eth')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid-length',
    });
  });

  it('recognises the BIP-49 ypub for BTC (F-17)', async () => {
    await expect(validateExtendedKey(btcYpub, 'btc')).resolves.toMatchObject({
      ok: true,
    });
  });

  it('derives the ypub key to the verified BTC address at index 0 (F-17)', async () => {
    await expect(deriveAddress('btc', btcYpub, 0)).resolves.toBe(
      'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
    );
  });

  it.each(addressCases)(
    'derives the verified $chain address at index $index',
    async ({ chain, xpub, index, address }) => {
      await expect(deriveAddress(chain, xpub, index)).resolves.toBe(address);
    },
  );

  it('derives three BTC addresses in index order', async () => {
    const addresses = await deriveAddresses('btc', btcZpub, 3);

    expect(Array.isArray(addresses)).toBe(true);
    expect(addresses).toHaveLength(3);
    expect(addresses.slice(0, 2)).toEqual(fixtures[0].addresses);
    expect(addresses[2]).toMatch(/^bc1q/);
  });

  it.each([2147483648, -1, 1.5, NaN])(
    'rejects the invalid derivation index %s with an Error',
    async (index) => {
      await expect(
        deriveAddress('btc', btcZpub, index),
      ).rejects.toBeInstanceOf(Error);
    },
  );

  it('is initialised after a successful derivation', async () => {
    await deriveAddress('btc', btcZpub, 0);
    expect(isEngineReady()).toBe(true);
  });
});
