// Tests for the STON.fi Omniston quotes (Lane C scaffolding + Lane A
// live RFQ, 2026-11-27). The asset table is the live chains page
// (docs.ston.fi/developer-section/omniston/chains.md, fetched
// 2026-11-26); the QuoteRequest shape is the SDK guide's order
// example (1 USDT on TON -> USDC on Base). No network is touched:
// live quotes run through an injected fake RFQ client — and no quote
// is invented here. The live proof (real SDK, real WebSocket, both
// settlement branches) is recorded in the comment above the
// fetchStonfiQuote suite below.
import { describe, expect, it } from 'vitest';
import {
  STONFI_QUOTE_TIMEOUT_MS,
  STONFI_SDK_EXACT_VERSION,
  STONFI_SDK_PACKAGE,
  buildStonfiQuoteRequest,
  fetchStonfiQuote,
  parseStonfiQuote,
  stonfiAssetFor,
  stonfiCoversPair,
} from './stonfi-quotes';
import type {
  StonfiQuoteInput,
  StonfiRfqClient,
  StonfiRfqEvent,
} from './stonfi-quotes';
import type { Quote } from '@ston-fi/omniston-sdk';
import type { SwapTokenChoice } from './swap-quotes';

const TON_USDT: SwapTokenChoice = {
  kind: 'token',
  contract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  symbol: 'USDT',
  decimals: 6,
};
const BASE_USDC: SwapTokenChoice = {
  kind: 'token',
  contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6,
};
const TON_NATIVE: SwapTokenChoice = { kind: 'native', symbol: 'TON', decimals: 9 };
const ETH_NATIVE: SwapTokenChoice = { kind: 'native', symbol: 'ETH', decimals: 18 };
const TRON_USDT: SwapTokenChoice = {
  kind: 'token',
  contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  symbol: 'USDT',
  decimals: 6,
};

describe('STON.fi SDK pin', () => {
  it('pins the exact 0.8.x version (latest, MIT, verified 2026-11-26)', () => {
    expect(STONFI_SDK_PACKAGE).toBe('@ston-fi/omniston-sdk');
    expect(STONFI_SDK_EXACT_VERSION).toBe('0.8.13');
  });
});

describe('stonfiAssetFor', () => {
  it('maps native TON to GRAM and lists the stablecoins by contract', () => {
    expect(stonfiAssetFor('ton', TON_NATIVE)?.symbol).toBe('GRAM');
    expect(stonfiAssetFor('ton', TON_NATIVE)?.kind).toBe('native');
    expect(stonfiAssetFor('ton', TON_USDT)?.symbol).toBe('USDT');
    expect(stonfiAssetFor('ton', TON_USDT)?.kind).toBe('jetton');
    expect(stonfiAssetFor('base', BASE_USDC)?.symbol).toBe('USDC');
    expect(stonfiAssetFor('base', BASE_USDC)?.kind).toBe('erc20');
  });

  it('returns null for non-stablecoins and uncovered chains', () => {
    expect(stonfiAssetFor('eth', ETH_NATIVE)).toBeNull();
    expect(stonfiAssetFor('sol', { kind: 'native', symbol: 'SOL', decimals: 9 })).toBeNull();
    expect(stonfiAssetFor('btc', { kind: 'native', symbol: 'BTC', decimals: 8 })).toBeNull();
  });

  it('flags TRON assets as live-unverified', () => {
    const asset = stonfiAssetFor('trx', TRON_USDT);
    expect(asset?.symbol).toBe('USDT');
    expect(asset?.liveUnverified).toBe(true);
  });
});

