#!/usr/bin/env node
// generate-project.mjs — generate a differentiated wallet project for one
// registry profile.
//
// Usage: node scripts/generate-project.mjs <profile-id> [--out <dir>]
// Default output: generated/<profile-id> under the repo root. The output
// is a starter or CLI scaffold, never a complete wallet: see the generated
// README for the implemented capabilities, missing components, supported
// chains and verification status of the profile.
//
// Hand-applied by the coordinator from the prescribed design (acceptance
// programme, 2026-11-10): Astra stalled twice on this file (2 x 600s kills,
// 0 output), so the coordinator wrote it directly and verified it
// first-hand, per the A-3 precedent. The verify/derive templates it copies
// were likewise written and verified by hand (7/7 checks).
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedRoot = join(repoRoot, 'generated');

const PATHS = {
  btc: "m/84'/0'/0'/0/i",
  eth: "m/44'/60'/0'/0/i",
  trx: "m/44'/195'/0'/0/i",
  ton: "m/44'/607'/0' generation-only",
};

function usageError(message) {
  console.error('Usage: node scripts/generate-project.mjs <profile-id> [--out <dir>]');
  if (message) console.error('generate-project: ' + message);
  return 2;
}

function baseCommit() {
  try {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10000,
    });
    return result.status === 0 ? result.stdout.trim() : '';
  } catch {
    return '';
  }
}

function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) count += countFiles(path);
    else count += 1;
  }
  return count;
}

function bulletList(items) {
  return items.map((item) => '- ' + item).join('\n');
}

function readmeFor(profile) {
  // implemented/missing come from the registry entry (added in the
  // acceptance programme); fall back to a conservative, platform-aware
  // derivation until the registry carries them.
  const fallbackImplemented = {
    cli: ['Derivation primitives via the repository tools (see security notes)'],
    web: [
      'Watch-only address derivation in the browser (BTC, ETH, TRX, indices 0-4) via the vendored wallet-core 4.8.4 WASM boundary',
      '14-screen UI navigation with mock data and unavailable actions labelled as such',
      'Receive-screen QR display of a derived address',
    ],
    android: [
      'Extended-public-key validation (no secrets, no derivation on-device)',
      '14-screen UI navigation with mock data and unavailable actions labelled as such',
      'QR display of an address',
    ],
  };
  const fallbackMissing = {
    cli: ['send', 'sign', 'broadcast', 'balances', 'prices', 'history'],
    web: ['send', 'sign', 'broadcast', 'balances', 'prices', 'history', 'wallet creation and backup (repository tools only)'],
    android: ['on-device derivation', 'send', 'sign', 'broadcast', 'balances', 'prices', 'history', 'wallet creation and backup (repository tools only)'],
  };
  const implemented = Array.isArray(profile.implemented)
    ? profile.implemented
    : fallbackImplemented[profile.platform];
  const missing = Array.isArray(profile.missing)
    ? profile.missing
    : fallbackMissing[profile.platform];
  const chains = profile.chains
    .map((chain) => '- ' + chain + ' (' + PATHS[chain] + ')')
    .join('\n');
  const scope =
    profile.platform === 'cli'
      ? 'a CLI scaffold for the `' + profile.id + '` profile: its derivation primitives are verified through the repository tools, but the wallet product itself is not built'
      : 'a starter for the `' + profile.id + '` profile: implemented and verified within its documented scope, not a complete wallet';
  const howTo =
    profile.platform === 'cli'
      ? 'Verify the generated project with `node verify.mjs` (derives the published fixture addresses and asserts them exact, including the R-01 invalid-point rejection). Derive an address with `node derive.mjs <chain> <xpub> [index]`. Generate fresh test wallets with the repository tools: `node ../../tools/hdwallet-gen/generate.js` (interactive, needs a controlling terminal) and `python3 ../../tools/make_wallet.py`.'
      : profile.platform === 'web'
        ? 'Install dependencies with `npm install`, build with `npm run build`, run the tests with `npx vitest run`. The wallet-core WASM file is copied into `public/` by the prebuild step; never commit it. The starter\'s own README is preserved as `README-starter.md` in this directory. This copy still depends on the repository checkout for `@bawa/contracts` (a local `file:` dependency).'
        : 'Build with `./gradlew assembleDebug` and run the unit tests with `./gradlew testDebugUnitTest` (needs `JAVA_HOME` pointing at JDK 17 and `ANDROID_HOME` pointing at an Android SDK with platform 35). The starter\'s own README is preserved as `README-starter.md` in this directory.';
  return [
    '# Generated ' + profile.id,
    '',
    '## What this is',
    '',
    'This is ' + scope + '.',
    '',
    '## Implemented capabilities',
    '',
    bulletList(implemented),
    '',
    '## Missing components',
    '',
    bulletList(missing),
    '',
    '## Supported chains',
    '',
    chains,
    '',
    '## Verification status',
    '',
    'Status: `' + profile.status + '`. ' +
      'The implemented capabilities above are backed by the recorded first-hand evidence for this profile; the missing components are not implemented.',
    '',
    '## How to build and verify',
    '',
    howTo,
    '',
    '## Boundaries',
    '',
    '- Testnet only. Mainnet is out of scope without separate approval.',
    '- No send, sign or broadcast code exists in this project or in the repository.',
    '- No balances, prices or transaction history: no provider is selected.',
    '- Secrets (mnemonics, seeds, private keys, private extended keys) never leave the trusted key/vault boundary and never enter adapters, UI state, logs or telemetry.',
    '',
  ].join('\n');
}

