// Read-only mainnet fee retrieval and exact amount/fee calculation.
// Chains: BTC, ETH, TRON, TON. No dependencies; built-in fetch only.
// All money is BigInt in the chain's atomic unit (sat, wei, SUN,
// nanoton). There is no floating-point money math anywhere.
//
// Restrictions this module enforces (MAINNET-GUIDE.md section 21;
// the module does NOT clear any register row):
// - M-07 (BTC): never quote one fee source alone. Both mempool.space
//   and blockstream.info are fetched for every BTC quote; a
//   disagreement fails closed with SourceDisagreementError. The
//   mempool.space recommended set is the quoted rate; the blockstream
//   value is always shown in the quote's sources with its raw wire
//   value. UNIT EVIDENCE (live probe 2026-11-12, lane file
//   evidence/probe-2026-11-12.json): blockstream.info fee-estimates
//   values across targets 1-1008 run 0.0999...-2.005, falling with
//   target, on the same scale as mempool.space (1-4 sat/vB). Read as
//   BTC/kB they would imply 10,000-200,500 sat/vB, which is not a
//   real fee market; read as sat/vB they are the market. So this
//   module treats blockstream.info fee-estimates values as sat/vB,
//   parsed exactly from the decimal wire token (never via float).
//   That CONTRADICTS the guide's BTC/kB label and its ~97 sat/vB
//   annotation of the 2026-11-09 pair (0.972 sat/vB, not 97): both
//   were misreadings. The real 2026-11-09 disagreement was 3 vs
//   0.972 sat/vB, still a disagreement, so fail-closed stands. The
//   M-07 row itself stays OPEN: this module records the evidence,
//   it does not clear the row.
// - M-08 (TRON): estimateenergy is unsupported on TronGrid, so this
//   module never calls it. Energy comes only from a
//   triggerconstantcontract dry-run whose result is successful; a
//   reverted result or a missing energy figure fails closed. The
//   reverted-call energy figure must never be quoted as a cost, and
//   this module holds no hardcoded energy figure at all. fee_limit is
//   a caller-supplied explicit cap, not a computed value.
// - M-09 (ETH): real-transfer gas is unverified. This module never
//   substitutes the zero-amount self-transfer gas figure for a real
//   transfer estimate, and it cross-checks the base fee against a
//   second, independent RPC at the same block; a mismatch fails
//   closed. Two RPCs returning identical values from one upstream
//   are not independent confirmations.
// - M-44 (TRON): energy costs 100 SUN per unit. The ten-times
//   shorthand must never be quoted; the constant below is the only
//   energy rate in this module.
//
// A quote is a FeeQuote: { chain, request, quote, unit, quotedAtMs,
// expiresAtMs, disagreement: false, sources }. sources is the
// provenance record: one entry per read, with the source URL, HTTP
// method, request body (or null), fetch-completion time, the raw wire
// value, and the stated unit. expiresAtMs is the oldest fetchedAtMs
// plus the chain TTL. Every failure mode is fail-closed: the error is
// thrown and no quote is returned, including no cached or fallback
// quote.
//
// Callers inject fetch (typeof globalThis.fetch) and nowMs
// (() => Unix milliseconds). There is no global fallback, so tests
// never touch the network and live reads are explicit.

export const QUOTE_TTL_MS = Object.freeze({
  BTC: 60_000,
  ETH: 15_000,
  TRON: 30_000,
  TON: 30_000,
});

// TRON energy price, SUN per energy unit (M-44 measured value).
const TRON_SUN_PER_ENERGY = 100n;

// BTC disagreement tolerance (M-07): the two fresh sources disagree
// exactly when the absolute gap exceeds BOTH 1 sat/vB and 25% of the
// smaller rate. Compared in milli-sat/vB so fractional blockstream
// rates stay exact.
const BTC_TOLERANCE_MILLI_SAT_PER_VB = 1000n; // 1 sat/vB.

// ETH cross-check tolerance: base fees from two independent RPCs at
// the same block disagree when the gap exceeds 1% of the larger fee.
const ETH_TOLERANCE_PERCENT = 1n;

const BTC_MEMPOOL_URL = 'https://mempool.space/api/v1/fees/recommended';
const BTC_BLOCKSTREAM_URL = 'https://blockstream.info/api/fee-estimates';
const ETH_PRIMARY_RPC_URL = 'https://ethereum-rpc.publicnode.com';
const ETH_SECOND_RPC_URL = 'https://cloudflare-eth.com';
const TRON_TRONGRID_URL = 'https://api.trongrid.io/wallet/triggerconstantcontract';
const TON_TONCENTER_URL = 'https://toncenter.com/api/v2/estimateFee';

