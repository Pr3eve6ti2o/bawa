// scripts/verify-token-bitget.test.mjs — tests for the Lane H agent-side
// Bitget deep check. Run: node scripts/verify-token-bitget.test.mjs
// Plain node:test; no dependencies; no network (fetch is mocked).

import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyToken } from './verify-token-bitget.mjs';

const CHAIN = 'eth';
const CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

function infoEntry(overrides = {}) {
  return {
    chain: 'eth',
    contract: CONTRACT,
    symbol: 'USDC',
    name: 'USD Coin',
    price: 1.001,
    holders: 9272568,
    liquidity: 339462344,
    top10_holder_percent: 0.3,
    insider_holder_percent: 0.01,
    sniper_holder_percent: 0.02,
    dev_holder_percent: 0,
    dev_rug_percent: 0,
    dev_issue_coin_count: 0,
    dev_rug_coin_count: 0,
    lock_lp_percent: 0,
    ...overrides,
  };
}

function auditEntry(overrides = {}) {
  return {
    chain: 'eth',
    contract: CONTRACT,
    highRisk: false,
    riskCount: 0,
    warnCount: 0,
    buyTax: 0,
    sellTax: 0,
    support: 1,
    ...overrides,
  };
}

// Mock fetch: first call is batchGetBaseInfo, second is security/audits.
function mockFetch(info, audit) {
  let calls = 0;
  return async (url) => {
    calls += 1;
    const isAudit = String(url).includes('security/audits');
    const payload = isAudit
      ? { status: 0, data: [audit] }
      : { status: 0, data: { list: [info] } };
    return { ok: true, json: async () => payload };
  };
}

test('real token with a clean audit verifies', async () => {
  const result = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(infoEntry(), auditEntry()),
  });
  assert.equal(result.verdict, 'VERIFIED');
  assert.equal(result.symbol, 'USDC');
  assert.equal(result.name, 'USD Coin');
  assert.deepEqual(result.reasons, []);
});

test('zeroed stub (no symbol/name) is unverified, never verified', async () => {
  const stub = infoEntry();
  delete stub.symbol;
  delete stub.name;
  stub.price = 0;
  stub.holders = 0;
  const result = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(stub, auditEntry()),
  });
  assert.equal(result.verdict, 'UNVERIFIED');
});

test('highRisk audit is high-risk', async () => {
  const result = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(infoEntry(), auditEntry({ highRisk: true, riskCount: 3 })),
  });
  assert.equal(result.verdict, 'HIGH-RISK');
  assert.match(result.reasons.join(' '), /highRisk/);
});

test('dev rug percent above 20 is high-risk (fraction and percent scales)', async () => {
  const byFraction = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(
      infoEntry({ dev_rug_percent: 0.3, dev_issue_coin_count: 10, dev_rug_coin_count: 3 }),
      auditEntry(),
    ),
  });
  assert.equal(byFraction.verdict, 'HIGH-RISK');
  assert.match(byFraction.reasons.join(' '), /dev rug percent 30%/);
  const byPercent = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(
      infoEntry({ dev_rug_percent: 30, dev_issue_coin_count: 10, dev_rug_coin_count: 3 }),
      auditEntry(),
    ),
  });
  assert.equal(byPercent.verdict, 'HIGH-RISK');
});

test('sell tax at 50 is high-risk; at 15 it is a warning', async () => {
  const risky = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(infoEntry(), auditEntry({ sellTax: 50 })),
  });
  assert.equal(risky.verdict, 'HIGH-RISK');
  const warned = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(infoEntry(), auditEntry({ sellTax: 15 })),
  });
  assert.equal(warned.verdict, 'VERIFIED-WITH-WARNINGS');
  assert.match(warned.warnings.join(' '), /sell tax 15%/);
});

test('sniper holders above 10 warn; top-10 above 50 warn (fractions normalised)', async () => {
  const result = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(infoEntry({ sniper_holder_percent: 0.15, top10_holder_percent: 0.6 }), auditEntry()),
  });
  assert.equal(result.verdict, 'VERIFIED-WITH-WARNINGS');
  assert.equal(result.warnings.length, 2);
});

test('audit with support 0 is unverified, never clean', async () => {
  const result = await verifyToken({
    chain: CHAIN,
    contract: CONTRACT,
    fetchFn: mockFetch(infoEntry(), auditEntry({ support: 0 })),
  });
  assert.equal(result.verdict, 'UNVERIFIED');
  assert.match(result.reasons.join(' '), /support 0/);
});

test('failed fetch is unverified, never throws', async () => {
  const failing = async () => {
    throw new Error('network down');
  };
  const result = await verifyToken({ chain: CHAIN, contract: CONTRACT, fetchFn: failing });
  assert.equal(result.verdict, 'UNVERIFIED');
});

test('unmapped chain is skipped, not fetched', async () => {
  let called = false;
  const counting = async () => {
    called = true;
    return { ok: true, json: async () => ({}) };
  };
  const result = await verifyToken({ chain: 'sol', contract: CONTRACT, fetchFn: counting });
  assert.equal(result.verdict, 'UNVERIFIED');
  assert.equal(called, false);
  assert.match(result.reasons.join(' '), /not mapped/);
});
