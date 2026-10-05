// derive_daemon.js — persistent public-only Trust Wallet Core derivation daemon.
// JSONL request: {"chain":"btc|eth|trx","xpub":"...","index":5}
// JSONL response: {"ok":true,"address":"..."} or {"ok":false,"error":"..."}
// Startup: {"ready":true}
const { initWasm } = require("@trustwallet/wallet-core");
const readline = require("readline");
const crypto = require("crypto");

const CHAINS = Object.create(null);
CHAINS.btc = (coin) => coin.bitcoin;
CHAINS.eth = (coin) => coin.ethereum;
CHAINS.trx = (coin) => coin.tron;

const PATHS = Object.create(null);
PATHS.btc = (i) => \`m/84'/0'/0'/0/\${i}\`;
PATHS.eth = (i) => \`m/44'/60'/0'/0/\${i}\`;
PATHS.trx = (i) => \`m/44'/195'/0'/0/\${i}\`;

const ALLOWED_CHAINS = new Set(["btc", "eth", "trx"]);
const MAX_XPUB_LENGTH = 200;
const MAX_LINE_LENGTH = 4096;
const MAX_INDEX = 2147483647;

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
  let hex = n.toString(16);
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
  const payload = buf.subarray(0, buf.length - 4);
  const checksum = buf.subarray(buf.length - 4);
  const hash = crypto.createHash("sha256").update(payload).digest();
  const hash2 = crypto.createHash("sha256").update(hash).digest();
  if (!hash2.subarray(0, 4).equals(checksum)) return false;
  return PRIVATE_VERSIONS.has(buf.subarray(0, 4).toString("hex"));
}

function redact(msg) {
  let s = msg == null ? "" : String(msg);
  s = s.replace(/(?:xprv|xpub|yprv|ypub|zprv|zpub|Yprv|Ypub|Zprv|Zpub|tprv|tpub|uprv|upub|vprv|vpub)[1-9A-HJ-NP-Za-km-z]+/g, "[REDACTED]");
  s = s.replace(/[1-9A-HJ-NP-Za-km-z]{100,}/g, "[REDACTED]");
  return s;
}

function fail(msg) {
  console.log(JSON.stringify({ ok: false, error: redact(msg) }));
}

(async () => {
  const core = await initWasm();
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  console.log(JSON.stringify({ ready: true }));

  rl.on("line", (line) => {
    try {
      if (line.length > MAX_LINE_LENGTH) return fail("request too large");
      if (!line.trim()) return;

      let req;
      try { req = JSON.parse(line); } catch { return fail("bad json"); }

      const { chain, xpub, index } = req || {};
      if (
        !ALLOWED_CHAINS.has(chain) ||
        typeof xpub !== "string" || !xpub.trim() || xpub.length > MAX_XPUB_LENGTH ||
        !Number.isInteger(index) || index < 0 || index > MAX_INDEX
      ) return fail("bad request");

      if (isPrivateExtendedKey(xpub)) return fail("extended public key required");

      const coin = CHAINS[chain](core.CoinType);
      let pubkey;
      try {
        pubkey = core.HDWallet.getPublicKeyFromExtended(xpub.trim(), coin, PATHS[chain](index));
      } catch (e) {
        return fail("getPublicKeyFromExtended failed: " + (e && e.message));
      }

      let addr;
      try {
        addr = core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
      } catch (e) {
        return fail("deriveAddressFromPublicKey failed: " + (e && e.message));
      } finally {
        try { pubkey.delete(); } catch {}
      }

      if (!addr || !core.CoinTypeExt.validate(coin, addr)) return fail("derived address failed validation");
      console.log(JSON.stringify({ ok: true, address: addr }));
    } catch (e) {
      fail("internal error: " + (e && e.message));
    }
  });

  rl.on("close", () => { process.exitCode = 0; });
  process.on("SIGTERM", () => { process.exitCode = 0; rl.close(); });
})().catch((e) => { console.error("FATAL: " + (e && e.message)); process.exit(1); });
