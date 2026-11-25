// scripts/verify-token-bitget.mjs — Lane H (usable-install mining pass).
// Agent-side Bitget deep check for one token, by contract address.
//
// Why this exists: the Bitget Agent API (https://copenapi.bgwapi.io,
// bitget-wallet-skill, MIT, no key) cannot fire from a browser — its
// OPTIONS handler demands X-SIGN/X-TIMESTAMP, which a CORS preflight
// never carries — so Lane A's in-app leg is wired but fail-closed in
// the browser (apps/web/src/wallet/token-verification.ts). From Node
// there is no preflight, so the same signed POSTs answer live. This
// script is the agent-side form: a dev/CI check, never shipped in the
// app bundle (zero bundle cost; scripts/ is not bundled).
//
// What it checks (two signed POSTs, both from the skill's
// bitget-wallet-agent-api.py `_request`, BKHmacAuth = unsalted SHA-256
// of method + path + body + timestamp — no secret):
//   1. /market/v3/coin/batchGetBaseInfo — identity: the entry must
//      match the exact chain + contract AND carry a non-empty symbol
//      and name. A fake contract answers a zeroed stub (no symbol/
//      name, price 0, holders 0), which is never a verification.
//      The same entry also carries the concentration fields the
//      browser leg does not use: top10/insider/sniper/dev holder
//      percents, dev rug percent + counts, LP lock percent.
//   2. /market/v3/coin/security/audits — the audit alone never
//      verifies (a fake answers highRisk false with support 0 —
//      audit pending), but a highRisk audit vetoes, and support 0
//      means "no audit": fail-closed, UNVERIFIED, never clean.
// Thresholds are the skill docs' own (bitget-wallet-skill/docs/
// market-data.md + token-analyze.md): dev_rug_percent > 20% red
// flag; sniper_holder_percent > 10% warning; top10 > 50%
// concentration risk; trade tax >= 50% risk, >= 10% warn.
// Scale note (verified live 2026-11-26): the API returns those
// "percent" fields as FRACTIONS — USDC top10 is 0.2248, PEPE's is
// 0.3807 — so this script normalises (0, 1] x100 to the docs' 0-100
// scale before comparing. The dev_rug_percent scale has no live
// non-zero sample; it is normalised like its sibling fields, and
// that inference is stated in asPercent, not hidden.
//
// Chains: the same six Lane A verified live (eth, bnb, matic,
// arbitrum, base, avax). Solana is deliberately absent: chain "sol"
// errors (errno 200200) and "solana" returns a zeroed stub for any
// contract, real or fake; op returns a stub for real USDC too.
//
// Cloudflare note (verified live 2026-11-26 from loud-stone): the API
// sits behind Cloudflare and returns 403 "error code: 1010" for a
// bare Python-urllib User-Agent. Node's fetch (undici) and
// python-requests User-Agents answer 200. This script sets an
// explicit User-Agent identifying itself.
//
// Usage:
//   node scripts/verify-token-bitget.mjs --chain eth --contract 0x...
//   node scripts/verify-token-bitget.mjs --chain eth --contract 0x... --json
// Exit code: 0 VERIFIED (or VERIFIED-WITH-WARNINGS), 1 HIGH-RISK or
// UNVERIFIED, 2 usage error. No secrets, no keys, no writes.
// Run: node scripts/verify-token-bitget.test.mjs (plain node:test).

import { createHash } from 'node:crypto';

/** Bitget Agent API base (bitget-wallet-skill, MIT, no key). */
export const BITGET_AGENT_API_BASE = 'https://copenapi.bgwapi.io';

/**
 * Bawa chain -> Bitget Agent API chain code. Only the chains verified
 * live 2026-11-25 are mapped (same map as
 * apps/web/src/wallet/token-verification.ts BITGET_CHAIN_FOR_CHAIN).
 * An unmapped chain is skipped, not fetched.
 */
export const BITGET_CHAIN_FOR_CHAIN = {
  eth: 'eth',
  bsc: 'bnb',
  matic: 'matic',
  arb: 'arbitrum',
  base: 'base',
  avax: 'avax',
};

/** Thresholds from bitget-wallet-skill/docs/market-data.md. */
export const THRESHOLDS = {
  devRugPercentRed: 20,
  sniperPercentWarn: 10,
  top10PercentWarn: 50,
  taxRisk: 50,
  taxWarn: 10,
};

const USER_AGENT = 'bawa-verify-token/1.0 (Node; +https://github.com/Pr3eve6ti2o/bawa)';