describe('stonfiCoversPair', () => {
  it('covers the TON corridor for listed stablecoins', () => {
    expect(stonfiCoversPair('ton', TON_USDT, 'base', BASE_USDC)).toEqual({
      covered: true,
    });
    expect(stonfiCoversPair('ton', TON_NATIVE, 'base', BASE_USDC)).toEqual({
      covered: true,
    });
  });

  it('does not cover Solana, BTC or non-stablecoins', () => {
    expect(
      stonfiCoversPair('sol', { kind: 'native', symbol: 'SOL', decimals: 9 }, 'ton', TON_USDT),
    ).toEqual({
      covered: false,
      reason: expect.stringContaining('stablecoins only'),
    });
    expect(stonfiCoversPair('eth', ETH_NATIVE, 'base', BASE_USDC)).toEqual({
      covered: false,
      reason: expect.stringContaining('stablecoins only'),
    });
  });

  it('does not offer TRON until a live quote is seen', () => {
    const result = stonfiCoversPair('trx', TRON_USDT, 'ton', TON_USDT);
    expect(result).toEqual({
      covered: false,
      reason: expect.stringContaining('no live TRON quote has been seen yet'),
    });
  });
});

describe('buildStonfiQuoteRequest', () => {
  it('builds the documented order request for TON USDT -> Base USDC', () => {
    const request = buildStonfiQuoteRequest('ton', TON_USDT, 'base', BASE_USDC, '1000000');
    expect(request).toEqual({
      inputAsset: {
        chain: {
          $case: 'ton',
          value: {
            kind: {
              $case: 'jetton',
              value: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
            },
          },
        },
      },
      outputAsset: {
        chain: {
          $case: 'base',
          value: {
            kind: {
              $case: 'erc20',
              value: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            },
          },
        },
      },
      amount: { $case: 'inputUnits', value: '1000000' },
      settlementParams: [{ params: { $case: 'order', value: {} } }],
    });
  });

  it('uses swap settlement with 1% slippage for TON-intrachain pairs', () => {
    const request = buildStonfiQuoteRequest('ton', TON_NATIVE, 'ton', TON_USDT, '1000000000');
    expect(request?.settlementParams).toEqual([
      {
        params: {
          $case: 'swap',
          value: { maxPriceSlippagePips: 10_000, flexibleIntegratorFee: true },
        },
      },
    ]);
  });

  it('returns null for an uncovered pair', () => {
    expect(
      buildStonfiQuoteRequest('sol', { kind: 'native', symbol: 'SOL', decimals: 9 }, 'ton', TON_USDT, '1000000000'),
    ).toBeNull();
    expect(buildStonfiQuoteRequest('trx', TRON_USDT, 'ton', TON_USDT, '1000000')).toBeNull();
  });
});

// ---- Live RFQ client (fetchStonfiQuote / parseStonfiQuote) ----
//
// LIVE PROOF (2026-11-27, loud-stone, Node 22, real SDK 0.8.13 over
// wss://omni-ws.ston.fi; probe scripts stonfi-live-probe.mjs +
// stonfi-live-probe-swap.mjs, RFQ only — nothing built/signed/sent):
// (1) 1 USDT on TON -> USDC on Base, 1,000,000 base units in, order
// settlement: ack at 950 ms (rfqId
// 9cc98a4733bc8466cd37bdbbab3621bc63e3eb9fcffd9ec2111a1c745a6020fa),
// quoteUpdated at 958 ms — quoteId
// 8dd111dff1e95c2c60eb11ce41b49a63002a773d41d9397caa623db678150945,
// resolver Arbiter (EQDE_TwSRO95P4fWSeCaIqIBgVubITNHQIOicLkiYJb4mQ-r),
// inputUnits 1000000, outputUnits 972487, quoteTimestamp 1795718960,
// tradeStartDeadline 1795719260 (2026-11-26T18:54:20Z, +300 s),
// estimatedSettlementDuration 13 s.
// (2) 1 TON native -> USDT on TON, 1,000,000,000 in, swap settlement:
// ack at 933 ms, quoteUpdated at 934 ms — quoteId
// 6563211d6947d458e320e2032fa7295f2e93438601eb2b616e65a8663f9a4b31,
// resolver Omniston (EQDV8OoP-iqaGDncSOo0dAsPpS0KY_z-d1GraV8fArOy4L1g),
// inputUnits 1000000000, outputUnits 960344, minOutputAmount 950741,
// recommendedMinOutputAmount 950741, recommendedSlippagePips 10000,
// routes 1, estimatedSettlementDuration 1 s.
// Runtime check from the same probes: `typeof omniston.close` is
// 'undefined' (no public close() on the class in 0.8.13) while
// `omniston.transport.close` is a function — hence the transport
// close in the client. The fixtures below replay these two shapes.

