// Regression tests for the T10 (W1) M-20–M-24 register remediation.
// Guards the Doc 3 register rows, the 4.9.1/4.9.2 version discipline,
// the auto-lock wording rule, the M-23 draft-absence finding and the
// M-24 TON generation-only resolution. Pure doc-consistency checks:
// they read the guides, they move no funds and touch no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const doc3 = fs.readFileSync(
  path.join(repoRoot, 'docs/android-wallet/ANDROID-GUIDE.md'), 'utf8');
const doc4 = fs.readFileSync(
  path.join(repoRoot, 'docs/mainnet/MAINNET-GUIDE.md'), 'utf8');
const doc11 = fs.readFileSync(
  path.join(repoRoot, 'docs/11-trust-wallet-and-independent-verification/README.md'),
  'utf8');

function section(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.notEqual(start, -1, `missing section ${startMarker}`);
  const end = endMarker ? text.indexOf(endMarker, start + 1) : text.length;
  return text.slice(start, end === -1 ? text.length : end);
}

test('M-20: OI-097–OI-102 rows exist in the Doc 3 register', () => {
  for (const id of ['OI-097', 'OI-098', 'OI-099', 'OI-100', 'OI-101', 'OI-102']) {
    assert.ok(doc3.includes(`| ${id} |`), `Doc 3 register is missing row ${id}`);
  }
  assert.ok(doc3.includes('OI-097 — Mainnet rehearsal evidence') ||
    doc3.includes('Mainnet rehearsal evidence'),
    'OI-097 must record rehearsal evidence');
  assert.ok(doc3.includes('OI-102 — Mainnet review-gate acceptance criteria') ||
    doc3.includes('review-gate acceptance criteria'),
    'OI-102 must record review-gate acceptance criteria');
});

test('M-20: the Doc 4 M-20 row stays OPEN and records the Doc 3 rows', () => {
  const m20 = section(doc4, '### M-20 —', '### M-21 —');
  assert.match(m20, /\*\*Status:\*\* OPEN/, 'M-20 must stay OPEN');
  assert.ok(m20.includes('OI-097'), 'M-20 must cite the Doc 3 rows');
  assert.ok(m20.includes('Recording them does not clear this row') ||
    m20.includes('recording a gate does not clear it'),
    'M-20 must state that recording does not clear the row');
});

test('M-21: no guide prescribes 4.9.2 as the repository pin', () => {
  const forbidden = [
    'is superseded; do not build against it',
    'is the signing pin for built apps',
    'in place of the superseded 4.8.4 pin',
    'The release tagged **4.9.2** is an upgrade candidate',
  ];
  for (const phrase of forbidden) {
    assert.ok(!doc3.includes(phrase), `ANDROID-GUIDE still says: ${phrase}`);
    assert.ok(!doc4.includes(phrase), `MAINNET-GUIDE still says: ${phrase}`);
    assert.ok(!doc11.includes(phrase), `Doc 11 still says: ${phrase}`);
  }
  // The corrected discipline must be stated: repo pin 4.8.4, candidate 4.9.1.
  assert.ok(doc4.includes('**4.9.1**, the latest stable at the baseline') ||
    doc4.includes('upgrade candidate is **4.9.1**') ||
    doc4.includes('the upgrade candidate is `4.9.1`'),
    'Doc 4 must name 4.9.1 as the upgrade candidate');
  assert.ok(doc3.includes('repository pin remains `4.8.4`') ||
    doc3.includes('repository pin is `4.8.4`'),
    'Android guide must state the repository pin remains 4.8.4');
});

test('M-21: the shared 4.9.1/4.9.2 source commit is 17e3cd4, not d40d24a', () => {
  const m21 = section(doc4, '### M-21 —', '### M-22 —');
  assert.ok(m21.includes('17e3cd4df5d53f061ade3bbdc07d196f5ed5a8e3'),
    'M-21 must cite the correct shared commit 17e3cd4');
  assert.ok(!m21.includes('share source commit `d40d24a`'),
    'M-21 must not attribute the 4.8.4 commit d40d24a to 4.9.1/4.9.2');
  assert.ok(m21.includes('18e563fce2111a6fa5ad372cabeb83e6ed0998f0'),
    'M-21 must cite the verified 4.9.1 npm SHA-1');
});

test('M-21: the 4.9.1 qualification run is recorded and the row is resolved', () => {
  const m21 = section(doc4, '### M-21 —', '### M-22 —');
  assert.match(m21, /RESOLVED 2026-11-12/,
    'M-21 must record the resolved qualification run');
  assert.ok(m21.includes('7/7 byte-identical'),
    'M-21 must record the derivation result');
  assert.ok(m21.includes('qualification is not promotion'),
    'M-21 must state qualification is not promotion');
  assert.ok(m21.includes('repository pin stays `4.8.4`'),
    'M-21 must state the repo pin stays 4.8.4');
});

test('M-22: every "10 minutes of inactivity" mention is a correction', () => {
  for (const [name, text] of [['Doc 4', doc4], ['Doc 3', doc3], ['Doc 11', doc11]]) {
    for (const line of text.split('\n')) {
      if (line.includes('10 minutes of inactivity')) {
        assert.ok(line.includes('inaccurate'),
          `${name}: uncorrected "10 minutes of inactivity" claim: ${line.trim()}`);
      }
    }
  }
  const section10 = section(doc4, '#### Web draft browser vault', '#### Android Keystore vault');
  assert.ok(section10.includes('re-arms only on unlock or mnemonic access'),
    '§10 must describe the re-arm behaviour (unlock or mnemonic access)');
  assert.ok(section10.includes('Lock explicitly'),
    '§10 must tell readers to lock explicitly');
});

test('M-23: the row records that the cited draft is absent from the repo', () => {
  const m23 = section(doc4, '### M-23 —', '### M-24 —');
  assert.match(m23, /\*\*Status:\*\* OPEN/, 'M-23 must stay OPEN');
  assert.ok(m23.includes('do not exist in the repository'),
    'M-23 must record that WalletSession.kt/Screens.kt/App.kt are absent');
  assert.ok(m23.includes('981d0ba'), 'M-23 must pin the finding to the checked tip');
});

test('M-24: §13 stays capability-boundaries only for TON', () => {
  const m24 = section(doc4, '### M-24 —', '### M-25 —');
  assert.match(m24, /RESOLVED 2026-11-10/, 'M-24 must stay RESOLVED 2026-11-10');
  const s13 = section(doc4, '## 13. Sending and signing', '## 14. Fees');
  assert.ok(s13.includes('TON is generation-only'),
    '§13 must state TON is generation-only');
  assert.ok(s13.includes('TON send is out of scope'),
    '§13.7 must carry the TON-send scope box');
  assert.ok(s13.includes('no TON send procedure'),
    '§13 must state there is no TON send procedure');
});
