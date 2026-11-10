// compare.js — address comparison helper intended for extended public keys.
// Reads XPUB_BTC/ETH/TRX from the file selected by BAWA_ENV_FILE, or the repository-root .env by default.
// NOVA_ENV is a deprecated alias for BAWA_ENV_FILE (warned fallback; both set to different values refuses).
// Prints public addresses only. Private, bad-checksum, bad-version and
// version-detectable wrong-chain inputs are rejected before WASM.
// BTC/ETH/TRX xpubs share version 0488b21e, so an xpub carries no chain tag.
const { initWasm } = require("@trustwallet/wallet-core");
const fs = require("fs");
const path = require("path");
const { validateExtendedKey, redact } = require("./extended-key");

const MAX_ENV_BYTES = 65536;
const MAX_LINE_CHARS = 1024;
const MAX_VALUE_CHARS = 200;

// Canonical name BAWA_ENV_FILE; NOVA_ENV is accepted during the
// compatibility window with a deprecation warning. Both names set to
// different values refuses to run. Diagnostics name variables only,
// never values. (F-15; same guarded-migration shape as
// BAWA_SECRETS_DIR in tools/make_wallet.py.)
function resolveEnvPath() {
  const fresh = process.env.BAWA_ENV_FILE;
  const legacy = process.env.NOVA_ENV;
  const has = (value) => typeof value === "string" && value.length > 0;
  if (has(fresh) && has(legacy)) {
    if (fresh !== legacy) {
      throw new Error("conflicting env files: BAWA_ENV_FILE and NOVA_ENV are both set to different values; set only one");
    }
    console.error("warning: NOVA_ENV is deprecated; use BAWA_ENV_FILE");
    return fresh;
  }
  if (has(fresh)) return fresh;
  if (has(legacy)) {
    console.error("warning: NOVA_ENV is deprecated; use BAWA_ENV_FILE");
    return legacy;
  }
  return path.join(__dirname, "..", "..", ".env");
}

// Read at most maxBytes bytes; refuse when the file is longer. A stat
// size check alone does not bound the read (F-08): special files such
// as /dev/zero report size 0 while yielding bytes indefinitely.
function readFileCapped(filePath, maxBytes) {
  const fd = fs.openSync(filePath, "r");
  try {
    const chunks = [];
    let total = 0;
    const buffer = Buffer.alloc(8192);
    for (;;) {
      const n = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (n === 0) break;
      total += n;
      if (total > maxBytes) {
        throw new Error(`env file exceeds ${maxBytes} bytes: ${filePath}`);
      }
      chunks.push(Buffer.from(buffer.subarray(0, n)));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function addrFromXpub(core, xpub, coin, fullPath) {
  const pubkey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, fullPath);
  try {
    return core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
  } finally {
    pubkey.delete();
  }
}

(async () => {
  const envPath = resolveEnvPath();
  const env = {};
  // Split on CRLF as well as LF (F-07): a trailing CR made the
  // assignment regex fail, so a CRLF file reported a misleading
  // "missing xpub" for a key that was present in the file.
  const lines = readFileCapped(envPath, MAX_ENV_BYTES).split(/\r\n|\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // Over-long lines and values fail loudly (F-06): silently skipping
    // them kept a stale key from an earlier line in force while the
    // operator believed the replacement applied.
    if (line.length > MAX_LINE_CHARS) {
      throw new Error(`env file line ${index + 1} exceeds ${MAX_LINE_CHARS} characters`);
    }
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) {
      const value = m[2].trim();
      if (value.length > MAX_VALUE_CHARS) {
        throw new Error(`env file line ${index + 1} value for ${m[1]} exceeds ${MAX_VALUE_CHARS} characters`);
      }
      env[m[1]] = value;
    }
  }
  // Validate every input before initialising WASM or deriving any addresses.
  for (const [chain, xpub] of [
    ["btc", env.XPUB_BTC],
    ["eth", env.XPUB_ETH],
    ["trx", env.XPUB_TRX],
  ]) {
    if (!xpub) throw new Error(`missing ${chain} xpub in ${envPath}`);
    const validation = validateExtendedKey(xpub, chain);
    if (!validation.ok) throw new Error(`${chain}: ${validation.message}`);
  }

  const core = await initWasm();
  const { CoinType } = core;
  const jobs = [
    ["btc", env.XPUB_BTC, CoinType.bitcoin, i => `m/84'/0'/0'/0/${i}`],
    ["eth", env.XPUB_ETH, CoinType.ethereum, i => `m/44'/60'/0'/0/${i}`],
    ["trx", env.XPUB_TRX, CoinType.tron, i => `m/44'/195'/0'/0/${i}`],
  ];
  const results = [];
  for (const [chain, xpub, coin, pathFn] of jobs) {
    const addrs = [0, 1, 2].map(i => addrFromXpub(core, xpub, coin, pathFn(i)));
    results.push([chain, addrs]);
  }
  for (const [chain, addrs] of results) {
    console.log(chain, ...addrs);
  }
})().catch(e => {
  console.error("FATAL: " + redact(e.message));
  process.exit(1);
});
