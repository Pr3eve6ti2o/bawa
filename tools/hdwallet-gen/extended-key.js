/*
 * tools/hdwallet-gen/extended-key.js
 * Shared, pure extended-key validation before WASM and diagnostic redaction.
 *
 * BTC/ETH/TRX xpubs share version 0488b21e, so an xpub carries no chain tag.
 * Cross-chain xpub misuse between those three cannot be detected from
 * serialisation alone; this module catches every version-distinguishable
 * mismatch plus all checksum/payload defects.
 */

"use strict";

const crypto = require("crypto");

const PRIVATE_VERSIONS = new Set([
  "0488ade4",
  "049d7878",
  "04b2430c",
  "0295b005",
  "02aa7a99",
  "04358394",
  "044a4e28",
  "045f18bc",
]);

const PUBLIC_VERSIONS = Object.freeze({
  btc: new Set(["0488b21e", "049d7cb2", "04b24746"]),
  eth: new Set(["0488b21e"]),
  trx: new Set(["0488b21e"]),
});

// Exported sets describe the policy; caller mutation must not weaken validation.
const privateVersionLookup = new Set(PRIVATE_VERSIONS);
const publicVersionLookup = Object.freeze({
  btc: new Set(PUBLIC_VERSIONS.btc),
  eth: new Set(PUBLIC_VERSIONS.eth),
  trx: new Set(PUBLIC_VERSIONS.trx),
});

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NON_BASE58 = /[^1-9A-HJ-NP-Za-km-z]/;

const DECODED_LENGTH = 82;
const PAYLOAD_LENGTH = 78;
const KEY_DATA_OFFSET = 45;

// This bound includes any leading zeroes represented by Base58 "1" characters.
const MAX_BASE58_LENGTH = 112;

const REDACTION_PATTERN =
  /(?:[xyzYZtuv](?:prv|pub)[1-9A-HJ-NP-Za-km-z]+|[1-9A-HJ-NP-Za-km-z]{100,})/g;

function failure(reason, message) {
  return { ok: false, reason, message };
}

/*
 * The alphabet must already have been checked. Decode into a fixed-size
 * accumulator so oversized input cannot cause oversized allocations.
 * Return null unless the actual decoded length is exactly 82 bytes.
 */
function decode82Bytes(input) {
  if (input.length > MAX_BASE58_LENGTH) {
    return null;
  }

  let leadingZeroes = 0;
  while (
    leadingZeroes < input.length &&
    input[leadingZeroes] === "1"
  ) {
    leadingZeroes += 1;
  }

  if (leadingZeroes > DECODED_LENGTH) {
    return null;
  }

  const decoded = Buffer.alloc(DECODED_LENGTH);

  for (let i = leadingZeroes; i < input.length; i += 1) {
    let carry = BASE58_ALPHABET.indexOf(input[i]);

    for (let j = DECODED_LENGTH - 1; j >= 0; j -= 1) {
      carry += decoded[j] * 58;
      decoded[j] = carry & 0xff;
      carry >>>= 8;
    }

    if (carry !== 0) {
      return null;
    }
  }

  let firstNonZero = 0;
  while (
    firstNonZero < DECODED_LENGTH &&
    decoded[firstNonZero] === 0
  ) {
    firstNonZero += 1;
  }

  // Accumulator padding is not data; only encoded leading zeroes count.
  const decodedLength =
    leadingZeroes + (DECODED_LENGTH - firstNonZero);

  return decodedLength === DECODED_LENGTH ? decoded : null;
}

// Shared checks 1–3: alphabet, decoded length, then Base58Check checksum.
function decodeAndCheck(input) {
  // Length cap before the alphabet regex, so oversized input is not scanned.
  if (typeof input === "string" && input.length > MAX_BASE58_LENGTH) {
    return failure(
      "bad-length",
      "extended key must decode to exactly 82 bytes"
    );
  }
  // Do not trim or normalise input; whitespace is not a Base58 character.
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    NON_BASE58.test(input)
  ) {
    return failure(
      "bad-base58",
      "extended key must be a non-empty string of Base58 characters"
    );
  }

  const decoded = decode82Bytes(input);
  if (decoded === null) {
    return failure(
      "bad-length",
      "extended key must decode to exactly 82 bytes"
    );
  }

  const firstHash = crypto
    .createHash("sha256")
    .update(decoded.subarray(0, PAYLOAD_LENGTH))
    .digest();

  const expectedChecksum = crypto
    .createHash("sha256")
    .update(firstHash)
    .digest()
    .subarray(0, 4);

  if (
    !crypto.timingSafeEqual(
      decoded.subarray(PAYLOAD_LENGTH),
      expectedChecksum
    )
  ) {
    return failure(
      "bad-checksum",
      "extended key checksum verification failed"
    );
  }

  return {
    ok: true,
    decoded,
    version: decoded.subarray(0, 4).toString("hex"),
  };
}

