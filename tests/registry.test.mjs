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
  assert.equal(counts.entries, 31);
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
