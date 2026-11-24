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

  it('every chain except the seven named CoinGecko-only chains has a verified second source', () => {
    // Lane 80-APP (2026-11-24): 77 of 84 chains have a verified
    // native-price fallback. The seven below have none — no CoinLore
    // id, no Coinbase product and no verified wrapped-native contract
    // for a DexScreener leg — so CoinGecko is their only price source.
    // Telos and PulseChain have DexScreener chain slugs for token
    // lookups but no verified wrapped-native contract, so no native
    // leg. The set is pinned exactly: a new CoinGecko-only chain must
    // be named here deliberately, never silently.
    const COINGECKO_ONLY = new Set([
      'fraxtal',
      'velas',
      'telos',
      'songbird',
      'rootstock',
      'pulsechain',
      'xdc',
    ]);
    const alone: string[] = [];
    for (const chain of SUPPORTED_CHAINS) {
      const sources = priceFallbackSourcesFor(chain);
      expect(sources[0]).toBe('CoinGecko');
      if (COINGECKO_ONLY.has(chain)) {
        expect(sources).toEqual(['CoinGecko']);
        alone.push(chain);
      } else {
        expect(sources.length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(alone.sort()).toEqual([...COINGECKO_ONLY].sort());
  });
});
