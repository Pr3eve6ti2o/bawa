// derive_daemon.js — persistent public-only Trust Wallet Core derivation daemon.
// JSONL request: {"chain":"btc|eth|trx","xpub":"...","index":5}
// JSONL response: {"ok":true,"address":"..."} or {"ok":false,"error":"..."}
// Startup: {"ready":true}
// Extended keys are validated via the shared module before any per-request WASM call.
const { initWasm } = require("@trustwallet/wallet-core");
const readline = require("readline");
const { Transform } = require("stream");
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

let replyRl = null;
let waitingForDrain = false;

function reply(obj) {
  if (process.stdout.write(JSON.stringify(obj) + "\n")) return;

  if (replyRl) replyRl.pause();
  if (waitingForDrain) return;

  waitingForDrain = true;
  process.stdout.once("drain", () => {
    waitingForDrain = false;
    if (replyRl) replyRl.resume();
  });
}

function fail(msg) {
  reply({ ok: false, error: redact(msg) });
}

(async () => {
  const core = await initWasm();
  // Bound input accumulation per line: readline only sees a line after it has
  // buffered it, so cap the bytes of the current UNTERMINATED line on the byte
  // stream itself. A line that does terminate (its newline arrives in the same
  // chunk) is left to the line-length check below, which replies and keeps the
  // daemon up; only a line that keeps growing without a newline is cut off,
  // with one reply, by destroying stdin.
  let cappedLineBytes = 0;
  let cappedOverLimit = false;
  const cappedInput = new Transform({
    transform(chunk, encoding, callback) {
      if (cappedOverLimit) return callback();
      let start = 0;
      for (;;) {
        const newline = chunk.indexOf(10, start);
        if (newline === -1) {
          cappedLineBytes += chunk.length - start;
          break;
        }
        cappedLineBytes = 0;
        start = newline + 1;
      }
      if (cappedLineBytes > MAX_LINE_LENGTH) {
        cappedOverLimit = true;
        fail("request too large");
        process.stdin.destroy();
        return callback();
      }
      callback(null, chunk);
    },
  });
  process.stdin.pipe(cappedInput);
  const rl = readline.createInterface({ input: cappedInput, terminal: false });
  replyRl = rl;
  reply({ ready: true });

  if (waitingForDrain) rl.pause();

  rl.on("line", (line) => {
    try {
      if (line.length > MAX_LINE_LENGTH) return fail("request too large");
      if (!line.trim()) return fail("bad json");

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
      reply({ ok: true, address: addr });
    } catch (e) {
      fail("internal error: " + (e && e.message));
    }
  });

  rl.on("close", () => { process.exitCode = 0; });
  // Destroy stdin too: the capped-input pipe keeps stdin flowing, so closing
  // readline alone no longer drains the event loop.
  process.on("SIGTERM", () => { process.exitCode = 0; process.stdin.destroy(); rl.close(); });
})().catch((e) => { console.error("FATAL: " + (e && e.message)); process.exit(1); });
