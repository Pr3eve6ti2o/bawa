import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Published public test vectors.
const FIXTURES = {
  btc: {
    xpub: "zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9",
    address: "bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd",
  },
  eth: {
    xpub: "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc",
    address: "0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7",
  },
  trx: {
    xpub: "xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF",
    address: "TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c",
  },
};

const VALID_ENV = Object.freeze({
  XPUB_BTC: FIXTURES.btc.xpub,
  XPUB_ETH: FIXTURES.eth.xpub,
  XPUB_TRX: FIXTURES.trx.xpub,
});

const temporaryDirectories = new Set();

function loadNegative() {
  // Read the existing vectors as data without executing the smoke tests.
  const source = fs.readFileSync(
    path.join(ROOT, "test", "smoke.test.js"),
    "utf8",
  );
  const block = source.match(
    /\bNEGATIVE\s*=\s*(?:Object\.freeze\s*\(\s*)?\{([\s\S]*?)\}/,
  );

  if (!block) {
    throw new Error(
      "Cannot locate the NEGATIVE fixture block in test/smoke.test.js",
    );
  }

  const values = Object.create(null);
  for (const [, key, value] of block[1].matchAll(
    /\b([A-Z][A-Z0-9_]*)\s*:\s*"([^"]*)"/g,
  )) {
    values[key] = value;
  }

  const requiredKeys = [
    "TV1_XPRV",
    "ZPRV",
    "TV5_BAD",
    "TV5_VER",
    "ZPUB84",
    "ETH_BAD_CHECKSUM",
  ];
  const missing = requiredKeys.filter((key) => !Object.hasOwn(values, key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required NEGATIVE fixtures in test/smoke.test.js: ${missing.join(", ")}`,
    );
  }

  return values;
}

function base58Decode(str) {
  let value = 0n;
  for (const character of str) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) {
      throw new Error("Invalid base58 character");
    }
    value = value * 58n + BigInt(digit);
  }

  const bytes = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();

  // Leading zero bytes are not represented by the BigInt value.
  let leadingZeroes = 0;
  while (leadingZeroes < str.length && str[leadingZeroes] === "1") {
    leadingZeroes += 1;
  }

  return Buffer.concat([
    Buffer.alloc(leadingZeroes),
    Buffer.from(bytes),
  ]);
}

function base58Encode(buf) {
  const bytes = Buffer.from(buf);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }

  let encoded = "";
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }

  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) {
    leadingZeroes += 1;
  }

  return "1".repeat(leadingZeroes) + encoded;
}

function reversionKey(xpub, versionHex) {
  const bytes = base58Decode(xpub);
  assert.equal(bytes.length, 82, "Expected an 82-byte extended key");
  assert.match(versionHex, /^[0-9a-f]{8}$/i, "Expected four version bytes");

  Buffer.from(versionHex, "hex").copy(bytes, 0);
  const payload = bytes.subarray(0, -4);
  const firstHash = createHash("sha256").update(payload).digest();
  const checksum = createHash("sha256")
    .update(firstHash)
    .digest()
    .subarray(0, 4);

  checksum.copy(bytes, bytes.length - 4);
  return base58Encode(bytes);
}

function runDerive(xpub, chain, index) {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "tools", "hdwallet-gen", "derive.js"), String(chain), String(index)],
    {
      cwd: ROOT,
      // Preserve genuinely empty stdin and the exact overlong input length.
      input: xpub,
      encoding: "utf8",
      timeout: 60_000,
    },
  );

  assert.ifError(result.error);
  assert.ok(Number.isInteger(result.status), "derive.js did not exit normally");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// Select the env file through BAWA_ENV_FILE (canonical), NOVA_ENV
// (deprecated fallback), or both. When neither is specified the test
// defaults to NOVA_ENV, preserving the pre-F-15 contract for the
// existing tests. Inherited BAWA_ENV_FILE/NOVA_ENV are removed first
// so the operator's shell cannot leak into the test.
function runCompare(envFile, { bawaEnvFile, novaEnv, timeout = 60_000 } = {}) {
  const env = { ...process.env };
  delete env.BAWA_ENV_FILE;
  delete env.NOVA_ENV;

  // Inherited wallet variables must not mask the selected temporary file.
  for (const key of Object.keys(VALID_ENV)) {
    delete env[key];
  }

  if (bawaEnvFile !== undefined) env.BAWA_ENV_FILE = bawaEnvFile;
  if (novaEnv !== undefined) env.NOVA_ENV = novaEnv;
  if (bawaEnvFile === undefined && novaEnv === undefined) {
    env.NOVA_ENV = envFile;
  }

  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "tools", "hdwallet-gen", "compare.js")],
    {
      cwd: ROOT,
      env,
      encoding: "utf8",
      timeout,
    },
  );

  assert.ifError(result.error);
  assert.ok(Number.isInteger(result.status), "compare.js did not exit normally");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function writeTempEnv(entries) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "bawa-negative-inputs-"),
  );
  temporaryDirectories.add(directory);

  const envFile = path.join(directory, ".env");
  const lines = Object.entries(entries).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(envFile, `${lines.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return envFile;
}

function writeTempEnvText(text) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "bawa-negative-inputs-"),
  );
  temporaryDirectories.add(directory);

  const envFile = path.join(directory, ".env");
  fs.writeFileSync(envFile, text, {
    encoding: "utf8",
    mode: 0o600,
  });

  return envFile;
}