function isPrivateDecodedKey(decoded, version) {
  return (
    decoded[KEY_DATA_OFFSET] === 0x00 ||
    privateVersionLookup.has(version)
  );
}

const SECP256K1_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;

function modpow(base, exponent, modulus) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if ((exponent & 1n) === 1n) {
      result = (result * base) % modulus;
    }
    base = (base * base) % modulus;
    exponent >>= 1n;
  }
  return result;
}

function validateExtendedKey(input, chain) {
  const checked = decodeAndCheck(input);
  if (!checked.ok) {
    return checked;
  }

  const { decoded, version } = checked;

  // 4. Either a private payload marker or a private version is sufficient.
  if (isPrivateDecodedKey(decoded, version)) {
    return failure(
      "private-key",
      "extended public key required (private extended keys are rejected)"
    );
  }

  // 5. Public key data must have a compressed public-key marker.
  if (
    decoded[KEY_DATA_OFFSET] !== 0x02 &&
    decoded[KEY_DATA_OFFSET] !== 0x03
  ) {
    return failure(
      "bad-key-data",
      "extended public key data must begin with 0x02 or 0x03"
    );
  }

  // 5b. secp256k1 point validation: x must be below the field prime and
  // x^3+7 must be a quadratic residue mod p (Legendre symbol), so the
  // key data is a real curve point. Do not merely reduce x mod p.
  const x = BigInt("0x" + decoded.subarray(46, 78).toString("hex"));
  if (x >= SECP256K1_P) {
    return failure(
      "bad-point",
      "extended public key is not a valid secp256k1 point"
    );
  }
  const ySquared = (x * x * x + 7n) % SECP256K1_P;
  const legendre = modpow(ySquared, (SECP256K1_P - 1n) / 2n, SECP256K1_P);
  if (legendre !== 1n) {
    return failure(
      "bad-point",
      "extended public key is not a valid secp256k1 point"
    );
  }

  // 5c. Depth-0 extended keys must have zero fingerprint and child number.
  if (
    decoded[4] === 0 &&
    (decoded.readUInt32BE(5) !== 0 || decoded.readUInt32BE(9) !== 0)
  ) {
    return failure(
      "bad-depth-metadata",
      "depth-0 extended key must have zero fingerprint and child number"
    );
  }

  // 6. Apply the requested chain's public-version allow-list.
  const chainName = typeof chain === "string" ? chain.toLowerCase() : "";
  const allowed = Object.prototype.hasOwnProperty.call(
    publicVersionLookup,
    chainName
  )
    ? publicVersionLookup[chainName]
    : null;

  if (allowed === null || !allowed.has(version)) {
    // Never echo an arbitrary chain argument: it could itself contain a key.
    const chainLabel =
      allowed === null
        ? "an unsupported chain (expected btc, eth or trx)"
        : chainName;

    return failure(
      "wrong-version",
      `extended key version ${version} is not allowed for ${chainLabel}`
    );
  }

  return { ok: true, version };
}

/*
 * Compatibility predicate: true only for a checksum-verified private key.
 * A false result is NOT proof the input is public: malformed input, including
 * a bad checksum, also returns false. Callers must use validateExtendedKey
 * before passing any extended key to WASM.
 */
function isPrivateExtendedKey(s) {
  const checked = decodeAndCheck(s);
  if (!checked.ok) {
    return false;
  }

  return isPrivateDecodedKey(checked.decoded, checked.version);
}

function redact(msg) {
  const text = msg === null || msg === undefined ? "" : String(msg);

  // No word boundaries: conceal key-like tokens embedded in other text too.
  return text.replace(REDACTION_PATTERN, "[REDACTED]");
}

module.exports = {
  validateExtendedKey,
  isPrivateExtendedKey,
  redact,
  PUBLIC_VERSIONS,
  PRIVATE_VERSIONS,
};