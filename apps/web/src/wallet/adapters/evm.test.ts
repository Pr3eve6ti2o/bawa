import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import {
  createEvmAdapter,
  parseBlockscoutV2TokenTransfers,
  parseBlockscoutV2TxList,
  type EvmAdapterConfig,
} from './evm';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const ADDRESS = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';

const BSC: EvmAdapterConfig = {
  chain: 'bsc',
  networkId: 'eip155:56',
  rpcUrl: 'https://bsc-rpc.publicnode.com',
  evmChainId: 56,
  chainName: 'BNB Smart Chain',
  nativeSymbol: 'BNB',
  source: 'publicnode',
};

function mockClient(overrides: Record<string, unknown> = {}): PublicClient {
  return {
    getChainId: vi.fn(async () => 56),
    getBalance: vi.fn(async () => 2000000000000000000n),
    getGasPrice: vi.fn(async () => 3000000000n),
    getTransactionCount: vi.fn(async () => 4),
    ...overrides,
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

describe('evm adapter — balance', () => {
  it('returns the exact base-unit string with the chain network id', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2000000000000000000');
      expect(result.data.decimals).toBe(18);
      expect(result.data.networkId).toBe('eip155:56');
      expect(result.data.chain).toBe('bsc');
    }
  });

  it('reports an exact zero, not an error', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({ getBalance: vi.fn(async () => 0n) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('rejects an invalid address', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getBalance('not-an-address');
    expect(result).toEqual({ status: 'error', reason: 'Invalid Ethereum address' });
  });

  it('errors when the RPC reports the wrong chain id', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({ getChainId: vi.fn(async () => 1) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('expected chain 56');
      expect(result.reason).toContain('got 1');
    }
  });

  it('errors when the RPC throws', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({ getBalance: vi.fn(async () => { throw new Error('boom'); }) }),
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result).toEqual({ status: 'error', reason: 'boom' });
  });
});

describe('evm adapter — Ronin ronin: prefix (Lane 80-APP, 2026-11-24)', () => {
  const RONIN: EvmAdapterConfig = {
    chain: 'ronin',
    networkId: 'eip155:2020',
    rpcUrl: 'https://api.roninchain.com/rpc',
    evmChainId: 2020,
    chainName: 'Ronin',
    nativeSymbol: 'RON',
    source: 'roninchain',
  };
  // The real Ronin form: the prefix REPLACES the 0x (not prepended).
  const RONIN_ADDRESS = 'ronin:A3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';

  it('loads a balance for a ronin: address (the prefix is stripped before the RPC call)', async () => {
    const adapter = createEvmAdapter(RONIN, {
      client: mockClient({ getChainId: vi.fn(async () => 2020) }),
    });
    const result = await adapter.getBalance(RONIN_ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2000000000000000000');
      expect(result.data.chain).toBe('ronin');
      expect(result.data.networkId).toBe('eip155:2020');
    }
  });

  it('loads a balance for the ronin:0x spelling too', async () => {
    const adapter = createEvmAdapter(RONIN, {
      client: mockClient({ getChainId: vi.fn(async () => 2020) }),
    });
    const result = await adapter.getBalance('ronin:0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2000000000000000000');
    }
  });

  it('loads a balance for the bare 0x form too', async () => {
    const adapter = createEvmAdapter(RONIN, {
      client: mockClient({ getChainId: vi.fn(async () => 2020) }),
    });
    const result = await adapter.getBalance('0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2000000000000000000');
    }
  });

  it('reads tx inputs for a ronin: address', async () => {
    const adapter = createEvmAdapter(RONIN, {
      client: mockClient({ getChainId: vi.fn(async () => 2020) }),
    });
    const result = await adapter.getTxInputs(RONIN_ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toEqual({ kind: 'nonce', nonce: 4 });
    }
  });
});

