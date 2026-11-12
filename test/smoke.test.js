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
// - TON watch-only derivation is tools/hdwallet-gen/derive-ton.js: a
//   single V4 R2 address from a 32-byte Ed25519 public key (no xpub, no
//   index — the account path m/44'/607'/0' is fully hardened). The policy
//   guard below asserts no TON derivation path exists in the xpub tools
//   (derive.js, derive_daemon.js).
//
// Any failure exits non-zero. Nothing here touches the network.
"use strict";

const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const TOOLS_DIR = path.join(__dirname, "..", "tools", "hdwallet-gen");
const { initWasm } = require(path.join(TOOLS_DIR, "node_modules", "@trustwallet", "wallet-core"));

const FIXTURES = {
  btc: {
    xpub: "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9",
    0: "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd",
    1: "bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za",
    // Change branch (branch 1) index 0, verified against bip_utils 2.12.2
    // from the public xpub above (T14, M-41). Receiving index 1 has real
    // mainnet history (2 txs); change index 0 has none (2026-11-12 check).
    c0: "bc1qx3hncnu3lknuejrmzse4nf2yjwpaskgn6tpnve",
    coin: "bitcoin",
    path: (i) => `m/84'/0'/0'/0/${i}`,
    changePath: (i) => `m/84'/0'/0'/1/${i}`,
  },
  eth: {
    xpub: "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc",
    0: "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7",
    1: "0xD6c3112a8Db4991a7359018F15e501dfEE316d59",
    c0: "0x01183125aF0c91eA24E4E7066D87B7564fb08aF5",
    coin: "ethereum",
    path: (i) => `m/44'/60'/0'/0/${i}`,
    changePath: (i) => `m/44'/60'/0'/1/${i}`,
  },
  trx: {
    xpub: "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF",
    0: "TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c",
    1: "TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B",
    c0: "TT2z3TvN2brZ19x826SAFdUCxYPEnkmZKF",
    coin: "tron",
    path: (i) => `m/44'/195'/0'/0/${i}`,
    changePath: (i) => `m/44'/195'/0'/1/${i}`,
  },
};

// TON watch-only fixture: PUBLIC material only. The public key is the
// Ed25519 account public key at m/44'/607'/0' for the repo's own published
// test-vector mnemonic; the expected address is the published V4 R2
// fixture (wallet ID 698983191), independently verified against
// @ton/ton 16.3.0 WalletContractV4 (workchain 0). No mnemonic, seed or
// private key appears in this file. Never fund the fixture address: the
// mnemonic is public.
const TON_FIXTURE = {
  pubkeyHex: "c8aeb00a8adb5879a58d031af01d6031fb743e1971a679c6ecea1354f022d0c9",
  address: "UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn",
};

// Published test vectors, never for funds.
const NEGATIVE = {
  INVALID_POINT_XPUB: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEgAeZQboMtDL9SK3y1FCbzvT2RNhXd5KBJDrFehG9Goe8ZB39VV",
  POINT_X_EQ_P: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEgAeZQboMtDL9SK3y1FCbzvT2RNhXd5KBJDrFehFQTHQfokME85",
  POINT_X_EQ_P_MINUS_1: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEgAeZQboMtDL9SK3y1FCbzvT2RNhXd5KBJDrFehFQTHQfgQLwyn",
  POINT_X_EQ_5: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEeDuPB9mWTY71cjM4RdCegKg7JkysvESPf9k1W1N9coFecKmneJ",
  POINT_X_EQ_1: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEeDuPB9mWTY71cjM4RdCegKg7JkysvESPf9k1W1N9coFe7ZepUb",
  POINT_X_EQ_0: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEeDuPB9mWTY71cjM4RdCegKg7JkysvESPf9k1W1N9coFe5gztYV",
  G_XPUB: "xpub661MyMwAqRbcEiHjdqucEvuyGAa8tYnEKNxRSHb554CQxfEJMwdTpYQHEf9XATYJ8eE5X1sSzitcy4JHC4dEYaPh8yfgqXzyRXqHa3Zxjpg",
  DEPTH0_FINGERPRINT: "xpub661MyMwTWkfYbGsHSkBPfK8hV3UhGjbN4hYBHFNRsZRFaUa3Eg5jKNwq1HMHBXDCDy9zSQTnhJgVAJY3gs8sTpDdrNWrHzwdEoY7Lf6dzxA",
  DEPTH0_CHILD: "xpub661MyMwAqRbcHG7iAofhFTywCv8fdScxFvDJvpPZrQfnYjTChfcdCM7UWu179f4DmYcB4d3xuhXR1fFqeykXjsYQFQ9WHho2G6GX5dSHoAV",
  TV1_XPRV: "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi",
  ZPRV: "zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE",
  TV5_BAD: "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL",
  TV5_VER: "xpub661MyMwAqRbcEYS8w7XLSVeEsBXy79zSzH1J8vCdxAZningWLdN3zgtU6LBpB85b3D2yc8sfvZU521AAwdZafEz7mnzBBsz4wKY5fTtTQBm",
  // T40-F2: the two further documented private versions (0295b005,
  // 02aa7a99) re-versioned from the ETH fixture with the same key data.
  VER_0295B005: "YprvAUcRCyQ3qDCdyfFffou2tZLydpCn5NWe8YhoeoBGhyfK833zgehK7d972cxHm7HTEbjC2XT68GhGxdVbiWQ5jER4GR2egAtGcgBtB4bVYDG",
  VER_02AA7A99: "ZprvAoSgWe4xytk7pxSnWAgf6eSUonME1zW93fE2SC5A5z3CB8sDwJrsjgoF3pusm1wNeEqzn13eaw3pqv7ASCp6XU6f8kj5G5hktQFXZczz4kw",
  ZPUB84: "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs",
  ETH_BAD_CHECKSUM: "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumd",
  // T45 F-T45-1: the fixture BTC zpub re-serialised with altered metadata
  // (same key bytes, valid checksum). DEPTH4 is a depth-4 key, CHILD1 is
  // depth 3 with a non-hardened child number, FP0 is depth 3 with a
  // zeroed parent fingerprint. All are published-fixture derivations;
  // none is a live key.
  DEPTH4_ZPUB: "zpub6tFcEgUKSnQzcFPsmVysxL1vYiDfSrez7cyck8yvKRTtSdwzGcoPVAGZeGCWTMyC2j6KMR5trBBk1jG5m7jyBM3158Eq9LL48ziLdu8iQaN",
  DEPTH3_CHILD1_ZPUB: "zpub6rNUNtxJEUjzo2bPGUHCejKYhEsFV2PFzG76roukRqaMboE5a4HD5HQAAvnFhd5eiw3GFxJhW7cUNrjLMg6yKE5n6ttiuApu9pp86QsUfbr",
  DEPTH3_FP0_ZPUB: "zpub6qKJA3qD7NEXinvr8asbSfpC53RQfkFHL5U9QZQHo5Uh6NDZUQAWN5ty5YoVKgqdBKxoRvbgTQQsXFAp8CpDbboZCcJtmgm8ash5ufyU25Y",
  // T45 F-T45-1: a REAL account-1 BTC xpub (m/84'/0'/1') derived from the
  // repo's published test-vector mnemonic with bip_utils 2.12.2. Its
  // index-0 address is bc1qn5edktucrclgejfrs9wffyy50uqfuad2ylshtd — a real
  // account-1 address, not the account-0 fixture address. Public test
  // material only; never for funds.
  ACCOUNT1_XPUB: "xpub6ChwmZccGnC1FUwqLgw4d3rA3C6vzMgVBGPVKiNhT7WPjXdGSuVCXgmPGT5hAdRtsTuGHkAEXJaTVWRaSy9qoHme3MSSXTsvzwgNkNFmZsf",
};

