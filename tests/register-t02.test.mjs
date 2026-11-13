import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// T02 (W1 register: M-08, M-42, M-43, M-44) — TRON energy estimation.
// Guards the 2026-11-12 register dispositions in Doc 4 §21 against
// silent regression: the refuted 0.001 TRX/unit shorthand must never
// return as a live rate, the M-08 dry-run evidence must stay recorded,
// and the M-42 file:line citations must stay present.
// Read-only: this test reads docs/mainnet/MAINNET-GUIDE.md only.

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const guide = fs.readFileSync(
  path.join(repoRoot, 'docs/mainnet/MAINNET-GUIDE.md'),
  'utf8',
);

function section(marker) {
  const start = guide.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${marker}`);
  return guide.slice(start, guide.indexOf('\n### ', start + marker.length) === -1
    ? undefined
    : guide.indexOf('\n### ', start + marker.length));
}

test('M-08 is resolved with the recorded 2026-11-12 dry run', () => {
  const row = section('### M-08 — TRON energy estimation');
  assert.match(row, /\*\*Status:\*\* RESOLVED 2026-11-12/);
  assert.match(row, /triggerconstantcontract/);
  assert.match(row, /energy_used: 64285/);
  assert.match(row, /energy_penalty: 49635/);
  assert.match(row, /4101b9f7b1756add6eb67f9825159577c08e845777/);
  assert.match(row, /TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/);
  // A dry run is a simulation, not a broadcast: the H-04 rehearsal
  // requirement for a real-transfer cost must stay in the row.
  assert.match(row, /H-04/);
});

test('M-44 is resolved at 100 SUN per energy unit', () => {
  const row = section('### M-44 — TRON energy burn-rate conflict');
  assert.match(row, /\*\*Status:\*\* RESOLVED 2026-11-12/);
  assert.match(row, /getEnergyFee: 100/);
  assert.match(row, /0\.0001 TRX/);
});

test('the 0.001 TRX per-energy shorthand stays refuted, never a live rate', () => {
  assert.match(guide, /That shorthand is \*\*REFUTED\*\*/);
  // The shorthand may only appear in refuting/quoting contexts: once in
  // §14 (marked REFUTED), once quoted in the M-44 question, once quoted
  // in the M-44 evidence as not found verbatim in the slices. Never as
  // a live energy rate.
  const energyRateClaims = guide.match(/0\.001 TRX per energy unit/g) ?? [];
  assert.equal(energyRateClaims.length, 3);
  assert.match(guide, /The m12 summary assigns \*\*0\.001 TRX per energy unit\*\*[\s\S]{0,600}?REFUTED/);
  // The reverted 8,624-energy reading must stay flagged never-to-quote.
  assert.match(guide, /8,624 energy[\s\S]{0,200}?must never be quoted as a USDT transfer cost/);
});

test('the base-vs-total energy reconciliation stays recorded', () => {
  assert.match(guide, /14,650 base energy/);
  assert.match(guide, /49,635 dynamic-energy penalty/);
  assert.match(guide, /64,285/);
});

test('M-42 is resolved with exact file:line citations', () => {
  const row = section('### M-42 — Exact file:line citations');
  assert.match(row, /\*\*Status:\*\* RESOLVED 2026-11-12/);
  assert.match(row, /README\.md:985/);
  assert.match(row, /docs\/RECOVERY\.md:20-236/);
  assert.match(row, /README\.md:1160-1192/);
  // The citations must exist in the guide prose, not only in the row.
  assert.match(guide, /README\.md:985 at 56396a20/);
  assert.match(guide, /docs\/RECOVERY\.md:89-236 at 56396a20/);
});

test('M-43 stays open with the partial 2026-11-12 check recorded', () => {
  const row = section('### M-43 — Explorer paid-plan links');
  assert.match(row, /\*\*Status:\*\* OPEN — partially cleared 2026-11-12/);
  assert.match(row, /Etherscan/);
  assert.match(row, /TronGrid/);
  assert.match(row, /TonAPI/);
  // The old blanket-UNVERIFIED sentence must be gone from §11.
  assert.doesNotMatch(guide, /Explorer paid-plan prices are \*\*UNVERIFIED\*\* and are not quoted here/);
  assert.match(guide, /Explorer pricing is partially verified/);
});