function main() {
  const [profileId, ...args] = process.argv.slice(2);
  let outDir = null;
  if (args.length === 2 && args[0] === '--out' && args[1]?.trim()) {
    outDir = resolve(args[1]);
  } else if (args.length !== 0) {
    return usageError('expected [--out <dir>]');
  }
  if (!profileId) return usageError('a profile id is required');

  const profiles = JSON.parse(
    readFileSync(join(repoRoot, 'registry', 'profiles.json'), 'utf8'),
  );
  const profile = profiles.find((entry) => entry?.id === profileId);
  if (!profile) {
    return usageError('unknown profile id: ' + profileId);
  }

  const target = outDir ?? join(generatedRoot, profileId);
  // Guard: never delete outside generated/ or an explicit --out under the
  // repo root. Refuse the repo root itself.
  const insideGenerated =
    target === generatedRoot || target.startsWith(generatedRoot + sep);
  const insideRepo = target.startsWith(repoRoot + sep);
  if ((!insideGenerated && !(outDir && insideRepo)) || target === repoRoot) {
    return usageError('refusing to write outside generated/ or the repo: ' + target);
  }

  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  const manifest = {
    ...profile,
    generatedAt: new Date().toISOString(),
    baseCommit: baseCommit(),
    generator: 'scripts/generate-project.mjs',
  };
  const readme = readmeFor(profile);

  if (profile.platform === 'cli') {
    writeFileSync(join(target, 'profile.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    writeFileSync(join(target, 'README.md'), readme, 'utf8');
    writeFileSync(
      join(target, 'package.json'),
      JSON.stringify(
        {
          name: 'bawa-generated-' + profileId,
          private: true,
          type: 'module',
          engines: { node: '>=22 <23' },
          scripts: { verify: 'node verify.mjs', derive: 'node derive.mjs' },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    copyFileSync(
      join(repoRoot, 'scripts', 'generate-templates', 'verify.mjs'),
      join(target, 'verify.mjs'),
    );
    copyFileSync(
      join(repoRoot, 'scripts', 'generate-templates', 'derive.mjs'),
      join(target, 'derive.mjs'),
    );
  } else if (profile.platform === 'web') {
    const source = join(repoRoot, 'apps', 'web');
    cpSync(source, target, {
      recursive: true,
      filter: (src) => {
        const rel = relative(source, src);
        if (rel === '') return true;
        const head = rel.split(sep)[0];
        if (head === 'node_modules' || head === 'dist') return false;
        if (rel === join('public', 'wallet-core.wasm')) return false;
        return true;
      },
    });
    writeFileSync(join(target, 'profile.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    copyFileSync(join(target, 'README.md'), join(target, 'README-starter.md'));
    writeFileSync(join(target, 'README.md'), readme, 'utf8');
  } else if (profile.platform === 'android') {
    const source = join(repoRoot, 'apps', 'android');
    cpSync(source, target, {
      recursive: true,
      filter: (src) => {
        const rel = relative(source, src);
        if (rel === '') return true;
        const head = rel.split(sep)[0];
        if (head === 'build' || head === '.gradle') return false;
        if (rel === 'local.properties') return false;
        return true;
      },
    });
    writeFileSync(join(target, 'profile.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    copyFileSync(join(target, 'README.md'), join(target, 'README-starter.md'));
    writeFileSync(join(target, 'README.md'), readme, 'utf8');
  } else {
    return usageError('unsupported platform for profile ' + profileId + ': ' + profile.platform);
  }

  console.log(target);
  console.log('generate-project: ' + countFiles(target) + ' files');
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(
    'generate-project: ' + (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
}