function runCompare(envText) {
  const tempDir = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "oi-096-compare-")
  );
  const envFile = path.join(tempDir, "fixtures.env");

  try {
    fs.writeFileSync(envFile, envText, {
      encoding: "utf8",
      mode: 0o600,
    });
    return spawnSync(
      process.execPath,
      [path.join(TOOLS_DIR, "compare.js")],
      {
        cwd: TOOLS_DIR,
        env: { ...process.env, BAWA_ENV_FILE: envFile },
        timeout: 60_000,
        encoding: "utf8",
      }
    );
  } finally {
    // Remove the temporary env file and its directory.
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function timedRunCli(script, args, stdinData) {
  const started = process.hrtime.bigint();
  const result = runCli(script, args, stdinData);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { result, ms };
}

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

// M-41: the daemon accepts an optional branch (0 receiving default, 1 change)
// and rejects any other branch value without deriving.
async function testDaemonBranch() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(TOOLS_DIR, "derive_daemon.js")], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buf = "";
    let stage = 0;
    const timer = setTimeout(() => {
      check("daemon branch test responds within timeout", false, "timed out");
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
          check("daemon branch test emits valid JSONL", false, line.slice(0, 80));
          continue;
        }
        if (stage === 0) {
          check("daemon branch test startup reports ready", msg.ready === true, JSON.stringify(msg));
          stage = 1;
          child.stdin.write(JSON.stringify({ chain: "btc", xpub: FIXTURES.btc.xpub, index: 0, branch: 1 }) + "\n");
        } else if (stage === 1) {
          check("daemon derives BTC change index 0", msg.ok === true && msg.address === FIXTURES.btc.c0, JSON.stringify(msg));
          stage = 2;
          child.stdin.write(JSON.stringify({ chain: "eth", xpub: FIXTURES.eth.xpub, index: 0 }) + "\n");
        } else if (stage === 2) {
          check("daemon defaults to receiving branch when branch omitted", msg.ok === true && msg.address === FIXTURES.eth[0], JSON.stringify(msg));
          stage = 3;
          child.stdin.write(JSON.stringify({ chain: "btc", xpub: FIXTURES.btc.xpub, index: 0, branch: 2 }) + "\n");
        } else if (stage === 3) {
          check("daemon rejects branch 2", msg.ok === false, JSON.stringify(msg));
          stage = 4;
          child.stdin.write(JSON.stringify({ chain: "btc", xpub: FIXTURES.btc.xpub, index: 0, branch: "1" }) + "\n");
        } else if (stage === 4) {
          check("daemon rejects string branch", msg.ok === false, JSON.stringify(msg));
          clearTimeout(timer);
          child.kill();
          resolve();
        }
      }
    });
    child.on("error", (e) => {
      check("daemon branch test spawns", false, e.message);
      clearTimeout(timer);
      resolve();
    });
  });
}

async function testDaemonPrivateRejection() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(TOOLS_DIR, "derive_daemon.js")],
      {
        cwd: TOOLS_DIR,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let finished = false;
    let ready = false;
    let stdoutBuffer = "";
    let stderr = "";

    const timer = setTimeout(() => {
      finish(
        false,
        `timed out after 60 s waiting for ${
          ready ? "a rejection reply" : "ready"
        }; stderr=${stderr}`
      );
    }, 60_000);

    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      check("derive_daemon.js rejects a private extended key", cond, detail);
      child.kill();
      resolve();
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish(false, `daemon spawn error: ${error.message}`);
    });

    child.stdin.on("error", (error) => {
      finish(false, `daemon stdin error: ${error.message}`);
    });

    child.on("close", (code, signal) => {
      finish(
        false,
        `daemon closed before rejection: status=${code}, signal=${signal}; stderr=${stderr}`
      );
    });

    child.stdout.on("data", (chunk) => {
      if (finished) return;
      stdoutBuffer += chunk;

      let newline;
      while (!finished && (newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line === "") continue;

        let message;
        try {
          message = JSON.parse(line);
        } catch (error) {
          finish(false, `invalid JSONL on daemon stdout: ${error.message}`);
          return;
        }

        if (!ready) {
          if (!message || message.ready !== true) {
            finish(false, "expected a ready message before sending the request");
            return;
          }

          ready = true;
          child.stdin.write(
            JSON.stringify({
              chain: "btc",
              xpub: NEGATIVE.ZPRV,
              index: 0,
            }) + "\n"
          );
          continue;
        }

        finish(
          message !== null &&
            typeof message === "object" &&
            message.ok === false &&
            typeof message.error === "string" &&
            message.error.includes("extended public key required"),
          line
        );
      }
    });
  });
}