const FETCH_TIMEOUT_MS = 10_000;

export class SourceDisagreementError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceDisagreementError';
    this.code = 'SOURCE_DISAGREEMENT';
  }
}

export class StaleQuoteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StaleQuoteError';
    this.code = 'STALE_QUOTE';
  }
}

export class InsufficientFundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InsufficientFundsError';
    this.code = 'INSUFFICIENT_FUNDS';
  }
}

export class FetchFailureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FetchFailureError';
    this.code = 'FETCH_FAILURE';
  }
}

function assertBigInt(value, name) {
  if (typeof value !== 'bigint') {
    throw new TypeError(`${name} must be a bigint`);
  }
}

function assertNonNegativeBigInt(value, name) {
  assertBigInt(value, name);
  if (value < 0n) {
    throw new RangeError(`${name} must not be negative`);
  }
}

function assertSafeNonNegativeInteger(value, name) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new FetchFailureError(`${name} is missing or not a safe non-negative integer`);
  }
  return BigInt(value);
}

function assertHex(value, name) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new FetchFailureError(`${name} is missing or not a 0x hex string`);
  }
  return BigInt(value);
}

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

// Parse a decimal wire token (e.g. "1.0030000000000001") into
// milli-sat/vB, exact for up to 3 fractional digits (1 sat/vB =
// 1000 milli-sat/vB). Longer fractions round half-up at the 4th
// digit; the raw token is always kept in the provenance record.
// String parsing, never float: "1.0030000000000001" must stay 1003,
// not drift.
function satPerVbTokenToMilliSatPerVb(token) {
  if (typeof token !== 'string' || !/^[0-9]+(\.[0-9]+)?$/.test(token)) {
    throw new FetchFailureError('blockstream fee-estimates value is not a non-negative decimal');
  }
  const [intPart, fracPart = ''] = token.split('.');
  let frac = fracPart;
  let roundUp = false;
  if (frac.length > 3) {
    roundUp = frac[3] >= '5';
    frac = frac.slice(0, 3);
  }
  let milli = BigInt(intPart) * 1000n + BigInt(frac.padEnd(3, '0') || '0');
  if (roundUp) milli += 1n;
  return milli;
}

function extractJsonNumberToken(rawText, key) {
  const match = rawText.match(new RegExp(`"${key}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)`));
  if (!match) {
    throw new FetchFailureError(`fee-estimates response has no numeric "${key}" entry`);
  }
  return match[1];
}

async function fetchJson(fetchFn, url, init) {
  let response;
  try {
    response = await fetchFn(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new FetchFailureError(`fetch failed for ${url}: ${error.message}`);
  }
  if (!response || response.ok !== true) {
    throw new FetchFailureError(`fetch failed for ${url}: HTTP ${response?.status ?? 'unknown'}`);
  }
  let rawText;
  try {
    rawText = await response.text();
  } catch (error) {
    throw new FetchFailureError(`fetch failed for ${url}: unreadable body: ${error.message}`);
  }
  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    throw new FetchFailureError(`fetch failed for ${url}: response is not JSON`);
  }
}

async function postJsonRpc(fetchFn, url, method, params) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const { data } = await fetchJson(fetchFn, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  if (!data || typeof data !== 'object' || data.error || data.result === undefined) {
    throw new FetchFailureError(`JSON-RPC ${method} at ${url} returned an error or no result`);
  }
  return data.result;
}

function checkFresh(quote, nowMsValue) {
  if (nowMsValue >= quote.expiresAtMs) {
    throw new StaleQuoteError(
      `fee quote for ${quote.chain} expired at ${quote.expiresAtMs} (now ${nowMsValue})`,
    );
  }
}

function assembleQuote(chain, request, quote, unit, sources, nowMs) {
  const oldestFetchedAtMs = Math.min(...sources.map((source) => source.fetchedAtMs));
  const assembled = {
    chain,
    request,
    quote,
    unit,
    quotedAtMs: nowMs(),
    expiresAtMs: oldestFetchedAtMs + QUOTE_TTL_MS[chain],
    disagreement: false,
    sources,
  };
  checkFresh(assembled, assembled.quotedAtMs);
  return assembled;
}

