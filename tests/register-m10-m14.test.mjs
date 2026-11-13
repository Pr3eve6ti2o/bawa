import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// T03 (2026-11-12): regression tests for Doc 4 §21 rows M-10–M-14.
// M-10 resolved on a first-hand primary-doc re-check; M-11 stays OPEN on the
// TronScan live-browser re-check; M-12 resolved with the §15 per-chain table;
// M-13 stays RESOLVED (validated); M-14 stays OPEN by design (dating rule).
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const guide = readFileSync(join(repoRoot, 'docs/mainnet/MAINNET-GUIDE.md'), 'utf8');

function row(id, nextId) {
  const start = guide.indexOf(`### ${id} —`);
  assert.ok(start !== -1, `${id} row not found`);
  const end = nextId ? guide.indexOf(`### ${nextId} —`, start) : guide.length;
  assert.ok(end !== -1, `${nextId} row not found`);
  return guide.slice(start, end);
}

describe('register M-10–M-14', () => {
  test('M-10 is RESOLVED with the 2026-11-12 primary-doc re-check evidence', () => {
    const m10 = row('M-10', 'M-11');
    assert.match(m10, /RESOLVED 2026-11-12/);
    assert.ok(m10.includes('invalidateNonces'), 'M-10 must name invalidateNonces');
    assert.ok(m10.includes('invalidateUnorderedNonces'), 'M-10 must name invalidateUnorderedNonces');
    assert.ok(m10.includes('docs.uniswap.org/contracts/permit2/overview'));
    assert.ok(m10.includes('primary source'), 'M-10 must record the source-code split honestly');
    assert.ok(!m10.includes('not yet checked'), 'M-10 must not still carry the un-checked marker');
  });

  test('M-11 stays OPEN on the TronScan live-browser re-check only', () => {
    const m11 = row('M-11', 'M-12');
    assert.match(m11, /Status:\*\* OPEN/);
    assert.ok(m11.includes('AccountPermissionUpdateContract'), 'M-11 must name ID 46 contract');
    assert.ok(m11.includes('approve(spender, 0)'), 'M-11 must record the nonzero-to-nonzero rule');
    assert.ok(m11.includes('live browser'), 'M-11 must name the live-browser blocker');
    assert.ok(m11.includes('developers.tron.network'), 'M-11 must cite the TRON docs verification');
  });

  test('M-12 is RESOLVED and the §15 per-chain table names all three forms per chain', () => {
    const m12 = row('M-12', 'M-13');
    assert.match(m12, /RESOLVED 2026-11-12/);
    assert.ok(m12.includes('42eab79'), 'M-12 must cite the commit the taxonomy dates from');
    assert.ok(guide.includes('#### Per-chain poisoning forms'), '§15 per-chain table missing');
    for (const chain of ['Bitcoin', 'Ethereum (and BNB Smart Chain)', 'TRON', 'TON']) {
      assert.ok(guide.includes(`| ${chain} |`), `§15 table missing row for ${chain}`);
    }
    for (const form of ['Zero-value', 'dust', 'fake-token']) {
      assert.ok(guide.includes(form), `§15 must name the ${form} form`);
    }
    assert.ok(guide.includes('never reselect it from history'), '§15 table must state the rule');
  });

  test('§15 still teaches the two-path Permit2 model and the TRON permission layer', () => {
    assert.ok(guide.includes('two independent paths'), '§15 must keep the Permit2 two-path model');
    assert.ok(guide.includes('does not cover TRON'), '§15 must keep Revoke.cash TRON exclusion');
    assert.ok(guide.includes('ID 46'), '§15 must keep the ID 46 marker');
  });

  test('M-13 stays RESOLVED: 1 masterchain seqno in §12, §14 and §17', () => {
    const m13 = row('M-13', 'M-14');
    assert.match(m13, /RESOLVED 2026-11-10/);
    const hits = guide.match(/1 masterchain seqno/g) ?? [];
    assert.ok(hits.length >= 3, `expected 1 masterchain seqno in §12/§14/§17, found ${hits.length}`);
  });

  test('M-14 stays OPEN by design and §14 dates its figures', () => {
    const m14 = row('M-14', 'M-15');
    assert.match(m14, /OPEN — by design/);
    assert.ok(m14.includes('standing dating rule'), 'M-14 must keep the dating rule');
    assert.ok(guide.includes('2026-11-09 ~11:54 UTC'), '§14 must date its fee figures');
    assert.ok(guide.includes('not current quotes'), '§14 must not present baselines as current');
  });
});
