#!/usr/bin/env node
// build-wallet.mjs — the one-prompt workflow: classify a plain-language
// wallet request, generate a differentiated project for its profile,
// verify that project, and write a JSON report.
// Usage: node scripts/build-wallet.mjs "<request>" [--out <report-path>]
// Hand-applied by the coordinator from the prescribed design (acceptance
// programme, 2026-11-10): Astra stalled 3x on code prompts in this lane
// (a01, a01b, a02 — 3 x 600s kills, 0 output), so the coordinator wrote
// this rewrite directly and verified it first-hand, per the A-3 precedent.
// Acceptance fix (2026-11-10, Orion, first-hand): the CLI path never
// installed tools/hdwallet-gen dependencies, so the one-prompt command
// failed from a genuinely clean checkout (verify 0/3, exit 1). The setup
// step below installs them (F-18: npm ci unconditionally, so a
// partial/corrupt/wrong-version wallet-core dir cannot skip the install
// and get VERIFIED).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRequest, extractChains, findRefusal } from './classify-request.mjs';
import { planFromNaturalLanguage } from './plan-build.mjs';
import { validateAll } from './validate-registry.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const notes = [
  'broadcast is not implemented anywhere',
  'prices are unavailable — no provider selected',
  'on-device address derivation is not implemented on Android — no Trust Wallet Core AAR exists',
  'a successful build on one platform does not imply success on the other',
];

// Platform-aware fallback for the registry's implemented/missing lists.
// Mirrors scripts/generate-project.mjs; retained because the schema does
// not require implemented/missing, so a future profile may still omit them.
const fallbackImplemented = {
  cli: ['Derivation primitives via the repository tools (see security notes)'],
  web: ['In-browser HD wallet creation (BIP-39 24 words, empty passphrase) with password-protected encrypted local vault (AES-256-GCM, PBKDF2 600k) and recovery confirmation reproducing identical addresses', 'Watch-only address derivation in the browser for BTC/ETH/TRX via wallet-core WASM', '14 screens with honest loading/empty/stale/locked/gate-failed/error states', 'Receive-QR display', 'Import of extended public keys only', 'Read-only mainnet balances and transaction history via per-chain adapters', 'Offline send: transaction construction (plan-transfer) and local signing via wallet-core AnySigner for all four chains, with post-sign verification for BTC/ETH/TRX'],
  android: ['Extended-public-key validation (no secrets, no derivation on-device)', '14-screen UI navigation with mock data and unavailable actions labelled as such', 'QR display of an address'],
};
const fallbackMissing = {
  cli: ['send', 'sign', 'broadcast', 'balances', 'prices', 'history'],
  web: ['broadcast', 'prices'],
  android: ['on-device derivation', 'send', 'sign', 'broadcast', 'balances', 'prices', 'history', 'wallet creation and backup (repository tools only)'],
};

function usageError(message) {
  console.error('Usage: node scripts/build-wallet.mjs "<request>" [--out <report-path>]');
  if (message) console.error('build-wallet: ' + message);
  return 2;
}

function listFiles(dir, base) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listFiles(path, base));
    else out.push(relative(base, path));
  }
  return out.sort();
}

function runStep(record, command, args, cwd) {
  let result;
  try {
    result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  } catch (error) {
    result = { status: null, error };
  }
  record.exitCode = result.status ?? null;
  record.status = result.status === 0 && !result.error ? 'VERIFIED' : 'FAILED';
  if (result.error) {
    console.error(`build-wallet: could not run ${record.step} for ${record.platform}: ${result.error.message}`);
  }
  return record.status === 'VERIFIED';
}