describe('evm adapter — fee and tx inputs', () => {
  it('estimates a native-transfer fee at 21000 gas', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.estimateFee();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.feeBaseUnits).toBe((3000000000n * 21000n).toString());
      expect(result.data.unit).toBe('wei');
    }
  });

  it('returns the nonce for tx inputs', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result).toMatchObject({ status: 'ok', data: { kind: 'nonce', nonce: 4 } });
  });

  it('reads the nonce at the pending block tag (A-4)', async () => {
    const client = mockClient();
    const adapter = createEvmAdapter(BSC, { client });
    const result = await adapter.getTxInputs(ADDRESS);
    expect(result.status).toBe('ok');
    expect(client.getTransactionCount).toHaveBeenCalledWith(
      expect.objectContaining({ blockTag: 'pending' }),
    );
  });
});

describe('evm adapter — history', () => {
  it('reports history unavailable when no history endpoint is configured', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('unavailable');
  });

  it('reads Blockscout history when a history endpoint is configured', async () => {
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
    const adapter = createEvmAdapter(
      { ...BSC, historyBaseUrl: 'https://eth.blockscout.com/api', historyExplorerBase: 'https://eth.blockscout.com' },
      { client: mockClient() },
    );
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: '0xabc',
        direction: 'out',
        amountBaseUnits: '1000',
        explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
      });
    }
  });

  it('reads Linea history through Etherscan V2, joining params with & after ?chainid=', async () => {
    // Fix-All Lane A: the Linea base URL carries ?chainid=59144, so the
    // txlist params must join with '&' — a second '?' would make the
    // whole query one opaque parameter. The live keyless response
    // carries message "OK-Missing/Invalid API Key, rate limit of
    // 1/5sec applied" with status '1' and real transactions.
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: '1',
        message: 'OK-Missing/Invalid API Key, rate limit of 1/5sec applied',
        result: [
          {
            hash: '0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c',
            from: '0x8915e470d0dd8a7830d96d6710cd2f4262dd7c40',
            to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            value: '20000000000000',
            timeStamp: '1782299939',
            txreceipt_status: '1',
            isError: '0',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createEvmAdapter(
      {
        chain: 'linea',
        networkId: 'eip155:59144',
        rpcUrl: 'https://linea-rpc.publicnode.com',
        evmChainId: 59144,
        chainName: 'Linea',
        nativeSymbol: 'ETH',
        source: 'publicnode',
        historyBaseUrl: 'https://api.etherscan.io/v2/api?chainid=59144',
        historyExplorerBase: 'https://lineascan.build',
      },
      { client: mockClient({ getChainId: vi.fn(async () => 59144) }) },
    );
    const result = await adapter.getHistory(
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('etherscan-v2');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: '0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c',
        direction: 'in',
        amountBaseUnits: '20000000000000',
        explorerUrl:
          'https://lineascan.build/tx/0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c',
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(url).toBe(
      'https://api.etherscan.io/v2/api?chainid=59144&module=account&action=txlist&address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&page=1&offset=20&sort=desc',
    );

  });

  it('retries an Etherscan V2 keyless-quota NOTOK once after the 5 s window', async () => {
    // Merge lane (2026-11-24): the keyless tier is 1 request per 5 s
    // per IP and answers NOTOK "Missing/Invalid API Key" inside the
    // window. The app fires the refresh twice in quick succession, so
    // the second call is quota-hit; the adapter retries it once after
    // 6 s instead of returning the error. A second NOTOK is returned
    // as the error (covered by the status-'0' path, not retried).
    vi.useFakeTimers();
    try {
      const okBody = {
        status: '1',
        message: 'OK-Missing/Invalid API Key, rate limit of 1/5sec applied',
        result: [
          {
            hash: '0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c',
            from: '0x8915e470d0dd8a7830d96d6710cd2f4262dd7c40',
            to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            value: '20000000000000',
            timeStamp: '1782299939',
            txreceipt_status: '1',
            isError: '0',
          },
        ],
      };
      // The mock returns Promise<unknown>: the two stubbed bodies carry
      // `result` as a string (NOTOK) and as an array (ok), which do not
      // unify into one mock type.
      const fetchMock = vi
        .fn(async (): Promise<unknown> => ({
          ok: true,
          status: 200,
          json: async () => ({
            status: '0',
            message: 'NOTOK',
            result: 'Missing/Invalid API Key',
          }),
        }))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: '0',
            message: 'NOTOK',
            result: 'Missing/Invalid API Key',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => okBody,
        });
      vi.stubGlobal('fetch', fetchMock);
      const adapter = createEvmAdapter(
        {
          chain: 'linea',
          networkId: 'eip155:59144',
          rpcUrl: 'https://linea-rpc.publicnode.com',
          evmChainId: 59144,
          chainName: 'Linea',
          nativeSymbol: 'ETH',
          source: 'publicnode',
          historyBaseUrl: 'https://api.etherscan.io/v2/api?chainid=59144',
          historyExplorerBase: 'https://lineascan.build',
        },
        { client: mockClient({ getChainId: vi.fn(async () => 59144) }) },
      );
      const pending = adapter.getHistory(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      );
      await vi.advanceTimersByTimeAsync(6000);
      const result = await pending;
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.hash).toBe(
          '0x75dfb5f5c555ec25c87e3c7d0ff5401ec84fd7129ac8cfcb1935692435e97c9c',
        );
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('evm adapter — token history', () => {
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  it('reads tokentx transfers with the token on each row', async () => {
    // Watch-only display programme: the asset-detail token route
    // shows real USDC history instead of "No history for this token
    // yet". The tokentx entry carries the token, and the amount is in
    // the token's smallest units — so the row carries the token with
    // it for formatting.
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: '1',
        message: 'OK',
        result: [
          {
            hash: '0xtoken1',
            from: ADDRESS,
            to: '0x000000000000000000000000000000000000dEaD',
            value: '1136600000',
            timeStamp: '1700000000',
            contractAddress: USDC,
            tokenName: 'USD Coin',
            tokenSymbol: 'USDC',
            tokenDecimal: '6',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = createEvmAdapter(
      {
        chain: 'eth',
        networkId: 'eip155:1',
        rpcUrl: 'https://eth-rpc.publicnode.com',
        evmChainId: 1,
        chainName: 'Ethereum',
        nativeSymbol: 'ETH',
        source: 'publicnode',
        historyBaseUrl: 'https://eth.blockscout.com/api',
        historyExplorerBase: 'https://eth.blockscout.com',
      },
      { client: mockClient({ getChainId: vi.fn(async () => 1) }) },
    );
    const result = await adapter.getTokenHistory?.(USDC, ADDRESS, 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('action=tokentx');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`contractaddress=${USDC}`);
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: '0xtoken1',
        direction: 'out',
        amountBaseUnits: '1136600000',
        token: { symbol: 'USDC', decimals: 6 },
      });
    }
  });

  it('rejects an invalid contract address', async () => {
    const adapter = createEvmAdapter(
      { ...BSC, historyBaseUrl: 'https://eth.blockscout.com/api' },
      { client: mockClient() },
    );
    const result = await adapter.getTokenHistory?.('not-a-contract', ADDRESS);
    expect(result).toEqual({
      status: 'error',
      reason: 'Invalid token contract address',
    });
  });

  it('reports token history unavailable when no history endpoint is configured', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    const result = await adapter.getTokenHistory?.(USDC, ADDRESS);
    expect(result?.status).toBe('unavailable');
  });
});

describe('evm adapter — broadcast', () => {
  it('always throws the broadcast-disabled message', async () => {
    const adapter = createEvmAdapter(BSC, { client: mockClient() });
    await expect(adapter.broadcast({})).rejects.toThrow(BROADCAST_DISABLED_MESSAGE);
  });
});

describe('evm adapter — RPC failover (UI/UX fixes, item 19)', () => {
  /** JSON-RPC fetch stub: the primary host throws, the backup answers. */
  function mockRpcFailover(primaryHost: string, _backupHost: string): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith(primaryHost)) {
          throw new Error('Network error: primary RPC unreachable');
        }
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: unknown;
          method?: string;
        };
        const result =
          body.method === 'eth_chainId'
            ? '0x38'
            : body.method === 'eth_getBalance'
              ? '0x1bc16d674ec80000'
              : body.method === 'eth_gasPrice'
                ? '0x77359400'
                : body.method === 'eth_getTransactionCount'
                  ? '0x4'
                  : '0x0';
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ jsonrpc: '2.0', id: body.id ?? 1, result }),
          // viem reads the body as text first (error paths), then parses.
          text: async () =>
            JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }),
        };
      }),
    );
  }

  it('loads a balance through the backup RPC when the primary is down', async () => {
    mockRpcFailover('https://bsc-primary.invalid', 'https://bsc-backup.invalid');
    const adapter = createEvmAdapter(BSC, {
      rpcUrls: ['https://bsc-primary.invalid', 'https://bsc-backup.invalid'],
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2000000000000000000');
      // The answering endpoint is named, never the dead primary.
      expect(result.data.source).toBe('bsc-backup.invalid');
    }
  });

  it('errors when every RPC is down, naming the last failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error: all RPCs unreachable');
      }),
    );
    const adapter = createEvmAdapter(BSC, {
      rpcUrls: ['https://bsc-primary.invalid', 'https://bsc-backup.invalid'],
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('error');
  });

  it('re-reads a resolver-supplied RPC list on every call', async () => {
    mockRpcFailover('https://bsc-primary.invalid', 'https://bsc-backup.invalid');
    let urls = ['https://bsc-primary.invalid', 'https://bsc-backup.invalid'];
    const adapter = createEvmAdapter(BSC, { rpcUrls: () => urls });
    const first = await adapter.getBalance(ADDRESS);
    expect(first.status).toBe('ok');
    // The primary recovers and is put first again: the next call must
    // use it (source flips back to the primary host).
    urls = ['https://bsc-backup.invalid', 'https://bsc-primary.invalid'];
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      void input;
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: unknown;
        method?: string;
      };
      const result =
        body.method === 'eth_chainId'
          ? '0x38'
          : body.method === 'eth_getBalance'
            ? '0x1bc16d674ec80000'
            : '0x0';
      // Partial Response shape, like mockRpcFailover above: viem
      // only reads ok/status/headers/json/text from it.
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ jsonrpc: '2.0', id: body.id ?? 1, result }),
        text: async () =>
          JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }),
      } as unknown as Response;
    });
    const second = await adapter.getBalance(ADDRESS);
    expect(second.status).toBe('ok');
    if (second.status === 'ok') {
      expect(second.data.source).toBe('bsc-backup.invalid');
    }
  });

  it('an injected client still wins over the RPC list', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient(),
      rpcUrls: ['https://bsc-primary.invalid'],
    });
    const result = await adapter.getBalance(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.source).toBe('publicnode');
  });
});

