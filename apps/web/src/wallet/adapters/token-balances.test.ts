import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchTokenBalance,
  fetchTronTokenMetadata,
  isValidTronAddress,
  resolveTokenCoingeckoId,
  tronAddressToHex,
  verifyEvmToken,
  verifyTronToken,
  type EvmRpcClient,
  type FetchTransportLike,
} from './token-balances';

const OWNER = '0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_OWNER = 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9';

function uint256Hex(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function abiStringHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const length = bytes.length.toString(16).padStart(64, '0');
  const data = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const padded = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
  return '0'.repeat(62) + '20' + length + padded;
}

/**
 * Fake EVM JSON-RPC client: dispatches on the method, and for eth_call
 * on the 4-byte function selector — the same surface the implementation
 * uses (raw JSON-RPC, no viem actions). Overrides replace one response
 * (a hex string) or throw (an Error) for that selector.
 */
function mockEvmClient(overrides: {
  chainId?: string;
  code?: string;
  balanceOf?: string | Error;
  name?: string | Error;
  symbol?: string | Error;
  decimals?: string | Error;
} = {}): EvmRpcClient {
  const responses: Record<string, string | Error> = {
    '0x70a08231': overrides.balanceOf ?? `0x${uint256Hex(2500000n)}`,
    '0x06fdde03': overrides.name ?? `0x${abiStringHex('USD Coin')}`,
    '0x95d89b41': overrides.symbol ?? `0x${abiStringHex('USDC')}`,
    '0x313ce567': overrides.decimals ?? `0x${uint256Hex(6n)}`,
  };
  const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
    if (args.method === 'eth_chainId') return overrides.chainId ?? '0x1';
    if (args.method === 'eth_getCode') return overrides.code ?? '0x60006000';
    if (args.method === 'eth_call') {
      const data = String(
        (args.params?.[0] as { data?: string } | undefined)?.data ?? '',
      ).toLowerCase();
      for (const [selector, value] of Object.entries(responses)) {
        if (data.startsWith(selector)) {
          if (value instanceof Error) throw value;
          return value;
        }
      }
      throw new Error(`unexpected eth_call data ${data}`);
    }
    throw new Error(`unexpected method ${args.method}`);
  });
  return { request };
}

function tronTransport(handlers: {
  balanceOf?: string;
  name?: string;
  symbol?: string;
  decimals?: string;
  probeOk?: boolean;
}): FetchTransportLike {
  return {
    request: vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { function_selector?: string };
      const selector = body.function_selector ?? '';
      const ok = handlers.probeOk !== false;
      const constant = (value: string | undefined): string[] =>
        value === undefined ? [] : [value];
      if (selector === 'balanceOf(address)') {
        return { result: { result: ok }, constant_result: constant(handlers.balanceOf) };
      }
      if (selector === 'name()') {
        return { result: { result: ok }, constant_result: constant(handlers.name) };
      }
      if (selector === 'symbol()') {
        return { result: { result: ok }, constant_result: constant(handlers.symbol) };
      }
      if (selector === 'decimals()') {
        return { result: { result: ok }, constant_result: constant(handlers.decimals) };
      }
      throw new Error(`unexpected selector ${selector}`);
    }),
  };
}

