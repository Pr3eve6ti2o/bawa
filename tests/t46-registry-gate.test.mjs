// T46: generation fails closed on an invalid registry.
// Builds a minimal repo scaffold in a temp dir (scripts + registry +
// tools pin + ai files) so both generators run against a tampered
// registry without mutating the real checkout. Validation runs before
// any generation, so the tampered runs exit before touching apps/,
// templates or the network.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

function makeScaffold(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bawa-t46-scaffold-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(root, 'scripts'), {
    recursive: true,
    dereference: true,
  });
  fs.cpSync(path.join(repoRoot, 'registry'), path.join(root, 'registry'), {
    recursive: true,
    dereference: true,
  });
  fs.mkdirSync(path.join(root, 'tools', 'hdwallet-gen'), { recursive: true });
  fs.cpSync(
    path.join(repoRoot, 'tools', 'hdwallet-gen', 'package.json'),
    path.join(root, 'tools', 'hdwallet-gen', 'package.json'),
  );
  fs.cpSync(path.join(repoRoot, 'ai'), path.join(root, 'ai'), {
    recursive: true,
    dereference: true,
  });
  return root;
}

function tamperImplemented(root) {
  const filename = path.join(root, 'registry', 'profiles.json');
  const profiles = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const profile = profiles.find((entry) => entry.id === 'web-wallet');
  assert.ok(profile, 'Expected a web-wallet profile');
  profile.implemented = ['send', 'sign', 'broadcast'];
  fs.writeFileSync(filename, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
}

function runNode(root, args) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

describe('T46 registry gate at generation time', () => {
  test('generate-project fails closed on a tampered registry', (t) => {
    const root = makeScaffold(t);
    tamperImplemented(root);
    const result = runNode(root, [
      'scripts/generate-project.mjs',
      'web-wallet',
      '--out',
      'generated/t46',
      '--force',
    ]);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /send/i);
    assert.equal(
      fs.existsSync(path.join(root, 'generated', 't46')),
      false,
      'no output must be written when validation fails',
    );
  });

  test('build-wallet fails closed on a tampered registry', (t) => {
    const root = makeScaffold(t);
    tamperImplemented(root);
    const reportPath = path.join(root, 't46-report.json');
    const result = runNode(root, [
      'scripts/build-wallet.mjs',
      'Create a Web wallet',
      '--out',
      't46-report.json',
    ]);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /send/i);
    assert.equal(
      fs.existsSync(reportPath),
      false,
      'no report must be written when validation fails',
    );
  });

  test('generate-project still succeeds on a valid registry', (t) => {
    const root = makeScaffold(t);
    const result = runNode(root, [
      'scripts/generate-project.mjs',
      'hd-wallet-cli',
      '--out',
      'generated/ok',
    ]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(fs.existsSync(path.join(root, 'generated', 'ok', 'profile.json')));
    assert.ok(fs.existsSync(path.join(root, 'generated', 'ok', 'README.md')));
  });
});
