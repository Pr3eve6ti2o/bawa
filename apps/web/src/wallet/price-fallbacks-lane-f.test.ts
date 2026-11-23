import { describe, expect, it } from 'vitest';
import { SUPPORTED_CHAINS } from './chains';
import { priceFallbackSourcesFor } from './price-fallbacks';

describe('priceFallbackSourcesFor (Lane F, FIX-ALL)', () => {
  it('tries CoinGecko first, then CoinLore, then DexScreener where verified', () => {
    expect(priceFallbackSourcesFor('eth')).toEqual([
      'CoinGecko',
      'CoinLore',
      'DexScreener',
    ]);
    expect(priceFallbackSourcesFor('btc')).toEqual(['CoinGecko', 'CoinLore']);
    expect(priceFallbackSourcesFor('fantom')).toEqual([
      'CoinGecko',
      'CoinLore',
      'DexScreener',
    ]);
  });

  it('gives TON TonAPI and Litecoin Coinbase as their second source', () => {
    expect(priceFallbackSourcesFor('ton')).toEqual(['CoinGecko', 'TonAPI']);
    expect(priceFallbackSourcesFor('ltc')).toEqual(['CoinGecko', 'Coinbase']);
  });

  it('gives Gnosis and Mantle CoinLore as their second source (Lane B)', () => {
    expect(priceFallbackSourcesFor('gnosis')).toEqual(['CoinGecko', 'CoinLore']);
    expect(priceFallbackSourcesFor('mantle')).toEqual(['CoinGecko', 'CoinLore', 'DexScreener']);
  });

  it('every chain has a verified second source — none is CoinGecko-alone', () => {
    for (const chain of SUPPORTED_CHAINS) {
      const sources = priceFallbackSourcesFor(chain);
      expect(sources[0]).toBe('CoinGecko');
      expect(sources.length).toBeGreaterThanOrEqual(2);
    }
  });
});
