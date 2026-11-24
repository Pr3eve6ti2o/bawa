import { describe, expect, it } from 'vitest';
import {
  EXPANDED_CHAINS,
  EXPANDED_CHAIN_COUNT,
  expandedChainByKey,
} from './chains-expanded';

/** Chains with no Trust Wallet Assets directory at the verified pin. */
const NO_ICON_KEYS = ["zora", "mode", "fraxtal", "berachain", "arbnova", "worldchain", "unichain", "ink", "abstract", "soneium", "apechain", "immutable", "fuse", "velas", "xlayer", "taiko", "astar", "telos", "core", "songbird", "pulsechain", "chiliz", "flare", "hemi", "bob", "flowevm", "celestia", "dydx"] as const;

describe('chains-expanded (Lane 80-DATA)', () => {
  it('has 62 verified new chains', () => {
    expect(EXPANDED_CHAIN_COUNT).toBe(62);
    expect(EXPANDED_CHAINS).toHaveLength(62);
  });

  it('has unique keys', () => {
    const keys = EXPANDED_CHAINS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every chain at least two live-verified https RPCs with evidence', () => {
    for (const c of EXPANDED_CHAINS) {
      expect(c.rpcEndpoints.length, c.key).toBeGreaterThanOrEqual(2);
      expect(c.rpcEvidence.length, c.key).toBe(c.rpcEndpoints.length);
      for (const url of c.rpcEndpoints) {
        expect(url.startsWith('https://'), c.key + ' ' + url).toBe(true);
      }
      for (const ev of c.rpcEvidence) {
        expect(ev.length, c.key).toBeGreaterThan(0);
      }
    }
  });

  it('uses hardened BIP-44 derivation paths', () => {
    const re = /^m\/44'\/\d+'\/\d+'(\/\d+'?){0,2}$/;
    for (const c of EXPANDED_CHAINS) {
      expect(c.derivationPath, c.key).toMatch(re);
      expect(c.derivationTemplate, c.key).toContain('{account}');
    }
  });

  it('has a CoinGecko id on every chain', () => {
    for (const c of EXPANDED_CHAINS) {
      expect(c.priceSources.coingeckoId.length, c.key).toBeGreaterThan(0);
    }
  });

  it('has icons null only for the chains with no Trust Wallet Assets dir', () => {
    const nullIcon = EXPANDED_CHAINS.filter((c) => c.iconUrl === null).map((c) => c.key);
    expect([...nullIcon].sort()).toEqual([...NO_ICON_KEYS].sort());
    for (const c of EXPANDED_CHAINS) {
      if (c.iconUrl !== null) {
        expect(c.iconUrl).toContain('trustwallet/assets');
        expect(c.iconPath).toContain('blockchains/');
      }
    }
  });

  it('has no duplicate EVM chain ids', () => {
    const ids = EXPANDED_CHAINS.filter((c) => c.evmChainId !== null).map((c) => c.evmChainId);
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a transaction URL pattern with a hash placeholder on every chain', () => {
    for (const c of EXPANDED_CHAINS) {
      expect(c.explorerTxUrlPattern, c.key).toMatch(/\{(hash|messageCid|opHash)\}/);
      expect(c.explorerBaseUrl.startsWith('https://'), c.key).toBe(true);
    }
  });

  it('resolves every chain by key', () => {
    for (const c of EXPANDED_CHAINS) {
      expect(expandedChainByKey[c.key]).toBe(c);
    }
  });
});
