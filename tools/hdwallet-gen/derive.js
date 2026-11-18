// derive.js — derive a deposit address from an account xpub using Trust Wallet Core.
// Usage: echo "<xpub>" | node derive.js <chain> <index>
// chain: btc | eth | trx; index: 0..2147483647
// Extended-key validation (Base58Check checksum, private-key and
// per-chain version checks) happens BEFORE WASM initialisation, so invalid
// input never reaches WASM. BTC/ETH/TRX xpubs share version 0488b21e, so an
// xpub carries no chain tag: cross-chain xpub misuse between those three
// cannot be detected from serialisation alone.
const { initWasm } = require("@trustwallet/wallet-core");
const { validateExtendedKey, redact } = require("./extended-key");

const ALLOWED_CHAINS = new Set(["btc", "eth", "trx"]);
const CHAINS = Object.assign(Object.create(null), {
  btc: (coin) => coin.bitcoin,
  eth: (coin) => coin.ethereum,
  trx: (coin) => coin.tron,
});
const PATHS = Object.assign(Object.create(null), {
  btc: (i) => `m/84'/0'/0'/0/${i}`,
  eth: (i) => `m/44'/60'/0'/0/${i}`,
  trx: (i) => `m/44'/195'/0'/0/${i}`,
});

// F-006: TRX 33-byte public-key boundary. In wallet-core 4.8.4 WASM, passing a
// 33-byte compressed secp256k1 PublicKey (keyType 0) to TRON
// CoinTypeExt.deriveAddressFromPublicKey aborts the WASM runtime (assertion
// failure, uncatchable from JS). Decompress and validate the point in plain JS
// first, then construct a fresh 65-byte uncompressed secp256k1Extended key
// (keyType 1) for the derive call. Invalid input fails here with a clean JS
// error and never reaches WASM. BTC and ETH keep their original key: they
// accept 33-byte input in the tested build. Tested on wallet-core 4.8.4 WASM,
// Node 22.23.4. NOTE: `new core.PublicKey(bytes, type)` does not exist on
// 4.8.4 - use core.PublicKey.createWithData(bytes, enum) (verified first-hand).
const SECP256K1_P = (1n << 256n) - (1n << 32n) - 977n;
const readBE = (b) => BigInt("0x" + Buffer.from(b).toString("hex"));
const write32 = (n) => Buffer.from(n.toString(16).padStart(64, "0"), "hex");
function powModP(a, e) {
  let r = 1n;
  while (e > 0n) {
    if (e & 1n) r = (r * a) % SECP256K1_P;
    a = (a * a) % SECP256K1_P;
    e >>= 1n;
  }
  return r;
}
function trx65(data) {
  const b = Buffer.from(data); // copy bytes out of the WASM key
  const compressed = b.length === 33 && (b[0] === 2 || b[0] === 3);
  if (!compressed && !(b.length === 65 && b[0] === 4))
    throw new Error("TRX: expected 33-byte 02/03 or 65-byte 04 SEC1 key");
  const x = readBE(b.subarray(1, 33));
  const rhs = (x * x * x + 7n) % SECP256K1_P;
  // P is 3 mod 4, so (P + 1) / 4 is the square-root exponent; verify below.
  let y = compressed ? powModP(rhs, (SECP256K1_P + 1n) / 4n) : readBE(b.subarray(33));
  if (compressed && (y & 1n) !== BigInt(b[0] & 1)) y = SECP256K1_P - y;
  if (x >= SECP256K1_P || y >= SECP256K1_P || (y * y) % SECP256K1_P !== rhs)
    throw new Error("TRX: invalid/non-canonical secp256k1 point");
  return Buffer.concat([Buffer.from([4]), write32(x), write32(y)]);
}

(async () => {
  const [chain, indexRaw] = process.argv.slice(2);
  let xpub = "";
  try {
    xpub = (await new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => {
        data += c;
        if (data.length > 200) {
          reject(new Error("xpub too long"));
          process.stdin.destroy();
        }
      });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    })).trim();
  } catch (e) {
    console.error("failed to read xpub from stdin: " + redact(e && e.message));
    process.exit(2);
  }

  if (typeof indexRaw !== "string" || !/^[0-9]+$/.test(indexRaw)) {
    console.error("usage: echo <xpub> | node derive.js <btc|eth|trx> <index>  (0 <= index <= 2147483647)");
    process.exit(2);
  }

  const index = Number(indexRaw);
  const MAX_INDEX = 2147483647;
  if (!ALLOWED_CHAINS.has(chain) || !xpub || !Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
    console.error("usage: echo <xpub> | node derive.js <btc|eth|trx> <index>  (0 <= index <= 2147483647)");
    process.exit(2);
  }
  const validation = validateExtendedKey(xpub, chain);
  if (!validation.ok) {
    console.error(validation.message);
    process.exit(2);
  }

  const core = await initWasm();
  const coin = CHAINS[chain](core.CoinType);
  let pubkey;
  try {
    pubkey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, PATHS[chain](index));
  } catch (e) {
    console.error("getPublicKeyFromExtended failed: " + redact(e && e.message));
    process.exit(1);
  }

  let addr;
  let trxKey;
  try {
    let keyForDerive = pubkey;
    if (chain === "trx") {
      try {
        trxKey = core.PublicKey.createWithData(
          trx65(pubkey.data()),
          core.PublicKeyType.secp256k1Extended
        );
      } catch (e) {
        console.error("TRX public key normalisation failed: " + redact(e && e.message));
        process.exit(1);
      }
      keyForDerive = trxKey;
    }
    addr = core.CoinTypeExt.deriveAddressFromPublicKey(coin, keyForDerive);
  } catch (e) {
    console.error("deriveAddressFromPublicKey failed: " + redact(e && e.message));
    process.exitCode = 1;
    return;
  } finally {
    if (trxKey) trxKey.delete();
    pubkey.delete();
  }

  if (!addr || !core.CoinTypeExt.validate(coin, addr)) {
    console.error("derived address failed validation");
    process.exit(1);
  }
  console.log(addr);
})().catch((e) => { console.error("FATAL: " + redact(e && e.message)); process.exit(1); });