const ORDER_INPUT: StonfiQuoteInput = {
  fromChain: 'ton',
  fromToken: TON_USDT,
  toChain: 'base',
  toToken: BASE_USDC,
  fromAmountBaseUnits: '1000000',
};
const SWAP_INPUT: StonfiQuoteInput = {
  fromChain: 'ton',
  fromToken: TON_NATIVE,
  toChain: 'ton',
  toToken: TON_USDT,
  fromAmountBaseUnits: '1000000000',
};

/**
 * Quote fixtures in the exact wire shape the live probes saw. The
 * cast is the single seam: the parser reads quoteId, outputUnits,
 * estimatedSettlementDuration and settlementData only, and the live
 * probes above prove the real SDK emits exactly these fields.
 */
function orderQuote(overrides: Record<string, unknown> = {}): Quote {
  return {
    rfqId: 'rfq-1',
    quoteId: 'quote-order-1',
    resolverId: 'resolver-arbiter',
    resolverName: 'Arbiter',
    inputAsset: {
      chain: {
        $case: 'ton',
        value: {
          kind: {
            $case: 'jetton',
            value: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          },
        },
      },
    },
    outputAsset: {
      chain: {
        $case: 'base',
        value: {
          kind: {
            $case: 'erc20',
            value: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          },
        },
      },
    },
    inputUnits: '1000000',
    outputUnits: '972487',
    integratorFeeUnits: '0',
    protocolFeeUnits: '0',
    quoteTimestamp: 1795718960,
    estimatedSettlementDuration: 13,
    settlementData: {
      $case: 'order',
      value: { tradeStartDeadline: 4102444800 },
    },
    ...overrides,
  } as unknown as Quote;
}

function swapQuote(overrides: Record<string, unknown> = {}): Quote {
  return {
    rfqId: 'rfq-2',
    quoteId: 'quote-swap-1',
    resolverId: 'resolver-omniston',
    resolverName: 'Omniston',
    inputAsset: {
      chain: { $case: 'ton', value: { kind: { $case: 'native', value: {} } } },
    },
    outputAsset: {
      chain: {
        $case: 'ton',
        value: {
          kind: {
            $case: 'jetton',
            value: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          },
        },
      },
    },
    inputUnits: '1000000000',
    outputUnits: '960344',
    integratorFeeUnits: '0',
    protocolFeeUnits: '0',
    quoteTimestamp: 1795718979,
    estimatedSettlementDuration: 1,
    settlementData: {
      $case: 'swap',
      value: { minOutputAmount: '950741' },
    },
    ...overrides,
  } as unknown as Quote;
}

function quoteUpdatedEvent(quote: Quote): StonfiRfqEvent {
  return { rfqId: 'rfq-1', $case: 'quoteUpdated', value: quote };
}

interface FakeRfq {
  client: StonfiRfqClient;
  emit: (event: StonfiRfqEvent | null) => void;
  fail: (error: unknown) => void;
  finish: () => void;
  request: unknown;
  unsubscribed: boolean;
  closed: boolean;
}

function makeFakeRfq(): FakeRfq {
  let observer: {
    next?: (event: StonfiRfqEvent | null) => void;
    error?: (error: unknown) => void;
    complete?: () => void;
  } | null = null;
  const fake: FakeRfq = {
    client: {
      transport: {
        close: () => {
          fake.closed = true;
        },
      },
      requestForQuote: (request) => {
        fake.request = request;
        return {
          subscribe: (obs) => {
            observer = obs;
            return {
              unsubscribe: () => {
                fake.unsubscribed = true;
              },
            };
          },
        };
      },
    },
    emit: (event) => {
      observer?.next?.(event);
    },
    fail: (error) => {
      observer?.error?.(error);
    },
    finish: () => {
      observer?.complete?.();
    },
    request: null,
    unsubscribed: false,
    closed: false,
  };
  return fake;
}

