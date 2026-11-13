// Regression tests for tools/mainnet-fees/fees.mjs (T32 / W3 mainnet).
// All tests use an injected fetch stub and a controllable clock: no
// live network. Live endpoint behaviour is checked separately by the
// read-only smoke script in the lane evidence directory, never here.
// Fake values only: the BTC 3 vs ~97 sat/vB pair is the recorded
// M-07 disagreement from 2026-11-09, used as a regression fixture.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  QUOTE_TTL_MS,
  SourceDisagreementError,
  StaleQuoteError,
  InsufficientFundsError,
  FetchFailureError,
  getBtcFee,
  getEthFee,
  getTronFee,
  getTonFee,
  calculateAmountPlusFee,
} from '../tools/mainnet-fees/fees.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const moduleText = readFileSync(`${repoRoot}tools/mainnet-fees/fees.mjs`, 'utf8');

function makeClock(startMs = 1_000_000) {
  let now = startMs;
  return {
    nowMs: () => now,
    advance: (ms) => { now += ms; },
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function stubFetch(routes) {
  // routes: [{ match(url, init) => boolean, respond(url, init) => response }]
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match(url, init)) return route.respond(url, init);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  fetchFn.calls = calls;
  return fetchFn;
}

function btcStub({ mempool = { fastestFee: 3, halfHourFee: 2, hourFee: 1 }, blockstream = { 1: 3, 3: 2, 6: 1 } } = {}) {
  return stubFetch([
    {
      match: (url) => url.includes('mempool.space'),
      respond: () => jsonResponse(mempool),
    },
    {
      match: (url) => url.includes('blockstream.info'),
      respond: () => jsonResponse(blockstream),
    },
  ]);
}

function ethStub({ primaryBaseFee = '0x10', secondBaseFee = '0x10', gasPrice = '0x20', reward = '0x5', oldestBlock = '0x100' } = {}) {
  return stubFetch([
    {
      match: (url, init) => url.includes('publicnode') && JSON.parse(init.body).method === 'eth_feeHistory',
      respond: () => jsonResponse({ result: { baseFeePerGas: [primaryBaseFee, primaryBaseFee], oldestBlock, reward: [[reward]] } }),
    },
    {
      match: (url, init) => url.includes('publicnode') && JSON.parse(init.body).method === 'eth_gasPrice',
      respond: () => jsonResponse({ result: gasPrice }),
    },
    {
      match: (url, init) => url.includes('cloudflare-eth') && JSON.parse(init.body).method === 'eth_feeHistory',
      respond: () => jsonResponse({ result: { baseFeePerGas: [secondBaseFee, secondBaseFee], oldestBlock, reward: [[reward]] } }),
    },
  ]);
}

function tronStub({ energyUsed = 1000, resultOk = true } = {}) {
  return stubFetch([
    {
      match: (url) => url.includes('trongrid'),
      respond: () => jsonResponse(resultOk
        ? { result: { result: true }, energy_used: energyUsed }
        : { result: { result: false }, energy_used: energyUsed }),
    },
  ]);
}

function tonStub({ fees = { in_fwd_fee: 10, storage_fee: 20, gas_fee: 30, fwd_fee: 40 }, ok = true } = {}) {
  return stubFetch([
    {
      match: (url) => url.includes('toncenter'),
      respond: () => jsonResponse(ok ? { ok: true, result: { source_fees: fees } } : { ok: false }),
    },
  ]);
}

const TRON_CALL = {
  ownerAddressHex: '41' + 'aa'.repeat(20),
  contractAddressHex: '41' + 'bb'.repeat(20),
  functionSelector: 'transfer(address,uint256)',
  parameterHex: 'cc'.repeat(64),
  callValueSun: 0n,
};

const TON_MESSAGE = {
  address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  bodyBocBase64: 'te6ccgEBAQEAAgAAAA==',
  initCodeBocBase64: null,
  initDataBocBase64: null,
};

describe('BTC fee retrieval (M-07)', () => {
  test('agreeing sources quote the mempool.space rate with full provenance', async () => {
    const clock = makeClock();
    const fetchFn = btcStub();
    const quote = await getBtcFee(250n, 1, fetchFn, clock.nowMs);
    assert.equal(quote.chain, 'BTC');
    assert.equal(quote.quote, 750n);
    assert.equal(typeof quote.quote, 'bigint');
    assert.equal(quote.unit, 'sat');
    assert.equal(quote.disagreement, false);
    assert.equal(quote.sources.length, 2);
    assert.equal(quote.sources[0].url, 'https://mempool.space/api/v1/fees/recommended');
    assert.equal(quote.sources[0].rawValue, '3');
    assert.equal(quote.sources[0].statedUnit, 'sat/vB');
    assert.equal(quote.sources[1].url, 'https://blockstream.info/api/fee-estimates');
    assert.equal(quote.sources[1].rawValue, '3');
    assert.equal(quote.sources[1].statedUnit, 'sat/vB');
    assert.equal(quote.expiresAtMs, quote.sources[0].fetchedAtMs + QUOTE_TTL_MS.BTC);
    assert.equal(QUOTE_TTL_MS.BTC, 60_000);
  });

  test('targetBlocks 3 and 6 select halfHourFee and hourFee', async () => {
    const clock = makeClock();
    const fetchFn = btcStub();
    assert.equal((await getBtcFee(10n, 3, fetchFn, clock.nowMs)).quote, 20n);
    assert.equal((await getBtcFee(10n, 6, fetchFn, clock.nowMs)).quote, 10n);
    await assert.rejects(() => getBtcFee(10n, 2, fetchFn, clock.nowMs), RangeError);
  });

  test('M-07 regression: 3 vs 0.972 sat/vB fails closed, no quote', async () => {
    const clock = makeClock();
    // Recorded 2026-11-09: mempool.space 3 sat/vB vs blockstream
    // "1": 0.972. The guide annotated that as ~97 sat/vB, a 100x
    // misreading; live data (evidence/probe-2026-11-12.json) shows
    // blockstream values are sat/vB-scale, so 0.972 is 0.972 sat/vB
    // and the real disagreement is 3x, not 32x. Still a disagreement,
    // so the module must fail closed.
    const fetchFn = btcStub({ blockstream: { 1: 0.972 } });
    await assert.rejects(() => getBtcFee(250n, 1, fetchFn, clock.nowMs), SourceDisagreementError);
  });

  test('live 2026-11-12 pair: mempool 4 vs blockstream 2.005 fails closed', async () => {
    const clock = makeClock();
    const fetchFn = btcStub({
      mempool: { fastestFee: 4, halfHourFee: 3, hourFee: 3 },
      blockstream: { 1: 2.005, 3: 2.005, 6: 1.11 },
    });
    await assert.rejects(() => getBtcFee(250n, 1, fetchFn, clock.nowMs), SourceDisagreementError);
  });

  test('blockstream float dust parses exactly, raw token kept verbatim', async () => {
    const clock = makeClock();
    // Live value shape: "1.0030000000000001" must read as 1003
    // milli-sat/vB, not drift through a float.
    const fetchFn = btcStub({ mempool: { fastestFee: 1, halfHourFee: 1, hourFee: 1 }, blockstream: { 1: 1.0030000000000001 } });
    const quote = await getBtcFee(10n, 1, fetchFn, clock.nowMs);
    assert.equal(quote.quote, 10n);
    assert.equal(quote.sources[1].rawValue, '1.0030000000000001');
  });

  test('small gaps pass: 100 vs 100.05 sat/vB is within tolerance', async () => {
    const clock = makeClock();
    const fetchFn = btcStub({ mempool: { fastestFee: 100, halfHourFee: 90, hourFee: 80 }, blockstream: { 1: 100.05 } });
    const quote = await getBtcFee(10n, 1, fetchFn, clock.nowMs);
    assert.equal(quote.quote, 1000n);
  });

  test('a missing source fails closed, never a single-source quote', async () => {
    const clock = makeClock();
    const fetchFn = stubFetch([
      { match: (url) => url.includes('mempool.space'), respond: () => jsonResponse({ fastestFee: 3, halfHourFee: 2, hourFee: 1 }) },
      { match: (url) => url.includes('blockstream.info'), respond: () => jsonResponse({}) },
    ]);
    await assert.rejects(() => getBtcFee(10n, 1, fetchFn, clock.nowMs), FetchFailureError);
  });

  test('a missing mempool rate field fails closed', async () => {
    const clock = makeClock();
    const fetchFn = btcStub({ mempool: { halfHourFee: 2, hourFee: 1 } });
    await assert.rejects(() => getBtcFee(10n, 1, fetchFn, clock.nowMs), FetchFailureError);
  });

  test('a transport failure fails closed', async () => {
    const clock = makeClock();
    const fetchFn = async () => { throw new Error('socket hang up'); };
    await assert.rejects(() => getBtcFee(10n, 1, fetchFn, clock.nowMs), FetchFailureError);
  });

  test('a non-2xx response fails closed', async () => {
    const clock = makeClock();
    const fetchFn = stubFetch([
      { match: () => true, respond: () => jsonResponse({ error: 'boom' }, 500) },
    ]);
    await assert.rejects(() => getBtcFee(10n, 1, fetchFn, clock.nowMs), FetchFailureError);
  });
});

describe('ETH fee retrieval (M-09)', () => {
  test('legacy fee is gasPrice x gasLimit with both RPCs in provenance', async () => {
    const clock = makeClock();
    const quote = await getEthFee(21_000n, 'legacy', ethStub(), clock.nowMs);
    assert.equal(quote.quote, 0x20n * 21_000n);
    assert.equal(quote.unit, 'wei');
    assert.equal(quote.sources.length, 3);
    assert.ok(quote.sources.some((s) => s.url.includes('cloudflare-eth')));
    assert.equal(quote.expiresAtMs - quote.quotedAtMs, QUOTE_TTL_MS.ETH);
    assert.equal(QUOTE_TTL_MS.ETH, 15_000);
  });

  test('eip1559 fee is (2 x baseFee + priority) x gasLimit', async () => {
    const clock = makeClock();
    const quote = await getEthFee(21_000n, 'eip1559', ethStub(), clock.nowMs);
    assert.equal(quote.quote, (2n * 0x10n + 0x5n) * 21_000n);
  });

  test('second-RPC base fee diverging beyond 1% fails closed', async () => {
    const clock = makeClock();
    await assert.rejects(
      () => getEthFee(21_000n, 'legacy', ethStub({ secondBaseFee: '0x12' }), clock.nowMs),
      SourceDisagreementError,
    );
  });

  test('cross-check blocks diverging fails closed', async () => {
    const clock = makeClock();
    const fetchFn = stubFetch([
      {
        match: (url, init) => url.includes('publicnode') && JSON.parse(init.body).method === 'eth_feeHistory',
        respond: () => jsonResponse({ result: { baseFeePerGas: ['0x10', '0x10'], oldestBlock: '0x100', reward: [['0x5']] } }),
      },
      {
        match: (url, init) => url.includes('cloudflare-eth'),
        respond: () => jsonResponse({ result: { baseFeePerGas: ['0x10', '0x10'], oldestBlock: '0x101', reward: [['0x5']] } }),
      },
    ]);
    await assert.rejects(() => getEthFee(21_000n, 'legacy', fetchFn, clock.nowMs), FetchFailureError);
  });

  test('invalid mode fails', async () => {
    const clock = makeClock();
    await assert.rejects(() => getEthFee(21_000n, 'bogus', ethStub(), clock.nowMs), RangeError);
  });
});

describe('TRON fee retrieval (M-08, M-44)', () => {
  test('energy x 100 SUN plus bandwidth is the fee (M-44: 100 SUN/unit)', async () => {
    const clock = makeClock();
    const quote = await getTronFee(TRON_CALL, 500n, tronStub({ energyUsed: 1000 }), clock.nowMs);
    assert.equal(quote.quote, 100_000n + 500n);
    assert.equal(quote.unit, 'SUN');
    assert.equal(quote.sources[0].rawValue, '1000');
    assert.equal(quote.sources[0].statedUnit, 'energy');
    assert.equal(QUOTE_TTL_MS.TRON, 30_000);
  });

  test('a reverted dry-run fails closed, never a quoted cost', async () => {
    const clock = makeClock();
    await assert.rejects(
      () => getTronFee(TRON_CALL, 0n, tronStub({ resultOk: false }), clock.nowMs),
      FetchFailureError,
    );
  });

  test('a missing energy figure fails closed', async () => {
    const clock = makeClock();
    const fetchFn = stubFetch([
      { match: () => true, respond: () => jsonResponse({ result: { result: true } }) },
    ]);
    await assert.rejects(() => getTronFee(TRON_CALL, 0n, fetchFn, clock.nowMs), FetchFailureError);
  });
});

describe('TON fee retrieval', () => {
  test('fee is the sum of the four source fees', async () => {
    const clock = makeClock();
    const quote = await getTonFee(TON_MESSAGE, tonStub(), clock.nowMs);
    assert.equal(quote.quote, 100n);
    assert.equal(quote.unit, 'nanoton');
    assert.equal(quote.sources[0].statedUnit, 'nanoton');
    assert.equal(QUOTE_TTL_MS.TON, 30_000);
  });

  test('a non-ok estimate fails closed', async () => {
    const clock = makeClock();
    await assert.rejects(() => getTonFee(TON_MESSAGE, tonStub({ ok: false }), clock.nowMs), FetchFailureError);
  });
});

describe('amount-plus-fee calculation', () => {
  test('total is amount + fee and an exact-balance spend passes', async () => {
    const clock = makeClock();
    const fetchFn = btcStub();
    const { total, feeQuote } = await calculateAmountPlusFee(
      9250n, 10_000n, { chain: 'BTC', args: [250n, 1] }, fetchFn, clock.nowMs,
    );
    assert.equal(feeQuote.quote, 750n);
    assert.equal(total, 10_000n);
  });

  test('amount + fee above balance fails closed', async () => {
    const clock = makeClock();
    await assert.rejects(
      () => calculateAmountPlusFee(9251n, 10_000n, { chain: 'BTC', args: [250n, 1] }, btcStub(), clock.nowMs),
      InsufficientFundsError,
    );
  });

  test('a quote that goes stale before use fails closed', async () => {
    const clock = makeClock();
    // BTC TTL is 60s. The clock returns the fetch time for the first
    // three reads (both fetchedAtMs values and quotedAtMs) and a time
    // 61s later from the fourth read onward (the use-time check).
    let reads = 0;
    const steppedNow = () => {
      reads += 1;
      return reads <= 3 ? clock.nowMs() : clock.nowMs() + 61_000;
    };
    await assert.rejects(
      () => calculateAmountPlusFee(1n, 1_000_000n, { chain: 'BTC', args: [10n, 1] }, btcStub(), steppedNow),
      StaleQuoteError,
    );
  });

  test('negative amount or balance is rejected', async () => {
    const clock = makeClock();
    await assert.rejects(
      () => calculateAmountPlusFee(-1n, 100n, { chain: 'BTC', args: [10n, 1] }, btcStub(), clock.nowMs),
      RangeError,
    );
    await assert.rejects(
      () => calculateAmountPlusFee(1n, -100n, { chain: 'BTC', args: [10n, 1] }, btcStub(), clock.nowMs),
      RangeError,
    );
  });

  test('an unknown chain is rejected', async () => {
    const clock = makeClock();
    await assert.rejects(
      () => calculateAmountPlusFee(1n, 100n, { chain: 'DOGE', args: [] }, btcStub(), clock.nowMs),
      RangeError,
    );
  });

  test('all quote money is BigInt, never a float', async () => {
    const clock = makeClock();
    const quote = await getBtcFee(250n, 1, btcStub(), clock.nowMs);
    assert.equal(typeof quote.quote, 'bigint');
    assert.equal(typeof quote.expiresAtMs, 'number');
    assert.ok(Number.isInteger(quote.expiresAtMs));
  });
});

describe('forbidden-figure regressions', () => {
  test('the module never contains the zero-amount self-transfer gas figure', () => {
    assert.ok(!moduleText.includes('37973'), 'module must not contain the M-09 figure');
  });

  test('the module holds no hardcoded energy figure and one energy rate', () => {
    assert.ok(!moduleText.includes('8624'), 'module must not contain the reverted-call energy figure');
    assert.equal((moduleText.match(/TRON_SUN_PER_ENERGY = 100n/g) ?? []).length, 1);
  });
});
