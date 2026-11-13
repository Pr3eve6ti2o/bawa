import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateAll } from '../scripts/validate-registry.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const registryDir = path.join(repoRoot, 'registry');

const statuses = new Set([
  'IMPLEMENTED_AND_VERIFIED',
  'DOCUMENTED_NOT_TESTED',
  'PROPOSED',
  'OPEN',
  'UNVERIFIED',
  'EXTERNALLY_DEPENDENT',
]);

const operations = [
  'generate',
  'derive',
  'watch-only',
  'receive-address',
  'import',
  'recover',
  'send',
  'sign',
  'broadcast',
  'confirm',
];

const profileFields = [
  'id',
  'platform',
  'chains',
  'engine',
  'ui',
  'security',
  'verification',
  'status',
  'sources',
];

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function readRegistry(dir, name) {
  const filename = path.join(dir, `${name}.json`);
  const document = readJson(filename);
  const entries = Array.isArray(document)
    ? document
    : (document?.entries ?? document?.[name]);

  assert.ok(Array.isArray(entries), `${name}.json must contain an entries array`);
  assert.ok(entries.length > 0, `${name}.json must not be empty`);

  return { filename, document, entries };
}

function makeFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bawa-registry-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // Include the schemas and dereference links to keep all mutations isolated.
  fs.cpSync(registryDir, dir, { recursive: true, dereference: true });
  return dir;
}

function mutateRegistry(dir, name, mutate) {
  const { filename, document, entries } = readRegistry(dir, name);
  const result = mutate(entries);
  fs.writeFileSync(filename, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return result;
}

function assertErrorMentions(errors, id) {
  assert.equal(typeof id, 'string');
  assert.ok(
    errors.some((error) => error.includes(id)),
    `Expected an error mentioning "${id}"; received:\n${errors.join('\n') || '(none)'}`,
  );
}

test('the real registry validates with the expected counts', async () => {
  const { errors, counts } = await validateAll(registryDir);

  assert.deepEqual(errors, []);
  assert.equal(counts.files, 4);
  // 32 since E02 (2026-11-13): the trust-wallet-core-4-9-3 engine entry.
  assert.equal(counts.entries, 32);
});

test('a profile missing its required status is rejected', async (t) => {
  const dir = makeFixture(t);
  const id = mutateRegistry(dir, 'profiles', (profiles) => {
    const profile = profiles[0];
    assert.ok(Object.hasOwn(profile, 'status'));
    delete profile.status;
    return profile.id;
  });

  const { errors } = await validateAll(dir);
  assertErrorMentions(errors, id);
});

test('a UI entry with a status outside the enum is rejected', async (t) => {
  const dir = makeFixture(t);
  const id = mutateRegistry(dir, 'ui', (entries) => {
    entries[0].status = 'VERIFIED';
    return entries[0].id;
  });

  const { errors } = await validateAll(dir);
  assertErrorMentions(errors, id);
});

test('an unknown profile id is rejected', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'profiles', (profiles) => {
    profiles[0].id = 'super-wallet';
  });

  const { errors } = await validateAll(dir);
  assert.ok(errors.length > 0, 'Expected an unknown profile id to be rejected');
});

test('an unknown UI foundation reference is rejected', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'profiles', (profiles) => {
    const profile = profiles.find((entry) => entry.id === 'web-wallet');
    assert.ok(profile, 'Expected the web-wallet profile');
    profile.ui.foundation = 'no-such-template';
  });

  const { errors } = await validateAll(dir);
  assert.ok(
    errors.length > 0,
    'Expected an unknown UI foundation reference to be rejected',
  );
});

test('a duplicate engine id is rejected', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'engines', (entries) => {
    entries.push({ ...entries[0] });
  });

  const { errors } = await validateAll(dir);
  assert.ok(errors.length > 0, 'Expected a duplicate engine id to be rejected');
});

test('send marked IMPLEMENTED_AND_VERIFIED triggers the hard rule', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'capabilities', (entries) => {
    assert.ok(Object.hasOwn(entries[0].capabilities, 'send'));
    entries[0].capabilities.send = 'IMPLEMENTED_AND_VERIFIED';
  });

  const { errors } = await validateAll(dir);
  assert.ok(
    errors.some((error) =>
      /hard[\s-]*rule/i.test(error)
      || (/\bsend\b/i.test(error) && error.includes('IMPLEMENTED_AND_VERIFIED')),
    ),
    `Expected the send hard-rule error; received:\n${errors.join('\n') || '(none)'}`,
  );
});

test('T44-F9: a profile platform outside the enum is rejected', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'profiles', (profiles) => {
    profiles[0].platform = 'ios';
  });

  const { errors } = await validateAll(dir);
  assert.ok(errors.length > 0, 'Expected an unknown platform to be rejected');
  assertErrorMentions(errors, 'platform');
});

