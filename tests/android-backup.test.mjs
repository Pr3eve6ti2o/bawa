// Regression tests for the generated Android wallet's backup opt-out
// (T49 F-03). The starter manifest shipped with allowBackup="true" and
// no extraction rules, so a future persistence layer would have let
// system backup / device transfer copy wallet data off-device. The
// template must opt out before persistence lands.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MANIFEST = new URL(
  '../apps/android/app/src/main/AndroidManifest.xml',
  import.meta.url,
);
const RULES = new URL(
  '../apps/android/app/src/main/res/xml/data_extraction_rules.xml',
  import.meta.url,
);

function section(xml, name) {
  // Strip XML comments first: the header comment names the sections
  // in prose (e.g. "<device-transfer>"), which must not match.
  const body = xml.replace(/<!--[\s\S]*?-->/g, '');
  const match = body.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  assert.ok(match, 'data extraction rules must contain a <' + name + '> section');
  return match[1];
}

function domains(sectionXml) {
  return [...sectionXml.matchAll(/<exclude domain="([^"]+)" path="\." \/>/g)].map((m) => m[1]);
}

describe('generated Android wallet backup opt-out (T49 F-03)', () => {
  test('the manifest disables backup and references extraction rules', () => {
    const manifest = readFileSync(MANIFEST, 'utf8');
    assert.ok(
      manifest.includes('android:allowBackup="false"'),
      'manifest must set allowBackup="false"',
    );
    assert.ok(
      manifest.includes('android:fullBackupContent="false"'),
      'manifest must set fullBackupContent="false"',
    );
    assert.ok(
      manifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"'),
      'manifest must reference the data extraction rules',
    );
    assert.ok(
      !manifest.includes('android:allowBackup="true"'),
      'manifest must not contain allowBackup="true"',
    );
  });

  test('the extraction rules exclude every storage domain in both sections', () => {
    const xml = readFileSync(RULES, 'utf8');
    // All nine domains in EACH section: exclusions do not inherit
    // across sections, and an empty device-transfer would transfer
    // everything (T49 F-03, C5 re-audit).
    const allNine = [
      'database',
      'device_database',
      'device_file',
      'device_root',
      'device_sharedpref',
      'external',
      'file',
      'root',
      'sharedpref',
    ];
    assert.deepEqual(
      domains(section(xml, 'cloud-backup')).sort(),
      allNine,
      'cloud-backup must exclude every domain',
    );
    assert.deepEqual(
      domains(section(xml, 'device-transfer')).sort(),
      allNine,
      'device-transfer must exclude every domain',
    );
  });
});