function assertDeriveRejected(result, stderrPattern = /\S/) {
  assert.equal(result.status, 2, "Invalid derive.js input must exit with code 2");
  assert.equal(result.stdout, "", "Rejected input must leave stdout empty");
  assert.match(
    result.stderr,
    stderrPattern,
    "derive.js must explain the rejection on stderr",
  );
}

const NEGATIVE = loadNegative();

after(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

// derive.js

for (const [chain, fixture] of Object.entries(FIXTURES)) {
  test(`derive.js: valid ${chain} index 0 returns the fixture address`, () => {
    const result = runDerive(fixture.xpub, chain, 0);

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), fixture.address);
    assert.equal(result.stderr, "");
  });
}

test("derive.js: valid BTC ypub (BIP-49) index 0 returns the fixture address (F-17)", () => {
  // The ypub is the fixture zpub re-versioned to 049d7cb2: the same key,
  // so the bech32 derivation gives the same address. Independently,
  // bip-utils derives the BIP-49 P2SH address
  // 34JdW53BKMNqjQXGU33G4N65VxbYdw6jFd at m/49'/0'/0'/0/0.
  const ypub = "ypub6XYD5EHXRTjV5Ts4obsP9JGSgxcYzbxc1GcsWN73fjLXGXrpR3McpqJbko4xj3kFj41KRZpnymX4YbH6RTpUnKASUq94bKggxBAf5Wpvbv5";
  const result = runDerive(ypub, "btc", 0);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), FIXTURES.btc.address);
  assert.equal(result.stderr, "");
});

for (const key of ["ZPRV", "TV1_XPRV"]) {
  test(`derive.js: rejects the ${key} private key as btc`, () => {
    assertDeriveRejected(
      runDerive(NEGATIVE[key], "btc", 0),
      /private.*key/i,
    );
  });
}

test("derive.js: rejects an ETH key with a bad checksum", () => {
  assertDeriveRejected(runDerive(NEGATIVE.ETH_BAD_CHECKSUM, "eth", 0));
});

for (const chain of ["eth", "trx"]) {
  test(`derive.js: rejects a BTC zpub on the ${chain} chain`, () => {
    assertDeriveRejected(runDerive(NEGATIVE.ZPUB84, chain, 0));
  });
}

test("derive.js: rejects the TV5_VER version mismatch as btc", () => {
  assertDeriveRejected(runDerive(NEGATIVE.TV5_VER, "btc", 0));
});

for (const [description, input] of [
  ["empty stdin", ""],
  ["non-key text", "not-a-key"],
  ["a truncated key", FIXTURES.btc.xpub.slice(0, 40)],
  ["a non-base58 character", `${FIXTURES.btc.xpub}0`],
  ["overlong stdin", "1".repeat(201)],
]) {
  test(`derive.js: rejects ${description}`, () => {
    assertDeriveRejected(runDerive(input, "btc", 0));
  });
}

for (const [description, chain, index] of [
  ["an unsupported chain", "doge", 0],
  ["a negative index", "btc", -1],
  ["an index above 2147483647", "btc", 2147483648],
]) {
  test(`derive.js: rejects ${description}`, () => {
    assertDeriveRejected(runDerive(FIXTURES.btc.xpub, chain, index));
  });
}

