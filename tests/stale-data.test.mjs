import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function git(...args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const diagnostic =
    `git ${args.join(' ')} failed:\n${result.stderr ?? ''}` +
    (result.error ? `\n${result.error.message}` : '');

  assert.equal(result.status, 0, diagnostic);
  return result.stdout.trim();
}

describe('stale data', () => {
  test('engine pin matches the declared pin in both lockfiles', () => {
    for (const directory of ['tools/hdwallet-gen', 'apps/web']) {
      const packagePath = `${directory}/package.json`;
      const manifest = JSON.parse(read(packagePath));

      assert.equal(
        manifest.dependencies?.['@trustwallet/wallet-core'],
        '4.8.4',
        `${packagePath} must pin @trustwallet/wallet-core to 4.8.4`,
      );

      const lockPath = `${directory}/package-lock.json`;
      assert.ok(
        read(lockPath).includes('"@trustwallet/wallet-core": "4.8.4"'),
        `${lockPath} must contain the declared wallet-core pin`,
      );
    }
  });

  test('Doc 4 section 5 step-4 SHA names a real ancestor commit (staleness reported, not hidden)', () => {
    const head = git('rev-parse', 'HEAD');
    const guide = read('docs/mainnet/MAINNET-GUIDE.md');
    const match = guide.match(/git rev-parse HEAD\)" = "([0-9a-f]{40})"/);

    assert.ok(match, 'Doc 4 §5 step-4 SHA not found');
    const sha = match[1];

    git('merge-base', '--is-ancestor', sha, 'HEAD');

    if (sha !== head) {
      console.log(`INFO: Doc 4 §5 names ${sha} while HEAD is ${head}`);
    }
  });

  test('registry reviewed_at dates are present and parse as dates', () => {
    const now = Date.now();
    let oldest = null;

    function visit(value, location) {
      if (value === null || typeof value !== 'object') return;

      if (Object.hasOwn(value, 'reviewed_at')) {
        const reviewedAt = value.reviewed_at;
        const timestamp = Date.parse(reviewedAt);

        assert.ok(
          Number.isFinite(timestamp),
          `${location}: reviewed_at does not parse as a date: ${JSON.stringify(reviewedAt)}`,
        );
        assert.ok(
          timestamp <= now,
          `${location}: reviewed_at is in the future: ${JSON.stringify(reviewedAt)}`,
        );

        if (oldest === null || timestamp < oldest.timestamp) {
          oldest = { reviewedAt, timestamp, location };
        }
      }

      for (const [key, child] of Object.entries(value)) {
        visit(child, `${location}.${key}`);
      }
    }

    for (const path of [
      'registry/ui.json',
      'registry/engines.json',
      'registry/profiles.json',
    ]) {
      visit(JSON.parse(read(path)), path);
    }

    assert.ok(oldest, 'No registry reviewed_at dates found');
    console.log(
      `INFO: Oldest registry reviewed_at is ${oldest.reviewedAt} (${oldest.location})`,
    );
  });

  test('plan front matter records the Astra-only rule', () => {
    const plan = read('docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md');

    assert.ok(plan.includes('gpt-6-astra'), 'Plan must name gpt-6-astra');
    assert.ok(
      plan.includes('Astra is the only authorised'),
      'Plan must record the Astra-only rule',
    );
  });
});
