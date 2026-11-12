// Regression test for OI-095 (D22 F3): Node engine-strict enforcement.
//
// Each engines-declaring install root must carry its own .npmrc with
// engine-strict=true. npm reads only ONE project .npmrc (the nearest
// package.json root) and does not merge ancestor files, so a root
// .npmrc alone does not cover tools/, tools/hdwallet-gen/ or apps/web/.
// Without these files npm only warns (EBADENGINE) on an out-of-range
// Node and installs anyway; with them the install fails.
//
// Run standalone: node --test tests/npm-engine-strict.test.mjs
// (also runnable as: node tests/npm-engine-strict.test.mjs)
// No network, no install: asserts the effective per-project npm config
// with user/global config isolated, so ambient machine config cannot
// mask a missing repository file. Live install behaviour (Node 22
// pass; Node 24 and Node 20 EBADENGINE failure) is verified by the
// install matrix in the T06 lane evidence, not by this test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const DIRS = ['.', 'tools', 'tools/hdwallet-gen', 'apps/web'];

test('engine-declaring projects enable engine-strict (OI-095)', (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'bawa-npm-config-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));

  const userConfig = join(tmp, 'user.npmrc');
  const globalConfig = join(tmp, 'global.npmrc');
  writeFileSync(userConfig, '');
  writeFileSync(globalConfig, '');

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)),
  );

  for (const dir of DIRS) {
    const cwd = resolve(repoRoot, dir);
    const npmrc = join(cwd, '.npmrc');
    assert.ok(existsSync(npmrc), `${dir}: missing .npmrc`);
    const content = readFileSync(npmrc, 'utf8');
    assert.match(content, /^engine-strict=true$/m, `${dir}: .npmrc lacks engine-strict=true`);
    const value = execFileSync(
      'npm',
      [
        'config', 'get', 'engine-strict',
        `--userconfig=${userConfig}`,
        `--globalconfig=${globalConfig}`,
      ],
      { cwd, env, encoding: 'utf8' },
    );
    assert.equal(value.trim(), 'true', `${dir}: effective engine-strict is not true`);
  }
});