/** Hex-encode bytes (BKHmacAuth X-SIGN). */
function hexEncode(bytes) {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * One signed Bitget Agent API POST (bitget-wallet-skill
 * bitget-wallet-agent-api.py `_request`). Returns the parsed JSON,
 * or null on any failure (fail-closed, never throws).
 */
export async function bitgetSignedPost(path, body, fetchFn = globalThis.fetch) {
  const bodyStr = JSON.stringify(body);
  const ts = String(Date.now());
  const sign = `0x${hexEncode(
    createHash('sha256').update(`POST${path}${bodyStr}${ts}`).digest(),
  )}`;
  let response;
  try {
    response = await fetchFn(`${BITGET_AGENT_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        channel: 'toc_agent',
        brand: 'toc_agent',
        clientversion: '10.0.0',
        language: 'en',
        token: 'toc_agent',
        'User-Agent': USER_AGENT,
        'X-SIGN': sign,
        'X-TIMESTAMP': ts,
      },
      body: bodyStr,
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Exact chain + contract match (EVM addresses case-insensitive). */
function entryMatches(entry, bitgetChain, contract) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    typeof entry.chain === 'string' &&
    entry.chain.toLowerCase() === bitgetChain.toLowerCase() &&
    typeof entry.contract === 'string' &&
    entry.contract.toLowerCase() === contract.toLowerCase()
  );
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Normalise a holder/rug "percent" field to the 0-100 scale the skill
 * docs' thresholds use. Live answers (2026-11-26) return FRACTIONS:
 * USDC top10_holder_percent is 0.2248 and PEPE's is 0.3807 — 22% and
 * 38%, not 0.22% and 0.38%. A value in (0, 1] is therefore scaled
 * x100; a value above 1 is already a percent and is left alone. The
 * dev_rug_percent scale itself has no live non-zero sample — it is
 * normalised the same way as its sibling fields from the same
 * endpoint, and that inference is recorded here, not hidden.
 */
function asPercent(value) {
  const n = asNumber(value);
  if (n === null) return null;
  return n > 0 && n <= 1 ? n * 100 : n;
}

/**
 * Deep-check one token. Never throws: every failure is UNVERIFIED.
 * Returns { verdict, chain, contract, symbol, name, facts, warnings,
 * reasons } where verdict is VERIFIED, VERIFIED-WITH-WARNINGS,
 * HIGH-RISK or UNVERIFIED.
 */
export async function verifyToken({ chain, contract, fetchFn = globalThis.fetch }) {
  const result = {
    verdict: 'UNVERIFIED',
    chain,
    contract,
    symbol: null,
    name: null,
    facts: {},
    warnings: [],
    reasons: [],
  };
  const bitgetChain = BITGET_CHAIN_FOR_CHAIN[chain];
  if (bitgetChain === undefined) {
    result.reasons.push(`chain "${chain}" is not mapped to a Bitget chain code — skipped, not fetched`);
    return result;
  }

  const info = await bitgetSignedPost(
    '/market/v3/coin/batchGetBaseInfo',
    { list: [{ chain: bitgetChain, contract }] },
    fetchFn,
  );
  if (!isRecord(info) || info.status !== 0 || !isRecord(info.data) || !Array.isArray(info.data.list)) {
    result.reasons.push('token-info call failed or answered without data');
    return result;
  }
  const entry = info.data.list.find((item) => entryMatches(item, bitgetChain, contract));
  if (entry === undefined) {
    result.reasons.push('no token-info entry for this chain + contract');
    return result;
  }
  // A fake contract answers a zeroed stub: no symbol/name keys at all.
  if (typeof entry.symbol !== 'string' || entry.symbol === '' || typeof entry.name !== 'string' || entry.name === '') {
    result.reasons.push('token-info entry has no symbol/name — zeroed stub, not a real token');
    return result;
  }
  result.symbol = entry.symbol;
  result.name = entry.name;
  result.facts = {
    price: asNumber(entry.price),
    holders: asNumber(entry.holders),
    liquidity: asNumber(entry.liquidity),
    top10HolderPercent: asPercent(entry.top10_holder_percent),
    insiderHolderPercent: asPercent(entry.insider_holder_percent),
    sniperHolderPercent: asPercent(entry.sniper_holder_percent),
    devHolderPercent: asPercent(entry.dev_holder_percent),
    devRugPercent: asPercent(entry.dev_rug_percent),
    devIssueCoinCount: asNumber(entry.dev_issue_coin_count),
    devRugCoinCount: asNumber(entry.dev_rug_coin_count),
    lockLpPercent: asPercent(entry.lock_lp_percent),
  };

  const audit = await bitgetSignedPost(
    '/market/v3/coin/security/audits',
    { list: [{ chain: bitgetChain, contract }], source: 'bg' },
    fetchFn,
  );
  if (!isRecord(audit) || audit.status !== 0 || !Array.isArray(audit.data)) {
    result.reasons.push('security-audit call failed or answered without data — fail-closed');
    return result;
  }
  const auditEntry = audit.data.find((item) => entryMatches(item, bitgetChain, contract));
  if (auditEntry === undefined) {
    result.reasons.push('no security-audit entry for this chain + contract');
    return result;
  }
  // support 0 = audit pending: a fake answers highRisk false with
  // support 0, so "no audit" is UNVERIFIED, never clean.
  if (auditEntry.support !== 1) {
    result.reasons.push('security audit not supported for this token (support 0) — no audit, fail-closed');
    return result;
  }
  const buyTax = asNumber(auditEntry.buyTax);
  const sellTax = asNumber(auditEntry.sellTax);
  result.facts.highRisk = auditEntry.highRisk === true;
  result.facts.riskCount = asNumber(auditEntry.riskCount);
  result.facts.warnCount = asNumber(auditEntry.warnCount);
  result.facts.buyTax = buyTax;
  result.facts.sellTax = sellTax;

  // Red flags (HIGH-RISK). Thresholds: skill docs, market-data.md.
  if (auditEntry.highRisk === true) result.reasons.push('security audit flags highRisk');
  if (buyTax !== null && buyTax >= THRESHOLDS.taxRisk) result.reasons.push(`buy tax ${buyTax}% (>= ${THRESHOLDS.taxRisk}% risk)`);
  if (sellTax !== null && sellTax >= THRESHOLDS.taxRisk) result.reasons.push(`sell tax ${sellTax}% (>= ${THRESHOLDS.taxRisk}% risk)`);
  if (result.facts.devRugPercent !== null && result.facts.devRugPercent > THRESHOLDS.devRugPercentRed) {
    result.reasons.push(`dev rug percent ${result.facts.devRugPercent}% (> ${THRESHOLDS.devRugPercentRed}% red flag)`);
  }
  if (result.reasons.length > 0) {
    result.verdict = 'HIGH-RISK';
    return result;
  }

  // Warnings (verified, with notes). Thresholds: skill docs.
  if (result.facts.sniperHolderPercent !== null && result.facts.sniperHolderPercent > THRESHOLDS.sniperPercentWarn) {
    result.warnings.push(`sniper holders ${result.facts.sniperHolderPercent}% (> ${THRESHOLDS.sniperPercentWarn}% warning)`);
  }
  if (result.facts.top10HolderPercent !== null && result.facts.top10HolderPercent > THRESHOLDS.top10PercentWarn) {
    result.warnings.push(`top-10 holders ${result.facts.top10HolderPercent}% (> ${THRESHOLDS.top10PercentWarn}% concentration risk)`);
  }
  if (buyTax !== null && buyTax >= THRESHOLDS.taxWarn) result.warnings.push(`buy tax ${buyTax}% (>= ${THRESHOLDS.taxWarn}% warn)`);
  if (sellTax !== null && sellTax >= THRESHOLDS.taxWarn) result.warnings.push(`sell tax ${sellTax}% (>= ${THRESHOLDS.taxWarn}% warn)`);
  if (result.facts.devRugPercent !== null && result.facts.devRugPercent > 0) {
    result.warnings.push(`dev rug percent ${result.facts.devRugPercent}% (${result.facts.devRugCoinCount ?? '?'} of ${result.facts.devIssueCoinCount ?? '?'} dev projects rugged)`);
  }
  if (result.facts.riskCount !== null && result.facts.riskCount > 0) {
    result.warnings.push(`security audit risk count ${result.facts.riskCount}`);
  }
  result.verdict = result.warnings.length > 0 ? 'VERIFIED-WITH-WARNINGS' : 'VERIFIED';
  return result;
}

function parseArgs(argv) {
  const out = { chain: null, contract: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--chain' && argv[i + 1]) out.chain = argv[++i];
    else if (argv[i] === '--contract' && argv[i + 1]) out.contract = argv[++i];
    else if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else out.unknown = argv[i];
  }
  return out;
}

function usage() {
  return [
    'Usage: node scripts/verify-token-bitget.mjs --chain <bawa-chain> --contract <0x...>',
    '  --chain     Bawa chain id: eth, bsc, matic, arb, base, avax',
    '  --contract  EVM contract address (0x + 40 hex)',
    '  --json      Print the raw result JSON instead of the report',
    'Exit code: 0 VERIFIED (or VERIFIED-WITH-WARNINGS), 1 HIGH-RISK or UNVERIFIED, 2 usage error.',
  ].join('\n');
}

function formatReport(result) {
  const lines = [
    `Bitget deep check: ${result.chain}:${result.contract}`,
    `Verdict: ${result.verdict}`,
  ];
  if (result.symbol !== null) lines.push(`Token: ${result.symbol} — ${result.name}`);
  const facts = Object.entries(result.facts)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  if (facts.length > 0) lines.push(`Facts: ${facts.join(', ')}`);
  for (const warning of result.warnings) lines.push(`Warning: ${warning}`);
  for (const reason of result.reasons) lines.push(`Reason: ${reason}`);
  return lines.join('\n');
}

// CLI only when run directly (importing the module runs no network).
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  if (args.unknown !== undefined || args.chain === null || args.contract === null) {
    console.error(usage());
    process.exit(2);
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.contract)) {
    console.error(`contract "${args.contract}" is not a 0x + 40-hex EVM address`);
    process.exit(2);
  }
  const result = await verifyToken({ chain: args.chain, contract: args.contract });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatReport(result));
  process.exit(result.verdict === 'VERIFIED' || result.verdict === 'VERIFIED-WITH-WARNINGS' ? 0 : 1);
}
