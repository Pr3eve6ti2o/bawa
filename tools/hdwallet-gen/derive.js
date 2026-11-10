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

(async () => {
  const [chain, indexRaw] = process.argv.slice(2);
  const MAX_INDEX = 2147483647;
  // Validate arguments BEFORE reading stdin (F-35): invalid arguments
  // must fail with the usage error immediately, not wait for stdin EOF.
  if (typeof indexRaw !== "string" || !/^[0-9]+$/.test(indexRaw)) {
    console.error("usage: echo <xpub> | node derive.js <btc|eth|trx> <index>  (0 <= index <= 2147483647)");
    process.exit(2);
  }
  const index = Number(indexRaw);
  if (!ALLOWED_CHAINS.has(chain) || !Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
    console.error("usage: echo <xpub> | node derive.js <btc|eth|trx> <index>  (0 <= index <= 2147483647)");
    process.exit(2);
  }

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

  if (!xpub) {
    console.error("usage: echo <xpub> | node derive.js <btc|eth|trx> <index>  (0 <= index <= 2147483647)");
    process.exit(2);
  }
  const validation = validateExtendedKey(xpub, chain);
  if (!validation.ok) {
    // Defence in depth (F-36): the messages are fixed strings, but
    // validation output goes through redact() like every other
    // stderr message in this tool, so a future message change cannot
    // echo key material.
    console.error(redact(validation.message));
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
    process.exitCode = 1;
    return;
  } finally {
    pubkey.delete();
  }

  if (!addr || !core.CoinTypeExt.validate(coin, addr)) {
    console.error("derived address failed validation");
    process.exit(1);
  }
  console.log(addr);
})().catch((e) => { console.error("FATAL: " + redact(e && e.message)); process.exit(1); });