test('T44-F9: a profile claiming send as implemented triggers the hard rule', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'profiles', (profiles) => {
    profiles[0].implemented = [...(profiles[0].implemented ?? []), 'send'];
  });

  const { errors } = await validateAll(dir);
  assert.ok(
    errors.some((error) =>
      /hard[\s-]*rule/i.test(error) && /\bsend\b/i.test(error),
    ),
    `Expected the send hard-rule error; received:\n${errors.join('\n') || '(none)'}`,
  );
});

test('T44-F9: a profile implemented list that is not an array of strings is rejected', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'profiles', (profiles) => {
    profiles[0].missing = 'send';
  });

  const { errors } = await validateAll(dir);
  assert.ok(errors.length > 0, 'Expected a non-array missing list to be rejected');
  assertErrorMentions(errors, 'missing');
});

test('T44-F9: a profile with empty chains is rejected', async (t) => {
  const dir = makeFixture(t);
  mutateRegistry(dir, 'profiles', (profiles) => {
    profiles[0].chains = [];
  });

  const { errors } = await validateAll(dir);
  assert.ok(errors.length > 0, 'Expected empty chains to be rejected');
  assertErrorMentions(errors, 'chains');
});

test('every profile contains all required profile schema fields', () => {
  const { entries: profiles } = readRegistry(registryDir, 'profiles');
  assert.equal(profiles.length, 7);

  for (const profile of profiles) {
    for (const field of profileFields) {
      assert.ok(
        Object.hasOwn(profile, field),
        `${profile.id ?? '<unnamed profile>'} is missing "${field}"`,
      );
      assert.notEqual(
        profile[field],
        undefined,
        `${profile.id ?? '<unnamed profile>'}.${field} must not be undefined`,
      );
    }
  }
});

test('all eight capability entries have explicit statuses for all ten operations', () => {
  const { entries } = readRegistry(registryDir, 'capabilities');
  assert.equal(entries.length, 8);

  for (const entry of entries) {
    const capabilities = entry.capabilities;
    assert.ok(
      capabilities !== null
        && typeof capabilities === 'object'
        && !Array.isArray(capabilities),
      `${entry.id} must have a capabilities object`,
    );

    for (const operation of operations) {
      const label = `${entry.id}.capabilities.${operation}`;

      assert.ok(
        Object.hasOwn(capabilities, operation),
        `${label} must be present`,
      );
      assert.notEqual(
        capabilities[operation],
        undefined,
        `${label} must not be undefined`,
      );
      assert.ok(
        statuses.has(capabilities[operation]),
        `${label} must have a recognised status, got ${JSON.stringify(capabilities[operation])}`,
      );
    }
  }
});

test('schema files are valid JSON and declare draft 2020-12', () => {
  for (const filename of ['profile.schema.json', 'registry.schema.json']) {
    const schema = readJson(path.join(registryDir, 'schemas', filename));

    assert.equal(
      typeof schema.$schema,
      'string',
      `${filename} must declare $schema`,
    );
    assert.match(
      schema.$schema,
      /2020-12/,
      `${filename} must declare JSON Schema draft 2020-12`,
    );
  }
});

// T46: registry-claims, engine-pin and profile-asset checks. The
// fixture is a minimal repo scaffold (registry + tool pin + ai files)
// so validateAll can run with an explicit repo root.
const PROFILE_IDS = [
  'hd-wallet-cli',
  'bitcoin-wallet',
  'evm-wallet',
  'multichain-wallet',
  'web-wallet',
  'android-wallet',
  'watch-only-wallet',
];

function promptFile(id) {
  return id === 'hd-wallet-cli' ? 'create-hd-wallet.md' : `create-${id}.md`;
}

