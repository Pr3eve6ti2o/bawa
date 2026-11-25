/**
 * Starknet address derivation (Argent proxy account, counterfactual).
 *
 * The wallet's bundled Wallet Core 4.9.3 has no Starknet coin, so the
 * address is derived here from the OKX js-wallet-sdk as reference
 * (bu-packages/coin-starknet + bu-packages/crypto-lib, MIT):
 *
 * 1. The Starknet private key is NOT derived from the mnemonic directly.
 *    The SDK derives the Ethereum key at m/44'/60'/0'/0/0, uses those
 *    32 bytes as a BIP32 seed, derives along m/44'/9004'/0'/0/{index},
 *    then grinds the result into the Stark curve order
 *    (micro-starknet's grindKey: sha256(seed || i) until in range).
 *    This module takes the Ethereum key bytes (which Wallet Core derives
 *    from the mnemonic) as its input, so no new BIP39 code is needed.
 * 2. The public key is the Stark curve x-coordinate (getStarkKey).
 * 3. The receive address is the Argent proxy account contract address:
 *    CalculateContractAddressFromHash(starkPub) with the Argent proxy
 *    class hash, the Argent account implementation class hash, and the
 *    `initialize` selector — a Pedersen hash chain
 *    (computeHashOnElements). Funds sent to it are recoverable by
 *    deploying that exact Argent account; the wallet cannot deploy it
 *    yet, so send stays blocked and the address is receive-only.
 *
 * No SDK code is imported: the Stark curve is plain affine bigint
 * arithmetic, Pedersen uses the five published base points (the
 * 252-point tables are rebuilt at runtime by doubling, exactly as the
 * SDK does), BIP32 is hand-rolled below (standard BIP32, the same
 * bytes as the SDK's fromSeedV2 — @scure/bip32 was dropped to keep
 * the lazy chunk small; its secp256k1 math already ships in the
 * bundle via viem), and the only hash dependency is @noble/hashes
 * (HMAC-SHA512 for BIP32, SHA-256 for grindKey).
 * The `initialize` selector is a constant (keccak256("initialize") &
 * 2^250-1, measured first-hand in the Lane B probe) so no keccak code
 * ships in the bundle.
 *
 * Vectors in starknet-derive.test.ts pin every step against the SDK's
 * own tests (privateKey -> stark key -> contract address).
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';

/** Stark curve order (micro-starknet). */
const CURVE_ORDER = BigInt(
  '3618502788666131213697322783095070105526743751716087489154079457884512865583',
);
/** Stark field prime: 2^251 + 17 * 2^192 + 1. */
const FIELD_PRIME = BigInt(
  '0x800000000000011000000000000000000000000000000000000000000000001',
);
/** Curve: y^2 = x^3 + x + b (b = pi digits; the point arithmetic below
 * needs only a = 1, so b is documented here, not stored). */
const GENERATOR_X = BigInt(
  '874739451078007766457464989774322083649278607533249481151382481072868806602',
);
const GENERATOR_Y = BigInt(
  '152666792071518830868575557812948353041420400780739481342941381225525861407',
);

/** Argent account class hashes (OKX SDK constants.ts). */
const PROXY_ACCOUNT_CLASS_HASH = BigInt(
  '0x3530cc4759d78042f1b543bf797f5f3d647cde0388c33734cf91b7f7b9314a9',
);
const ACCOUNT_CLASS_HASH = BigInt(
  '0x309c042d3729173c7f2f91a34f04d8c509c1b292d334679ef1aabf8da0899cc',
);
/** keccak256("initialize") & (2^250 - 1), measured first-hand (Lane B probe). */
const INITIALIZE_SELECTOR = BigInt(
  '0x79dc0da7c54b95f10aa182ad0a46400db63156920adb65eca2654c0945a463',
);
/** 'STARKNET_CONTRACT_ADDRESS' as a felt. */
const CONTRACT_ADDRESS_PREFIX = BigInt(
  '0x535441524b4e45545f434f4e54524143545f41444452455353',
);
/** Starknet address bound: 2^251 - 256. */
const ADDR_BOUND = 2n ** 251n - 256n;

