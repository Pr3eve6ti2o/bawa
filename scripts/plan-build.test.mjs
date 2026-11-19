// scripts/plan-build.test.mjs — tests for the PR2 planner (Lane B).
// Run: node scripts/plan-build.test.mjs
// Plain node:test; no dependencies.

import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFromRequest, planFromNaturalLanguage } from './plan-build.mjs';

const REGISTRY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'registry',
);

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    targets: ['web'],
    mode: 'opt-in-read-only',
    networks: [{ id: 'btc', profile: 'web-wallet' }],
    require: ['create', 'derive', 'receive'],
    broadcast: 'disabled',
    ...overrides,
  };
}

function codes(result) {
  assert.equal(result.ok, false, 'expected ok:false, got ok:true');
  return result.errors.map((e) => e.code);
}

test('Solana on web-wallet is rejected with CHAIN_NOT_SUPPORTED (the misroute)', () => {
  const result = planFromRequest(
    request({ networks: [{ id: 'solana', profile: 'web-wallet' }] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('CHAIN_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
  const error = result.errors.find(
    (e) => e.code === 'CHAIN_NOT_SUPPORTED',
  );
  assert.match(error.message, /solana/);
  assert.match(error.message, /web-wallet/);
  assert.match(error.message, /btc, eth, trx, ton/);
  assert.match(error.message, /no profile in the registry supports solana/);
});

test('Solana is rejected the same way through the natural-language entry point', () => {
  const result = planFromNaturalLanguage(
    'web-wallet',
    ['solana'],
    ['create', 'derive', 'receive'],
    'opt-in-read-only',
    'disabled',
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('CHAIN_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
});

test('unknown chain (cosmos) is rejected with UNKNOWN_CHAIN', () => {
  const result = planFromRequest(
    request({ networks: [{ id: 'cosmos', profile: 'web-wallet' }] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('UNKNOWN_CHAIN'),
    JSON.stringify(result.errors),
  );
  assert.ok(!codes(result).includes('CHAIN_NOT_SUPPORTED'));
});

test('valid request passes (web-wallet, btc, create+derive+receive)', () => {
  const result = planFromRequest(request(), REGISTRY_DIR);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.plan.targets, ['web']);
  assert.equal(result.plan.profile, 'web-wallet');
  assert.deepEqual(result.plan.chains, ['btc']);
  assert.deepEqual(result.plan.operations, ['create', 'derive', 'receive']);
  assert.equal(result.plan.mode, 'opt-in-read-only');
  assert.equal(result.plan.engine.name, 'trust-wallet-core');
  assert.equal(result.plan.engine.version, '4.9.3');
});

test('valid request passes through the natural-language entry point', () => {
  // Registry v2: hd-wallet-cli supports create/derive/restore; receive is
  // DOCUMENTED_NOT_TESTED for a CLI (no receive UI), so it is not requested.
  const result = planFromNaturalLanguage(
    'hd-wallet-cli',
    ['btc'],
    ['create', 'derive'],
    'opt-in-read-only',
    'disabled',
    REGISTRY_DIR,
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.plan.targets, ['cli']);
  assert.equal(result.plan.profile, 'hd-wallet-cli');
});

test('broadcast enabled is rejected with BROADCAST_NOT_DISABLED', () => {
  const result = planFromRequest(request({ broadcast: 'enabled' }), REGISTRY_DIR);
  assert.ok(
    codes(result).includes('BROADCAST_NOT_DISABLED'),
    JSON.stringify(result.errors),
  );
});

test('offline mode + balance is rejected with MODE_OPERATION_CONFLICT', () => {
  const result = planFromRequest(
    request({ mode: 'offline', require: ['create', 'balance'] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('MODE_OPERATION_CONFLICT'),
    JSON.stringify(result.errors),
  );
});

test('an operation the profile does not support is rejected (fee-quote: DOCUMENTED_NOT_TESTED for web-wallet, registry v2)', () => {
  const result = planFromRequest(
    request({ require: ['create', 'fee-quote'] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('OPERATION_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
  // opt-in-read-only mode: no mode conflict for fee-quote, only support.
  assert.ok(!codes(result).includes('MODE_OPERATION_CONFLICT'));
});

test('an operation the profile does not support is rejected (local-sign: sign is DOCUMENTED_NOT_TESTED)', () => {
  const result = planFromRequest(
    request({
      require: ['create', 'plan-transfer', 'local-sign', 'verify-signature'],
    }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('OPERATION_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
  // plan-transfer + verify-signature present, so no mode conflict.
  assert.ok(!codes(result).includes('MODE_OPERATION_CONFLICT'));
});

test('an operation the profile does not support is rejected (verify-signature: DOCUMENTED_NOT_TESTED for web-wallet, registry v2)', () => {
  const result = planFromRequest(
    request({ require: ['verify-signature'] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('OPERATION_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
});

test('unknown profile is rejected with UNKNOWN_PROFILE', () => {
  const result = planFromRequest(
    request({ networks: [{ id: 'btc', profile: 'no-such-wallet' }] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('UNKNOWN_PROFILE'),
    JSON.stringify(result.errors),
  );
});

test('known chain outside the profile is rejected (ton on watch-only-wallet)', () => {
  const result = planFromRequest(
    request({ networks: [{ id: 'ton', profile: 'watch-only-wallet' }] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('CHAIN_NOT_SUPPORTED'),
    JSON.stringify(result.errors),
  );
  const error = result.errors.find(
    (e) => e.code === 'CHAIN_NOT_SUPPORTED',
  );
  assert.match(error.message, /supported by:/);
});

test('local-sign without plan-transfer and verify-signature is a mode conflict', () => {
  const result = planFromRequest(
    request({ require: ['create', 'local-sign'] }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(result).includes('MODE_OPERATION_CONFLICT'),
    JSON.stringify(result.errors),
  );
});

test('invalid schema is rejected with INVALID_SCHEMA', () => {
  for (const bad of [
    request({ schemaVersion: 2 }),
    request({ targets: [] }),
    request({ targets: ['ios'] }),
    request({ mode: 'online' }),
    request({ networks: [] }),
    request({ require: [] }),
    request({ require: ['swap'] }),
  ]) {
    const result = planFromRequest(bad, REGISTRY_DIR);
    assert.ok(
      codes(result).includes('INVALID_SCHEMA'),
      JSON.stringify({ bad, errors: result.errors }),
    );
  }
  const missingBroadcast = request();
  delete missingBroadcast.broadcast;
  assert.ok(
    codes(planFromRequest(missingBroadcast, REGISTRY_DIR)).includes(
      'INVALID_SCHEMA',
    ),
  );
});

test('all errors are collected, not just the first', () => {
  const result = planFromRequest(
    request({
      broadcast: 'enabled',
      networks: [{ id: 'cosmos', profile: 'web-wallet' }],
    }),
    REGISTRY_DIR,
  );
  assert.ok(codes(result).includes('BROADCAST_NOT_DISABLED'));
  assert.ok(codes(result).includes('UNKNOWN_CHAIN'));
  assert.ok(result.errors.length >= 2);
});

test('TON derive passes under registry v2 (verified by the rebuilt app)', () => {
  // Registry v2 records TON derive as IMPLEMENTED_AND_VERIFIED (the rebuilt
  // app verified it), flipping the v1 fail-closed behaviour Lane B pinned.
  // TON fee-quote is still DOCUMENTED_NOT_TESTED and must fail closed.
  const derived = planFromRequest(
    request({
      networks: [{ id: 'ton', profile: 'web-wallet' }],
      require: ['derive'],
    }),
    REGISTRY_DIR,
  );
  assert.equal(derived.ok, true, JSON.stringify(derived.errors));
  const quoted = planFromRequest(
    request({
      networks: [{ id: 'ton', profile: 'web-wallet' }],
      require: ['create', 'fee-quote'],
    }),
    REGISTRY_DIR,
  );
  assert.ok(
    codes(quoted).includes('OPERATION_NOT_SUPPORTED'),
    JSON.stringify(quoted.errors),
  );
});