export async function getBtcFee(vbytes, targetBlocks, fetchFn, nowMs) {
  assertNonNegativeBigInt(vbytes, 'vbytes');
  if (targetBlocks !== 1 && targetBlocks !== 3 && targetBlocks !== 6) {
    throw new RangeError('targetBlocks must be 1, 3 or 6');
  }
  const request = { chain: 'BTC', args: [vbytes, targetBlocks] };

  const mempool = await fetchJson(fetchFn, BTC_MEMPOOL_URL, { method: 'GET' });
  const mempoolFetchedAtMs = nowMs();
  const rateField = targetBlocks === 1 ? 'fastestFee' : targetBlocks === 3 ? 'halfHourFee' : 'hourFee';
  if (!mempool.data || typeof mempool.data !== 'object') {
    throw new FetchFailureError('mempool.space recommended-fees response is not an object');
  }
  const mempoolRateMilli = assertSafeNonNegativeInteger(mempool.data[rateField], `mempool.space ${rateField}`) * 1000n;

  const blockstream = await fetchJson(fetchFn, BTC_BLOCKSTREAM_URL, { method: 'GET' });
  const blockstreamFetchedAtMs = nowMs();
  if (!blockstream.data || typeof blockstream.data !== 'object') {
    throw new FetchFailureError('blockstream.info fee-estimates response is not an object');
  }
  // The entry key matches the confirmation target, so the two
  // sources are always compared for the same target. Values are
  // sat/vB (see the M-07 note at the top of this file); the raw
  // token is recorded verbatim.
  const blockstreamToken = extractJsonNumberToken(blockstream.rawText, String(targetBlocks));
  const blockstreamRateMilli = satPerVbTokenToMilliSatPerVb(blockstreamToken);

  const smaller = mempoolRateMilli < blockstreamRateMilli ? mempoolRateMilli : blockstreamRateMilli;
  const gap = mempoolRateMilli > blockstreamRateMilli
    ? mempoolRateMilli - blockstreamRateMilli
    : blockstreamRateMilli - mempoolRateMilli;
  if (gap > BTC_TOLERANCE_MILLI_SAT_PER_VB && gap * 100n > smaller * 25n) {
    throw new SourceDisagreementError(
      `BTC fee sources disagree: mempool.space ${mempool.data[rateField]} sat/vB vs ` +
      `blockstream.info ${blockstreamToken} sat/vB (gap exceeds 1 sat/vB and 25% of the smaller rate)`,
    );
  }

  // M-07: prefer the mempool.space recommended set; the blockstream
  // value stays visible in sources.
  const mempoolRateSatPerVb = mempoolRateMilli / 1000n;
  const fee = mempoolRateSatPerVb * vbytes;
  return assembleQuote('BTC', request, fee, 'sat', [
    {
      url: BTC_MEMPOOL_URL,
      httpMethod: 'GET',
      requestBody: null,
      fetchedAtMs: mempoolFetchedAtMs,
      rawValue: String(mempool.data[rateField]),
      statedUnit: 'sat/vB',
    },
    {
      url: BTC_BLOCKSTREAM_URL,
      httpMethod: 'GET',
      requestBody: null,
      fetchedAtMs: blockstreamFetchedAtMs,
      rawValue: blockstreamToken,
      statedUnit: 'sat/vB',
    },
  ], nowMs);
}