/** The five published Pedersen base points (micro-starknet). */
const PEDERSEN_POINTS: ReadonlyArray<readonly [bigint, bigint]> = [
  [
    2089986280348253421170679821480865132823066470938446095505822317253594081284n,
    1713931329540660377023406109199410414810705867260802078187082345529207694986n,
  ],
  [
    996781205833008774514500082376783249102396023663454813447423147977397232763n,
    1668503676786377725805489344771023921079126552019160156920634619255970485781n,
  ],
  [
    2251563274489750535117886426533222435294046428347329203627021249169616184184n,
    1798716007562728905295480679789526322175868328062420237419143593021674992973n,
  ],
  [
    2138414695194151160943305727036575959195309218611738193261179310511854807447n,
    113410276730064486255102093846540133784865286929052426931474106396135072156n,
  ],
  [
    2379962749567351885752724891227938183011949129833673362440656643086021394946n,
    776496453633298175483985398648758586525933812536653089401905292063708816422n,
  ],
];

type AffinePoint = { x: bigint; y: bigint } | null;

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new Error('No modular inverse.');
  return mod(oldS, m);
}

function pointAdd(p: AffinePoint, q: AffinePoint): AffinePoint {
  if (p === null) return q;
  if (q === null) return p;
  if (p.x === q.x && mod(p.y + q.y, FIELD_PRIME) === 0n) return null;
  let slope: bigint;
  if (p.x === q.x && p.y === q.y) {
    // Double: (3x^2 + 1) / 2y.
    slope = mod(
      (3n * p.x * p.x + 1n) * modInverse(2n * p.y, FIELD_PRIME),
      FIELD_PRIME,
    );
  } else {
    slope = mod(
      (q.y - p.y) * modInverse(q.x - p.x, FIELD_PRIME),
      FIELD_PRIME,
    );
  }
  const x = mod(slope * slope - p.x - q.x, FIELD_PRIME);
  const y = mod(slope * (p.x - x) - p.y, FIELD_PRIME);
  return { x, y };
}

function pointDouble(p: AffinePoint): AffinePoint {
  return pointAdd(p, p);
}

function scalarMult(k: bigint, point: AffinePoint): AffinePoint {
  let result: AffinePoint = null;
  let addend = point;
  let n = k;
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    n >>= 1n;
  }
  return result;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Minimal big-endian encoding; 0 encodes as a single zero byte. */