for (const [prefix, versionHex] of [
  ["tpub", "043587cf"],
  ["vpub", "045f1cf6"],
]) {
  test(`derive.js: rejects the ${prefix} network version as btc`, () => {
    const xpub = reversionKey(FIXTURES.btc.xpub, versionHex);
    assert.ok(xpub.startsWith(prefix));

    assertDeriveRejected(runDerive(xpub, "btc", 0), /version/i);
  });
}

test("derive.js: BTC testnet4 policy retains the mainnet address", () => {
  // testnet4 uses the mainnet derivation by policy, so this is expected, not an error.
  const result = runDerive(FIXTURES.btc.xpub, "btc", 0);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), FIXTURES.btc.address);
  assert.equal(result.stderr, "");
});

// compare.js

test("compare.js: valid temporary env returns all three fixture addresses", () => {
  const envFile = writeTempEnv(VALID_ENV);
  const result = runCompare(envFile);

  assert.equal(result.status, 0);

  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, 3, "Expected exactly three chain lines");

  const rows = lines.map((line) => line.trim().split(/\s+/));
  for (const [chain, fixture] of Object.entries(FIXTURES)) {
    const row = rows.find(([name]) => name === chain);
    assert.ok(row, `Expected a ${chain} line`);
    assert.equal(row.length, 4, `Expected three addresses on the ${chain} line`);
    assert.equal(row[1], fixture.address, `Unexpected ${chain} index 0 address`);
  }
});

test("compare.js: rejects one BTC private key with the other chains valid", () => {
  const envFile = writeTempEnv({
    ...VALID_ENV,
    XPUB_BTC: NEGATIVE.ZPRV,
  });
  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /btc/i);
});

test("compare.js: rejects one ETH bad checksum with the other chains valid", () => {
  const envFile = writeTempEnv({
    ...VALID_ENV,
    XPUB_ETH: NEGATIVE.ETH_BAD_CHECKSUM,
  });
  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /eth/i);
});

test("compare.js: rejects a nonexistent NOVA_ENV file", () => {
  const envFile = writeTempEnv({});
  fs.unlinkSync(envFile);

  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\S/);
});

// F-07: a CRLF env file parses exactly like an LF one.
test("compare.js: CRLF env file returns all three fixture addresses", () => {
  const lines = Object.entries(VALID_ENV).map(([key, value]) => `${key}=${value}`);
  const envFile = writeTempEnvText(`${lines.join("\r\n")}\r\n`);
  const result = runCompare(envFile);

  assert.equal(result.status, 0, result.stderr);

  const rows = result.stdout.trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/));
  for (const [chain, fixture] of Object.entries(FIXTURES)) {
    const row = rows.find(([name]) => name === chain);
    assert.ok(row, `Expected a ${chain} line`);
    assert.equal(row[1], fixture.address, `Unexpected ${chain} index 0 address`);
  }
});

// F-06: an over-long replacement value fails loudly instead of keeping
// the stale key from the earlier line in force.
test("compare.js: rejects a 201-character replacement for a valid key", () => {
  const envFile = writeTempEnvText(
    [
      `XPUB_BTC=${FIXTURES.btc.xpub}`,
      `XPUB_BTC=${"A".repeat(201)}`,
      `XPUB_ETH=${FIXTURES.eth.xpub}`,
      `XPUB_TRX=${FIXTURES.trx.xpub}`,
      "",
    ].join("\n"),
  );
  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /line 2 value for XPUB_BTC exceeds 200 characters/);
});

// F-06: an over-long line fails loudly even when it is not an assignment.
test("compare.js: rejects a line over 1024 characters", () => {
  const envFile = writeTempEnvText(
    [
      `XPUB_BTC=${FIXTURES.btc.xpub}`,
      `#${"x".repeat(1024)}`,
      `XPUB_ETH=${FIXTURES.eth.xpub}`,
      `XPUB_TRX=${FIXTURES.trx.xpub}`,
      "",
    ].join("\n"),
  );
  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /line 2 exceeds 1024 characters/);
});

// F-08: /dev/zero reports stat size 0 but yields bytes indefinitely; the
// capped read must refuse quickly. The short spawn timeout keeps a
// regression from hanging the suite (it fails the test instead).
test("compare.js: refuses /dev/zero quickly instead of reading forever", () => {
  const result = runCompare(null, { novaEnv: "/dev/zero", timeout: 10_000 });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /exceeds 65536 bytes/);
});

