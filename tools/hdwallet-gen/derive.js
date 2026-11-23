// derive.js — derive a deposit address from an account xpub using Trust Wallet Core.
// Usage: echo "<xpub>" | node derive.js <chain> <index> [branch]
// chain: btc | eth | trx | ltc | doge | bsc | matic | arb | op | base | avax |
//   gnosis | celo | linea | mantle | scroll | opbnb | metis | aurora | fantom |
//   btc-change; index: 0..2147483647; branch: 0 (receiving, default) | 1 (change)
// The fifteen EVM chains share the Ethereum account key (m/44'/60'/0') and
// the Ethereum address: one EVM address is the same address on every EVM
// chain. LTC uses m/84'/2'/0' (Ltub), DOGE m/44'/3'/0' (dpub or dgub).
// TON and SOL have no xpub and are NOT supported here: their paths are
// fully hardened Ed25519, so one wallet has exactly one address — TON
// lives in derive-ton.js (public key only), SOL in the app's
// deriveAddresses (see apps/web/src/wallet/core.ts).
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
// input never reaches WASM. BTC/ETH/TRX/EVM xpubs share version 0488b21e, so
// an xpub carries no chain tag: cross-chain xpub misuse between those
// chains cannot be detected from serialisation alone. LTC (Ltub 019da462)
// and DOGE (dpub 02fda926, dgub 02facafd) have their own versions.
const { initWasm } = require("@trustwallet/wallet-core");
const { validateAccountKey, redact } = require("./extended-key");

const ALLOWED_CHAINS = new Set([
  "btc", "eth", "trx", "ltc", "doge",
  "bsc", "matic", "arb", "op", "base", "avax", "gnosis", "celo", "linea",
  "mantle", "scroll", "opbnb", "metis", "aurora", "fantom",
  "btc-change",
]);
const CHAINS = Object.assign(Object.create(null), {
  btc: (coin) => coin.bitcoin,
  eth: (coin) => coin.ethereum,
  trx: (coin) => coin.tron,
  ltc: (coin) => coin.litecoin,
  doge: (coin) => coin.dogecoin,
  bsc: (coin) => coin.smartChain,
  matic: (coin) => coin.polygon,
  arb: (coin) => coin.arbitrum,
  op: (coin) => coin.optimism,
  base: (coin) => coin.base,
  avax: (coin) => coin.avalancheCChain,
  gnosis: (coin) => coin.xdai,
  celo: (coin) => coin.celo,
  linea: (coin) => coin.linea,
  mantle: (coin) => coin.mantle,
  scroll: (coin) => coin.scroll,
  opbnb: (coin) => coin.opBNB,
  metis: (coin) => coin.metis,
  aurora: (coin) => coin.aurora,
  fantom: (coin) => coin.fantom,
  "btc-change": (coin) => coin.bitcoin,
});
// All fifteen EVM chains share the Ethereum m/44'/60' account path, so
// they share the derivation function; the CoinType above is what makes
// each chain's address encoding differ (in practice every EVM chain
// yields the same 0x address from the same account key).
const EVM_PATH = (branch, i) => `m/44'/60'/0'/${branch}/${i}`;
const PATHS = Object.assign(Object.create(null), {
  btc: (branch, i) => `m/84'/0'/0'/${branch}/${i}`,
  eth: EVM_PATH,
  trx: (branch, i) => `m/44'/195'/0'/${branch}/${i}`,
  ltc: (branch, i) => `m/84'/2'/0'/${branch}/${i}`,
  doge: (branch, i) => `m/44'/3'/0'/${branch}/${i}`,
  bsc: EVM_PATH,
  matic: EVM_PATH,
  arb: EVM_PATH,
  op: EVM_PATH,
  base: EVM_PATH,
  avax: EVM_PATH,
  gnosis: EVM_PATH,
  celo: EVM_PATH,
  linea: EVM_PATH,
  mantle: EVM_PATH,
  scroll: EVM_PATH,
  opbnb: EVM_PATH,
  metis: EVM_PATH,
  aurora: EVM_PATH,
  fantom: EVM_PATH,
  "btc-change": (branch, i) => `m/84'/0'/0'/1/${i}`,
});
// btc-change validates against the btc public-version allow-list: it is the
// same account zpub, only the branch differs. validateAccountKey knows no
// "btc-change" chain, so it must receive the base chain here. Every other
// chain validates against its own allow-list in extended-key.js.
const BASE_CHAIN = Object.assign(Object.create(null), {
  btc: "btc",
  eth: "eth",
  trx: "trx",
  ltc: "ltc",
  doge: "doge",
  bsc: "bsc",
  matic: "matic",
  arb: "arb",
  op: "op",
  base: "base",
  avax: "avax",
  gnosis: "gnosis",
  celo: "celo",
  linea: "linea",
  mantle: "mantle",
  scroll: "scroll",
  opbnb: "opbnb",
  metis: "metis",
  aurora: "aurora",
  fantom: "fantom",
  "btc-change": "btc",
});

(async () => {
  const [chain, indexRaw, branchRaw] = process.argv.slice(2);
  const MAX_INDEX = 2147483647;
  const USAGE = "usage: echo <xpub> | node derive.js <btc|eth|trx|ltc|doge|bsc|matic|arb|op|base|avax|gnosis|celo|linea|mantle|scroll|opbnb|metis|aurora|fantom|btc-change> <index> [branch]  (0 <= index <= 2147483647; branch 0 receiving, 1 change; default 0; btc-change takes no branch argument)";
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
  const validation = validateAccountKey(xpub, BASE_CHAIN[chain]);
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
