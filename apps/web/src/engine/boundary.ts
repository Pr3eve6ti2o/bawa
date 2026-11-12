import { initWasm } from '@trustwallet/wallet-core';

export type ChainId = 'btc' | 'eth' | 'trx';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const PRIVATE_VERSIONS = new Set([
  '0488ade4',
  '049d7878',
  '04b2430c',
  '0295b005',
  '02aa7a99',
  '04358394',
  '044a4e28',
  '045f18bc',
]);

const ALLOWED_VERSIONS: Readonly<Record<ChainId, readonly string[]>> = {
  // F-17: BIP-49 ypub (049d7cb2) is accepted for BTC, like the shared
  // validator (tools/hdwallet-gen/extended-key.js).
  btc: ['0488b21e', '049d7cb2', '04b24746'],
  eth: ['0488b21e'],
  trx: ['0488b21e'],
};

const DERIVATION_PREFIXES: Readonly<Record<ChainId, string>> = {
  btc: "m/84'/0'/0'/0",
  eth: "m/44'/60'/0'/0",
  trx: "m/44'/195'/0'/0",
};

type WalletCore = Awaited<ReturnType<typeof initWasm>>;

let wasmPromise: Promise<WalletCore> | undefined;
let engineReady = false;

function loadCore(): Promise<WalletCore> {
  if (wasmPromise === undefined) {
    // F-40: a rejected initialisation must not poison the cache for the
    // page lifetime. Clear the cached promise on rejection (only if it
    // is still the same promise) so a later call retries; in-flight and
    // successful initialisation stay cached.
    const promise = (async () => {
      // No options: the wallet-core 4.8.4 Emscripten build rejects both
      // locateFile and wasmBinary (not in INCOMING_MODULE_JS_API). It
      // resolves wallet-core.wasm relative to the page URL in the
      // browser, so the file is served from public/ (see
      // scripts/copy-wasm.mjs); in Node it reads its own directory.
      const core = await initWasm();
      engineReady = true;
      return core;
    })();
    promise.catch(() => {
      if (wasmPromise === promise) wasmPromise = undefined;
    });
    wasmPromise = promise;
  }

  return wasmPromise;
}

const SECP256K1_P = (1n << 256n) - (1n << 32n) - 977n;

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

// Compressed public key: prefix 0x02/0x03, x < p, and x^3 + 7 a quadratic
// residue mod p (y^2 = x^3 + 7 has a solution). y^2 == 0 is on-curve.
function isValidCompressedPoint(keyBytes: Uint8Array): boolean {
  const prefix = keyBytes[0];
  if (prefix !== 0x02 && prefix !== 0x03) return false;
  let x = 0n;
  for (let i = 1; i < 33; i++) x = (x << 8n) | BigInt(keyBytes[i]!);
  if (x >= SECP256K1_P) return false;
  const ySquared = ((x * x) % SECP256K1_P * x + 7n) % SECP256K1_P;
  if (ySquared === 0n) return true;
  return modPow(ySquared, (SECP256K1_P - 1n) / 2n, SECP256K1_P) === 1n;
}