// Check daemon validation and recovery through one sequential JSONL session.
async function testDaemonDefects() {
  return new Promise((resolve) => {
    const steps = [
      {
        name: "daemon rejects TV1 xprv",
        request: { chain: "btc", xpub: NEGATIVE.TV1_XPRV, index: 0 },
        error: "extended public key required"
      },
      {
        name: "daemon rejects version-mismatch xpub",
        request: { chain: "btc", xpub: NEGATIVE.TV5_VER, index: 0 },
        error: "extended public key required"
      },
      {
        name: "daemon rejects bad-checksum xprv",
        request: { chain: "btc", xpub: NEGATIVE.TV5_BAD, index: 0 },
        error: "checksum"
      },
      {
        name: "daemon rejects bad-checksum ETH xpub",
        request: { chain: "eth", xpub: NEGATIVE.ETH_BAD_CHECKSUM, index: 0 },
        error: "checksum",
        fastName: "daemon rejects bad-checksum ETH xpub fast"
      },
      {
        name: "daemon rejects BTC zpub as eth",
        request: { chain: "eth", xpub: NEGATIVE.ZPUB84, index: 0 },
        error: "not allowed for eth"
      },
      {
        name: "daemon rejects BTC zpub as trx",
        request: { chain: "trx", xpub: NEGATIVE.ZPUB84, index: 0 },
        error: "not allowed for trx"
      },
      {
        name: "daemon derives BTC index 0 after bad requests",
        request: { chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 },
        address: FIXTURES.btc[0]
      },
      {
        name: "daemon derives ETH index 0 after bad requests",
        request: { chain: "eth", xpub: FIXTURES.eth.xpub, index: 0 },
        address: FIXTURES.eth[0]
      },
      {
        name: "daemon derives TRX index 0 after bad requests",
        request: { chain: "trx", xpub: FIXTURES.trx.xpub, index: 0 },
        address: FIXTURES.trx[0]
      },
      {
        name: "daemon stays up and derives BTC index 1 after bad requests",
        request: { chain: "btc", xpub: FIXTURES.btc.xpub, index: 1 },
        address: FIXTURES.btc[1]
      }
    ];

    let child;
    let stdout = "";
    let stderr = "";
    let ready = false;
    let finished = false;
    let childClosed = false;
    let teardownTimer = null;
    let teardownCond = false;
    let teardownDetail;
    let current = 0;
    let sentAt;

    const timer = setTimeout(() => {
      finish(false, "daemon timed out after 60 s");
    }, 60000);

    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      teardownCond = cond;
      teardownDetail = detail;

      // An aborted run fails each outstanding expectation exactly once.
      if (!cond) {
        for (; current < steps.length; current += 1) {
          const step = steps[current];
          check(step.name, false, detail);
          if (step.fastName) check(step.fastName, false, detail);
        }
      }

      // An early close is finalized by the close handler already running.
      if (childClosed || !child) return;

      if (child.stdin) child.stdin.end();
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
      }

      teardownTimer = setTimeout(() => {
        if (
          !childClosed &&
          child.exitCode === null &&
          child.signalCode === null
        ) {
          child.kill("SIGKILL");
        }
      }, 5000);
    }

    function sendNext() {
      if (finished) return;
      if (current === steps.length) {
        finish(true);
        return;
      }

      try {
        const payload = JSON.stringify(steps[current].request) + "\n";
        sentAt = process.hrtime.bigint();
        child.stdin.write(payload);
      } catch (err) {
        finish(false, `daemon stdin write failed: ${err.message}`);
      }
    }

    try {
      child = spawn(
        process.execPath,
        [path.join(TOOLS_DIR, "derive_daemon.js")],
        { cwd: TOOLS_DIR, stdio: ["pipe", "pipe", "pipe"] }
      );
    } catch (err) {
      finish(false, `daemon spawn failed: ${err.message}`);
      return;
    }

    child.on("error", (err) => {
      finish(false, `daemon process error: ${err.message}`);
    });

    child.on("close", (code, signal) => {
      if (childClosed) return;
      childClosed = true;
      clearTimeout(teardownTimer);
      teardownTimer = null;

      if (!finished) {
        finish(
          false,
          `daemon closed early (code=${code}, signal=${signal || "none"})` +
            (stdout.length ? "; incomplete JSONL on stdout" : "")
        );
      }

      // Evaluate stderr only now: the daemon has exited and its stdio has
      // closed, so no late stderr can be missed, and the next test cannot
      // start with this daemon still alive.
      const cleanStderr =
        !stderr.includes("Aborted") && !stderr.includes("enlarge memory");

      check(
        "daemon stderr has no WASM abort or allocation attempt",
        teardownCond && cleanStderr,
        cleanStderr
          ? teardownDetail
          : 'daemon stderr contains "Aborted" or "enlarge memory"'
      );

      resolve();
    });

    if (!child.stdin || !child.stdout || !child.stderr) {
      finish(false, "daemon stdio pipes were not created");
      return;
    }

    child.stdin.on("error", (err) => {
      finish(false, `daemon stdin error: ${err.message}`);
    });
    child.stdout.on("error", (err) => {
      finish(false, `daemon stdout error: ${err.message}`);
    });
    child.stderr.on("error", (err) => {
      finish(false, `daemon stderr error: ${err.message}`);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (finished) return;

      // Timestamp arrival before parsing or checking the completed reply line.
      const receivedAt = process.hrtime.bigint();
      stdout += chunk;

      let newline;
      while (!finished && (newline = stdout.indexOf("\n")) !== -1) {
        const line = stdout.slice(0, newline);
        stdout = stdout.slice(newline + 1);

        let reply;
        try {
          reply = JSON.parse(line);
        } catch {
          finish(
            false,
            ready
              ? `invalid JSONL reply for ${steps[current].name}`
              : "invalid JSONL while waiting for daemon readiness"
          );
          return;
        }

        if (!reply || typeof reply !== "object" || Array.isArray(reply)) {
          finish(false, "daemon emitted a non-object JSONL message");
          return;
        }

        if (!ready) {
          if (reply.ready !== true) {
            finish(false, "daemon emitted a message before its ready message");
            return;
          }
          ready = true;
          sendNext();
          continue;
        }

        const step = steps[current];
        const cond = step.error
          ? reply.ok === false &&
            typeof reply.error === "string" &&
            reply.error.includes(step.error)
          : reply.ok === true && reply.address === step.address;

        check(
          step.name,
          cond,
          step.error
            ? `expected ok:false and error containing "${step.error}"`
            : "expected ok:true and the fixture address"
        );

        if (step.fastName) {
          const latencyMs = Number(receivedAt - sentAt) / 1e6;
          check(
            step.fastName,
            latencyMs >= 0 && latencyMs < 5000,
            `reply latency was ${latencyMs.toFixed(1)} ms; expected under 5000 ms`
          );
        }

        current += 1;
        sendNext();
      }
    });
  });
}

// A-9: daemon MAX_LINE_LENGTH enforcement (A-4). A newline-terminated
// over-long line is rejected with "request too large" and the daemon stays
// up; an unterminated over-long line is cut off with one reply and the
// daemon exits 0.
async function testDaemonLineLength() {
  // Part 1: terminated over-long line, then a valid request proves stays-up.
  await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(TOOLS_DIR, "derive_daemon.js")],
      { cwd: TOOLS_DIR, stdio: ["pipe", "pipe", "pipe"] }
    );
    let finished = false;
    let ready = false;
    let stage = 0;
    let stdoutBuffer = "";
    let stderr = "";
    const timer = setTimeout(() => {
      finish(false, "timed out after 60 s waiting for " + (ready ? "a reply" : "ready"));
    }, 60_000);
    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!cond) check("daemon line-length checks (terminated)", false, detail);
      child.kill();
      resolve();
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { finish(false, "daemon spawn error: " + error.message); });
    child.stdin.on("error", (error) => { finish(false, "daemon stdin error: " + error.message); });
    child.on("close", (code, signal) => {
      finish(false, "daemon closed before line-length checks finished: status=" + code + ", signal=" + signal + "; stderr=" + stderr);
    });
    child.stdout.on("data", (chunk) => {
      if (finished) return;
      stdoutBuffer += chunk;
      let newline;
      while (!finished && (newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line === "") continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch (error) {
          finish(false, "invalid JSONL on daemon stdout: " + error.message);
          return;
        }
        if (!ready) {
          if (!message || message.ready !== true) {
            finish(false, "expected a ready message before sending the request");
            return;
          }
          ready = true;
          child.stdin.write("x".repeat(5000) + "\n");
          continue;
        }
        if (stage === 0) {
          check(
            "daemon rejects a newline-terminated over-long line",
            message !== null && typeof message === "object" && message.ok === false &&
              typeof message.error === "string" && message.error.includes("request too large"),
            line
          );
          stage = 1;
          child.stdin.write(JSON.stringify({ chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 }) + "\n");
          continue;
        }
        check(
          "daemon stays up and derives after an over-long line",
          message !== null && typeof message === "object" && message.ok === true &&
            message.address === FIXTURES.btc[0],
          line
        );
        finish(true);
      }
    });
  });

  // Part 2: unterminated over-long line — one reply, then the daemon exits 0.
  await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(TOOLS_DIR, "derive_daemon.js")],
      { cwd: TOOLS_DIR, stdio: ["pipe", "pipe", "pipe"] }
    );
    let finished = false;
    let ready = false;
    let replied = false;
    let replyOk = false;
    let stdoutBuffer = "";
    let stderr = "";
    const timer = setTimeout(() => {
      finish(false, "timed out after 60 s waiting for " + (ready ? "a reply or exit" : "ready"));
    }, 60_000);
    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!cond) check("daemon line-length checks (unterminated)", false, detail);
      child.kill();
      resolve();
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { finish(false, "daemon spawn error: " + error.message); });
    child.stdin.on("error", (error) => { finish(false, "daemon stdin error: " + error.message); });
    child.on("close", (code) => {
      check(
        "daemon rejects an unterminated over-long line",
        replied && replyOk,
        replied ? "reply was not a request-too-large rejection" : "no reply before exit"
      );
      check(
        "daemon exits 0 after an unterminated over-long line",
        code === 0,
        "exit code=" + code + "; stderr=" + stderr.slice(0, 200)
      );
      finish(true);
    });
    child.stdout.on("data", (chunk) => {
      if (finished) return;
      stdoutBuffer += chunk;
      let newline;
      while (!finished && (newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line === "") continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch (error) {
          finish(false, "invalid JSONL on daemon stdout: " + error.message);
          return;
        }
        if (!ready) {
          if (!message || message.ready !== true) {
            finish(false, "expected a ready message before sending the request");
            return;
          }
          ready = true;
          child.stdin.write("y".repeat(5000));
          continue;
        }
        replied = true;
        replyOk = message !== null && typeof message === "object" && message.ok === false &&
          typeof message.error === "string" && message.error.includes("request too large");
      }
    });
  });
}