export async function getEthFee(gasLimit, mode, fetchFn, nowMs) {
  assertNonNegativeBigInt(gasLimit, 'gasLimit');
  if (mode !== 'legacy' && mode !== 'eip1559') {
    throw new RangeError("mode must be 'legacy' or 'eip1559'");
  }
  const request = { chain: 'ETH', args: [gasLimit, mode] };

  const feeHistoryParams = ['0x1', 'latest', [50]];
  const primaryHistory = await postJsonRpc(fetchFn, ETH_PRIMARY_RPC_URL, 'eth_feeHistory', feeHistoryParams);
  const primaryHistoryFetchedAtMs = nowMs();
  const secondHistory = await postJsonRpc(fetchFn, ETH_SECOND_RPC_URL, 'eth_feeHistory', feeHistoryParams);
  const secondHistoryFetchedAtMs = nowMs();

  for (const [label, history] of [['primary', primaryHistory], ['second', secondHistory]]) {
    if (!history || typeof history !== 'object' || !Array.isArray(history.baseFeePerGas) || history.baseFeePerGas.length === 0) {
      throw new FetchFailureError(`${label} eth_feeHistory response has no baseFeePerGas array`);
    }
    if (typeof history.oldestBlock !== 'string') {
      throw new FetchFailureError(`${label} eth_feeHistory response has no oldestBlock`);
    }
  }
  if (primaryHistory.oldestBlock !== secondHistory.oldestBlock) {
    throw new FetchFailureError(
      'ETH fee cross-check blocks diverged: '
      + `primary oldestBlock ${primaryHistory.oldestBlock} vs second ${secondHistory.oldestBlock}`,
    );
  }
  // Newest entry is the base fee for the next block: the fee a new
  // transaction would pay.
  const primaryBaseFee = assertHex(primaryHistory.baseFeePerGas.at(-1), 'primary baseFeePerGas');
  const secondBaseFee = assertHex(secondHistory.baseFeePerGas.at(-1), 'second baseFeePerGas');
  const larger = primaryBaseFee > secondBaseFee ? primaryBaseFee : secondBaseFee;
  const baseFeeGap = primaryBaseFee > secondBaseFee
    ? primaryBaseFee - secondBaseFee
    : secondBaseFee - primaryBaseFee;
  if (baseFeeGap * 100n > larger * ETH_TOLERANCE_PERCENT) {
    throw new SourceDisagreementError(
      `ETH base-fee sources disagree at block ${primaryHistory.oldestBlock}: `
      + `primary ${primaryBaseFee} wei vs second ${secondBaseFee} wei (gap exceeds 1%)`,
    );
  }

  const sources = [
    {
      url: ETH_PRIMARY_RPC_URL,
      httpMethod: 'POST',
      requestBody: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_feeHistory', params: feeHistoryParams }),
      fetchedAtMs: primaryHistoryFetchedAtMs,
      rawValue: String(primaryHistory.baseFeePerGas.at(-1)),
      statedUnit: 'wei/gas',
    },
    {
      url: ETH_SECOND_RPC_URL,
      httpMethod: 'POST',
      requestBody: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_feeHistory', params: feeHistoryParams }),
      fetchedAtMs: secondHistoryFetchedAtMs,
      rawValue: String(secondHistory.baseFeePerGas.at(-1)),
      statedUnit: 'wei/gas',
    },
  ];

  let fee;
  if (mode === 'legacy') {
    const gasPrice = await postJsonRpc(fetchFn, ETH_PRIMARY_RPC_URL, 'eth_gasPrice', []);
    const gasPriceFetchedAtMs = nowMs();
    const gasPriceWei = assertHex(gasPrice, 'eth_gasPrice');
    sources.push({
      url: ETH_PRIMARY_RPC_URL,
      httpMethod: 'POST',
      requestBody: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
      fetchedAtMs: gasPriceFetchedAtMs,
      rawValue: String(gasPrice),
      statedUnit: 'wei/gas',
    });
    fee = gasPriceWei * gasLimit;
  } else {
    if (!Array.isArray(primaryHistory.reward) || primaryHistory.reward.length === 0
      || !Array.isArray(primaryHistory.reward.at(-1)) || primaryHistory.reward.at(-1).length === 0) {
      throw new FetchFailureError('primary eth_feeHistory response has no reward entry for the newest block');
    }
    const priorityFee = assertHex(primaryHistory.reward.at(-1)[0], 'eth_feeHistory reward priority fee');
    const maxFeePerGas = 2n * primaryBaseFee + priorityFee;
    fee = maxFeePerGas * gasLimit;
  }
  return assembleQuote('ETH', request, fee, 'wei', sources, nowMs);
}

