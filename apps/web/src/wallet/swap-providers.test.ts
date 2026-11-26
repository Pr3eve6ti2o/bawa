// Tests for the provider-aware swap comparison (Lane C): coverage
// labelling from the three provider clients, and route selection
// (cheapest live quote wins, Relay > STON.fi > LI.FI on ties).
import { describe, expect, it } from 'vitest';
import {
  COMPARE_CHAINS,
  PROVIDER_INFO,
  UNCOVERED_CHAINS,
  providersForPair,
  selectBestRoute,
  uncoveredReasonFor,
} from './swap-providers';
import type { SwapTokenChoice } from './swap-quotes';

const NATIVE = (symbol: string, decimals: number): SwapTokenChoice => ({
  kind: 'native',
  symbol,
  decimals,
});
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

describe('COMPARE_CHAINS / UNCOVERED_CHAINS', () => {
  it('offers every chain at least one provider covers', () => {
    expect(COMPARE_CHAINS).toContain('eth');
    expect(COMPARE_CHAINS).toContain('sol');
    expect(COMPARE_CHAINS).toContain('matic');
    // Relay adds these four to the pickers (LI.FI alone cannot route them).
    expect(COMPARE_CHAINS).toContain('btc');
    expect(COMPARE_CHAINS).toContain('trx');
    expect(COMPARE_CHAINS).toContain('ton');
    expect(COMPARE_CHAINS).toContain('xrp');
  });

  it('leaves the no-provider slice uncovered, with honest reasons', () => {
    expect(UNCOVERED_CHAINS).toContain('cosmos');
    expect(UNCOVERED_CHAINS).toContain('cardano');
    expect(UNCOVERED_CHAINS).toContain('starknet');
    expect(UNCOVERED_CHAINS).toContain('ltc');
    expect(UNCOVERED_CHAINS).toContain('doge');
    expect(UNCOVERED_CHAINS).toContain('stellar');
    expect(UNCOVERED_CHAINS).not.toContain('eth');
    expect(UNCOVERED_CHAINS).not.toContain('ton');
    expect(UNCOVERED_CHAINS).not.toContain('xrp');
    expect(UNCOVERED_CHAINS).not.toContain('btc');
    expect(uncoveredReasonFor('cosmos')).toContain('Cosmos family');
    expect(uncoveredReasonFor('ltc')).toContain('neither LI.FI nor Relay');
    expect(uncoveredReasonFor('cardano')).toContain('No swap provider covers');
  });
});

describe('providersForPair', () => {
  it('covers an EVM pair with LI.FI and Relay, not STON.fi (native is not a stablecoin)', () => {
    const statuses = providersForPair('eth', NATIVE('ETH', 18), 'matic', NATIVE('POL', 18));
    expect(statuses.find((entry) => entry.provider === 'lifi')?.status).toBe('covered');
    expect(statuses.find((entry) => entry.provider === 'relay')?.status).toBe('covered');
    const stonfi = statuses.find((entry) => entry.provider === 'stonfi');
    expect(stonfi?.status).toBe('not-covered');
    if (stonfi?.status === 'not-covered') {
      expect(stonfi.reason).toContain('stablecoins only');
    }
  });

  it('covers the TON corridor with STON.fi only for TON USDT', () => {
    const statuses = providersForPair('ton', TON_USDT, 'base', BASE_USDC);
    expect(statuses.find((entry) => entry.provider === 'stonfi')?.status).toBe('covered');
    expect(statuses.find((entry) => entry.provider === 'lifi')?.status).toBe('not-covered');
    // Relay's TON leg is GRAM only — a TON USDT is not a solver currency.
    expect(statuses.find((entry) => entry.provider === 'relay')?.status).toBe('not-covered');
  });

  it('covers TON native -> Base USDC with Relay and STON.fi, not LI.FI', () => {
    const statuses = providersForPair('ton', NATIVE('TON', 9), 'base', BASE_USDC);
    expect(statuses.find((entry) => entry.provider === 'relay')?.status).toBe('covered');
    expect(statuses.find((entry) => entry.provider === 'stonfi')?.status).toBe('covered');
    expect(statuses.find((entry) => entry.provider === 'lifi')?.status).toBe('not-covered');
  });
});

describe('selectBestRoute', () => {
  it('picks the highest expected output', () => {
    expect(
      selectBestRoute([
        { provider: 'lifi', toAmountBaseUnits: '100', toAmountUsd: '1.00' },
        { provider: 'relay', toAmountBaseUnits: '99', toAmountUsd: '0.99' },
      ]),
    ).toBe('lifi');
    expect(
      selectBestRoute([
        { provider: 'lifi', toAmountBaseUnits: '100', toAmountUsd: '1.00' },
        { provider: 'relay', toAmountBaseUnits: '101', toAmountUsd: '1.01' },
      ]),
    ).toBe('relay');
  });

  it('breaks ties toward Relay, then STON.fi, then LI.FI', () => {
    expect(
      selectBestRoute([
        { provider: 'lifi', toAmountBaseUnits: '100', toAmountUsd: '1.00' },
        { provider: 'relay', toAmountBaseUnits: '100', toAmountUsd: '1.00' },
      ]),
    ).toBe('relay');
    expect(
      selectBestRoute([
        { provider: 'lifi', toAmountBaseUnits: '100', toAmountUsd: '1.00' },
        { provider: 'stonfi', toAmountBaseUnits: '100', toAmountUsd: '1.00' },
      ]),
    ).toBe('stonfi');
  });

  it('returns null when no provider returned a live quote', () => {
    expect(selectBestRoute([])).toBeNull();
  });

  it('names the providers with their fee notes', () => {
    expect(PROVIDER_INFO.relay.feeNote).toContain('0.00% bridge');
    expect(PROVIDER_INFO.stonfi.feeNote).toContain('0.3%');
    expect(PROVIDER_INFO.lifi.feeNote).toContain('0.25%');
  });
});