// T45 F-T45-1: the daemon must reject non-account-level keys instead of
// silently deriving under the wrong path. DEPTH4 (depth 4), CHILD1
// (depth 3, non-hardened child) and ACCOUNT1 (a real account-1 xpub from
// the published test-vector mnemonic) are rejected with an account-level
// error; FP0 (depth 3, zeroed fingerprint) is accepted — the parent
// fingerprint cannot be checked without the parent key — and derives the
// fixture address, which pins that limitation. A valid request afterwards
// proves the daemon stays up.
async function testDaemonAccountLevel() {
  return new Promise((resolve) => {
    const steps = [
      {
        name: "daemon rejects a depth-4 extended key",
        request: { chain: "btc", xpub: NEGATIVE.DEPTH4_ZPUB, index: 0 },
        error: "account-level",
      },
      {
        name: "daemon rejects a depth-3 key with a non-hardened child number",
        request: { chain: "btc", xpub: NEGATIVE.DEPTH3_CHILD1_ZPUB, index: 0 },
        error: "account-level",
      },
      {
        name: "daemon rejects a real account-1 extended key",
        request: { chain: "btc", xpub: NEGATIVE.ACCOUNT1_XPUB, index: 0 },
        error: "account-level",
      },
      {
        name: "daemon derives from a depth-3 key with a zeroed fingerprint",
        request: { chain: "btc", xpub: NEGATIVE.DEPTH3_FP0_ZPUB, index: 0 },
        address: FIXTURES.btc[0],
      },
      {
        name: "daemon derives BTC index 0 after account-level rejections",
        request: { chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 },
        address: FIXTURES.btc[0],
      },
    ];
    const child = spawn(process.execPath, [path.join(TOOLS_DIR, "derive_daemon.js")], {
      cwd: TOOLS_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let finished = false;
    let ready = false;
    let current = 0;
    let stdoutBuffer = "";
    let stderr = "";
    const timer = setTimeout(() => {
      finish(false, "timed out after 60 s");
    }, 60_000);
    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (!cond) {
        for (; current < steps.length; current += 1) check(steps[current].name, false, detail);
      }
      child.kill();
      resolve();
    }
    function sendNext() {
      if (finished || current >= steps.length) return;
      try {
        child.stdin.write(JSON.stringify(steps[current].request) + "\n");
      } catch (err) {
        finish(false, `daemon stdin write failed: ${err.message}`);
      }
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { finish(false, `daemon spawn error: ${error.message}`); });
    child.stdin.on("error", (error) => { finish(false, `daemon stdin error: ${error.message}`); });
    child.on("close", (code, signal) => {
      if (!finished) finish(false, `daemon closed early: status=${code}, signal=${signal}; stderr=${stderr}`);
    });
    child.stdout.on("data", (chunk) => {
      if (finished) return;
      stdoutBuffer += chunk;
      let newline;
      while (!finished && (newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line === "") continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          finish(false, `invalid JSONL on daemon stdout: ${line.slice(0, 80)}`);
          return;
        }
        if (!ready) {
          if (!message || message.ready !== true) {
            finish(false, "expected a ready message before sending the request");
            return;
          }
          ready = true;
          sendNext();
          continue;
        }
        const step = steps[current];
        const cond =
          message !== null &&
          typeof message === "object" &&
          (step.address !== undefined
            ? message.ok === true && message.address === step.address
            : message.ok === false &&
              typeof message.error === "string" &&
              message.error.includes(step.error));
        check(step.name, cond, line);
        current += 1;
        if (current >= steps.length) {
          finish(true);
          return;
        }
        sendNext();
      }
    });
  });
}

// T45 F-T45-2: a broken reply pipe must end the daemon with a clean exit 1
// and no uncaught-exception stack trace — not the pre-fix crash
// ("Unhandled 'error' event / Error: write EPIPE" on stderr).
async function testDaemonEpipe() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(TOOLS_DIR, "derive_daemon.js")], {
      cwd: TOOLS_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let finished = false;
    let ready = false;
    let stdoutBuffer = "";
    let stderr = "";
    const timer = setTimeout(() => {
      finish(false, "timed out after 15 s waiting for the daemon to exit");
    }, 15_000);
    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      check("daemon exits cleanly on a broken reply pipe", cond, detail);
      child.kill();
      resolve();
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { finish(false, `daemon spawn error: ${error.message}`); });
    child.stdin.on("error", (error) => { finish(false, `daemon stdin error: ${error.message}`); });
    child.on("close", (code, signal) => {
      const cleanStderr =
        !stderr.includes("Unhandled") &&
        !stderr.includes("write EPIPE") &&
        !stderr.includes("Error:");
      finish(
        code === 1 && signal === null && cleanStderr,
        `exit code=${code}, signal=${signal}; stderr=${stderr.slice(0, 200)}`
      );
    });
    child.stdout.on("data", (chunk) => {
      if (finished) return;
      stdoutBuffer += chunk;
      let newline;
      while (!finished && (newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (line === "") continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        if (!ready && message && message.ready === true) {
          ready = true;
          // Close the parent's read end of the daemon's stdout, then
          // elicit a reply: the daemon's write hits EPIPE.
          child.stdout.destroy();
          try {
            child.stdin.write(JSON.stringify({ chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 }) + "\n");
          } catch (err) {
            finish(false, `daemon stdin write failed: ${err.message}`);
          }
        }
      }
    });
  });
}

