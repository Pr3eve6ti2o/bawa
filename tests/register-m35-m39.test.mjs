import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const guideFile = 'docs/mainnet/MAINNET-GUIDE.md';

function readRepo(file) {
  return readFileSync(resolve(repoRoot, file), 'utf8');
}

// Slice one §21 row out of the guide, from its heading to the next row's heading.
function rowSection(guide, id, nextId) {
  const start = guide.indexOf(`### ${id} `);
  assert.ok(start !== -1, `Missing register row ${id} in ${guideFile}`);
  const end = guide.indexOf(`### ${nextId} `, start);
  assert.ok(end !== -1, `Missing register row ${nextId} after ${id} in ${guideFile}`);
  return guide.slice(start, end);
}

describe('register M-35–M-39 (§21)', () => {
  test('M-35 stays OPEN: rehearsal execution is not authorised and no procedure exists', () => {
    const guide = readRepo(guideFile);
    const row = rowSection(guide, 'M-35', 'M-36');

    assert.ok(
      row.includes('Status:** OPEN (amounts approved for review only 2026-11-10; execution NOT authorised)'),
      'M-35 must stay OPEN with execution NOT authorised',
    );
    assert.ok(
      row.includes('NOT authorisation to execute transactions'),
      'M-35 must state the review-only amounts are NOT authorisation to execute',
    );
    assert.ok(
      row.includes('T13 re-check 2026-11-12:'),
      'M-35 must carry the dated T13 re-verification note',
    );
    assert.ok(
      guide.includes('No rehearsal procedure is supplied here.'),
      '§13 must keep stating that no rehearsal procedure is supplied',
    );
  });

  test('M-36 stays OPEN: no "larger amounts" threshold is defined anywhere', () => {
    const guide = readRepo(guideFile);
    const row = rowSection(guide, 'M-36', 'M-37');

    assert.ok(row.includes('Status:** OPEN.'), 'M-36 must stay OPEN');
    assert.ok(
      row.includes('no threshold for "larger amounts" is defined anywhere'),
      'M-36 must keep stating that no threshold is defined',
    );
    assert.ok(
      row.includes('Maintainer decision stating a number or a rule'),
      'M-36 clearance must still require a maintainer decision',
    );
    assert.ok(
      row.includes('T13 re-check 2026-11-12:'),
      'M-36 must carry the dated T13 re-verification note',
    );
    assert.ok(
      guide.includes('It contains no transaction construction, signing, broadcast or PSBT code.'),
      '§13 must keep presenting hardware/PSBT as direction only, not a shipped feature',
    );
  });

  test('M-37 stays OPEN: no approval-validity duration is defined; §13.4 names no in-repo code', () => {
    const guide = readRepo(guideFile);
    const row = rowSection(guide, 'M-37', 'M-38');

    assert.ok(row.includes('Status:** OPEN.'), 'M-37 must stay OPEN');
    assert.ok(
      row.includes('no tested approval deadline is defined'),
      'M-37 must keep stating that no approval deadline is defined',
    );
    assert.ok(
      row.includes('Maintainer-defined finite validity policy plus offline expiry/mutation tests'),
      'M-37 clearance must still require a maintainer policy plus offline expiry/mutation tests',
    );
    // The M-37 note carries the commit in parentheses, so no colon follows the date.
    assert.ok(
      row.includes('T13 re-check 2026-11-12'),
      'M-37 must carry the dated T13 re-verification note',
    );
    assert.ok(
      guide.includes('are not present in this repository. They must not be treated as in-repo code until their location is recorded.'),
      '§13.4 must carry the caveat that the named approval functions/files are not in this repo',
    );
    assert.ok(
      guide.includes('The approval-validity question remains open under M-37.'),
      '§13.4 caveat must keep M-37 open',
    );
  });

  test('M-38 stays RESOLVED with the ETH "12" unsourced-extra-minimum qualification', () => {
    const guide = readRepo(guideFile);
    const row = rowSection(guide, 'M-38', 'M-39');

    assert.ok(
      row.includes('Status:** RESOLVED 2026-11-10'),
      'M-38 must stay RESOLVED 2026-11-10',
    );
    assert.ok(
      row.includes('never as a sourced threshold'),
      'M-38 must keep the ETH "12" never-as-sourced-threshold restriction',
    );
    assert.ok(
      row.includes('T13 re-check 2026-11-12:'),
      'M-38 must carry the dated T13 re-verification note',
    );
    assert.ok(
      guide.includes('12 alone is insufficient'),
      '§16 must keep stating that 12 alone is insufficient for Ethereum',
    );
    assert.ok(
      guide.includes('19 distinct active Super Representatives'),
      '§16 must keep the TRON 19-SR solidification threshold',
    );
  });

  test('M-39 stays OPEN: no GUI withdrawal route is confirmed', () => {
    const guide = readRepo(guideFile);
    const row = rowSection(guide, 'M-39', 'M-40');

    assert.ok(
      row.includes('Status:** OPEN (findings accepted 2026-11-10; GUI withdrawal route unverified)'),
      'M-39 must stay OPEN with the GUI withdrawal route unverified',
    );
    assert.ok(
      row.includes('is the documented expert-assisted route'),
      'M-39 must keep naming @ton/ton as the documented expert-assisted route only',
    );
    assert.ok(
      row.includes('T13 re-check 2026-11-12:'),
      'M-39 must carry the dated T13 re-verification note',
    );
    // Count inside §14 only: the M-39 re-check note itself quotes the table wording,
    // so a whole-guide count would include the quotation.
    const section14Start = guide.indexOf('## 14.');
    const section14End = guide.indexOf('## 15.', section14Start);
    assert.ok(section14Start !== -1 && section14End !== -1, '§14 boundaries not found');
    const section14 = guide.slice(section14Start, section14End);
    const blocked = section14.match(/Not established by the evidence — blocked/g) ?? [];
    assert.equal(
      blocked.length,
      4,
      '§14 boundary table must keep all four chains "Not established by the evidence — blocked"',
    );
  });
});