// T44-F19: an indented XPUB replacement fails loudly instead of being
// silently skipped while the stale key from the earlier line stays in
// force (same hazard as F-06).
test("compare.js: rejects an indented XPUB_BTC replacement", () => {
  const envFile = writeTempEnvText(
    [
      `XPUB_BTC=${FIXTURES.btc.xpub}`,
      ` XPUB_BTC=${FIXTURES.eth.xpub}`,
      `XPUB_ETH=${FIXTURES.eth.xpub}`,
      `XPUB_TRX=${FIXTURES.trx.xpub}`,
      "",
    ].join("\n"),
  );
  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /line 2 assignment for XPUB_BTC is indented/);
});

// T44-F19: a duplicate XPUB assignment fails loudly instead of last-wins
// silently picking whichever line the operator did not intend.
test("compare.js: rejects a duplicate XPUB_BTC assignment", () => {
  const envFile = writeTempEnvText(
    [
      `XPUB_BTC=${FIXTURES.btc.xpub}`,
      `XPUB_BTC=${FIXTURES.eth.xpub}`,
      `XPUB_ETH=${FIXTURES.eth.xpub}`,
      `XPUB_TRX=${FIXTURES.trx.xpub}`,
      "",
    ].join("\n"),
  );
  const result = runCompare(envFile);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /line 2 duplicates assignment for XPUB_BTC/);
});

// T44-F20: a FIFO env file is refused quickly instead of blocking the
// open indefinitely (no writer ever appears). The short spawn timeout
// keeps a regression from hanging the suite (it fails the test instead).
test("compare.js: refuses a FIFO env file quickly instead of hanging", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bawa-compare-fifo-"));
  temporaryDirectories.add(directory);
  const fifoPath = path.join(directory, "env.fifo");
  const mkfifo = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
  assert.equal(mkfifo.status, 0, mkfifo.stderr);

  const result = runCompare(null, { bawaEnvFile: fifoPath, timeout: 10_000 });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /env file is not a readable file/);
});

// F-15: BAWA_ENV_FILE is the canonical selector and works silently.
test("compare.js: BAWA_ENV_FILE selects the env file without a warning", () => {
  const envFile = writeTempEnv(VALID_ENV);
  const result = runCompare(envFile, { bawaEnvFile: envFile });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, new RegExp(FIXTURES.btc.address));
});

// F-15: NOVA_ENV alone still works but warns it is deprecated.
test("compare.js: NOVA_ENV alone warns it is deprecated", () => {
  const envFile = writeTempEnv(VALID_ENV);
  const result = runCompare(envFile, { novaEnv: envFile });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /NOVA_ENV is deprecated; use BAWA_ENV_FILE/);
});

// F-15: both names set to different files refuse to run.
test("compare.js: conflicting BAWA_ENV_FILE and NOVA_ENV refuses", () => {
  const first = writeTempEnv(VALID_ENV);
  const second = writeTempEnv(VALID_ENV);
  const result = runCompare(first, { bawaEnvFile: first, novaEnv: second });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /conflicting env files/);
});

// F-15: both names set to the same file warn and use it.
test("compare.js: matching BAWA_ENV_FILE and NOVA_ENV warns and uses the file", () => {
  const envFile = writeTempEnv(VALID_ENV);
  const result = runCompare(envFile, { bawaEnvFile: envFile, novaEnv: envFile });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /NOVA_ENV is deprecated; use BAWA_ENV_FILE/);
});

// F-35: invalid arguments fail without waiting for stdin EOF. The stdin
// pipe is never closed; the usage error must arrive promptly.
test("derive.js: invalid arguments fail without waiting for stdin EOF", async () => {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "tools", "hdwallet-gen", "derive.js"), "doge", "0"],
    { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] },
  );
  const closed = new Promise((resolve) => {
    child.once("close", (code) => resolve(code));
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    const code = await Promise.race([
      closed,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("derive.js did not exit promptly on invalid arguments")),
        5_000,
      )),
    ]);
    assert.equal(code, 2);
    assert.match(stderr, /usage:/);
  } finally {
    child.kill("SIGKILL");
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
  }
});

// F-36: a rejection message never echoes the supplied key.
test("derive.js: rejection stderr never contains the supplied key", () => {
  const bad = NEGATIVE.ETH_BAD_CHECKSUM;
  const result = runDerive(bad, "eth", 0);
  assertDeriveRejected(result, /checksum/i);
  assert.ok(!result.stderr.includes(bad), "stderr must not echo the supplied key");
});

