// derive_daemon.js — persistent public-only Trust Wallet Core derivation daemon.
// JSONL request: {"chain":"btc|eth|trx","xpub":"...","index":5}
// JSONL response: {"ok":true,"address":"..."} or {"ok":false,"error":"..."}
// Startup: {"ready":true}
// Extended keys are validated via the shared module before any per-request WASM call.
const { initWasm } = require("@trustwallet/wallet-core");
const readline = require("readline");
const { validateExtendedKey, redact } = require("./extended-key");

const CHAINS = Object.create(null);
CHAINS.btc = (coin) => coin.bitcoin;
CHAINS.eth = (coin) => coin.ethereum;
CHAINS.trx = (coin) => coin.tron;

const PATHS = Object.create(null);
PATHS.btc = (i) => `m/84'/0'/0'/0/${i}`;
PATHS.eth = (i) => `m/44'/60'/0'/0/${i}`;
PATHS.trx = (i) => `m/44'/195'/0'/0/${i}`;

const ALLOWED_CHAINS = new Set(["btc", "eth", "trx"]);
const MAX_XPUB_LENGTH = 200;
const MAX_LINE_LENGTH = 4096;
const MAX_INDEX = 2147483647;

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

      const validation = validateExtendedKey(xpub.trim(), chain);
      if (!validation.ok) return fail(validation.message);

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