export async function getTronFee(call, bandwidthFeeSun, fetchFn, nowMs) {
  assertNonNegativeBigInt(bandwidthFeeSun, 'bandwidthFeeSun');
  if (!call || typeof call !== 'object') {
    throw new TypeError('call must be a TronCall object');
  }
  assertNonEmptyString(call.ownerAddressHex, 'call.ownerAddressHex');
  assertNonEmptyString(call.contractAddressHex, 'call.contractAddressHex');
  assertNonEmptyString(call.functionSelector, 'call.functionSelector');
  assertNonEmptyString(call.parameterHex, 'call.parameterHex');
  assertNonNegativeBigInt(call.callValueSun, 'call.callValueSun');
  if (call.callValueSun > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('call.callValueSun exceeds the safe-integer range for the TronGrid body');
  }
  const request = { chain: 'TRON', args: [call, bandwidthFeeSun] };

  const body = JSON.stringify({
    owner_address: call.ownerAddressHex,
    contract_address: call.contractAddressHex,
    function_selector: call.functionSelector,
    parameter: call.parameterHex,
    call_value: Number(call.callValueSun),
  });
  const { data } = await fetchJson(fetchFn, TRON_TRONGRID_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const fetchedAtMs = nowMs();
  // Only a successful dry-run yields an energy figure. A reverted
  // result or a missing figure fails closed; no hardcoded energy
  // figure exists in this module.
  if (!data || typeof data !== 'object' || data.result?.result !== true) {
    throw new FetchFailureError('triggerconstantcontract dry-run did not succeed (reverted or failed result)');
  }
  const energy = assertSafeNonNegativeInteger(data.energy_used, 'triggerconstantcontract energy_used');
  const fee = energy * TRON_SUN_PER_ENERGY + bandwidthFeeSun;
  return assembleQuote('TRON', request, fee, 'SUN', [
    {
      url: TRON_TRONGRID_URL,
      httpMethod: 'POST',
      requestBody: body,
      fetchedAtMs,
      rawValue: String(data.energy_used),
      statedUnit: 'energy',
    },
  ], nowMs);
}

export async function getTonFee(message, fetchFn, nowMs) {
  if (!message || typeof message !== 'object') {
    throw new TypeError('message must be a TonMessage object');
  }
  assertNonEmptyString(message.address, 'message.address');
  assertNonEmptyString(message.bodyBocBase64, 'message.bodyBocBase64');
  if (message.initCodeBocBase64 !== null && typeof message.initCodeBocBase64 !== 'string') {
    throw new TypeError('message.initCodeBocBase64 must be a string or null');
  }
  if (message.initDataBocBase64 !== null && typeof message.initDataBocBase64 !== 'string') {
    throw new TypeError('message.initDataBocBase64 must be a string or null');
  }
  const request = { chain: 'TON', args: [message] };

  const body = JSON.stringify({
    address: message.address,
    body: message.bodyBocBase64,
    init_code: message.initCodeBocBase64,
    init_data: message.initDataBocBase64,
    ignore_chksig: true,
  });
  const { data } = await fetchJson(fetchFn, TON_TONCENTER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const fetchedAtMs = nowMs();
  if (!data || typeof data !== 'object' || data.ok !== true
    || !data.result || typeof data.result !== 'object'
    || !data.result.source_fees || typeof data.result.source_fees !== 'object') {
    throw new FetchFailureError('toncenter estimateFee returned no usable source_fees');
  }
  const fees = data.result.source_fees;
  const inFwdFee = assertSafeNonNegativeInteger(fees.in_fwd_fee, 'source_fees.in_fwd_fee');
  const storageFee = assertSafeNonNegativeInteger(fees.storage_fee, 'source_fees.storage_fee');
  const gasFee = assertSafeNonNegativeInteger(fees.gas_fee, 'source_fees.gas_fee');
  const fwdFee = assertSafeNonNegativeInteger(fees.fwd_fee, 'source_fees.fwd_fee');
  const fee = inFwdFee + storageFee + gasFee + fwdFee;
  return assembleQuote('TON', request, fee, 'nanoton', [
    {
      url: TON_TONCENTER_URL,
      httpMethod: 'POST',
      requestBody: body,
      fetchedAtMs,
      rawValue: JSON.stringify(fees),
      statedUnit: 'nanoton',
    },
  ], nowMs);
}

export async function calculateAmountPlusFee(amount, balance, request, fetchFn, nowMs) {
  assertNonNegativeBigInt(amount, 'amount');
  assertNonNegativeBigInt(balance, 'balance');
  if (!request || typeof request !== 'object' || typeof request.chain !== 'string' || !Array.isArray(request.args)) {
    throw new TypeError('request must be a FeeRequest { chain, args }');
  }
  let feeQuote;
  if (request.chain === 'BTC') {
    feeQuote = await getBtcFee(...request.args, fetchFn, nowMs);
  } else if (request.chain === 'ETH') {
    feeQuote = await getEthFee(...request.args, fetchFn, nowMs);
  } else if (request.chain === 'TRON') {
    feeQuote = await getTronFee(...request.args, fetchFn, nowMs);
  } else if (request.chain === 'TON') {
    feeQuote = await getTonFee(...request.args, fetchFn, nowMs);
  } else {
    throw new RangeError(`unknown chain in FeeRequest: ${request.chain}`);
  }
  // Re-check freshness at use time: a quote fetched fresh can still
  // go stale before the caller spends it.
  checkFresh(feeQuote, nowMs());
  const total = amount + feeQuote.quote;
  if (total > balance) {
    throw new InsufficientFundsError(
      `amount ${amount} + fee ${feeQuote.quote} = ${total} ${feeQuote.unit} exceeds balance ${balance}`,
    );
  }
  return { total, feeQuote };
}