async function runDaemon(requests) {
  const startedAt = Date.now();
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "tools/hdwallet-gen/derive_daemon.js")],
    { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] },
  );

  const replies = [];
  const lines = [];
  let stderr = "";
  let buffer = "";
  let pending = null;
  let terminalError = null;

  function fail(error) {
    if (terminalError === null) terminalError = error;
    if (pending !== null) {
      const { reject, timer } = pending;
      pending = null;
      clearTimeout(timer);
      reject(terminalError);
    }
  }

  const closed = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      fail(new Error(
        `Daemon closed (code ${code}, signal ${signal}). Stderr: ${stderr}`,
      ));
      resolve();
    });
  });

  child.on("error", fail);
  child.stdin.on("error", fail);
  child.stdout.on("error", fail);
  child.stderr.on("error", fail);

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  // Stdout chunks need not coincide with protocol line boundaries.
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);

      if (pending !== null) {
        const { resolve, timer } = pending;
        pending = null;
        clearTimeout(timer);
        resolve(line);
      } else {
        lines.push(line);
      }
    }
  });

  function readLine(label) {
    if (terminalError !== null) return Promise.reject(terminalError);
    if (lines.length > 0) return Promise.resolve(lines.shift());

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        fail(new Error(
          `Timed out after 30 seconds waiting for daemon ${label}. Stderr: ${stderr}`,
        ));
      }, 30_000);
      pending = { resolve, reject, timer };
    });
  }

  try {
    const ready = JSON.parse(await readLine("ready line"));
    assert.strictEqual(ready.ready, true, "Daemon did not announce readiness");

    for (const request of requests) {
      const line = typeof request === "string"
        ? request
        : JSON.stringify(request);
      child.stdin.write(`${line}\n`);
      replies.push(JSON.parse(await readLine(`reply ${replies.length + 1}`)));
    }
  } finally {
    // Bound shutdown too, whilst collecting stderr until the pipes close.
    let shutdownTimer;
    try {
      child.kill("SIGKILL");
      await Promise.race([
        closed,
        new Promise((_, reject) => {
          shutdownTimer = setTimeout(() => {
            reject(new Error("Timed out waiting for daemon shutdown"));
          }, 5_000);
        }),
      ]);
    } finally {
      clearTimeout(shutdownTimer);
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
    }
  }

  return { replies, stderr, elapsedMs: Date.now() - startedAt };
}

async function runDaemonTimed(request) {
  const { replies, elapsedMs } = await runDaemon([request]);
  return { reply: replies[0], elapsedMs };
}

test("daemon: valid BTC index 0 matches the fixture", async () => {
  const { replies } = await runDaemon([
    { chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 },
  ]);

  assert.strictEqual(replies[0].ok, true, JSON.stringify(replies[0]));
  assert.strictEqual(replies[0].address, FIXTURES.btc.address);
});

test("daemon: rejects private keys", async () => {
  const { replies } = await runDaemon([
    { chain: "btc", xpub: NEGATIVE.ZPRV, index: 0 },
    { chain: "btc", xpub: NEGATIVE.TV1_XPRV, index: 0 },
  ]);

  for (const reply of replies) {
    assert.strictEqual(reply.ok, false, JSON.stringify(reply));
    assert.match(reply.error, /private/i);
  }
});

test("daemon: rejects a bad checksum", async () => {
  const { replies } = await runDaemon([
    { chain: "eth", xpub: NEGATIVE.ETH_BAD_CHECKSUM, index: 0 },
  ]);

  assert.strictEqual(replies[0].ok, false, JSON.stringify(replies[0]));
});

test("daemon: rejects a BTC zpub on ETH and TRX", async () => {
  const { replies } = await runDaemon([
    { chain: "eth", xpub: NEGATIVE.ZPUB84, index: 0 },
    { chain: "trx", xpub: NEGATIVE.ZPUB84, index: 0 },
  ]);

  for (const reply of replies) {
    assert.strictEqual(reply.ok, false, JSON.stringify(reply));
  }
});

test("daemon: rejects a version mismatch", async () => {
  const { replies } = await runDaemon([
    { chain: "btc", xpub: NEGATIVE.TV5_VER, index: 0 },
  ]);

  assert.strictEqual(replies[0].ok, false, JSON.stringify(replies[0]));
});

test("daemon: rejects an unknown chain", async () => {
  const { replies } = await runDaemon([
    { chain: "doge", xpub: FIXTURES.btc.xpub, index: 0 },
  ]);

  assert.strictEqual(replies[0].ok, false, JSON.stringify(replies[0]));
});

