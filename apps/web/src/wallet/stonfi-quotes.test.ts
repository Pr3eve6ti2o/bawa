// Tests for the STON.fi Omniston scaffolding (Lane C). The asset
// table is the live chains page
// (docs.ston.fi/developer-section/omniston/chains.md, fetched
// 2026-11-26); the QuoteRequest shape is the SDK guide's order
// example (1 USDT on TON -> USDC on Base). No network is touched:
// live quotes need the SDK, which is not installed — and no quote
// is invented here.
import { describe, expect, it } from 'vitest';
import {
  STONFI_SDK_EXACT_VERSION,
  STONFI_SDK_PACKAGE,
  buildStonfiQuoteRequest,
  stonfiAssetFor,
  stonfiCoversPair,
} from './stonfi-quotes';
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
