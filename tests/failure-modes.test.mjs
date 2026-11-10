import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const toolsDir = fileURLToPath(new URL('../tools/hdwallet-gen/', import.meta.url));

function base58Decode(text) {
  let value = 0n;
  for (const character of text) {
    const digit = alphabet.indexOf(character);
    assert.notEqual(digit, -1, 'Invalid base58 character');
    value = value * 58n + BigInt(digit);
  }
  const bytes = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  const zeroes = text.match(/^1*/)[0].length;
  return Buffer.concat([Buffer.alloc(zeroes), Buffer.from(bytes.reverse())]);
}

function base58Encode(buffer) {
  let value = 0n;
  for (const byte of buffer) value = (value << 8n) + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  let zeroes = 0;
  while (zeroes < buffer.length && buffer[zeroes] === 0) zeroes++;
  return alphabet[0].repeat(zeroes) + encoded;
}

function withChecksum(payload78) {
  assert.equal(payload78.length, 78, 'Extended key payload must be 78 bytes');
  const first = createHash('sha256').update(payload78).digest();
  const second = createHash('sha256').update(first).digest();
  return Buffer.concat([payload78, second.subarray(0, 4)]);
}

function badChecksum(key) {
  const replacement = key.at(-1) === alphabet[0] ? alphabet[1] : alphabet[0];
  return key.slice(0, -1) + replacement;
}

function runDerive(chain, key) {
  const result = spawnSync(process.execPath, [join(toolsDir, 'derive.js'), chain, '0'], {
    cwd: toolsDir,
    input: `${key}\n`,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.ifError(result.error);
  return result;
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

describe('failure modes', () => {
  let btcKey, ethKey, trxKey, btcAddress;

  before(() => {
    const source = readFileSync(new URL('../test/smoke.test.js', import.meta.url), 'utf8');
    const extract = (pattern, name, group = 1) => {
      const match = source.match(pattern);
      assert.ok(match?.[group], `Missing ${name} in test/smoke.test.js`);
      return match[group];
    };
    btcKey = extract(/xpub: "(zpub[^"]+)"/, 'BTC account key');
    ethKey = extract(/xpub: "(xpub6Bs[^"]+)"/, 'ETH account key');
    btcAddress = extract(/bc1q[a-z0-9]{38}/, 'expected BTC index-0 address', 0);
    trxKey = extract(/xpub: "(xpub6Bu[^"]+)"/, 'TRX account key');
  });

  test('derive.js rejects a private extended key with exit 2', () => {
    const payload = base58Decode(ethKey).subarray(0, 78);
    payload[45] = 0x00;
    const result = runDerive('eth', base58Encode(withChecksum(payload)));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /private/i);
  });

  test('derive.js rejects a bad-checksum key with exit 2', () => {
    const result = runDerive('eth', badChecksum(ethKey));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /checksum/i);
  });

  test('derive.js rejects a wrong-version key with exit 2', () => {
    const result = runDerive('eth', btcKey);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /not allowed for eth/);
  });

  // R-01: the H8 fix (shared validator point check) is in this tree; the
  // test was skipped at H7 and re-enabled after the H9 rebase (2026-11-10).
  test('derive.js rejects an invalid secp256k1 point with exit 2 (R-01)', () => {
    const payload = base58Decode(btcKey).subarray(0, 78);
    payload[45] = 0x02;
    payload.fill(0xff, 46, 78);
    const result = runDerive('btc', base58Encode(withChecksum(payload)));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /not a valid secp256k1 point/i);
  });

  test('compare.js rejects a bad input with exit 1 and empty stdout', () => {
    const result = spawnSync(process.execPath, [join(toolsDir, 'compare.js')], {
      cwd: toolsDir,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        XPUB_BTC: badChecksum(ethKey),
        XPUB_ETH: ethKey,
        XPUB_TRX: trxKey,
      },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
  });

  test('daemon rejects bad requests and stays up', async () => {
    const child = spawn(process.execPath, [join(toolsDir, 'derive_daemon.js')], {
      cwd: toolsDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const closed = new Promise((resolve) => {
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    let daemonError;
    child.on('error', (error) => { daemonError = error; });
    child.stdin.on('error', (error) => { daemonError = error; });
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const output = createInterface({ input: child.stdout, crlfDelay: Infinity });
    const lines = output[Symbol.asyncIterator]();
    const readReply = async () => {
      const { value, done } = await withTimeout(lines.next(), 10_000, 'Timed out awaiting daemon output');
      assert.ifError(daemonError);
      assert.equal(done, false, `Daemon closed stdout before replying: ${stderr}`);
      return JSON.parse(value);
    };
    const send = (request) => child.stdin.write(`${JSON.stringify(request)}\n`);

    try {
      assert.deepEqual(await readReply(), { ready: true });
      send({ chain: 'eth', xpub: badChecksum(ethKey), index: 0 });
      assert.equal((await readReply()).ok, false);
      send({ chain: 'btc', xpub: btcKey, index: 0 });
      const reply = await readReply();
      assert.equal(reply.ok, true);
      assert.equal(reply.address, btcAddress);
    } finally {
      child.kill();
      try {
        const { code, signal } = await withTimeout(closed, 5_000, 'Daemon did not close within 5 s');
        assert.ok(code !== null || signal !== null, 'Daemon neither exited nor was killed');
        assert.ifError(daemonError);
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
          child.unref();
        }
        output.close();
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
      }
    }
  });
});
