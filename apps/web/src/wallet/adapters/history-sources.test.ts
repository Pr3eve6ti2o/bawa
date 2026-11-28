/**
 * Gap 1 (Lane D, 2026-11-23): keyless EVM history for Celo, Optimism
 * and Scroll. The three hosts were probed live from gray-pinee on
 * 2026-11-23 and answer the Blockscout `?module=account&action=txlist`
 * shape with real transactions. (Merge: Lane B wired six more the same
 * day, so nine of fifteen non-ETH EVM chains are wired and six stay
 * unwired — bsc, gnosis, linea, opbnb, metis, fantom; see
 * EVM_HISTORY_SOURCES and docs/GAP-ANALYSIS.md §1. Fix-All Lane A,
 * 2026-11-24: Linea is wired too, via Etherscan V2 keyless — ten
 * wired, five unwired: bsc, gnosis, opbnb, metis, fantom. Gnosis is
 * wired 2026-11-28 via gnosisscan.io keyless (browser fetch; curl is
 * 403 Cloudflare) — eleven wired, four unwired: bsc, opbnb, metis,
 * fantom. Gnosis is wired in chains.ts, not in EVM_HISTORY_SOURCES,
 * like Linea.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createEvmAdapter, type EvmAdapterConfig } from './evm';
import { EVM_HISTORY_SOURCES } from './index';

const ADDRESS = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';

function mockClient(chainId: number): PublicClient {
  return {
    getChainId: vi.fn(async () => chainId),
    getBalance: vi.fn(async () => 0n),
    getGasPrice: vi.fn(async () => 0n),
    getTransactionCount: vi.fn(async () => 0),
  } as unknown as PublicClient;
}

function mockFetchJson(result: unknown, status = '1', message = 'OK'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status, message, result }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CONFIGS: Record<
  'celo' | 'op' | 'scroll',
  { config: EvmAdapterConfig; chainId: number; source: string }
> = {
  celo: {
    config: {
      chain: 'celo',
      networkId: 'eip155:42220',
      rpcUrl: 'https://celo-rpc.publicnode.com',
      evmChainId: 42220,
      chainName: 'Celo',
      nativeSymbol: 'CELO',
      source: 'publicnode',
      ...historyFor('celo'),
    },
    chainId: 42220,
    source: 'blockscout',
  },
  op: {
    config: {
      chain: 'op',
      networkId: 'eip155:10',
      rpcUrl: 'https://optimism-rpc.publicnode.com',
      evmChainId: 10,
      chainName: 'Optimism',
      nativeSymbol: 'ETH',
      source: 'publicnode',
      ...historyFor('op'),
    },
    chainId: 10,
    source: 'optimism-explorer',
  },
  scroll: {
    config: {
      chain: 'scroll',
      networkId: 'eip155:534352',
      rpcUrl: 'https://scroll-rpc.publicnode.com',
      evmChainId: 534352,
      chainName: 'Scroll',
      nativeSymbol: 'ETH',
      source: 'publicnode',
      ...historyFor('scroll'),
    },
    chainId: 534352,
    source: 'scrollscan',
  },
};

function historyFor(chain: 'celo' | 'op' | 'scroll'): {
  historyBaseUrl: string;
  historyExplorerBase: string;
  historySource: string;
} {
  const entry = EVM_HISTORY_SOURCES[chain];
  if (entry === undefined) {
    throw new Error(`no wired history source for ${chain}`);
  }
  return entry;
}

describe('gap 1 — EVM history sources', () => {
  it('wires exactly celo, op and scroll, all https, explorer base on the API host', () => {
    expect(Object.keys(EVM_HISTORY_SOURCES).sort()).toEqual([
      'celo',
      'op',
      'scroll',
    ]);
    for (const entry of Object.values(EVM_HISTORY_SOURCES)) {
      expect(entry.historyBaseUrl.startsWith('https://')).toBe(true);
      expect(entry.historyExplorerBase.startsWith('https://')).toBe(true);
      expect(new URL(entry.historyBaseUrl).origin).toBe(
        entry.historyExplorerBase,
      );
    }
    expect(historyFor('celo').historyBaseUrl).toBe(
      'https://celo.blockscout.com/api',
    );
    expect(historyFor('op').historyBaseUrl).toBe(
      'https://explorer.optimism.io/api',
    );
    expect(historyFor('scroll').historyBaseUrl).toBe(
      'https://scrollscan.com/api',
    );
  });

  it.each(['celo', 'op', 'scroll'] as const)(
    'reads %s history through its wired source and links to its explorer',
    async (chain) => {
      mockFetchJson([
        {
          hash: '0xabc',
          from: ADDRESS,
          to: '0x000000000000000000000000000000000000dEaD',
          value: '1000',
          timeStamp: '1700000000',
          txreceipt_status: '1',
          isError: '0',
        },
      ]);
      const { config, chainId, source } = CONFIGS[chain];
      const adapter = createEvmAdapter(config, {
        client: mockClient(chainId),
      });
      const result = await adapter.getHistory(ADDRESS);
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.source).toBe(source);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
          hash: '0xabc',
          explorerUrl: `${config.historyExplorerBase}/tx/0xabc`,
        });
      }
    },
  );

  it('leaves the other EVM chains without history (unavailable, never faked)', async () => {
    const bsc: EvmAdapterConfig = {
      chain: 'bsc',
      networkId: 'eip155:56',
      rpcUrl: 'https://bsc-rpc.publicnode.com',
      evmChainId: 56,
      chainName: 'BNB Smart Chain',
      nativeSymbol: 'BNB',
      source: 'publicnode',
    };
    const adapter = createEvmAdapter(bsc, { client: mockClient(56) });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('unavailable');
  });
});
