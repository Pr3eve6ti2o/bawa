// derive.js — derive a deposit address from an account xpub using Trust Wallet Core.
// Usage: echo "<xpub>" | node derive.js <chain> <index>
// chain: btc | eth | trx; index: 0..2147483647
const { initWasm } = require("@trustwallet/wallet-core");
const crypto = require("crypto");

const ALLOWED_CHAINS = new Set(["btc", "eth", "trx"]);
const CHAINS = Object.assign(Object.create(null), {
  btc: (coin) => coin.bitcoin,
  eth: (coin) => coin.ethereum,
  trx: (coin) => coin.tron,
});
const PATHS = Object.assign(Object.create(null), {
  btc: (i) => \`m/84'/0'/0'/0/\${i}\`,
  eth: (i) => \`m/44'/60'/0'/0/\${i}\`,
  trx: (i) => \`m/44'/195'/0'/0/\${i}\`,
});

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PRIVATE_VERSIONS = new Set([
  "0488ade4","049d7878","04b2430c","0295b005",
  "02aa7a99","04358394","044a4e28","045f18bc",
]);

function decodeBase58(s) {
  let n = 0n;
  for (const ch of s) {
    const v = B58_ALPHABET.indexOf(ch);
    if (v < 0) return null;
    n = n * 58n + BigInt(v);
  }
  let hex = n === 0n ? "" : n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  return Buffer.concat([Buffer.alloc(zeros), Buffer.from(hex, "hex")]);
}

function isPrivateExtendedKey(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  const buf = decodeBase58(t);
  if (!buf || buf.length < 4) return false;
  const payload = buf.subarray(0, -4);
  const checksum = buf.subarray(-4);
  const hash = crypto.createHash("sha256").update(
    crypto.createHash("sha256").update(payload).digest()
  ).digest().subarray(0, 4);
  if (!crypto.timingSafeEqual(checksum, hash)) return false;
  return PRIVATE_VERSIONS.has(buf.subarray(0, 4).toString("hex"));
}

function redact(msg) {
  let s = msg == null ? "" : String(msg);
  s = s.replace(/(?:xprv|xpub|yprv|ypub|zprv|zpub|Yprv|Ypub|Zprv|Zpub|tprv|tpub|uprv|upub|vprv|vpub)[1-9A-HJ-NP-Za-km-z]+/g, "[REDACTED]");
  s = s.replace(/[1-9A-HJ-NP-Za-km-z]{100,}/g, "[REDACTED]");
  return s;
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

  const index = Number(indexRaw);
  const MAX_INDEX = 2147483647;
  if (!ALLOWED_CHAINS.has(chain) || !xpub || !Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
    console.error("usage: echo <xpub> | node derive.js <btc|eth|trx> <index>  (0 <= index <= 2147483647)");
    process.exit(2);
  }
  if (isPrivateExtendedKey(xpub)) {
    console.error("usage: extended public key required (private extended keys are rejected)");
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
  try {
    addr = core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
  } catch (e) {
    console.error("deriveAddressFromPublicKey failed: " + redact(e && e.message));
    process.exit(1);
  } finally {
    pubkey.delete();
  }

  if (!addr || !core.CoinTypeExt.validate(coin, addr)) {
    console.error("derived address failed validation");
    process.exit(1);
  }
  console.log(addr);
})().catch((e) => { console.error("FATAL: " + redact(e && e.message)); process.exit(1); });