/** Let the async fetch run to its subscribe before emitting events. */
async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('parseStonfiQuote', () => {
  it('converts a live-shaped order quote (deadline kept, no minimum)', () => {
    const quote = parseStonfiQuote(orderQuote());
    expect(quote).not.toBeNull();
    expect(quote?.quoteId).toBe('quote-order-1');
    expect(quote?.toAmountBaseUnits).toBe('972487');
    expect(quote?.toAmountMinBaseUnits).toBeNull();
    expect(quote?.estimatedSettlementDurationSeconds).toBe(13);
    expect(quote?.tradeStartDeadlineMs).toBe(4102444800 * 1000);
    expect(typeof quote?.fetchedAtMs).toBe('number');
  });

  it('converts a live-shaped swap quote (minimum kept, no deadline)', () => {
    const quote = parseStonfiQuote(swapQuote());
    expect(quote).not.toBeNull();
    expect(quote?.toAmountBaseUnits).toBe('960344');
    expect(quote?.toAmountMinBaseUnits).toBe('950741');
    expect(quote?.tradeStartDeadlineMs).toBeNull();
    expect(quote?.estimatedSettlementDurationSeconds).toBe(1);
  });

  it('rejects an expired order quote (deadline in the past)', () => {
    const quote = parseStonfiQuote(
      orderQuote({
        settlementData: {
          $case: 'order',
          value: { tradeStartDeadline: 1000000000 },
        },
      }),
    );
    expect(quote).toBeNull();
  });

  it('rejects a zero or malformed output, an empty id, a malformed swap minimum', () => {
    expect(parseStonfiQuote(orderQuote({ outputUnits: '0' }))).toBeNull();
    expect(parseStonfiQuote(orderQuote({ outputUnits: 'abc' }))).toBeNull();
    expect(parseStonfiQuote(orderQuote({ quoteId: '' }))).toBeNull();
    expect(
      parseStonfiQuote(
        swapQuote({
          settlementData: { $case: 'swap', value: { minOutputAmount: 'x' } },
        }),
      ),
    ).toBeNull();
  });

  it('keeps the quote when the settlement estimate is missing', () => {
    const quote = parseStonfiQuote(
      orderQuote({ estimatedSettlementDuration: undefined }),
    );
    expect(quote?.estimatedSettlementDurationSeconds).toBeNull();
    expect(quote?.toAmountBaseUnits).toBe('972487');
  });
});