function writeReport(report, outArg) {
  const generatedAt = new Date().toISOString();
  report.generatedAt = generatedAt;
  const reportPath = resolve(
    repoRoot,
    outArg ?? `reports/build-wallet-${generatedAt.replace(/[:.]/g, '-')}.json`,
  );
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function main() {
  const [request, ...args] = process.argv.slice(2);
  if (
    request === undefined ||
    (args.length !== 0 &&
      (args.length !== 2 || args[0] !== '--out' || !args[1]?.trim()))
  ) {
    return usageError();
  }
  const outArg = args.length === 2 ? args[1] : null;

  // F-31: refusal screen, before classification. A refusal is a JSON
  // report with the exact sentence from ai/request-routing.md, profile
  // null, exit 2.
  const refusal = findRefusal(request);
  if (refusal) {
    const reportPath = writeReport(
      {
        request,
        profile: null,
        platforms: [],
        steps: [],
        generatedPath: null,
        generatedFiles: [],
        capabilities: { implemented: [], missing: [], chains: [] },
        verification: null,
        ambiguous: null,
        refusal,
        notes,
      },
      outArg,
    );
    console.log(reportPath);
    console.log('build-wallet: REFUSED');
    return 2;
  }

  // T46: validate the registry before trusting it. A separate quality
  // gate does not protect a direct one-prompt invocation: fail closed.
  const registryCheck = validateAll(
    join(repoRoot, 'registry'),
    undefined,
    repoRoot,
  );
  if (registryCheck.errors.length > 0) {
    for (const error of registryCheck.errors) {
      console.error(`build-wallet: ${error}`);
    }
    return 1;
  }

  const profiles = JSON.parse(
    readFileSync(resolve(repoRoot, 'registry/profiles.json'), 'utf8'),
  );
  if (!Array.isArray(profiles)) {
    throw new Error('registry/profiles.json must contain a JSON array');
  }

  // Classification lives in scripts/classify-request.mjs (F-20/21/22).
  // The registry profiles are passed in so the classifier's chain
  // check (PR2 Lane C) can verify a named chain against the matched
  // profile's chains.
  const result = classifyRequest(request, profiles);
  let profileId = null;
  let ambiguous = null;
  if (result.profile) {
    profileId = result.profile;
  } else if (result.ambiguous) {
    ambiguous = result.ambiguous;
    console.error('build-wallet: split this request into one build per requested profile');
  } else {
    // F-20: an unclassifiable request gets a JSON report with the
    // failure reason (not bare stderr), exit 2.
    const reportPath = writeReport(
      {
        request,
        profile: null,
        platforms: [],
        steps: [],
        generatedPath: null,
        generatedFiles: [],
        capabilities: { implemented: [], missing: [], chains: [] },
        verification: null,
        ambiguous: null,
        classificationFailure: result.reason,
        notes,
      },
      outArg,
    );
    console.log(reportPath);
    console.log('build-wallet: UNCLASSIFIABLE');
    return 2;
  }

  if (ambiguous) {
    const reportPath = writeReport(
      {
        request,
        profile: null,
        platforms: [],
        steps: [],
        generatedPath: null,
        generatedFiles: [],
        capabilities: { implemented: [], missing: [], chains: [] },
        verification: null,
        ambiguous,
        notes,
      },
      outArg,
    );
    console.log(reportPath);
    console.log('build-wallet: AMBIGUOUS');
    return 2;
  }

  const profile = profiles.find((entry) => entry?.id === profileId);
  if (!profile) {
    throw new Error(`profile not found in registry: ${profileId}`);
  }
  const platform = profile.platform;
  const generatedPath = join(repoRoot, 'generated', profileId);

  // PR2 Lane C: planner gate. After classification succeeds and before
  // ANY generation step, prove the classified profile can build for the
  // chains named in the request. This is the second layer behind the
  // classifier's own chain check, and the one that catches the
  // documented misroute (docs/wallet-reference-map.md:156):
  // classifyRequest() routed "Build a web wallet for Solana" to the
  // web-wallet profile even though that starter has no Solana support.
  // A planner rejection fails closed: a JSON report (same shape as the
  // refusal/unclassifiable reports, with a `planRejection` field
  // carrying the planner's errors), exit 2, and nothing generated.
  const namedChains = extractChains(request);
  const planChains =
    namedChains.length > 0 ? namedChains : [...profile.chains];
  // A plain-language build request implies wallet creation. Creation is
  // the one operation the registry verifies for every chain on every
  // profile: derive is OPEN for TON in the registry, so requiring it
  // would newly reject valid TON and no-chain builds that the profile's
  // own chains list supports. The gate's job here is the chain/profile
  // misroute, which the planner's chain check covers for any operation
  // set; broadcast stays disabled and the mode stays opt-in-read-only.
  const planResult = planFromNaturalLanguage(
    profileId,
    planChains,
    ['create'],
    'opt-in-read-only',
    'disabled',
    join(repoRoot, 'registry'),
  );
  if (!planResult.ok) {
    const reportPath = writeReport(
      {
        request,
        profile: profileId,
        platforms: [],
        steps: [],
        generatedPath: null,
        generatedFiles: [],
        capabilities: { implemented: [], missing: [], chains: [] },
        verification: null,
        ambiguous: null,
        planRejection: {
          profile: profileId,
          chains: planChains,
          errors: planResult.errors,
        },
        notes,
      },
      outArg,
    );
    console.log(reportPath);
    console.log('build-wallet: PLAN REJECTED');
    return 2;
  }

  // Test-only hook (used by scripts/build-wallet.test.mjs): stop after
  // the planner gate passes, without generating. It exists so the gate
  // can be verified for valid requests without running the slow
  // generate + verify steps (npm ci / vite build / vitest / gradle).
  // Never set in production use.
  if (process.env.BUILD_WALLET_STOP_AFTER_PLAN === '1') {
    console.log(
      `build-wallet: PLAN OK ${profileId} ${planChains.join(',')}`,
    );
    return 0;
  }

  const steps = [];
  let blocked = false;

  // Generate.
  const generate = { step: 'generate', platform, status: 'NOT-RUN' };
  steps.push(generate);
  const generated = runStep(generate, process.execPath,
    ['scripts/generate-project.mjs', profileId, '--out', generatedPath, '--force'], repoRoot);
  if (!generated) blocked = true;

  // Verify inside the generated directory.
  if (!blocked && platform === 'cli') {
    // Setup: the verify step runs the repo engine tools, which need the
    // tools/hdwallet-gen dependencies installed. F-18: run npm ci
    // unconditionally — a partial/corrupt/wrong-version wallet-core dir
    // must not skip the install and get VERIFIED.
    const setup = { step: 'setup', platform, status: 'NOT-RUN' };
    steps.push(setup);
    const engineDir = join(repoRoot, 'tools', 'hdwallet-gen');
    if (!runStep(setup, 'npm', ['ci', '--no-audit', '--no-fund'], engineDir)) {
      blocked = true;
    }
    const verify = { step: 'verify', platform, status: 'NOT-RUN' };
    steps.push(verify);
    if (!blocked && !runStep(verify, process.execPath, ['verify.mjs'], generatedPath)) blocked = true;
  } else if (!blocked && platform === 'web') {
    for (const [step, command, stepArgs] of [
      // F-19: npm ci, not npm install — the lockfile is enforced.
      ['setup', 'npm', ['ci', '--no-audit', '--no-fund']],
      ['build', 'npm', ['run', 'build']], ['test', 'npx', ['vitest', 'run']],
    ]) {
      const record = { step, platform, status: 'NOT-RUN' };
      steps.push(record);
      if (blocked) continue;
      if (!runStep(record, command, stepArgs, generatedPath)) blocked = true;
    }
  } else if (!blocked && platform === 'android') {
    // Setup is an environment check only: it verifies, it does not build.
    const setup = { step: 'setup', platform, status: 'NOT-RUN' };
    steps.push(setup);
    if (!process.env.JAVA_HOME || !process.env.ANDROID_HOME) {
      setup.status = 'SKIPPED';
      setup.reason = 'JAVA_HOME or ANDROID_HOME is unset';
      blocked = true;
    } else {
      setup.status = 'VERIFIED';
    }
    const build = { step: 'build', platform, status: 'NOT-RUN' };
    steps.push(build);
    if (!blocked && !runStep(build, './gradlew', ['assembleDebug', '--console=plain', '-q'], generatedPath)) {
      blocked = true;
    }
    const test = { step: 'test', platform, status: 'NOT-RUN' };
    steps.push(test);
    if (!blocked && !runStep(test, './gradlew', ['testDebugUnitTest', '--console=plain', '-q'], generatedPath)) {
      blocked = true;
    }
  }

  const capabilities = {
    implemented: Array.isArray(profile.implemented) ? profile.implemented : fallbackImplemented[platform],
    missing: Array.isArray(profile.missing) ? profile.missing : fallbackMissing[platform],
    chains: profile.chains,
  };
  const reportPath = writeReport(
    {
      request,
      profile: profile.id,
      platforms: [platform],
      steps,
      generatedPath,
      generatedFiles: listFiles(generatedPath, generatedPath),
      capabilities,
      verification: profile.status,
      ambiguous: null,
      notes,
    },
    outArg,
  );

  const summaries = [platform].map((entry) => {
    const entries = steps.filter((step) => step.platform === entry);
    let status = 'NOT-RUN';
    if (entries.some((step) => step.status === 'FAILED')) status = 'FAILED';
    else if (entries.some((step) => step.status === 'SKIPPED')) status = 'SKIPPED';
    else if (entries.length > 0 && entries.every((step) => step.status === 'VERIFIED')) status = 'VERIFIED';
    return { platform: entry, status };
  });

  console.log(reportPath);
  console.log(
    `build-wallet: ${summaries.map(({ platform: p, status }) => `${status} ${p}`).join(', ')}`,
  );
  return summaries.every(({ status }) => status === 'VERIFIED') ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(
    `build-wallet: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
