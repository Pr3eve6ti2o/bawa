// derive_daemon.js — persistent public-only Trust Wallet Core derivation daemon.
// JSONL request: {"chain":"btc|eth|trx","xpub":"...","index":5}
// Optional "branch": 0 (receiving, default) or 1 (change). Any other value
// is a bad request. The branch selects the BIP-44 change component only;
// purpose, coin type and account stay fixed per chain (M-41).
// JSONL response: {"ok":true,"address":"..."} or {"ok":false,"error":"..."}
// Startup: {"ready":true}
// Extended keys are validated via the shared module before any per-request WASM call.
const { initWasm } = require("@trustwallet/wallet-core");
const readline = require("readline");
const { Transform } = require("stream");
const { validateAccountKey, redact } = require("./extended-key");

const CHAINS = Object.create(null);
CHAINS.btc = (coin) => coin.bitcoin;
CHAINS.eth = (coin) => coin.ethereum;
CHAINS.trx = (coin) => coin.tron;

const PATHS = Object.create(null);
PATHS.btc = (branch, i) => `m/84'/0'/0'/${branch}/${i}`;
PATHS.eth = (branch, i) => `m/44'/60'/0'/${branch}/${i}`;
PATHS.trx = (branch, i) => `m/44'/195'/0'/${branch}/${i}`;

const ALLOWED_CHAINS = new Set(["btc", "eth", "trx"]);
const MAX_XPUB_LENGTH = 200;
const MAX_LINE_LENGTH = 4096;
const MAX_INDEX = 2147483647;

let replyRl = null;
let waitingForDrain = false;

function onStdoutDrain() {
  waitingForDrain = false;
  if (replyRl) replyRl.resume();
}

function reply(obj) {
  let flushed;
  try {
    flushed = process.stdout.write(JSON.stringify(obj) + "\n");
  } catch {
    // A synchronously failed write (e.g. a destroyed stdout stream)
    // must not become an uncaught exception; see the stdio error
    // handlers below.
    process.exit(1);
  }
  if (flushed) return;

  if (replyRl) replyRl.pause();
  if (waitingForDrain) return;

  waitingForDrain = true;
  process.stdout.once("drain", onStdoutDrain);
}

function fail(msg) {
  reply({ ok: false, error: redact(msg) });
}

// A broken stdio pipe must end the daemon cleanly, not crash it with an
// uncaught EPIPE exception (T45 F-T45-2). Exit 1, not 0: the daemon can
// no longer serve, so a supervisor with Restart=on-failure relaunches
// it — the same exit code the uncaught crash produced, minus the stack
// trace. No logging here: stderr may itself be broken, and logging to a
// broken stream can throw again. (Astra's re-audit suggested exit 0 for
// a peer disconnect; exit 1 was kept so the documented
// Restart=on-failure recovery model and the pre-existing exit code are
// unchanged — only the uncaught-exception crash is removed.)
process.stdout.on("error", () => process.exit(1));
process.stdin.on("error", () => process.exit(1));

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
        cappedLineBytes += (newline === -1 ? chunk.length : newline) - start;
        if (newline === -1) break;
        cappedLineBytes = 0;
        start = newline + 1;
      }
      if (cappedLineBytes > MAX_LINE_LENGTH) {
        cappedOverLimit = true;
        const rejectFragment = () => {
          fail("request too large");
          process.stdin.destroy();
          callback();
        };
        if (start === 0) return rejectFragment();

        // Readline may be paused for stdout backpressure, so wait for the
        // complete prefix to be consumed before rejecting the fragment.
        let prefixBytes = this.readableLength + start;
        const onPrefixData = (data) => {
          prefixBytes -= data.length;
          if (prefixBytes > 0) return;
          this.removeListener("data", onPrefixData);
          rejectFragment();
        };
        this.on("data", onPrefixData);
        this.push(chunk.subarray(0, start));
        return;
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
      if (Buffer.byteLength(line, "utf8") > MAX_LINE_LENGTH) return fail("request too large");
      if (!line.trim()) return fail("bad json");

      let req;
      try { req = JSON.parse(line); } catch { return fail("bad json"); }

      const { chain, xpub, index, branch: branchRaw } = req || {};
      // Branch defaults to receiving (0). Only the integers 0 and 1 are
      // accepted: a non-integer, out-of-range or wrong-type branch is a bad
      // request, never a silent receiving-branch default (M-41).
      const branch = branchRaw === undefined ? 0 : branchRaw;
      if (
        !ALLOWED_CHAINS.has(chain) ||
        typeof xpub !== "string" || !xpub.trim() || xpub.length > MAX_XPUB_LENGTH ||
        !Number.isInteger(index) || index < 0 || index > MAX_INDEX ||
        !Number.isInteger(branch) || (branch !== 0 && branch !== 1)
      ) return fail("bad request");

      const validation = validateAccountKey(xpub.trim(), chain);
      if (!validation.ok) return fail(validation.message);

      const coin = CHAINS[chain](core.CoinType);
      let pubkey;
      try {
        pubkey = core.HDWallet.getPublicKeyFromExtended(xpub.trim(), coin, PATHS[chain](branch, index));
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
  // SIGTERM must exit promptly even when stdout is blocked (F-11).
  // process.stdout.destroy() does NOT cancel a pending stdout write:
  // verified first-hand, stdout.destroyed stays false and the pending
  // WriteWrap keeps the event loop alive indefinitely when no client
  // drains the pipe — including writes below the highWaterMark, which
  // never set waitingForDrain. Exit directly; the pending write is to
  // a pipe nobody drains, so it can never complete.
  process.on("SIGTERM", () => {
    process.stdout.removeListener("drain", onStdoutDrain);
    process.stdin.destroy();
    rl.close();
    process.exit(0);
  });
})().catch((e) => { console.error("FATAL: " + (e && e.message)); process.exit(1); });
