#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stepNames = ['setup', 'build', 'test'];
const notes = [
  'send/sign/broadcast is not implemented in either starter',
  'balances, prices and transaction history are unavailable — no provider selected',
  'on-device address derivation is not implemented on Android — no Trust Wallet Core AAR exists',
  'a successful build on one platform does not imply success on the other',
];

function main() {
  const [request, ...args] = process.argv.slice(2);
  if (
    request === undefined ||
    (args.length !== 0 &&
      (args.length !== 2 || args[0] !== '--out' || !args[1]?.trim()))
  ) {
    console.error(
      'Usage: node scripts/build-wallet.mjs "<request>" [--out <report-path>]',
    );
    return 2;
  }

  const profiles = JSON.parse(
    readFileSync(resolve(repoRoot, 'registry/profiles.json'), 'utf8'),
  );
  if (!Array.isArray(profiles)) {
    throw new Error('registry/profiles.json must contain a JSON array');
  }

  const lower = request.toLowerCase();
  if (!lower.includes('wallet')) {
    console.log('cannot classify request');
    return 2;
  }

  let profileId;
  if (lower.includes('android')) {
    profileId = 'android-wallet';
  } else if (lower.includes('web') || lower.includes('website')) {
    profileId = 'web-wallet';
  } else if (
    lower.includes('multi-chain') ||
    lower.includes('multichain') ||
    lower.includes('both')
  ) {
    profileId = 'multichain-wallet';
  } else if (lower.includes('watch-only') || lower.includes('watch only')) {
    profileId = 'watch-only-wallet';
  } else {
    profileId = 'watch-only-wallet';
  }

  const profile = profiles.find(entry => entry?.id === profileId);
  if (!profile) {
    throw new Error(`profile not found in registry: ${profileId}`);
  }

  const platforms =
    profile.id === 'web-wallet'
      ? ['web']
      : profile.id === 'android-wallet'
        ? ['android']
        : ['web', 'android'];

  const steps = [];
  for (const platform of platforms) {
    let blocked = false;
    for (const step of stepNames) {
      const record = { step, platform, status: 'NOT-RUN' };
      steps.push(record);
      if (blocked) continue;

      if (
        platform === 'android' &&
        step === 'setup' &&
        (!process.env.JAVA_HOME || !process.env.ANDROID_HOME)
      ) {
        record.status = 'SKIPPED';
        blocked = true;
        continue;
      }

      let result;
      try {
        result = spawnSync(
          process.execPath,
          [`scripts/${step}.mjs`, '--platform', platform],
          { cwd: repoRoot, stdio: 'inherit' },
        );
      } catch (error) {
        result = { status: null, error };
      }

      // Only attempted steps have an exit code; null is never success.
      record.exitCode = result.status ?? null;
      record.status =
        result.status === 0 && !result.error ? 'VERIFIED' : 'FAILED';
      blocked = record.status !== 'VERIFIED';

      if (result.error) {
        console.error(
          `build-wallet: could not run ${step} for ${platform}: ${result.error.message}`,
        );
      }
    }
  }

  const generatedAt = new Date().toISOString();
  const report = {
    request,
    profile: profile.id,
    platforms,
    steps,
    generatedAt,
    notes,
  };
  const reportPath = resolve(
    repoRoot,
    args[1] ??
      `reports/build-wallet-${generatedAt.replace(/[:.]/g, '-')}.json`,
  );

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const summaries = platforms.map(platform => {
    const entries = steps.filter(entry => entry.platform === platform);
    let status = 'NOT-RUN';
    if (entries.some(entry => entry.status === 'FAILED')) {
      status = 'FAILED';
    } else if (entries.some(entry => entry.status === 'SKIPPED')) {
      status = 'SKIPPED';
    } else if (
      entries.length === stepNames.length &&
      entries.every(entry => entry.status === 'VERIFIED')
    ) {
      status = 'VERIFIED';
    }
    return { platform, status };
  });

  console.log(reportPath);
  console.log(
    `build-wallet: ${summaries
      .map(({ platform, status }) => `${status} ${platform}`)
      .join(', ')}`,
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