// Lane B (Finish the Product, 2026-11-23): Routescan history for
// Avalanche/Mantle must report its own source label, not 'blockscout',
// and parse the same Etherscan-compatible txlist shape.
// (Appended to wallet/adapters/evm.test.ts.)
describe('evm adapter — history source labels (Lane B)', () => {
  it('reads Routescan history and reports source routescan', async () => {
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
    const adapter = createEvmAdapter(
      {
        ...BSC,
        chain: 'avax',
        networkId: 'eip155:43114',
        evmChainId: 43114,
        chainName: 'Avalanche C-Chain',
        nativeSymbol: 'AVAX',
        historyBaseUrl:
          'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api',
      },
      { client: mockClient({ getChainId: vi.fn(async () => 43114) }) },
    );
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('routescan');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: '0xabc',
        direction: 'out',
        amountBaseUnits: '1000',
      });
    }
  });

  it('reports source blockscout for a Blockscout history endpoint', async () => {
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
    const adapter = createEvmAdapter(
      { ...BSC, historyBaseUrl: 'https://eth.blockscout.com/api', historyExplorerBase: 'https://eth.blockscout.com' },
      { client: mockClient() },
    );
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('blockscout');
    }
  });
});

// P2-A, M2: live fee data for the Slow / Standard / Fast tiers.
describe('evm adapter — estimateFeeTiers', () => {
  it('returns the live max fee and priority fee from estimateFeesPerGas', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({
        estimateFeesPerGas: vi.fn(async () => ({
          maxFeePerGas: 50000000000n,
          maxPriorityFeePerGas: 50000000n,
        })),
      }),
    });
    const result = await adapter.estimateFeeTiers?.();
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.data.chain).toBe('bsc');
      expect(result.data.maxFeePerGasWei).toBe('50000000000');
      expect(result.data.maxPriorityFeePerGasWei).toBe('50000000');
    }
  });

  it('falls back to the gas price with a zero priority fee when EIP-1559 fees are unsupported', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({
        estimateFeesPerGas: vi.fn(async () => {
          throw new Error('EIP-1559 fees are not supported');
        }),
      }),
    });
    const result = await adapter.estimateFeeTiers?.();
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.data.maxFeePerGasWei).toBe('3000000000');
      expect(result.data.maxPriorityFeePerGasWei).toBe('0');
    }
  });

  it('errors when both fee reads fail, never guessing tiers', async () => {
    const adapter = createEvmAdapter(BSC, {
      client: mockClient({
        estimateFeesPerGas: vi.fn(async () => {
          throw new Error('fee history down');
        }),
        getGasPrice: vi.fn(async () => {
          throw new Error('gas price down');
        }),
      }),
    });
    const result = await adapter.estimateFeeTiers?.();
    expect(result?.status).toBe('error');
  });
});

