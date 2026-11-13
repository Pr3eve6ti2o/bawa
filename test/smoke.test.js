// test/smoke.test.js — repository-level invariant checks (public vectors only).
// These are deliberately not presented as proof of cryptographic correctness.
// Full vector and cross-implementation testing is still part of professional
// release work. Run via `npm test` in tools/hdwallet-gen (CI installs the
// Node dependencies first). Uses only the public regression mnemonic.
"use strict";
const assert = require("node:assert");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");

const TOOLS = path.join(__dirname, "..", "tools", "hdwallet-gen");
const WC = path.join(TOOLS, "node_modules", "@trustwallet", "wallet-core");
const VEC_MNEMONIC = "ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal";
const VEC_BTC = "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd";
const VEC_ETH = "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7";

async function main() {
  const { initWasm } = require(WC);
  const core = await initWasm();
  // 1. The installed wallet-core matches the version pinned in package.json.
  const pinned = require(path.join(TOOLS, "package.json")).dependencies["@trustwallet/wallet-core"];
  const installed = require(path.join(WC, "package.json")).version;
  assert.strictEqual(installed, pinned, "installed wallet-core " + installed + " != pinned " + pinned);
  // 2. Public-vector checks (same fixtures as generate.js / differential_test.py).
  const { HDWallet, CoinType, CoinTypeExt, Purpose, Derivation, HDVersion } = core;
  const v = HDWallet.createWithMnemonic(VEC_MNEMONIC, "");
  assert.strictEqual(v.getAddressForCoin(CoinType.bitcoin), VEC_BTC);
  assert.strictEqual(v.getAddressForCoin(CoinType.ethereum), VEC_ETH);
  const zpub = v.getExtendedPublicKeyAccount(Purpose.bip84, CoinType.bitcoin, Derivation.bitcoinSegwit, HDVersion.zpub, 0);
  assert.ok(zpub.startsWith("zpub"));
  const pubkey = core.HDWallet.getPublicKeyFromExtended(zpub, CoinType.bitcoin, "m/84'/0'/0'/0/0");
  let addr;
  try {
    addr = CoinTypeExt.deriveAddressFromPublicKey(CoinType.bitcoin, pubkey);
  } finally {
    pubkey.delete();
  }
  assert.strictEqual(addr, VEC_BTC);
  const ethXpub = v.getExtendedPublicKeyAccount(Purpose.bip44, CoinType.ethereum, Derivation.default, HDVersion.xpub, 0);
  v.delete();
  // 3. derive.js one-shot derivation over stdin, plus its rejections.
  const run = (args, input) => spawnSync(process.execPath, [path.join(TOOLS, "derive.js"), ...args], { input, encoding: "utf8" });
  let r = run(["btc", "0"], zpub + "\n");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), VEC_BTC);
  r = run(["eth", "0"], ethXpub + "\n");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), VEC_ETH);
  r = run(["btc", "0"], "not-an-xpub\n");
  assert.notStrictEqual(r.status, 0, "derive.js must reject a malformed xpub");
  r = run(["zzz", "0"], zpub + "\n");
  assert.notStrictEqual(r.status, 0, "derive.js must reject an unknown chain");
  // 4. derive_daemon.js answers one JSONL request, then rejects bad JSON.
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(TOOLS, "derive_daemon.js")], { stdio: ["pipe", "pipe", "pipe"] });
    const lines = [];
    let buf = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("daemon timed out")); }, 30000);
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) !== -1) {
        lines.push(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
      if (lines.length === 1) {
        assert.deepStrictEqual(JSON.parse(lines[0]), { ready: true });
        child.stdin.write(JSON.stringify({ chain: "eth", xpub: ethXpub, index: 0 }) + "\n");
        child.stdin.write("not json\n");
      } else if (lines.length >= 3) {
        clearTimeout(timer);
        assert.deepStrictEqual(JSON.parse(lines[1]), { ok: true, address: VEC_ETH });
        assert.strictEqual(JSON.parse(lines[2]).ok, false);
        child.kill();
        resolve();
      }
    });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
  console.log("smoke checks: PASS");
}

main().catch((e) => {
  console.error("smoke checks: FAIL: " + (e && e.message));
  process.exit(1);
});