function makeRepoFixture(t, { pin = '4.9.3' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bawa-t46-repo-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = path.join(root, 'registry');
  fs.cpSync(registryDir, registry, { recursive: true, dereference: true });
  const toolDir = path.join(root, 'tools', 'hdwallet-gen');
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(
    path.join(toolDir, 'package.json'),
    `${JSON.stringify({ name: 'bawa-hd-wallet-core-tools', dependencies: { '@trustwallet/wallet-core': pin } }, null, 2)}\n`,
    'utf8',
  );
  for (const id of PROFILE_IDS) {
    fs.mkdirSync(path.join(root, 'ai', 'profiles'), { recursive: true });
    fs.mkdirSync(path.join(root, 'ai', 'prompts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'ai', 'profiles', `${id}.md`), `# ${id}\n`, 'utf8');
    fs.writeFileSync(path.join(root, 'ai', 'prompts', promptFile(id)), `# ${id}\n`, 'utf8');
  }
  return { root, registry };
}

function mutateFixtureProfile(fixture, id, mutate) {
  const filename = path.join(fixture.registry, 'profiles.json');
  const profiles = readJson(filename);
  const profile = profiles.find((entry) => entry.id === id);
  assert.ok(profile, `Expected a ${id} profile`);
  mutate(profile);
  fs.writeFileSync(filename, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
}

test('T46: an implemented send claim is rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  mutateFixtureProfile(fixture, 'web-wallet', (profile) => {
    profile.implemented = ['send'];
  });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assertErrorMentions(errors, 'web-wallet');
  assert.ok(
    errors.some((error) => /\bsend\b/i.test(error)),
    `Expected a send-claim error; received:\n${errors.join('\n') || '(none)'}`,
  );
});

test('T46: send/sign/broadcast wording variants are rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  mutateFixtureProfile(fixture, 'web-wallet', (profile) => {
    profile.implemented = [
      'Sending BTC to friends',
      'SIGNING support',
      'broadcasting transactions',
    ];
  });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  for (const wording of ['Sending BTC', 'SIGNING', 'broadcasting']) {
    assert.ok(
      errors.some((error) => error.includes(wording)),
      `Expected an error mentioning "${wording}"; received:\n${errors.join('\n') || '(none)'}`,
    );
  }
});

test('T46 re-audit: euphemistic capability claims are rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  mutateFixtureProfile(fixture, 'web-wallet', (profile) => {
    profile.implemented = [
      'sent transactions',
      'signature creation',
      'submit transactions',
    ];
  });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  for (const wording of ['sent transactions', 'signature creation', 'submit transactions']) {
    assert.ok(
      errors.some((error) => error.includes(wording)),
      `Expected an error mentioning "${wording}"; received:\n${errors.join('\n') || '(none)'}`,
    );
  }
});

test('T46: implemented/missing overlap is rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  mutateFixtureProfile(fixture, 'web-wallet', (profile) => {
    assert.ok(profile.implemented.includes('receive-QR display'));
    profile.missing = [...profile.missing, 'receive-QR display'];
  });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assert.ok(
    errors.some((error) => /both implemented\[\] and missing\[\]/i.test(error)),
    `Expected an overlap error; received:\n${errors.join('\n') || '(none)'}`,
  );
});

test('T46: implemented must be an array of strings', async (t) => {
  const fixture = makeRepoFixture(t);
  mutateFixtureProfile(fixture, 'web-wallet', (profile) => {
    profile.implemented = 'send';
  });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assertErrorMentions(errors, 'web-wallet');
});

test('T46: coordinated wrong engine versions are rejected by the tool pin', async (t) => {
  const fixture = makeRepoFixture(t);
  mutateRegistry(fixture.registry, 'profiles', (profiles) => {
    for (const profile of profiles) profile.engine.version = '4.9.1';
  });
  mutateRegistry(fixture.registry, 'engines', (entries) => {
    for (const entry of entries) {
      if (typeof entry.name === 'string' && entry.name.includes('Trust Wallet Core')) {
        entry.revision = '4.9.1';
      }
    }
  });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assert.ok(
    errors.some((error) => error.includes("does not match the tools/hdwallet-gen pin '4.9.3'")),
    `Expected a pin-mismatch error; received:\n${errors.join('\n') || '(none)'}`,
  );
});

test('T46: a non-exact tool pin is rejected', async (t) => {
  const fixture = makeRepoFixture(t, { pin: '^4.9.3' });
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assert.ok(
    errors.some((error) => /exact X\.Y\.Z/i.test(error)),
    `Expected a non-exact-pin error; received:\n${errors.join('\n') || '(none)'}`,
  );
});

test('T46: a missing profile prompt file is rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  fs.rmSync(path.join(fixture.root, 'ai', 'prompts', 'create-web-wallet.md'));
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assertErrorMentions(errors, 'create-web-wallet.md');
});

test('T46: a missing profile file is rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  fs.rmSync(path.join(fixture.root, 'ai', 'profiles', 'web-wallet.md'));
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assertErrorMentions(errors, 'ai/profiles/web-wallet.md');
});

test('T46 re-audit: a symlinked profile file pointing outside is rejected', async (t) => {
  const fixture = makeRepoFixture(t);
  const outside = path.join(fixture.root, 'outside.md');
  fs.writeFileSync(outside, '# outside\n', 'utf8');
  const link = path.join(fixture.root, 'ai', 'profiles', 'web-wallet.md');
  fs.rmSync(link);
  fs.symlinkSync(outside, link, 'file');
  const { errors } = await validateAll(fixture.registry, undefined, fixture.root);
  assertErrorMentions(errors, 'ai/profiles/web-wallet.md');
});