const okTron = tronTransport({
  balanceOf: uint256Hex(5000000n),
  name: abiStringHex('Tether USD'),
  symbol: abiStringHex('USDT'),
  decimals: uint256Hex(6n),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ERC-20 balanceOf', () => {
  it('returns the exact base-unit balance with the token decimals', async () => {
    const result = await fetchTokenBalance(
      { chain: 'eth', contract: USDC, ownerAddress: OWNER },
      { evmClient: mockEvmClient() },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2500000');
      expect(result.data.decimals).toBe(6);
      expect(result.data.chain).toBe('eth');
    }
  });

  it('reports an exact zero balance, not an error', async () => {
    // A balance must never fail just because another read is
    // unavailable: for USDC the decimals come from the default-token
    // table, so no decimals read happens at all.
    const client = mockEvmClient({
      balanceOf: `0x${uint256Hex(0n)}`,
      name: new Error('unexpected'),
      symbol: new Error('unexpected'),
      decimals: new Error('unexpected'),
    });
    const result = await fetchTokenBalance(
      { chain: 'eth', contract: USDC, ownerAddress: OWNER },
      { evmClient: client },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });

  it('errors when the RPC reports the wrong chain id', async () => {
    const client = mockEvmClient({ chainId: '0x38' });
    const result = await fetchTokenBalance(
      { chain: 'eth', contract: USDC, ownerAddress: OWNER },
      { evmClient: client },
    );
    expect(result.status).toBe('error');
  });
});

describe('verifyEvmToken', () => {
  it('verifies a real token with metadata and a real balance', async () => {
    const result = await verifyEvmToken({
      chain: 'eth',
      contract: USDC,
      ownerAddress: OWNER,
      evmClient: mockEvmClient(),
    });
    expect(result).toEqual({
      ok: true,
      metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
      balanceBaseUnits: '2500000',
    });
  });

  it('decodes a bytes32 name from an older token', async () => {
    // Some older tokens return name() as a bare 32-byte word instead
    // of an ABI-encoded string.
    const bytes32 = (value: string): string =>
      `0x${[...new TextEncoder().encode(value)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`.padEnd(66, '0');
    const client = mockEvmClient({ name: bytes32('MKR') });
    const result = await verifyEvmToken({
      chain: 'eth',
      contract: USDC,
      ownerAddress: OWNER,
      evmClient: client,
    });
    expect(result).toEqual({
      ok: true,
      metadata: { name: 'MKR', symbol: 'USDC', decimals: 6 },
      balanceBaseUnits: '2500000',
    });
  });

  it('rejects a non-contract address', async () => {
    const client = mockEvmClient({ code: '0x' });
    const result = await verifyEvmToken({
      chain: 'eth',
      contract: USDC,
      ownerAddress: OWNER,
      evmClient: client,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not a token contract');
    }
  });

  it('rejects a bad-format address without touching the network', async () => {
    const client = mockEvmClient();
    const result = await verifyEvmToken({
      chain: 'eth',
      contract: '0x1234',
      ownerAddress: OWNER,
      evmClient: client,
    });
    expect(result.ok).toBe(false);
    expect((client.request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('rejects a token whose metadata cannot be read', async () => {
    const client = mockEvmClient({ name: new Error('reverted') });
    const result = await verifyEvmToken({
      chain: 'eth',
      contract: USDC,
      ownerAddress: OWNER,
      evmClient: client,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Could not read this token');
    }
  });

  it('rejects metadata with decimals outside 0-36', async () => {
    const client = mockEvmClient({
      balanceOf: `0x${uint256Hex(0n)}`,
      decimals: `0x${uint256Hex(37n)}`,
    });
    const result = await verifyEvmToken({
      chain: 'eth',
      contract: USDC,
      ownerAddress: OWNER,
      evmClient: client,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('decimals');
    }
  });
});

describe('TRC-20 balanceOf', () => {
  it('returns the exact base-unit balance with the token decimals', async () => {
    const result = await fetchTokenBalance(
      { chain: 'trx', contract: TRON_USDT, ownerAddress: TRON_OWNER },
      { transport: okTron },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('5000000');
      expect(result.data.decimals).toBe(6);
      expect(result.data.chain).toBe('trx');
    }
  });
});

describe('verifyTronToken', () => {
  it('verifies a real TRC-20 token with metadata and a real balance', async () => {
    const result = await verifyTronToken({
      contract: TRON_USDT,
      ownerAddress: TRON_OWNER,
      transport: okTron,
    });
    expect(result).toEqual({
      ok: true,
      metadata: { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
      balanceBaseUnits: '5000000',
    });
  });

  it('rejects a non-contract address', async () => {
    const transport = tronTransport({ probeOk: false });
    const result = await verifyTronToken({
      contract: TRON_USDT,
      ownerAddress: TRON_OWNER,
      transport,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not a token contract');
    }
  });

  it('rejects a bad-format address without touching the network', async () => {
    const transport = tronTransport({});
    const result = await verifyTronToken({
      contract: 'not-a-tron-address',
      ownerAddress: TRON_OWNER,
      transport,
    });
    expect(result.ok).toBe(false);
    expect((transport.request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe('fetchTronTokenMetadata', () => {
  it('decodes name, symbol and decimals from triggerconstantcontract', async () => {
    const result = await fetchTronTokenMetadata({
      contract: TRON_USDT,
      ownerAddress: TRON_OWNER,
      transport: okTron,
    });
    expect(result).toEqual({
      ok: true,
      metadata: { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
    });
  });
});

describe('resolveTokenCoingeckoId', () => {
  it('returns the CoinGecko id for a known contract', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('/coins/ethereum/contract/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
      return { ok: true, status: 200, json: async () => ({ id: 'usd-coin' }) };
    });
    const id = await resolveTokenCoingeckoId({
      platform: 'ethereum',
      contract: USDC,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(id).toBe('usd-coin');
  });

  it('returns null on 404 (unknown token still addable, price unavailable)', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    const id = await resolveTokenCoingeckoId({
      platform: 'ethereum',
      contract: USDC,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(id).toBeNull();
  });

  it('returns null when the network fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const id = await resolveTokenCoingeckoId({
      platform: 'tron',
      contract: TRON_USDT,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(id).toBeNull();
  });
});

describe('TRON address helpers', () => {
  it('validates the USDT contract address and converts it to hex', () => {
    expect(isValidTronAddress(TRON_USDT)).toBe(true);
    // 21-byte address hex (0x41 + 20-byte hash); the 4-byte base58check
    // checksum is verified, not part of the address.
    expect(tronAddressToHex(TRON_USDT)).toBe('41a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  });

  it('rejects a corrupted checksum', () => {
    expect(isValidTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBe(false);
    expect(tronAddressToHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBeNull();
  });
});
