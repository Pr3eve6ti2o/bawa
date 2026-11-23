import { describe, expect, it } from 'vitest';
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
      'DexScreener',
    ]);
  });

  it('gives TON TonAPI and Litecoin Coinbase as their second source', () => {
    expect(priceFallbackSourcesFor('ton')).toEqual(['CoinGecko', 'TonAPI']);
    expect(priceFallbackSourcesFor('ltc')).toEqual(['CoinGecko', 'Coinbase']);
  });

  it('leaves Gnosis and Mantle on CoinGecko alone — no verified fallback', () => {
    expect(priceFallbackSourcesFor('gnosis')).toEqual(['CoinGecko']);
    expect(priceFallbackSourcesFor('mantle')).toEqual(['CoinGecko']);
  });
});