function numberToVarBytesBE(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([0]);
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * micro-starknet grindKey: sha256(seed || i) until the value is below
 * the limit, then reduce mod the curve order.
 */
export function starkGrindKey(seed: Uint8Array): bigint {
  const mask = 2n ** 256n;
  const limit = mask - (mask % CURVE_ORDER);
  for (let i = 0n; ; i++) {
    const key = bytesToBigInt(sha256(concatBytes(seed, numberToVarBytesBE(i))));
    if (key < limit) return key % CURVE_ORDER;
    if (i === 100000n) {
      throw new Error('grindKey is broken: tried 100k vals');
    }
  }
}

const STARKNET_ADDRESS_REGEX = /^0x[0-9a-fA-F]+$/;

/**
 * Validate a Starknet address the way the SDK's validAddress does:
 * 0x-prefixed hex, longer than 50 characters, and a field element
 * below the address bound. (Derived Argent addresses are always the
 * full 0x + 64 hex chars; shorter unpadded felts are valid too.)
 */
export function isValidStarknetAddress(address: string): boolean {
  if (!STARKNET_ADDRESS_REGEX.test(address)) return false;
  if (address.length <= 50) return false;
  let value: bigint;
  try {
    value = BigInt(address);
  } catch {
    return false;
  }
  return value >= 0n && value < ADDR_BOUND;
}

/**
 * Derive the Starknet private key from the 32-byte Ethereum key at
 * m/44'/60'/{account}'/0/0 (the SDK's double-derivation): the Ethereum
 * key is the BIP32 seed, the child is derived along
 * m/44'/9004'/{account}'/0/{index}, then ground into the Stark curve
 * order. At account 0 index 0 this is exactly the SDK's path.
 * Returns a 0x-prefixed hex string.
 */
function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

type Bip32Node = { privateKey: Uint8Array; chainCode: Uint8Array };

/** BIP32 master node from a seed (HMAC-SHA512, key "Bitcoin seed"). */
function bip32Master(seed: Uint8Array): Bip32Node {
  const digest = hmac(sha512, new TextEncoder().encode('Bitcoin seed'), seed);
  return { privateKey: digest.slice(0, 32), chainCode: digest.slice(32) };
}

/**
 * One BIP32 child step (hardened or normal). Hand-rolled instead of
 * @scure/bip32 so the Starknet chunk stays small: the secp256k1 point
 * math comes from @noble/curves, already in the bundle via viem, and
 * HMAC-SHA512 from @noble/hashes. Same bytes as the SDK's fromSeedV2
 * (standard BIP32); pinned by the SDK-vector tests in
 * starknet-derive.test.ts.
 */
function bip32Child(
  parent: Bip32Node,
  index: number,
  hardened: boolean,
): Bip32Node {
  const childIndex = hardened ? index + 0x80000000 : index;
  const data = new Uint8Array(37);
  if (hardened) {
    data[0] = 0;
    data.set(parent.privateKey, 1);
  } else {
    const publicKey = secp256k1.ProjectivePoint.fromPrivateKey(
      parent.privateKey,
    ).toRawBytes(true);
    data.set(publicKey, 0);
  }
  new DataView(data.buffer).setUint32(33, childIndex);
  const digest = hmac(sha512, parent.chainCode, data);
  const childPrivate = mod(
    bytesToBigInt(digest.slice(0, 32)) + bytesToBigInt(parent.privateKey),
    secp256k1.CURVE.n,
  );
  if (childPrivate === 0n) {
    throw new Error('Starknet BIP32 derivation produced an invalid key.');
  }
  return {
    privateKey: bigIntToBytes(childPrivate, 32),
    chainCode: digest.slice(32),
  };
}

/** The SDK's fromSeedV2 path: m/44'/9004'/{account}'/0/{index}. */
function deriveBip32(
  seed: Uint8Array,
  account: number,
  index: number,
): Uint8Array {
  let node = bip32Master(seed);
  node = bip32Child(node, 44, true);
  node = bip32Child(node, 9004, true);
  node = bip32Child(node, account, true);
  node = bip32Child(node, 0, false);
  node = bip32Child(node, index, false);
  return node.privateKey;
}

export function starknetPrivateKeyFromEthKey(
  ethPrivateKey: Uint8Array,
  account: number,
  index: number,
): string {
  if (ethPrivateKey.length !== 32) {
    throw new Error('Ethereum private key must be 32 bytes.');
  }
  if (!Number.isSafeInteger(account) || account < 0) {
    throw new Error('Starknet account must be a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error('Starknet index must be a non-negative safe integer.');
  }
  const child = deriveBip32(ethPrivateKey, account, index);
  const ground = starkGrindKey(child);
  return '0x' + ground.toString(16);
}

function parseHexKey(privateKey: string): bigint {
  const hex = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey;
  if (!/^[0-9a-fA-F]+$/u.test(hex)) {
    throw new Error('Starknet private key must be hex.');
  }
  const value = BigInt('0x' + hex);
  if (value <= 0n) {
    throw new Error('Starknet private key out of range.');
  }
  // The SDK's getPublicKey reduces mod the curve order (noble
  // weierstrass), so an unground key above the order is reduced rather
  // than rejected — grindKey outputs are always below the order.
  return value % CURVE_ORDER;
}

/** Stark public key (x-coordinate), 0x-prefixed without leading zeros. */
export function starknetPublicKeyFromPrivateKey(privateKey: string): string {
  const secret = parseHexKey(privateKey);
  const point = scalarMult(secret, { x: GENERATOR_X, y: GENERATOR_Y });
  if (point === null) throw new Error('Starknet public key is infinity.');
  return '0x' + point.x.toString(16);
}

/** Rebuild the 252-point table by doubling, exactly as micro-starknet. */
function pedersenPrecompute(
  p1: readonly [bigint, bigint],
  p2: readonly [bigint, bigint],
): Array<AffinePoint> {
  const out: Array<AffinePoint> = [];
  let p: AffinePoint = { x: p1[0], y: p1[1] };
  for (let i = 0; i < 248; i++) {
    out.push(p);
    p = pointDouble(p);
  }
  p = { x: p2[0], y: p2[1] };
  for (let i = 0; i < 4; i++) {
    out.push(p);
    p = pointDouble(p);
  }
  return out;
}

const PEDERSEN_POINTS1 = pedersenPrecompute(
  PEDERSEN_POINTS[1]!,
  PEDERSEN_POINTS[2]!,
);
const PEDERSEN_POINTS2 = pedersenPrecompute(
  PEDERSEN_POINTS[3]!,
  PEDERSEN_POINTS[4]!,
);

function pedersenArg(value: bigint | string): bigint {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (!(parsed >= 0n && parsed < FIELD_PRIME)) {
    throw new Error('PedersenArg should be 0 <= value < CURVE.P.');
  }
  return parsed;
}

function pedersenSingle(
  point: AffinePoint,
  value: bigint | string,
  constants: Array<AffinePoint>,
): AffinePoint {
  let x = pedersenArg(value);
  let acc = point;
  for (let j = 0; j < 252; j++) {
    const constant = constants[j]!;
    if (
      constant !== null &&
      acc !== null &&
      constant.x === acc.x &&
      constant.y === acc.y
    ) {
      throw new Error('Same point');
    }
    if ((x & 1n) !== 0n) acc = pointAdd(acc, constant);
    x >>= 1n;
  }
  return acc;
}

/** Pedersen hash; returns the x-coordinate as a 0x hex string. */
export function starkPedersen(x: bigint | string, y: bigint | string): string {
  let point: AffinePoint = {
    x: PEDERSEN_POINTS[0]![0],
    y: PEDERSEN_POINTS[0]![1],
  };
  point = pedersenSingle(point, x, PEDERSEN_POINTS1);
  point = pedersenSingle(point, y, PEDERSEN_POINTS2);
  if (point === null) throw new Error('Pedersen hash is infinity.');
  return '0x' + point.x.toString(16);
}

/** computeHashOnElements: [0, ...data, data.length] folded with Pedersen. */
export function starkComputeHashOnElements(data: Array<bigint | string>): string {
  // Array.reduce with no initial value: the accumulator starts at the
  // leading 0 and folds over [...data, data.length].
  let acc: bigint | string = 0n;
  const input: Array<bigint | string> = [...data, BigInt(data.length)];
  for (const element of input) {
    acc = starkPedersen(acc, element);
  }
  return typeof acc === 'string' ? acc : '0x' + acc.toString(16);
}

/**
 * Argent proxy account contract address for a Stark public key
 * (CalculateContractAddressFromHash). Constructor calldata is the
 * `initialize` call: [implementation, selector, 2, signer, 0] — the
 * inner {signer, guardian} struct compiles to [signer, 0] and the
 * outer calldata array carries its length.
 */
export function starknetAddressFromPublicKey(starkPublicKey: string): string {
  const signer = BigInt(starkPublicKey);
  const constructorCalldata = [
    ACCOUNT_CLASS_HASH,
    INITIALIZE_SELECTOR,
    2n,
    signer,
    0n,
  ];
  const constructorCalldataHash = starkComputeHashOnElements(
    constructorCalldata,
  );
  const hash = starkComputeHashOnElements([
    CONTRACT_ADDRESS_PREFIX,
    0n,
    signer,
    PROXY_ACCOUNT_CLASS_HASH,
    BigInt(constructorCalldataHash),
  ]);
  const address = BigInt(hash) % ADDR_BOUND;
  return '0x' + address.toString(16).padStart(64, '0');
}

/** Full derivation: private key -> Starknet address. */
export function starknetAddressFromPrivateKey(privateKey: string): string {
  return starknetAddressFromPublicKey(
    starknetPublicKeyFromPrivateKey(privateKey),
  );
}

/** Full derivation: Ethereum key bytes + account + index -> Starknet address. */
export function starknetAddressFromEthKey(
  ethPrivateKey: Uint8Array,
  account: number,
  index: number,
): string {
  const privateKey = starknetPrivateKeyFromEthKey(
    ethPrivateKey,
    account,
    index,
  );
  const publicKey = starknetPublicKeyFromPrivateKey(privateKey);
  return starknetAddressFromPublicKey(publicKey);
}
