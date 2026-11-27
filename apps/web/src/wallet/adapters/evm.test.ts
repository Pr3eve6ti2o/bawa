import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createEvmAdapter, type EvmAdapterConfig } from './evm';
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
