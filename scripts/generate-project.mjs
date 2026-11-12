#!/usr/bin/env node
// generate-project.mjs — generate a differentiated wallet project for one
// registry profile.
//
// Usage: node scripts/generate-project.mjs <profile-id> [--out <dir>] [--force]
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
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll } from './validate-registry.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedRoot = join(repoRoot, 'generated');

const PATHS = {
  btc: "m/84'/0'/0'/0/i",
  eth: "m/44'/60'/0'/0/i",
  trx: "m/44'/195'/0'/0/i",
  ton: "m/44'/607'/0' generation-only",
};

function usageError(message) {
  console.error('Usage: node scripts/generate-project.mjs <profile-id> [--out <dir>] [--force]');
  if (message) console.error('generate-project: ' + message);
  return 2;
}

// F-23: resolve the REAL destination before any mutation. A lexical
// prefix check on the unresolved path is not enough: an ancestor of
// the target may be a symlink pointing outside the repo, and the
// writes below would follow it. Resolve the nearest existing ancestor
// (symlinks included) and re-append the not-yet-existing tail, so the
// path actually written is the path that is checked.
function resolveContained(target) {
  let ancestor = target;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) break; // filesystem root
    ancestor = parent;
  }
  const realAncestor = realpathSync(ancestor);
  const tail = relative(ancestor, target);
  return tail ? join(realAncestor, tail) : realAncestor;
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
        ? 'Install dependencies with `npm ci`, build with `npm run build`, run the tests with `npx vitest run`. The wallet-core WASM file is copied into `public/` by the prebuild step; never commit it. The starter\'s own README is preserved as `README-starter.md` in this directory. This copy still depends on the repository checkout for `@bawa/contracts` (a local `file:` dependency).'
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
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force' && !force) {
      force = true;
    } else if (
      args[i] === '--out' &&
      outDir === null &&
      args[i + 1]?.trim() &&
      !args[i + 1].startsWith('--')
    ) {
      outDir = resolve(args[++i]);
    } else {
      return usageError('expected [--out <dir>] [--force]');
    }
  }
  if (!profileId) return usageError('a profile id is required');

  // T46: validate the registry before consuming profile metadata.
  // A separate quality gate does not protect a direct invocation.
  const registryCheck = validateAll(
    join(repoRoot, 'registry'),
    undefined,
    repoRoot,
  );
  if (registryCheck.errors.length > 0) {
    for (const error of registryCheck.errors) {
      console.error(`generate-project: ${error}`);
    }
    return 1;
  }

  const profiles = JSON.parse(
    readFileSync(join(repoRoot, 'registry', 'profiles.json'), 'utf8'),
  );
  const profile = profiles.find((entry) => entry?.id === profileId);
  if (!profile) {
    return usageError('unknown profile id: ' + profileId);
  }

  const target = outDir ?? join(generatedRoot, profileId);
  // Guard: only generated/ descendants or an explicit --out under the
  // repo root are allowed. Refuse both roots themselves. The check runs
  // on the REAL paths (F-23): a symlinked ancestor pointing outside
  // the repo must refuse even when the lexical path looks inside.
  const realRepoRoot = realpathSync(repoRoot);
  const realGeneratedRoot = resolveContained(generatedRoot);
  const realTarget = resolveContained(target);
  const insideGenerated = realTarget.startsWith(realGeneratedRoot + sep);
  const insideRepo = realTarget.startsWith(realRepoRoot + sep);
  if (realTarget === realGeneratedRoot) {
    return usageError('refusing to write to generated/ itself: ' + target);
  }
  if ((!insideGenerated && !(outDir && insideRepo)) || realTarget === realRepoRoot) {
    return usageError('refusing to write outside generated/ or the repo: ' + target);
  }
  // All writes below use the resolved path, so they land exactly where
  // the containment check validated.
  const out = realTarget;

  if (existsSync(out)) {
    let nonEmpty;
    try {
      nonEmpty = readdirSync(out).length > 0;
    } catch {
      return usageError('refusing to overwrite a non-directory or unreadable target: ' + target);
    }

    if (nonEmpty) {
      if (!force) {
        return usageError('refusing to overwrite a non-empty target without --force: ' + target);
      }

      let generatorOwned = false;
      if (insideGenerated) {
        try {
          const marker = JSON.parse(
            readFileSync(join(out, 'profile.json'), 'utf8'),
          );
          generatorOwned = marker?.generator === 'scripts/generate-project.mjs';
        } catch {
          // Missing, unreadable or invalid manifests do not establish ownership.
        }
      }

      if (!generatorOwned) {
        return usageError(
          'refusing --force: target is not generator-owned inside generated/: ' + target,
        );
      }
    }

    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });

  const manifest = {
    ...profile,
    generatedAt: new Date().toISOString(),
    baseCommit: baseCommit(),
    generator: 'scripts/generate-project.mjs',
  };
  const readme = readmeFor(profile);

  if (profile.platform === 'cli') {
    writeFileSync(join(out, 'profile.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    writeFileSync(join(out, 'README.md'), readme, 'utf8');
    writeFileSync(
      join(out, 'package.json'),
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
      join(out, 'verify.mjs'),
    );
    copyFileSync(
      join(repoRoot, 'scripts', 'generate-templates', 'derive.mjs'),
      join(out, 'derive.mjs'),
    );
  } else if (profile.platform === 'web') {
    const source = join(repoRoot, 'apps', 'web');
    cpSync(source, out, {
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
    writeFileSync(join(out, 'profile.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    copyFileSync(join(out, 'README.md'), join(out, 'README-starter.md'));
    writeFileSync(join(out, 'README.md'), readme, 'utf8');
  } else if (profile.platform === 'android') {
    const source = join(repoRoot, 'apps', 'android');
    cpSync(source, out, {
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
    writeFileSync(join(out, 'profile.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    copyFileSync(join(out, 'README.md'), join(out, 'README-starter.md'));
    writeFileSync(join(out, 'README.md'), readme, 'utf8');
  } else {
    return usageError('unsupported platform for profile ' + profileId + ': ' + profile.platform);
  }

  console.log(out);
  console.log('generate-project: ' + countFiles(out) + ' files');
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