describe('fetchStonfiQuote', () => {
  it('returns not-covered for an uncovered pair without creating a client', async () => {
    const result = await fetchStonfiQuote(
      {
        fromChain: 'eth',
        fromToken: ETH_NATIVE,
        toChain: 'base',
        toToken: BASE_USDC,
        fromAmountBaseUnits: '100000000000000000',
      },
      {
        createClient: () => {
          throw new Error('must not create a client for an uncovered pair');
        },
      },
    );
    expect(result.status).toBe('not-covered');
    if (result.status === 'not-covered') {
      expect(result.reason).toContain('stablecoins only');
    }
  });

  it('resolves ok on the first valid order quote and closes the stream', async () => {
    const fake = makeFakeRfq();
    const promise = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => fake.client,
    });
    await tick();
    expect(fake.request).toEqual(
      buildStonfiQuoteRequest('ton', TON_USDT, 'base', BASE_USDC, '1000000'),
    );
    fake.emit({ $case: 'ack', value: { rfqId: 'rfq-1' } });
    fake.emit(quoteUpdatedEvent(orderQuote()));
    const result = await promise;
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.quote.toAmountBaseUnits).toBe('972487');
      expect(result.quote.tradeStartDeadlineMs).toBe(4102444800 * 1000);
    }
    expect(fake.unsubscribed).toBe(true);
    expect(fake.closed).toBe(true);
  });

  it('resolves ok on a swap quote, with the minimum from the settlement data', async () => {
    const fake = makeFakeRfq();
    const promise = fetchStonfiQuote(SWAP_INPUT, {
      createClient: () => fake.client,
    });
    await tick();
    fake.emit(quoteUpdatedEvent(swapQuote()));
    const result = await promise;
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.quote.toAmountBaseUnits).toBe('960344');
      expect(result.quote.toAmountMinBaseUnits).toBe('950741');
      expect(result.quote.tradeStartDeadlineMs).toBeNull();
    }
  });

  it('ignores an expired order quote and takes the next valid one', async () => {
    const fake = makeFakeRfq();
    const promise = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => fake.client,
    });
    await tick();
    fake.emit(
      quoteUpdatedEvent(
        orderQuote({
          quoteId: 'quote-expired',
          settlementData: {
            $case: 'order',
            value: { tradeStartDeadline: 1000000000 },
          },
        }),
      ),
    );
    expect(fake.unsubscribed).toBe(false);
    fake.emit(
      quoteUpdatedEvent(orderQuote({ quoteId: 'quote-fresh' })),
    );
    const result = await promise;
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.quote.quoteId).toBe('quote-fresh');
    }
  });

  it('ignores a malformed quote, then reports no-quote on noQuote', async () => {
    const fake = makeFakeRfq();
    const promise = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => fake.client,
    });
    await tick();
    fake.emit(quoteUpdatedEvent(orderQuote({ outputUnits: 'not-a-number' })));
    expect(fake.unsubscribed).toBe(false);
    fake.emit({ rfqId: 'rfq-1', $case: 'noQuote', value: {} });
    const result = await promise;
    expect(result).toEqual({ status: 'no-quote' });
    expect(fake.unsubscribed).toBe(true);
    expect(fake.closed).toBe(true);
  });

  it('reports no-quote on a null event (no resolver has a quote)', async () => {
    const fake = makeFakeRfq();
    const promise = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => fake.client,
    });
    await tick();
    fake.emit(null);
    expect(await promise).toEqual({ status: 'no-quote' });
  });

  it('reports unavailable on a stream error and on a server-closed stream', async () => {
    const failing = makeFakeRfq();
    const failed = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => failing.client,
    });
    await tick();
    failing.fail(new Error('socket broke'));
    expect(await failed).toEqual({
      status: 'unavailable',
      reason: expect.stringContaining('unavailable right now'),
    });
    expect(failing.closed).toBe(true);

    const closed = makeFakeRfq();
    const closedPromise = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => closed.client,
    });
    await tick();
    closed.emit({ $case: 'unsubscribed', value: undefined });
    expect(await closedPromise).toEqual({
      status: 'unavailable',
      reason: expect.stringContaining('unavailable right now'),
    });
  });

  it('reports unavailable when the stream completes without a quote', async () => {
    const fake = makeFakeRfq();
    const promise = fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => fake.client,
    });
    await tick();
    fake.finish();
    expect(await promise).toEqual({
      status: 'unavailable',
      reason: expect.stringContaining('unavailable right now'),
    });
  });

  it('reports unavailable on the 15 s timeout (and closes the stream)', async () => {
    expect(STONFI_QUOTE_TIMEOUT_MS).toBe(15_000);
    const fake = makeFakeRfq();
    const result = await fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => fake.client,
      timeoutMs: 30,
    });
    expect(result).toEqual({
      status: 'unavailable',
      reason: expect.stringContaining('unavailable right now'),
    });
    expect(fake.unsubscribed).toBe(true);
    expect(fake.closed).toBe(true);
  });

  it('reports unavailable when the client cannot be created', async () => {
    const result = await fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => {
        throw new Error('dynamic import failed');
      },
    });
    expect(result).toEqual({
      status: 'unavailable',
      reason: expect.stringContaining('unavailable right now'),
    });
  });

  it('reports unavailable when requestForQuote throws', async () => {
    const throwing: StonfiRfqClient = {
      transport: { close: () => undefined },
      requestForQuote: () => {
        throw new Error('bad request');
      },
    };
    const result = await fetchStonfiQuote(ORDER_INPUT, {
      createClient: () => throwing,
    });
    expect(result).toEqual({
      status: 'unavailable',
      reason: expect.stringContaining('unavailable right now'),
    });
  });
});
