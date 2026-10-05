// compare.js — public-only derivation comparison helper.
// Reads .env from repository root and prints public addresses only.
const { initWasm } = require("@trustwallet/wallet-core");
const fs = require("fs");
const path = require("path");

const envPath = process.env.NOVA_ENV || path.join(__dirname, "..", "..", ".env");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
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
  const core = await initWasm();
  const { CoinType } = core;
  const jobs = [
    ["btc", env.XPUB_BTC, CoinType.bitcoin, i => \`m/84'/0'/0'/0/\${i}\`],
    ["eth", env.XPUB_ETH, CoinType.ethereum, i => \`m/44'/60'/0'/0/\${i}\`],
    ["trx", env.XPUB_TRX, CoinType.tron, i => \`m/44'/195'/0'/0/\${i}\`],
  ];
  for (const [chain, xpub, coin, pathFn] of jobs) {
    if (!xpub) throw new Error(\`missing \${chain} xpub in \${envPath}\`);
    const addrs = [0, 1, 2].map(i => addrFromXpub(core, xpub, coin, pathFn(i)));
    console.log(chain, ...addrs);
  }
})().catch(e => { console.error("FATAL: " + e.message); process.exit(1); });