export async function validateExtendedKey(
  xpub: string,
  chain: ChainId,
): Promise<import('@bawa/contracts').ExtendedKeyValidation> {
  const key = xpub.trim();

  // Fixed-width, big-endian accumulator; leading '1's represent zero bytes.
  const bytes = new Uint8Array(82);
  let leadingZeroes = 0;
  while (
    leadingZeroes < key.length &&
    key.charAt(leadingZeroes) === '1'
  ) {
    leadingZeroes++;
  }

  let overflow = false;
  for (let i = leadingZeroes; i < key.length; i++) {
    const digit = BASE58_ALPHABET.indexOf(key.charAt(i));
    if (digit === -1) {
      return {
        ok: false,
        reason: 'invalid-base58',
        message: 'invalid base58 character in extended key',
      };
    }

    // Check all remaining characters even after overflow, preserving precedence.
    if (overflow) continue;

    let carry = digit;
    for (let j = bytes.length - 1; j >= 0; j--) {
      const value = bytes[j]! * 58 + carry;
      bytes[j] = value & 0xff;
      carry = value >>> 8;
    }
    overflow = carry !== 0;
  }

  let firstNonZero = 0;
  while (firstNonZero < bytes.length && bytes[firstNonZero] === 0) {
    firstNonZero++;
  }

  const decodedLength = leadingZeroes + bytes.length - firstNonZero;
  if (overflow || decodedLength !== 82) {
    return {
      ok: false,
      reason: 'invalid-length',
      message: 'invalid extended key length',
    };
  }

  const firstHash = await globalThis.crypto.subtle.digest(
    'SHA-256',
    bytes.slice(0, 78),
  );
  const checksum = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', firstHash),
  );

  let checksumDifference = 0;
  for (let i = 0; i < 4; i++) {
    checksumDifference |= bytes[78 + i]! ^ checksum[i]!;
  }
  if (checksumDifference !== 0) {
    return {
      ok: false,
      reason: 'invalid-checksum',
      message: 'invalid extended key checksum',
    };
  }

  const versionHex = Array.from(bytes.subarray(0, 4), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  if (bytes[45] === 0x00 || PRIVATE_VERSIONS.has(versionHex)) {
    return {
      ok: false,
      reason: 'private-key',
      message:
        'extended public key required (private extended keys are rejected)',
    };
  }
  // secp256k1 point validation (R-01): a checksum-correct key whose 33-byte
  // public key is not a valid compressed curve point must be rejected, or
  // derivation would return a valid-looking address nobody can spend from.
  if (!isValidCompressedPoint(bytes.subarray(45, 78))) {
    return {
      ok: false,
      reason: 'invalid-point',
      message: 'extended key contains an invalid secp256k1 public key point',
    };
  }

  // T40-F1: depth-0 extended keys must have zero fingerprint and child
  // number (matches tools/hdwallet-gen/extended-key.js check 5c).
  if (bytes[4] === 0 && bytes.subarray(5, 13).some((b) => b !== 0)) {
    return {
      ok: false,
      reason: 'invalid-depth-metadata',
      message: 'depth-0 extended key must have zero fingerprint and child number',
    };
  }

  // BTC/ETH/TRX xpubs share version 0488b21e, so cross-chain xpub misuse
  // between those three is undetectable from serialisation alone.
  if (!ALLOWED_VERSIONS[chain]?.includes(versionHex)) {
    return {
      ok: false,
      reason: 'version-not-allowed',
      message: `extended key version ${versionHex} is not allowed for ${chain}`,
    };
  }

  return { ok: true };
}

export async function deriveAddress(
  chain: ChainId,
  xpub: string,
  index: number,
): Promise<string> {
  if (!Number.isInteger(index) || index < 0 || index > 2147483647) {
    throw new Error('index out of range');
  }

  const key = xpub.trim();
  const validation = await validateExtendedKey(key, chain);
  if (validation.ok === false) {
    throw new Error(validation.message);
  }

  let address: string;
  let valid: boolean;

  try {
    const core = await loadCore();
    const coin = {
      btc: core.CoinType.bitcoin,
      eth: core.CoinType.ethereum,
      trx: core.CoinType.tron,
    }[chain];
    const path = `${DERIVATION_PREFIXES[chain]}/${index}`;

    const pubkey = core.HDWallet.getPublicKeyFromExtended(key, coin, path);
    try {
      address = core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
      valid = core.CoinTypeExt.validate(coin, address);
    } finally {
      pubkey.delete();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error('derivation failed: ' + message);
  }

  // A negative validation result is distinct from a thrown WASM failure.
  if (!valid) {
    throw new Error('derived address failed validation');
  }

  return address;
}

export async function deriveAddresses(
  chain: ChainId,
  xpub: string,
  count: number,
): Promise<string[]> {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('count out of range');
  }

  const addresses: string[] = [];
  for (let index = 0; index < count; index++) {
    addresses.push(await deriveAddress(chain, xpub, index));
  }
  return addresses;
}

export function isEngineReady(): boolean {
  return engineReady;
}
