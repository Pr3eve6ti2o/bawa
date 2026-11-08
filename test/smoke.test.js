// Bawa smoke test — public outputs only. Run via `npm test` from
// tools/hdwallet-gen (package.json: node ../../test/smoke.test.js).
//
// Fixtures are PUBLIC material only:
// - The three account xpubs below are the extended PUBLIC keys derived from
//   the repo's own published test-vector mnemonic (the same vector shipped in
//   tools/hdwallet-gen/generate.js and test/differential_test.py). No
//   mnemonic, seed, or private key appears in this file.
// - Every expected address was verified against TWO independent
//   implementations: Trust Wallet Core (WASM) and Python bip_utils 2.12.2.
//   BTC/ETH index 0 match the repo's published fixtures; index 1 and both
//   TRX addresses match bip_utils exactly.
// - TON has no watch-only derivation in Bawa (generation-only, single deposit
//   address, no xpub); the policy guard below asserts no TON derivation path
//   exists in the watch-only tools.
//
// Any failure exits non-zero. Nothing here touches the network.
"use strict";

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TOOLS_DIR = path.join(__dirname, "..", "tools", "hdwallet-gen");
const { initWasm } = require(path.join(TOOLS_DIR, "node_modules", "@trustwallet", "wallet-core"));

const FIXTURES = {
  btc: {
    xpub: "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9",
    0: "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd",
    1: "bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za",
    coin: "bitcoin",
    path: (i) => `m/84'/0'/0'/0/${i}`,
  },
  eth: {
    xpub: "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc",
    0: "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7",
    1: "0xD6c3112a8Db4991a7359018F15e501dfEE316d59",
    coin: "ethereum",
    path: (i) => `m/44'/60'/0'/0/${i}`,
  },
  trx: {
    xpub: "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF",
    0: "TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c",
    1: "TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B",
    coin: "tron",
    path: (i) => `m/44'/195'/0'/0/${i}`,
  },
};

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok - ${name}`);
  } else {
    failures++;
    console.log(`FAIL - ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function deriveFromXpub(core, xpub, coin, fullPath) {
  const pubkey = core.HDWallet.getPublicKeyFromExtended(xpub, coin, fullPath);
  try {
    return core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey);
  } finally {
    pubkey.delete();
  }
}

function runCli(script, args, stdinData) {
  const r = spawnSync(process.execPath, [path.join(TOOLS_DIR, script), ...args], {
    input: stdinData,
    encoding: "utf8",
    timeout: 60000,
  });
  return r;
}

async function testDaemon() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(TOOLS_DIR, "derive_daemon.js")], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buf = "";
    let stage = 0;
    const timer = setTimeout(() => {
      check("daemon responds within timeout", false, "timed out");
      child.kill();
      resolve();
    }, 60000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          check("daemon emits valid JSONL", false, line.slice(0, 80));
          continue;
        }
        if (stage === 0) {
          check("daemon startup reports ready", msg.ready === true, JSON.stringify(msg));
          stage = 1;
          child.stdin.write(JSON.stringify({ chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 }) + "\n");
        } else if (stage === 1) {
          check("daemon derives BTC index 0", msg.ok === true && msg.address === FIXTURES.btc[0], JSON.stringify(msg));
          stage = 2;
          child.stdin.write(JSON.stringify({ chain: "nope", xpub: FIXTURES.btc.xpub, index: 0 }) + "\n");
        } else if (stage === 2) {
          check("daemon rejects unknown chain", msg.ok === false, JSON.stringify(msg));
          clearTimeout(timer);
          child.kill();
          resolve();
        }
      }
    });
    child.on("error", (e) => {
      check("daemon spawns", false, e.message);
      clearTimeout(timer);
      resolve();
    });
  });
}

(async () => {
  const core = await initWasm();
  const { CoinType, CoinTypeExt } = core;

  // 1. Direct derivation from published xpubs matches independent fixtures.
  for (const [chain, fx] of Object.entries(FIXTURES)) {
    const coin = CoinType[fx.coin];
    for (const index of [0, 1]) {
      const addr = deriveFromXpub(core, fx.xpub, coin, fx.path(index));
      check(`${chain} index ${index} derives expected address`, addr === fx[index], addr);
      check(`${chain} index ${index} address validates`, CoinTypeExt.validate(coin, addr));
    }
  }
  // 2. Address-format guards (fail loudly if a format ever changes shape).
  check("btc addresses are bech32 segwit", FIXTURES.btc[0].startsWith("bc1q") && FIXTURES.btc[1].startsWith("bc1q"));
  check("eth addresses are 0x + 40 hex", /^0x[0-9a-fA-F]{40}$/.test(FIXTURES.eth[0]) && /^0x[0-9a-fA-F]{40}$/.test(FIXTURES.eth[1]));
  check("trx addresses are T + 33 base58 chars", /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(FIXTURES.trx[0]) && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(FIXTURES.trx[1]));

  // 3. derive.js CLI end to end (public xpub on stdin, address on stdout).
  for (const [chain, fx] of Object.entries(FIXTURES)) {
    const r = runCli("derive.js", [chain, "0"], fx.xpub + "\n");
    check(`derive.js ${chain} CLI exit 0 and prints expected address`, r.status === 0 && r.stdout.trim() === fx[0], `status=${r.status} out=${r.stdout.trim()} err=${(r.stderr || "").trim().slice(0, 120)}`);
  }
  // 4. derive.js input guards (all must refuse with exit 2, never derive).
  const badChain = runCli("derive.js", ["ton", "0"], FIXTURES.btc.xpub + "\n");
  check("derive.js rejects TON (no watch-only TON derivation)", badChain.status === 2, `status=${badChain.status}`);
  const badIndex = runCli("derive.js", ["btc", "-1"], FIXTURES.btc.xpub + "\n");
  check("derive.js rejects negative index", badIndex.status === 2, `status=${badIndex.status}`);
  const emptyXpub = runCli("derive.js", ["btc", "0"], "\n");
  check("derive.js rejects empty xpub", emptyXpub.status === 2, `status=${emptyXpub.status}`);

  // 5. Watch-only policy guard: the three documented paths exist in both
  // watch-only tools, and no TON derivation path exists in either.
  for (const script of ["derive.js", "derive_daemon.js"]) {
    const src = fs.readFileSync(path.join(TOOLS_DIR, script), "utf8");
    check(`${script} carries BTC/ETH/TRX paths`,
      src.includes("m/84'/0'/0'/0/${i}") && src.includes("m/44'/60'/0'/0/${i}") && src.includes("m/44'/195'/0'/0/${i}"));
    check(`${script} carries no TON derivation path`, !src.includes("m/44'/607'"));
  }

  // 6. Daemon JSONL protocol.
  await testDaemon();

  if (failures > 0) {
    console.log(`SMOKE TESTS FAILED: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("SMOKE TESTS PASSED");
})().catch((e) => {
  console.error("SMOKE TESTS FAILED with exception: " + (e && e.message));
  process.exit(1);
});