// Partials fix (2026-11-28): Blockscout v2 REST history fallback.
// Ethereum history is Routescan-primary (eth.ts / chains.ts); when
// the primary errors, the adapter falls back to Blockscout v2 on the
// explorer host — the v1/v2 buckets are separate (10 vs 180, probed
// live 2026-11-28). Fixtures below are the live v2 shapes, trimmed.
describe('evm adapter — Blockscout v2 history fallback', () => {
  const ETH: EvmAdapterConfig = {
    chain: 'eth',
    networkId: 'eip155:1',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    evmChainId: 1,
    chainName: 'Ethereum',
    nativeSymbol: 'ETH',
    source: 'publicnode',
    historyBaseUrl:
      'https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api',
    historyExplorerBase: 'https://eth.blockscout.com',
  };
  const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const ethClient = (): PublicClient =>
    mockClient({ getChainId: vi.fn(async () => 1) });

  // Live v2 transactions item (eth.blockscout.com, EF address,
  // 2026-11-28): newest row, hash 0x986656a4… at block 26475533.
  const V2_TX = {
    hash: '0x986656a45d8e5be5faf91af9ebda32aeb27493555fb77cda4e980045c4536455',
    block_number: 26475533,
    timestamp: '2026-11-23T04:46:47.000000Z',
    status: 'ok',
    value: '0',
    from: { hash: '0x74bfc11416e3443a5f3ff85f71acfb503216a165' },
    to: { hash: ADDRESS },
    fee: { value: '13433138658240' },
  };
  // Live v2 token-transfers items (same probe): the USDT row first,
  // then the USDC row at block 26163453, 115.68205 USDC.
  const V2_USDT_TRANSFER = {
    transaction_hash:
      '0xfb5fed09a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
    block_number: 26331158,
    timestamp: '2026-11-03T02:03:47.000000Z',
    from: { hash: '0x1e459CEB323152F1F5d6A7639f46E287CE8423b3' },
    to: { hash: ADDRESS },
    token: {
      address_hash: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      decimals: '6',
    },
    total: { value: '10000000', decimals: '6' },
    token_type: 'ERC-20',
  };
  const V2_USDC_TRANSFER = {
    transaction_hash:
      '0x9d0afd8e33eebbbde1b5ae5eceeb1dc1c84f9fd7171ebe9f06121b14aab07f5a',
    block_number: 26163453,
    timestamp: '2026-10-10T17:13:35.000000Z',
    from: { hash: '0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055' },
    to: { hash: ADDRESS },
    token: {
      address_hash: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: '6',
    },
    total: { value: '115682050', decimals: '6' },
    token_type: 'ERC-20',
  };

  function mockRoutedFetch(
    handler: (url: string) => { ok: boolean; status: number; body?: unknown },
  ): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const res = handler(url);
        return {
          ok: res.ok,
          status: res.status,
          json: async () => res.body ?? {},
        };
      }),
    );
  }

  it('reads Routescan history as the primary and labels the source routescan', async () => {
    const seen: string[] = [];
    mockRoutedFetch((url) => {
      seen.push(url);
      return {
        ok: true,
        status: 200,
        body: {
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0xabc',
              from: ADDRESS,
              to: '0x000000000000000000000000000000000000dEaD',
              value: '1000',
              timeStamp: '1700000000',
              txreceipt_status: '1',
              isError: '0',
            },
          ],
        },
      };
    });
    const adapter = createEvmAdapter(ETH, { client: ethClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('routescan');
      expect(result.data).toHaveLength(1);
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('api.routescan.io');
    expect(seen[0]).toContain('action=txlist');
  });

  it('falls back to Blockscout v2 txlist when the primary 429s', async () => {
    const seen: string[] = [];
    mockRoutedFetch((url) => {
      seen.push(url);
      if (url.includes('api.routescan.io')) {
        return { ok: false, status: 429 };
      }
      return {
        ok: true,
        status: 200,
        body: { items: [V2_TX], next_page_params: null },
      };
    });
    const adapter = createEvmAdapter(ETH, { client: ethClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.source).toBe('blockscout-v2');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: V2_TX.hash,
        direction: 'in',
        amountBaseUnits: '0',
        explorerUrl: `https://eth.blockscout.com/tx/${V2_TX.hash}`,
      });
    }
    expect(seen.some((url) => url.includes('eth.blockscout.com/api/v2/addresses'))).toBe(true);
    expect(seen.some((url) => url.includes('transactions?items_count='))).toBe(true);
  });

  it('falls back to Blockscout v2 token-transfers with a client-side USDC filter', async () => {
    mockRoutedFetch((url) => {
      if (url.includes('api.routescan.io')) {
        return { ok: false, status: 429 };
      }
      return {
        ok: true,
        status: 200,
        body: {
          items: [V2_USDT_TRANSFER, V2_USDC_TRANSFER],
          next_page_params: null,
        },
      };
    });
    const adapter = createEvmAdapter(ETH, { client: ethClient() });
    const result = await adapter.getTokenHistory?.(USDC, ADDRESS, 5);
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') {
      expect(result.source).toBe('blockscout-v2');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        hash: V2_USDC_TRANSFER.transaction_hash,
        direction: 'in',
        amountBaseUnits: '115682050',
        token: { symbol: 'USDC', decimals: 6 },
      });
    }
  });

  it('does not fall back on a terminal primary 404', async () => {
    const seen: string[] = [];
    mockRoutedFetch((url) => {
      seen.push(url);
      return { ok: false, status: 404 };
    });
    const adapter = createEvmAdapter(ETH, { client: ethClient() });
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('error');
    // Item 2: a terminal error is the indexer's settled answer — no
    // fallback attempt, so exactly one fetch.
    expect(seen).toHaveLength(1);
  });

  it('keeps the primary error when there is no Blockscout host to fall back to', async () => {
    const seen: string[] = [];
    mockRoutedFetch((url) => {
      seen.push(url);
      return { ok: false, status: 429 };
    });
    const adapter = createEvmAdapter(
      { ...ETH, historyExplorerBase: 'https://routescan.io' },
      { client: ethClient() },
    );
    const result = await adapter.getHistory(ADDRESS);
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.reason).toContain('429');
    }
    expect(seen.some((url) => url.includes('blockscout.com'))).toBe(false);
  });

  it('keeps the primary error when the v2 token walk finds no match in its bounded pages', async () => {
    const seen: string[] = [];
    mockRoutedFetch((url) => {
      seen.push(url);
      if (url.includes('api.routescan.io')) {
        return { ok: false, status: 429 };
      }
      // One USDT row per page, always another page — inconclusive,
      // so the walk must stop after its bounded pages, not page on.
      return {
        ok: true,
        status: 200,
        body: {
          items: [V2_USDT_TRANSFER],
          next_page_params: { index: 6, block_number: 26163453 },
        },
      };
    });
    const adapter = createEvmAdapter(ETH, { client: ethClient() });
    const result = await adapter.getTokenHistory?.(USDC, ADDRESS, 5);
    expect(result?.status).toBe('error');
    if (result?.status === 'error') {
      expect(result.reason).toContain('429');
    }
    // Primary retries 3 times, then the bounded 3-page v2 walk.
    expect(seen.filter((url) => url.includes('api.routescan.io'))).toHaveLength(3);
    expect(seen.filter((url) => url.includes('token-transfers'))).toHaveLength(3);
  });

  it('parses the v2 txlist shape and rejects a wrong shape', () => {
    const parsed = parseBlockscoutV2TxList(
      { items: [V2_TX], next_page_params: null },
      {
        chain: 'eth',
        networkId: 'eip155:1',
        address: ADDRESS,
        explorerBase: 'https://eth.blockscout.com',
      },
    );
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]).toMatchObject({
      hash: V2_TX.hash,
      direction: 'in',
      status: 'confirmed',
    });
    expect(parseBlockscoutV2TxList(null, {
      chain: 'eth',
      networkId: 'eip155:1',
      address: ADDRESS,
    })).toBeNull();
    expect(parseBlockscoutV2TxList({ items: [{ hash: '0xabc' }] }, {
      chain: 'eth',
      networkId: 'eip155:1',
      address: ADDRESS,
    })).toBeNull();
  });

  it('parses v2 token-transfers with a client-side filter and keyset params', () => {
    const parsed = parseBlockscoutV2TokenTransfers(
      {
        items: [V2_USDT_TRANSFER, V2_USDC_TRANSFER],
        next_page_params: { index: 6, block_number: 26163453 },
      },
      {
        chain: 'eth',
        networkId: 'eip155:1',
        address: ADDRESS,
        explorerBase: 'https://eth.blockscout.com',
        contract: USDC,
      },
    );
    expect(parsed?.txs).toHaveLength(1);
    expect(parsed?.txs[0]).toMatchObject({
      hash: V2_USDC_TRANSFER.transaction_hash,
      amountBaseUnits: '115682050',
    });
    expect(parsed?.nextPageParams).toEqual({
      index: 6,
      block_number: 26163453,
    });
    const empty = parseBlockscoutV2TokenTransfers(
      { items: [V2_USDT_TRANSFER], next_page_params: null },
      {
        chain: 'eth',
        networkId: 'eip155:1',
        address: ADDRESS,
        contract: USDC,
      },
    );
    expect(empty?.txs).toHaveLength(0);
    expect(empty?.nextPageParams).toBeNull();
  });
});
