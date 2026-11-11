// verify.mjs — generated-project verification template.
//
// Copied verbatim into each generated CLI wallet project by
// scripts/generate-project.mjs. Derives the published fixture addresses
// with the repo engine and asserts them exact. Public test vectors only;
// no secrets, no network calls.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const repoTools = join(dir, '..', '..', 'tools', 'hdwallet-gen');
const profile = JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'));

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(text) {
  let value = 0n;
  for (const ch of text) value = value * 58n + BigInt(alphabet.indexOf(ch));
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
  const first = createHash('sha256').update(payload78).digest();
  const second = createHash('sha256').update(first).digest();
  return Buffer.concat([payload78, second.subarray(0, 4)]);
}

const FIXTURES = {
  btc: {
    xpub: 'zpub6rNUNtxSa9Gxvm4Bdxf1MPMwrvkzwDx6vP96Hkzw3jiQKdg3fhXBStxjn12YixQB8h88B3RMSRscRstf9AEVaYr3MAqVBEWBDuEJU4PGaT9',
    addresses: [
      'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
      'bc1qm7td3gmpsddct487a54wqylml0t8q6np64k8za',
    ],
  },
  eth: {
    xpub: 'xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc',
    addresses: [
      '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7',
      '0xD6c3112a8Db4991a7359018F15e501dfEE316d59',
    ],
  },
  trx: {
    xpub: 'xpub6BuGaD9QhYL3taLFfDBrnJJTd6NnLniCBKVJsRsev1Ct9ZUfwPTwqDZSfPhFkmWvM9CA8veqHQWeBMnUgxPEv41H1Bqb3QbkZ3zpCRzzaeF',
    addresses: [
      'TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c',
      'TWuKAx5ibV2fa65UL4Rg4W4hke3LdE2G8B',
    ],
  },
};

function runDerive(chain, index, key) {
  return spawnSync(
    process.execPath,
    [join(repoTools, 'derive.js'), chain, String(index)],
    { cwd: repoTools, input: key + '\n', encoding: 'utf8', timeout: 10000 },
  );
}

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log('PASS ' + name);
  } else {
    fail++;
    console.log('FAIL ' + name + ' :: ' + detail);
  }
}

for (const chain of profile.chains) {
  if (chain === 'ton') {
    console.log('NOTE ton: generation-only, no derivation check (no xpub)');
    continue;
  }
  const fixture = FIXTURES[chain];
  for (const index of [0, 1]) {
    const result = runDerive(chain, index, fixture.xpub);
    check(
      chain + ' index ' + index + ' fixture exact',
      result.status === 0 && result.stdout.trim() === fixture.addresses[index],
      'status=' + result.status + ' out=' + JSON.stringify(result.stdout),
    );
  }
}

// R-01: a checksum-correct key with an invalid secp256k1 point must be
// rejected pre-WASM with exit 2 and empty stdout.
const payload = base58Decode(FIXTURES.btc.xpub).subarray(0, 78);
payload[45] = 0x02;
payload.fill(0xff, 46, 78);
const invalidKey = base58Encode(withChecksum(payload));
const rejected = runDerive('btc', 0, invalidKey);
check(
  'R-01 invalid point rejected exit 2, empty stdout',
  rejected.status === 2 &&
    rejected.stdout === '' &&
    /not a valid secp256k1 point/i.test(rejected.stderr),
  'status=' + rejected.status + ' out=' + JSON.stringify(rejected.stdout) +
    ' err=' + JSON.stringify(rejected.stderr),
);

console.log('verify: ' + pass + '/' + (pass + fail) + ' checks passed');
process.exitCode = fail === 0 ? 0 : 1;