// 11b. R-28: checksum rejections must not reach WASM at all. A preload
// counts initWasm ("init") and getPublicKeyFromExtended ("derive") calls
// in the child processes; bad-checksum inputs must produce zero counts.
async function testNoWasmEntryOnChecksumRejection() {
  const tempDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "bawa-no-wasm-entry-"));
  const preloadFile = path.join(tempDir, "preload.cjs");
  const countFile = path.join(tempDir, "counts.log");

  function readCounts() {
    if (!fs.existsSync(countFile)) return [];
    return fs.readFileSync(countFile, "utf8").split("\n").filter(Boolean);
  }

  function resetCounts() {
    fs.rmSync(countFile, { force: true });
  }

  try {
    fs.writeFileSync(preloadFile, String.raw`'use strict';
const Module = require('node:module');
const { appendFileSync } = require('node:fs');
const originalLoad = Module._load;
function count(event) {
  try {
    const file = process.env.BAWA_WASM_COUNT_FILE;
    if (file) appendFileSync(file, event + '\n');
  } catch {}
}
function wrapCore(core) {
  return new Proxy(core, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (key !== 'HDWallet') return value;
      return new Proxy(value, {
        get(wallet, key, receiver) {
          const method = Reflect.get(wallet, key, receiver);
          if (key !== 'getPublicKeyFromExtended') return method;
          return function (...args) {
            count('derive');
            return Reflect.apply(method, wallet, args);
          };
        }
      });
    }
  });
}
Module._load = function (request, parent, isMain) {
  const real = Reflect.apply(originalLoad, this, arguments);
  if (request !== '@trustwallet/wallet-core') return real;
  return new Proxy(real, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (key !== 'initWasm') return value;
      return function (...args) {
        count('init');
        return Reflect.apply(value, target, args).then(wrapCore);
      };
    }
  });
};
`, "utf8");

    const childEnv = {
      ...process.env,
      NODE_OPTIONS: `-r ${JSON.stringify(preloadFile)}`,
      BAWA_WASM_COUNT_FILE: countFile,
    };
    const btcAddress = FIXTURES.btc[0];

    // Part A: checksum rejection must precede initWasm.
    for (const [badInput, chain] of [
      [NEGATIVE.TV5_BAD, "btc"],
      [NEGATIVE.ETH_BAD_CHECKSUM, "eth"],
    ]) {
      resetCounts();
      const result = spawnSync(process.execPath, [
        path.join(TOOLS_DIR, "derive.js"), chain, "0",
      ], {
        cwd: TOOLS_DIR,
        env: childEnv,
        input: badInput + "\n",
        timeout: 60000,
        encoding: "utf8",
      });

      check(`no-WASM-entry: derive.js ${chain} checksum rejection`,
        result.status === 2 && (result.stderr || "").includes("checksum"),
        `status=${result.status}; stderr=${result.stderr}; error=${result.error || ""}`);

      const counts = readCounts();
      check(`no-WASM-entry: derive.js ${chain} zero calls`,
        counts.length === 0, JSON.stringify(counts));
    }

    resetCounts();
    const positive = spawnSync(process.execPath, [
      path.join(TOOLS_DIR, "derive.js"), "btc", "0",
    ], {
      cwd: TOOLS_DIR,
      env: childEnv,
      input: FIXTURES.btc.xpub + "\n",
      timeout: 60000,
      encoding: "utf8",
    });

    check("no-WASM-entry: derive.js positive control",
      positive.status === 0 && (positive.stdout || "").trim() === btcAddress,
      `status=${positive.status}; stdout=${positive.stdout}; stderr=${positive.stderr}; error=${positive.error || ""}`);

    const positiveCounts = readCounts();
    check("no-WASM-entry: derive.js positive call counts",
      JSON.stringify(positiveCounts) === '["init","derive"]',
      JSON.stringify(positiveCounts));

    // Part B: startup initializes once; only the valid request derives.
    resetCounts();
    const child = spawn(process.execPath, [
      path.join(TOOLS_DIR, "derive_daemon.js"),
    ], {
      cwd: TOOLS_DIR,
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buffer = "";
    let stderr = "";
    let closed = false;
    let failure = null;
    let wake = null;
    const replies = [];

    const fail = (error) => {
      failure = error;
      if (wake) wake();
    };

    const closePromise = new Promise((resolve) => {
      child.once("close", () => {
        closed = true;
        if (wake) wake();
        resolve();
      });
    });

    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("error", fail);
    child.stderr.on("error", fail);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      try {
        for (const line of lines) replies.push(JSON.parse(line));
      } catch (error) {
        fail(error);
      }
      if (wake) wake();
    });

    function nextReply(label) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          finish(new Error(`${label}: timed out after 30 s`));
        }, 30000);

        function finish(error, reply) {
          clearTimeout(timer);
          wake = null;
          if (error) reject(error);
          else resolve(reply);
        }

        wake = () => {
          if (failure) finish(failure);
          else if (replies.length) finish(null, replies.shift());
          else if (closed) finish(new Error(`${label}: daemon closed before a reply`));
        };
        wake();
      });
    }

    try {
      const ready = await nextReply("ready");
      check("no-WASM-entry: daemon ready",
        ready && ready.ready === true, JSON.stringify(ready));

      child.stdin.write(JSON.stringify({
        chain: "eth", xpub: NEGATIVE.ETH_BAD_CHECKSUM, index: 0,
      }) + "\n");

      const badReply = await nextReply("checksum rejection");
      check("no-WASM-entry: daemon checksum rejection",
        badReply && badReply.ok === false &&
          typeof badReply.error === "string" && badReply.error.includes("checksum"),
        JSON.stringify(badReply));

      child.stdin.write(JSON.stringify({
        chain: "btc", xpub: FIXTURES.btc.xpub, index: 0,
      }) + "\n");

      const goodReply = await nextReply("positive control");
      check("no-WASM-entry: daemon positive control",
        goodReply && goodReply.ok === true && goodReply.address === btcAddress,
        JSON.stringify(goodReply));
    } catch (error) {
      check("no-WASM-entry: daemon protocol", false,
        `${error.message}\nstderr: ${stderr}`);
    } finally {
      const killTimer = setTimeout(() => {
        if (!closed) child.kill("SIGKILL");
      }, 5000);

      try {
        if (!closed) {
          child.stdin.end();
          child.kill();
        }
        await closePromise;
      } finally {
        clearTimeout(killTimer);
      }
    }

    const daemonCounts = readCounts();
    check("no-WASM-entry: daemon startup init and valid-request derive only",
      JSON.stringify(daemonCounts) === '["init","derive"]',
      JSON.stringify(daemonCounts));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
    // M-41: change branch (branch 1) index 0 matches the bip_utils oracle.
    const changeAddr = deriveFromXpub(core, fx.xpub, coin, fx.changePath(0));
    check(`${chain} change index 0 derives expected address`, changeAddr === fx.c0, changeAddr);
    check(`${chain} change index 0 address validates`, CoinTypeExt.validate(coin, changeAddr));
    check(`${chain} change index 0 differs from receiving index 0`, changeAddr !== fx[0], changeAddr);
  }
  // 2. Address-format guards (fail loudly if a format ever changes shape).
  check("btc addresses are bech32 segwit", FIXTURES.btc[0].startsWith("bc1q") && FIXTURES.btc[1].startsWith("bc1q") && FIXTURES.btc.c0.startsWith("bc1q"));
  check("eth addresses are 0x + 40 hex", /^0x[0-9a-fA-F]{40}$/.test(FIXTURES.eth[0]) && /^0x[0-9a-fA-F]{40}$/.test(FIXTURES.eth[1]) && /^0x[0-9a-fA-F]{40}$/.test(FIXTURES.eth.c0));
  check("trx addresses are T + 33 base58 chars", /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(FIXTURES.trx[0]) && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(FIXTURES.trx[1]) && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(FIXTURES.trx.c0));

  // 3. derive.js CLI end to end (public xpub on stdin, address on stdout).
  for (const [chain, fx] of Object.entries(FIXTURES)) {
    const r = runCli("derive.js", [chain, "0"], fx.xpub + "\n");
    check(`derive.js ${chain} CLI exit 0 and prints expected address`, r.status === 0 && r.stdout.trim() === fx[0], `status=${r.status} out=${r.stdout.trim()} err=${(r.stderr || "").trim().slice(0, 120)}`);
    // M-41: explicit branch 1 derives the change address; omitting the
    // branch keeps the receiving default.
    const rc = runCli("derive.js", [chain, "0", "1"], fx.xpub + "\n");
    check(`derive.js ${chain} CLI branch 1 prints change address`, rc.status === 0 && rc.stdout.trim() === fx.c0, `status=${rc.status} out=${rc.stdout.trim()} err=${(rc.stderr || "").trim().slice(0, 120)}`);
    const r0 = runCli("derive.js", [chain, "0", "0"], fx.xpub + "\n");
    check(`derive.js ${chain} CLI branch 0 prints receiving address`, r0.status === 0 && r0.stdout.trim() === fx[0], `status=${r0.status} out=${r0.stdout.trim()} err=${(r0.stderr || "").trim().slice(0, 120)}`);
  }
  // 4. derive.js input guards (all must refuse with exit 2, never derive).
  const badChain = runCli("derive.js", ["ton", "0"], FIXTURES.btc.xpub + "\n");
  check("derive.js rejects TON (TON watch-only lives in derive-ton.js, not derive.js)", badChain.status === 2, `status=${badChain.status}`);
  const badIndex = runCli("derive.js", ["btc", "-1"], FIXTURES.btc.xpub + "\n");
  check("derive.js rejects negative index", badIndex.status === 2, `status=${badIndex.status}`);
  for (const token of ["2", "-1", "01", "x", "1.0"]) {
    const result = runCli("derive.js", ["btc", "0", token], FIXTURES.btc.xpub + "\n");
    check(
      `derive.js rejects branch token ${JSON.stringify(token)}`,
      result.status === 2 && result.stdout === "",
      `status=${result.status}, stdout=${JSON.stringify(result.stdout)}, stderr=${JSON.stringify(result.stderr)}`
    );
  }
  const emptyXpub = runCli("derive.js", ["btc", "0"], "\n");
  check("derive.js rejects empty xpub", emptyXpub.status === 2, `status=${emptyXpub.status}`);
  for (const token of ["", "0x10", "1e2", " 1", "+1"]) {
    const result = runCli("derive.js", ["btc", token], FIXTURES.btc.xpub + "\n");
    check(
      `derive.js rejects index token ${JSON.stringify(token)}`,
      result.status === 2 && result.stdout === "",
      `status=${result.status}, stdout=${JSON.stringify(result.stdout)}, stderr=${JSON.stringify(result.stderr)}`
    );
  }

  // 5. Watch-only policy guard: the three documented paths exist in both
  // xpub tools (branch is now a 0|1 parameter, default receiving), and no
  // TON derivation path exists in either (TON has no xpub; its watch-only
  // route is the separate derive-ton.js).
  for (const script of ["derive.js", "derive_daemon.js"]) {
    const src = fs.readFileSync(path.join(TOOLS_DIR, script), "utf8");
    check(`${script} carries BTC/ETH/TRX paths`,
      src.includes("m/84'/0'/0'/${branch}/${i}") && src.includes("m/44'/60'/0'/${branch}/${i}") && src.includes("m/44'/195'/0'/${branch}/${i}"));
    check(`${script} carries no TON derivation path`, !src.includes("m/44'/607'"));
  }
  {
    const tonSrc = fs.readFileSync(path.join(TOOLS_DIR, "derive-ton.js"), "utf8");
    check("derive-ton.js documents the TON account path m/44'/607'/0'",
      tonSrc.includes("m/44'/607'/0'"));
    check("derive-ton.js carries no xpub handling",
      !tonSrc.includes("xpub") || tonSrc.includes("no xpub"));
  }

  // 5b. derive-ton.js CLI end to end (public key on stdin, address on stdout).
  {
    const r = runCli("derive-ton.js", [], TON_FIXTURE.pubkeyHex + "\n");
    check("derive-ton.js fixture exit 0 and prints expected address",
      r.status === 0 && r.stdout.trim() === TON_FIXTURE.address,
      `status=${r.status} out=${r.stdout.trim()} err=${(r.stderr || "").trim().slice(0, 120)}`);
    const padded = runCli("derive-ton.js", [], "  " + TON_FIXTURE.pubkeyHex + "  \n");
    check("derive-ton.js accepts whitespace-padded fixture pubkey",
      padded.status === 0 && padded.stdout.trim() === TON_FIXTURE.address,
      `status=${padded.status} out=${padded.stdout.trim()}`);
    const upper = runCli("derive-ton.js", [], TON_FIXTURE.pubkeyHex.toUpperCase() + "\n");
    check("derive-ton.js accepts uppercase hex fixture pubkey",
      upper.status === 0 && upper.stdout.trim() === TON_FIXTURE.address,
      `status=${upper.status} out=${upper.stdout.trim()}`);
    const extraArg = runCli("derive-ton.js", ["0"], TON_FIXTURE.pubkeyHex + "\n");
    check("derive-ton.js rejects extra arguments",
      extraArg.status === 2 && extraArg.stdout === "",
      `status=${extraArg.status}, stdout=${JSON.stringify(extraArg.stdout)}`);
    for (const [name, input] of [
      ["empty input", "\n"],
      ["62 hex chars", TON_FIXTURE.pubkeyHex.slice(0, 62) + "\n"],
      ["66 hex chars", TON_FIXTURE.pubkeyHex + "aa\n"],
      ["non-hex chars", "zz" + TON_FIXTURE.pubkeyHex.slice(2) + "\n"],
      ["0x-prefixed input", "0x" + TON_FIXTURE.pubkeyHex + "\n"],
    ]) {
      const bad = runCli("derive-ton.js", [], input);
      check(`derive-ton.js rejects ${name}`,
        bad.status === 2 && bad.stdout === "",
        `status=${bad.status}, stdout=${JSON.stringify(bad.stdout)}, stderr=${JSON.stringify(bad.stderr)}`);
    }
  }

  // 5b. M-27: BTC change-branch derivation (watch-only, same account zpub).
  // Change addresses verified against TWO independent implementations
  // (Trust Wallet Core WASM and Python bip_utils) on 2026-11-12, T11.
  const CHANGE = {
    0: "bc1qx3hncnu3lknuejrmzse4nf2yjwpaskgn6tpnve",
    1: "bc1q2musnpmapynlze7lsq4jva8qf58acgkmd4txhs",
  };
  for (const index of [0, 1]) {
    const addr = deriveFromXpub(core, FIXTURES.btc.xpub, CoinType.bitcoin, `m/84'/0'/0'/1/${index}`);
    check(`btc change index ${index} derives expected address`, addr === CHANGE[index], addr);
    check(`btc change index ${index} differs from receiving`, addr !== FIXTURES.btc[index]);
  }
  for (const index of [0, 1]) {
    const r = runCli("derive.js", ["btc-change", String(index)], FIXTURES.btc.xpub + "\n");
    check(`derive.js btc-change ${index} CLI prints expected address`, r.status === 0 && r.stdout.trim() === CHANGE[index], `status=${r.status} out=${r.stdout.trim()}`);
    check(`derive.js btc-change ${index} CLI marks the branch on stderr`, (r.stderr || "").includes("change branch m/84'/0'/0'/1/" + index), `stderr=${(r.stderr || "").trim()}`);
  }
  const noEthChange = runCli("derive.js", ["eth-change", "0"], FIXTURES.eth.xpub + "\n");
  check("derive.js rejects eth-change (no ETH change branch)", noEthChange.status === 2, `status=${noEthChange.status}`);
  const zprvChange = runCli("derive.js", ["btc-change", "0"], `${NEGATIVE.ZPRV}\n`);
  check("derive.js btc-change rejects private key", zprvChange.status === 2 && zprvChange.stdout === "", `status=${zprvChange.status}`);
  {
    const src = fs.readFileSync(path.join(TOOLS_DIR, "derive.js"), "utf8");
    check("derive.js carries BTC change path", src.includes("m/84'/0'/0'/1/${i}"));
  }

  // 5c. M-29 / M-26 register guards: never-fund warning placement and the
  // glossary Mainnet row. Anchors are content strings, not line numbers,
  // so ordinary prose edits above them do not break the checks.
  {
    const repoRoot = path.join(__dirname, "..");
    const guide = fs.readFileSync(path.join(repoRoot, "docs", "mainnet", "MAINNET-GUIDE.md"), "utf8");
    const glossary = fs.readFileSync(path.join(repoRoot, "docs", "GLOSSARY.md"), "utf8");
    const warnBefore = (warning, tableAnchor, label) => {
      const w = guide.indexOf(warning);
      const t = guide.indexOf(tableAnchor);
      check(`M-29 ${label}: never-fund warning precedes fixture table`, w !== -1 && t !== -1 && w < t, `warn=${w} table=${t}`);
    };
    warnBefore("Fund none of the addresses below", "| Chain | Derivation path | Expected public-fixture address |", "§7 offline fixtures");
    warnBefore("Public test-vector warning: funding any address in the table below is immediate loss", "| Chain | Mainnet derivation path | First receiving-address fixture — never fund |", "§7 mainnet fixtures");
    warnBefore("Funding any address in the table below is immediate loss", "| Chain | Recorded path or wallet parameters | Expected fixture address |", "§9 published fixtures");
    warnBefore("Never fund a published fixture address.", "| Chain | Published fixture address — never fund |", "§11 fixture table");
    const sec2Never = guide.indexOf("If an address is derived from the published 15-word");
    const sec7 = guide.indexOf("## 7. Shared contracts and wallet generation");
    check("M-29 §2 never-fund warning precedes §7", sec2Never !== -1 && sec7 !== -1 && sec2Never < sec7, `warn=${sec2Never} sec7=${sec7}`);
    check("M-26 glossary Mainnet row is not scope-denying", !glossary.includes("Mainnet is outside this guide's scope"), "glossary still carries the false Mainnet scope sentence");
    const proseBeforeRegister = guide.slice(0, guide.indexOf("## 21."));
    check("M-26 no 'Never use real funds' in guide prose before §21", !proseBeforeRegister.includes("Never use real funds"), "testnet-only warning survives in mainnet prose");
  }

  // 6. Daemon JSONL protocol.
  await testDaemon();
  // 6b. Daemon branch protocol (M-41).
  await testDaemonBranch();
  // 7. derive.js rejection and index-1 regression checks.
  {
    const rejectionCases = [
      ["INVALID_POINT_XPUB", "btc", "not a valid secp256k1 point"],
      ["TV1_XPRV", "btc", "private extended keys are rejected"],
      ["ZPRV", "btc", "private extended keys are rejected"],
      ["TV5_VER", "btc", "private extended keys are rejected"],
      ["TV5_BAD", "btc", "checksum"],
      ["ETH_BAD_CHECKSUM", "eth", "checksum"],
      ["ZPUB84", "eth", "not allowed for eth"],
      ["ZPUB84", "trx", "not allowed for trx"],
    ];

    for (const [vector, chain, expected] of rejectionCases) {
      const label = `derive.js ${vector}/${chain}`;
      const { result, ms } = timedRunCli(
        "derive.js",
        [chain, "0"],
        `${NEGATIVE[vector]}\n`
      );
      const stdout = String(result.stdout || "");
      const stderr = String(result.stderr || "");

      check(
        `${label}: exit 2`,
        result.status === 2,
        `status=${result.status}; stderr=${stderr}`
      );
      check(`${label}: empty stdout`, stdout === "", stdout);
      check(
        `${label}: expected rejection message`,
        stderr.includes(expected),
        `expected "${expected}"; stderr=${stderr}`
      );

      if (expected === "checksum") {
        check(
          `${label}: rejects within 5000 ms`,
          ms < 5000,
          `${ms.toFixed(1)} ms`
        );
        check(
          `${label}: no WASM abort`,
          !stderr.includes("Aborted") && !stderr.includes("enlarge memory"),
          stderr
        );
      }
    }

    for (const chain of ["btc", "eth", "trx"]) {
      const result = runCli(
        "derive.js",
        [chain, "1"],
        `${FIXTURES[chain].xpub}\n`
      );
      const stdout = String(result.stdout || "");

      check(
        `derive.js ${chain} index 1: exit 0`,
        result.status === 0,
        `status=${result.status}; stderr=${result.stderr || ""}`
      );
      check(
        `derive.js ${chain} index 1: matches fixture`,
        stdout.trim() === FIXTURES[chain][1],
        stdout
      );
    }
  }

  // 8. compare.js rejection without address output or echoed input.
  {
    const fixtureXpubs = {
      btc: FIXTURES.btc.xpub,
      eth: FIXTURES.eth.xpub,
      trx: FIXTURES.trx.xpub,
    };
    const envTextFor = (xpubs) =>
      `XPUB_BTC=${xpubs.btc}\n` +
      `XPUB_ETH=${xpubs.eth}\n` +
      `XPUB_TRX=${xpubs.trx}\n`;
    const validEnvText = envTextFor(fixtureXpubs);

    const rejectionCases = [
      ["ZPRV", "btc", "private extended keys are rejected"],
      ["TV5_BAD", "btc", "checksum"],
      ["ETH_BAD_CHECKSUM", "eth", "checksum"],
      ["ZPUB84", "eth", "not allowed for eth"],
    ];

    for (const [vector, chain, expected] of rejectionCases) {
      const label = `compare.js ${vector}/${chain}`;
      const input = NEGATIVE[vector];
      const result = runCompare(
        envTextFor({ ...fixtureXpubs, [chain]: input })
      );
      const stdout = String(result.stdout || "");
      const stderr = String(result.stderr || "");

      check(
        `${label}: non-zero exit`,
        Number.isInteger(result.status) && result.status !== 0,
        `status=${result.status}; stderr=${stderr}`
      );
      check(`${label}: empty stdout`, stdout === "", stdout);
      check(
        `${label}: expected rejection message`,
        stderr.includes(expected),
        `expected "${expected}"; stderr=${stderr}`
      );
      check(
        `${label}: input is not echoed`,
        !stderr.includes(input),
        "stderr contains the substituted input"
      );
    }

    const validResult = runCompare(validEnvText);
    const validStdout = String(validResult.stdout || "");

    check(
      "compare.js all-valid env: exit 0",
      validResult.status === 0,
      `status=${validResult.status}; stderr=${validResult.stderr || ""}`
    );

    for (const chain of ["btc", "eth", "trx"]) {
      check(
        `compare.js all-valid env: contains ${chain} index 0`,
        validStdout.includes(FIXTURES[chain][0]),
        validStdout
      );
    }
  }

  // 9. derive_daemon.js rejection checks (private key, checksum, wrong chain).
  await testDaemonPrivateRejection();
  await testDaemonDefects();
  await testDaemonLineLength();
  await testDaemonAccountLevel();
  await testDaemonEpipe();
  await testNoWasmEntryOnChecksumRejection();

  // 10. generate.js verifySeedBundle checks (A-3: decrypt verification).
  // Requiring generate.js must not run generation (require.main guard); the
  // plaintext below is a plain test string, not a wallet mnemonic.
  {
    const { verifySeedBundle } = require(path.join(TOOLS_DIR, "generate.js"));
    check("verifySeedBundle is exported", typeof verifySeedBundle === "function");
    const testPhrase = "bundle verification test phrase - not a wallet mnemonic";
    const bundleDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "auditfix-bundle-"));
    try {
      const key = crypto.randomBytes(32);
      const nonce = crypto.randomBytes(12);
      const buildBundle = (phrase, aad, bundleKey, bundleNonce) => {
        const cipher = crypto.createCipheriv("aes-256-gcm", bundleKey, bundleNonce);
        cipher.setAAD(Buffer.from(aad, "utf8"));
        const body = Buffer.concat([cipher.update(phrase, "utf8"), cipher.final()]);
        return {
          alg: "AES-256-GCM",
          nonce_b64: bundleNonce.toString("base64"),
          ciphertext_b64: Buffer.concat([body, cipher.getAuthTag()]).toString("base64"),
          aad,
        };
      };
      const writeBundle = (obj, name) => {
        const p = path.join(bundleDir, name);
        fs.writeFileSync(p, JSON.stringify(obj) + "\n");
        return p;
      };
      const good = writeBundle(buildBundle(testPhrase, "nova-shop-seed-v1", key, nonce), "good.json");
      check("verifySeedBundle: good bundle verifies", verifySeedBundle(good, key, testPhrase) === true);
      const tampered = buildBundle(testPhrase, "nova-shop-seed-v1", key, nonce);
      const raw = Buffer.from(tampered.ciphertext_b64, "base64");
      raw[10] ^= 0x01;
      tampered.ciphertext_b64 = raw.toString("base64");
      check("verifySeedBundle: tampered ciphertext rejected", verifySeedBundle(writeBundle(tampered, "tampered.json"), key, testPhrase) === false);
      const wrongAad = buildBundle(testPhrase, "wrong-aad", key, nonce);
      check("verifySeedBundle: wrong AAD rejected", verifySeedBundle(writeBundle(wrongAad, "wrong-aad.json"), key, testPhrase) === false);
      check("verifySeedBundle: wrong key rejected", verifySeedBundle(good, crypto.randomBytes(32), testPhrase) === false);
      fs.writeFileSync(path.join(bundleDir, "malformed.json"), "{not json");
      check("verifySeedBundle: malformed bundle rejected", verifySeedBundle(path.join(bundleDir, "malformed.json"), key, testPhrase) === false);
    } finally {
      fs.rmSync(bundleDir, { recursive: true, force: true });
    }
  }

  // 11. Shared extended-key validator regressions (R-01/R-02/R-03).
  // NOTE: a chain argument is required — without one the validator fails
  // every input at the chain allow-list step, including valid points.
  {
    const { validateExtendedKey } = require(path.join(TOOLS_DIR, "extended-key.js"));

    for (const vector of ["G_XPUB", "POINT_X_EQ_1", "DEPTH4_ZPUB", "DEPTH3_CHILD1_ZPUB", "DEPTH3_FP0_ZPUB", "ACCOUNT1_XPUB"]) {
      // The general validator does NOT enforce account level: the three
      // T45 metadata-mutation vectors pass here and are caught by
      // validateAccountKey below (T45 F-T45-1).
      const result = validateExtendedKey(NEGATIVE[vector], "btc");
      check(
        `validateExtendedKey accepts ${vector}`,
        result.ok === true,
        `ok=${result.ok}, reason=${result.reason}`
      );
    }

    for (const [vector, expectedReason] of [
      ["INVALID_POINT_XPUB", "bad-point"],
      ["POINT_X_EQ_P", "bad-point"],
      ["POINT_X_EQ_P_MINUS_1", "bad-point"],
      ["POINT_X_EQ_5", "bad-point"],
      ["POINT_X_EQ_0", "bad-point"],
      ["DEPTH0_FINGERPRINT", "bad-depth-metadata"],
      ["DEPTH0_CHILD", "bad-depth-metadata"],
      ["VER_0295B005", "private-key"],
      ["VER_02AA7A99", "private-key"],
    ]) {
      const result = validateExtendedKey(NEGATIVE[vector], "btc");
      check(
        `validateExtendedKey rejects ${vector}`,
        result.ok === false && result.reason === expectedReason,
        `ok=${result.ok}, reason=${result.reason}`
      );
    }

    // Account-level validation (T45 F-T45-1; same section 11).
    {
      const { validateAccountKey } = require(path.join(TOOLS_DIR, "extended-key.js"));
      for (const [chain, fixture] of Object.entries(FIXTURES)) {
        const result = validateAccountKey(fixture.xpub, chain);
        check(
          `validateAccountKey accepts the ${chain} fixture`,
          result.ok === true,
          `ok=${result.ok}, reason=${result.reason}`
        );
      }
      const fp0 = validateAccountKey(NEGATIVE.DEPTH3_FP0_ZPUB, "btc");
      check(
        "validateAccountKey accepts a depth-3 key with a zeroed fingerprint",
        fp0.ok === true,
        `ok=${fp0.ok}, reason=${fp0.reason}`
      );
      for (const [vector, expectedReason] of [
        ["DEPTH4_ZPUB", "not-account-key"],
        ["DEPTH3_CHILD1_ZPUB", "not-account-key"],
        ["ACCOUNT1_XPUB", "not-account-key"],
      ]) {
        const result = validateAccountKey(NEGATIVE[vector], "btc");
        check(
          `validateAccountKey rejects ${vector}`,
          result.ok === false && result.reason === expectedReason,
          `ok=${result.ok}, reason=${result.reason}`
        );
      }
    }

    const oversizedResult = validateExtendedKey("1".repeat(200), "btc");
    check(
      "validateExtendedKey rejects 200-character input",
      oversizedResult.ok === false && oversizedResult.reason === "bad-length",
      `ok=${oversizedResult.ok}, reason=${oversizedResult.reason}`
    );
  }

  if (failures > 0) {
    console.log(`SMOKE TESTS FAILED: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("SMOKE TESTS PASSED");
})().catch((e) => {
  console.error("SMOKE TESTS FAILED with exception: " + (e && e.message));
  process.exit(1);
});
