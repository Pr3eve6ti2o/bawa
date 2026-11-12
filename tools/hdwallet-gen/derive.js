// derive.js — derive a deposit address from an account xpub using Trust Wallet Core.
// Usage: echo "<xpub>" | node derive.js <chain> <index> [branch]
// chain: btc | eth | trx | btc-change; index: 0..2147483647; branch: 0 (receiving, default) | 1 (change)
// btc-change derives the BTC change branch m/84'/0'/0'/1/<index> (M-27):
// watch-only only, same account zpub as btc, no signing, no private input.
// A bare BTC address carries no branch marker, so btc-change also prints
// the branch to stderr: stdout stays a bare address for scripts, and the
// stderr line is the marker that the address is a change address.
// ETH and TRX have no change branch: there is no eth-change or trx-change mode.
// (btc-change takes no [branch] argument: it always selects branch 1.)
// The branch selects the BIP-44 change component only; purpose, coin type and
// account stay fixed per chain (M-41: change-branch discovery). Any other
// branch value is a usage error, never a silent default.
// Extended-key validation (Base58Check checksum, private-key and
// per-chain version checks) happens BEFORE WASM initialisation, so invalid
// input never reaches WASM. BTC/ETH/TRX xpubs share version 0488b21e, so an
// xpub carries no chain tag: cross-chain xpub misuse between those three
// cannot be detected from serialisation alone.
const { initWasm } = require("@trustwallet/wallet-core");
const { validateExtendedKey, redact } = require("./extended-key");

const ALLOWED_CHAINS = new Set(["btc", "eth", "trx", "btc-change"]);
const CHAINS = Object.assign(Object.create(null), {
  btc: (coin) => coin.bitcoin,
  eth: (coin) => coin.ethereum,
  trx: (coin) => coin.tron,
  "btc-change": (coin) => coin.bitcoin,
});
const PATHS = Object.assign(Object.create(null), {
  btc: (branch, i) => `m/84'/0'/0'/${branch}/${i}`,
  eth: (branch, i) => `m/44'/60'/0'/${branch}/${i}`,
  trx: (branch, i) => `m/44'/195'/0'/${branch}/${i}`,
  "btc-change": (branch, i) => `m/84'/0'/0'/1/${i}`,
});
// btc-change validates against the btc public-version allow-list: it is the
// same account zpub, only the branch differs. validateExtendedKey knows no
// "btc-change" chain, so it must receive the base chain here.
const BASE_CHAIN = Object.assign(Object.create(null), {
  btc: "btc",
  eth: "eth",
  trx: "trx",
  "btc-change": "btc",
});

(async () => {
  const [chain, indexRaw, branchRaw] = process.argv.slice(2);
  const MAX_INDEX = 2147483647;
  const USAGE = "usage: echo <xpub> | node derive.js <btc|eth|trx|btc-change> <index> [branch]  (0 <= index <= 2147483647; branch 0 receiving, 1 change; default 0; btc-change takes no branch argument)";
  // Validate arguments BEFORE reading stdin (F-35): invalid arguments
  // must fail with the usage error immediately, not wait for stdin EOF.
  if (typeof indexRaw !== "string" || !/^[0-9]+$/.test(indexRaw)) {
    console.error(USAGE);
    process.exit(2);
  }
  const index = Number(indexRaw);
  if (!ALLOWED_CHAINS.has(chain) || !Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
    console.error(USAGE);
    process.exit(2);
  }
  // Branch is a single character, 0 or 1. Anything else (including "01",
  // "2", "-1", "1.0") is a usage error, never a silent receiving-branch
  // default: a wrong branch silently deriving receiving addresses would
  // hide change funds from discovery (M-41).
  let branch = 0;
  if (branchRaw !== undefined) {
    if (!/^[01]$/.test(branchRaw)) {
      console.error(USAGE);
      process.exit(2);
    }
    branch = Number(branchRaw);
  }
  if (chain === "btc-change" && branchRaw !== undefined) {
    console.error(USAGE);
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
    console.error(USAGE);
    process.exit(2);
  }
  const validation = validateExtendedKey(xpub, BASE_CHAIN[chain]);
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
    pubkey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, PATHS[chain](branch, index));
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
  if (chain === "btc-change") {
    // Branch marker (P02c review): a bare address does not encode its
    // branch, so the change address could be mistaken for a receiving
    // address. stdout stays bare for scripts; stderr carries the marker.
    console.error("change branch m/84'/0'/0'/1/" + index + " — watch-only change address, not a receiving address");
  }
  console.log(addr);
})().catch((e) => { console.error("FATAL: " + redact(e && e.message)); process.exit(1); });