test("daemon: rejects missing, empty and malformed xpub fields", async () => {
  const { replies } = await runDaemon([
    { chain: "btc", index: 0 },
    { chain: "btc", xpub: "", index: 0 },
    { chain: "btc", xpub: "not-a-key", index: 0 },
  ]);

  for (const reply of replies) {
    assert.strictEqual(reply.ok, false, JSON.stringify(reply));
  }
});

test("daemon: rejects tpub and vpub network versions", async () => {
  const { replies } = await runDaemon([
    {
      chain: "btc",
      xpub: reversionKey(FIXTURES.btc.xpub, "043587cf"),
      index: 0,
    },
    {
      chain: "btc",
      xpub: reversionKey(FIXTURES.btc.xpub, "045f1cf6"),
      index: 0,
    },
  ]);

  for (const reply of replies) {
    assert.strictEqual(reply.ok, false, JSON.stringify(reply));
    assert.match(reply.error, /version/i);
  }
});

test("daemon: remains usable after all input rejections", async () => {
  // Repeat every rejection above without restarting the daemon.
  const requests = [
    { chain: "btc", xpub: NEGATIVE.ZPRV, index: 0 },
    { chain: "btc", xpub: NEGATIVE.TV1_XPRV, index: 0 },
    { chain: "eth", xpub: NEGATIVE.ETH_BAD_CHECKSUM, index: 0 },
    { chain: "eth", xpub: NEGATIVE.ZPUB84, index: 0 },
    { chain: "trx", xpub: NEGATIVE.ZPUB84, index: 0 },
    { chain: "btc", xpub: NEGATIVE.TV5_VER, index: 0 },
    { chain: "doge", xpub: FIXTURES.btc.xpub, index: 0 },
    { chain: "btc", index: 0 },
    { chain: "btc", xpub: "", index: 0 },
    { chain: "btc", xpub: "not-a-key", index: 0 },
    {
      chain: "btc",
      xpub: reversionKey(FIXTURES.btc.xpub, "043587cf"),
      index: 0,
    },
    {
      chain: "btc",
      xpub: reversionKey(FIXTURES.btc.xpub, "045f1cf6"),
      index: 0,
    },
    { chain: "btc", xpub: FIXTURES.btc.xpub, index: 1 },
  ];
  const { replies } = await runDaemon(requests);

  assert.strictEqual(replies.length, requests.length);
  for (const reply of replies.slice(0, -1)) {
    assert.strictEqual(reply.ok, false, JSON.stringify(reply));
  }

  const reply = replies[replies.length - 1];
  assert.strictEqual(reply.ok, true, JSON.stringify(reply));
  assert.strictEqual(
    reply.address,
    "bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za",  // ripple zpub index 1; bc1qnjg0... is the SLIP-0132 'abandon' zpub's index 1, a different key
  );
});

test("daemon: bad-checksum rejection takes under 5000 ms", async () => {
  const { reply, elapsedMs } = await runDaemonTimed({
    chain: "eth",
    xpub: NEGATIVE.ETH_BAD_CHECKSUM,
    index: 0,
  });

  assert.strictEqual(reply.ok, false, JSON.stringify(reply));
  assert.ok(
    elapsedMs < 5_000,
    `Expected rejection in under 5000 ms, got ${elapsedMs} ms`,
  );
});

test("daemon: rejections leave stderr free of abort and allocation messages", async () => {
  const { replies, stderr } = await runDaemon([
    { chain: "eth", xpub: NEGATIVE.ETH_BAD_CHECKSUM, index: 0 },
    { chain: "eth", xpub: NEGATIVE.ZPUB84, index: 0 },
  ]);

  for (const reply of replies) {
    assert.strictEqual(reply.ok, false, JSON.stringify(reply));
  }
  assert.doesNotMatch(stderr, /abort|allocation/i);
});

test("daemon: remains usable after a non-JSON line", async () => {
  const { replies } = await runDaemon([
    "this is not json",
    { chain: "btc", xpub: FIXTURES.btc.xpub, index: 0 },
  ]);

  assert.strictEqual(replies.length, 2);
  assert.strictEqual(replies[0].ok, false, JSON.stringify(replies[0]));
  assert.strictEqual(replies[1].ok, true, JSON.stringify(replies[1]));
  assert.strictEqual(replies[1].address, FIXTURES.btc.address);
});
