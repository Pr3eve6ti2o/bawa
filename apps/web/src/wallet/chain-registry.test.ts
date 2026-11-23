import { describe, expect, it } from 'vitest';
import {
  CHAINS,
  SUPPORTED_CHAINS,
  availableFor,
  capabilitiesFor,
} from './chains';

/**
 * Registry drift guard for token discovery: every supported chain must
 * have a pinned RPC endpoint (an empty rpcEndpoints list means the chain
 * cannot fetch a balance, so its row could never be honest), and the
 * dead Polygon host must never be pinned.
 */
describe('chain registry — token discovery', () => {
  it('pins an RPC endpoint for every supported chain', () => {
    for (const chain of SUPPORTED_CHAINS) {
      expect(
        CHAINS[chain].rpcEndpoints.length,
        `${chain} must have a pinned RPC endpoint`,
      ).toBeGreaterThan(0);
      for (const endpoint of CHAINS[chain].rpcEndpoints) {
        expect(endpoint.startsWith('https://')).toBe(true);
      }
    }
  });

  it('never pins the dead polygon-rpc host', () => {
    const registryText = JSON.stringify(CHAINS);
    expect(registryText).not.toContain('polygon-rpc.publicnode.com');
    expect(CHAINS.matic.rpcEndpoints).toEqual([
      'https://polygon-bor-rpc.publicnode.com',
    ]);
  });

  it('pins the live-verified RPC for each new chain', () => {
    expect(CHAINS.sol.rpcEndpoints).toEqual([
      'https://solana-rpc.publicnode.com',
      'https://public.rpc.solanavibestation.com',
    ]);
    expect(CHAINS.bsc.rpcEndpoints).toEqual([
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed.binance.org',
    ]);
    expect(CHAINS.arb.rpcEndpoints).toEqual(['https://arbitrum-rpc.publicnode.com']);
    expect(CHAINS.op.rpcEndpoints).toEqual([
      'https://optimism-rpc.publicnode.com',
      'https://mainnet.optimism.io',
    ]);
    expect(CHAINS.base.rpcEndpoints).toEqual(['https://base-rpc.publicnode.com']);
    expect(CHAINS.avax.rpcEndpoints).toEqual([
      'https://avalanche-rpc.publicnode.com',
      'https://api.avax.network/ext/bc/C/rpc',
    ]);
    // UI/UX fixes item 14 (2026-11-23): each new chain pins two
    // independent keyless endpoints, both verified live.
    expect(CHAINS.gnosis.rpcEndpoints).toEqual([
      'https://gnosis-rpc.publicnode.com',
      'https://rpc.gnosischain.com',
    ]);
    expect(CHAINS.celo.rpcEndpoints).toEqual([
      'https://celo-rpc.publicnode.com',
      'https://forno.celo.org',
    ]);
    expect(CHAINS.linea.rpcEndpoints).toEqual([
      'https://linea-rpc.publicnode.com',
      'https://rpc.linea.build',
    ]);
    expect(CHAINS.mantle.rpcEndpoints).toEqual([
      'https://mantle-rpc.publicnode.com',
      'https://rpc.mantle.xyz',
    ]);
    expect(CHAINS.scroll.rpcEndpoints).toEqual([
      'https://scroll-rpc.publicnode.com',
      'https://rpc.scroll.io',
    ]);
    expect(CHAINS.opbnb.rpcEndpoints).toEqual([
      'https://opbnb-rpc.publicnode.com',
      'https://opbnb-mainnet-rpc.bnbchain.org',
    ]);
    expect(CHAINS.metis.rpcEndpoints).toEqual([
      'https://metis-rpc.publicnode.com',
      'https://andromeda.metis.io',
    ]);
    expect(CHAINS.aurora.rpcEndpoints).toEqual([
      'https://mainnet.aurora.dev',
      'https://1rpc.io/aurora',
    ]);
    expect(CHAINS.fantom.rpcEndpoints).toEqual([
      'https://rpc.fantom.network',
      'https://rpc2.fantom.network',
    ]);
    expect(CHAINS.ltc.rpcEndpoints).toEqual(['https://litecoinspace.org/api']);
    expect(CHAINS.doge.rpcEndpoints).toEqual([
      'https://sochain.com/api/v3',
      'https://api.blockcypher.com/v1/doge/main',
    ]);
  });

  it('lists all 22 chains for balance once their adapters land', () => {
    expect(availableFor('balance')).toEqual([...SUPPORTED_CHAINS]);
  });

  it('marks balance verified for the 9 new chains with a dated live cross-check', () => {
    for (const chain of ['sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge'] as const) {
      const caps = capabilitiesFor(chain);
      expect(caps.balance.status).toBe('verified');
      expect(caps.balance.evidenceLevel).toBe('mainnet-confirmed');
      expect(caps.balance.evidence).toContain('live mainnet cross-check 2026-11-22');
    }
  });

  it('marks balance verified for the 9 item-14 chains with a dated live cross-check', () => {
    for (const chain of ['gnosis', 'celo', 'linea', 'mantle', 'scroll', 'opbnb', 'metis', 'aurora', 'fantom'] as const) {
      const caps = capabilitiesFor(chain);
      expect(caps.balance.status).toBe('verified');
      expect(caps.balance.evidenceLevel).toBe('mainnet-confirmed');
      expect(caps.balance.evidence).toContain('live mainnet cross-check 2026-11-23');
    }
  });

  it('keeps history, fee-quote and send blocked for the 9 new chains', () => {
    for (const chain of ['sol', 'bsc', 'matic', 'arb', 'op', 'base', 'avax', 'ltc', 'doge'] as const) {
      const caps = capabilitiesFor(chain);
      for (const capability of ['history', 'fee-quote', 'unsigned-plan', 'local-sign', 'post-sign-verify'] as const) {
        expect(caps[capability].status).toBe('blocked');
        expect(caps[capability].evidence).toContain('never faked');
      }
    }
  });
});
