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

// Published test vectors, never for funds.
const NEGATIVE = {
  TV1_XPRV: "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi",
  ZPRV: "zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE",
  TV5_BAD: "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHL",
  TV5_VER: "xpub661MyMwAqRbcEYS8w7XLSVeEsBXy79zSzH1J8vCdxAZningWLdN3zgtU6LBpB85b3D2yc8sfvZU521AAwdZafEz7mnzBBsz4wKY5fTtTQBm",
  ZPUB84: "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs",
  ETH_BAD_CHECKSUM: "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumd",
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
        env: { ...process.env, NOVA_ENV: envFile },
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
    let current = 0;
    let sentAt;

    const timer = setTimeout(() => {
      finish(false, "daemon timed out after 60 s");
    }, 60000);

    function finish(cond, detail) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      // An aborted run fails each outstanding expectation exactly once.
      if (!cond) {
        for (; current < steps.length; current += 1) {
          const step = steps[current];
          check(step.name, false, detail);
          if (step.fastName) check(step.fastName, false, detail);
        }
      }

      const cleanStderr =
        !stderr.includes("Aborted") && !stderr.includes("enlarge memory");

      check(
        "daemon stderr has no WASM abort or allocation attempt",
        cond && cleanStderr,
        cleanStderr
          ? detail
          : 'daemon stderr contains "Aborted" or "enlarge memory"'
      );

      if (child) child.kill();
      resolve();
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
      if (finished) return;
      finish(
        false,
        `daemon closed early (code=${code}, signal=${signal || "none"})` +
          (stdout.length ? "; incomplete JSONL on stdout" : "")
      );
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
  // 7. derive.js rejection and index-1 regression checks.
  {
    const rejectionCases = [
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

  if (failures > 0) {
    console.log(`SMOKE TESTS FAILED: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log("SMOKE TESTS PASSED");
})().catch((e) => {
  console.error("SMOKE TESTS FAILED with exception: " + (e && e.message));
  process.exit(1);
});
