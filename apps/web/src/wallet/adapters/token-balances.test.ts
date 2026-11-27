import { afterEach, describe, expect, it, vi } from 'vitest';
import { hexToBytes } from 'viem';
import {
  deriveAssociatedTokenAddress,
  deriveMetaplexMetadataAddress,
  evmClientForChain,
  fetchJettonWalletAddress,
  fetchTokenBalance,
  fetchTronTokenMetadata,
  isValidTronAddress,
  resolveTokenCoingeckoId,
  tronAddressToHex,
  verifyEvmToken,
  verifyJettonToken,
  verifySplToken,
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

  it('rejects an on-chain decimals() above 36 in the balance fallback (A-5)', async () => {
    // A token outside the default-token table, so the on-chain
    // decimals() read is the only source — an absurd value must fail
    // the balance read instead of reaching the formatter.
    const client = mockEvmClient({ decimals: `0x${uint256Hex(100n)}` });
    const result = await fetchTokenBalance(
      {
        chain: 'eth',
        contract: '0x1234567890123456789012345678901234567890',
        ownerAddress: OWNER,
      },
      { evmClient: client },
    );
    expect(result.status).toBe('error');
  });

  it('accepts an on-chain decimals() of 36 in the balance fallback (A-5)', async () => {
    const client = mockEvmClient({ decimals: `0x${uint256Hex(36n)}` });
    const result = await fetchTokenBalance(
      {
        chain: 'eth',
        contract: '0x1234567890123456789012345678901234567890',
        ownerAddress: OWNER,
      },
      { evmClient: client },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.decimals).toBe(36);
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
    const result = await resolveTokenCoingeckoId({
      platform: 'ethereum',
      contract: USDC,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ id: 'usd-coin', image: null });
  });

  it('returns the CoinGecko image alongside the id when the listing has one', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'usd-coin',
        image: {
          small:
            'https://coin-images.coingecko.com/coins/images/6319/small/usdc.png',
        },
      }),
    }));
    const result = await resolveTokenCoingeckoId({
      platform: 'ethereum',
      contract: USDC,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({
      id: 'usd-coin',
      image: 'https://coin-images.coingecko.com/coins/images/6319/small/usdc.png',
    });
  });

  it('returns the CoinGecko id for a Jetton via the-open-network', async () => {
    const NOT_MASTER = 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT';
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain(
        '/coins/the-open-network/contract/eqavlwfdxgf2lxm67y4yzc17wykd9a0guwpkms1gosm__not',
      );
      return { ok: true, status: 200, json: async () => ({ id: 'notcoin' }) };
    });
    const result = await resolveTokenCoingeckoId({
      platform: 'the-open-network',
      contract: NOT_MASTER,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ id: 'notcoin', image: null });
  });

  it('returns null on 404 (unknown token still addable, price unavailable)', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));
    const result = await resolveTokenCoingeckoId({
      platform: 'ethereum',
      contract: USDC,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('returns null when the network fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const result = await resolveTokenCoingeckoId({
      platform: 'tron',
      contract: TRON_USDT,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toBeNull();
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

describe('evmClientForChain — RPC failover (UI/UX fixes, item 19)', () => {
  it('reads a token balance through the backup RPC when the primary is down', async () => {
    const transport: FetchTransportLike = {
      request: vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith('https://ethereum-rpc.publicnode.com')) {
          throw new Error('Network error: primary down');
        }
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          method?: string;
          id?: unknown;
        };
        const result =
          body.method === 'eth_chainId'
            ? '0x1'
            : body.method === 'eth_call'
              ? `0x${uint256Hex(2500000n)}`
              : '0x0';
        return { jsonrpc: '2.0', id: body.id ?? 1, result };
      }),
    };
    const client = evmClientForChain('eth', undefined, transport);
    const result = await fetchTokenBalance(
      { chain: 'eth', contract: USDC, ownerAddress: OWNER },
      { evmClient: client },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2500000');
      expect(result.data.source).toBe('eth.drpc.org');
    }
  });

  it('errors when every RPC is down', async () => {
    const transport: FetchTransportLike = {
      request: vi.fn(async () => {
        throw new Error('Network error: all RPCs down');
      }),
    };
    const client = evmClientForChain('eth', undefined, transport);
    const result = await fetchTokenBalance(
      { chain: 'eth', contract: USDC, ownerAddress: OWNER },
      { evmClient: client },
    );
    expect(result.status).toBe('error');
  });
});

const SOL_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_OWNER = 'DFeDnNjEonL96pQywDtanNuVGxSnjjq1aHjGGLjtxset';
/** The owner's USDC associated token account (verified PDA utility). */
const SOL_USDC_ATA = deriveAssociatedTokenAddress(SOL_OWNER, SOL_USDC_MINT)!;
const TON_USDT_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
const TON_OWNER = 'UQBfcPvE9ZZ0VXxBN_8zs7oJpf9q6ta8p7GZaaB97uWzvH5M';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const METAPLEX_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

/** Tiny base58 decode for building the Metaplex fixture (test-only). */
function decodeBase58Test(value: string): Uint8Array {
  const alphabet =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const ch of value) n = n * 58n + BigInt(alphabet.indexOf(ch));
  let hex = n.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  const bytes = new Uint8Array(32);
  const raw = hex === '00' ? new Uint8Array(0) : hexToBytes(`0x${hex}`);
  bytes.set(raw, 32 - raw.length);
  return bytes;
}

/** Minimal Metaplex metadata account: key + update authority + mint +
 *  length-prefixed name/symbol/uri — with the legacy fixed-width
 *  padding real mints use (name 32, symbol 10, uri 200) and the length
 *  prefix recording the PADDED length, exactly as the live USDC
 *  metadata account reads (verified 2026-11-23). The implementation
 *  reads only the name and symbol; the rest is present so the layout
 *  is honest. */
function metaplexMetadataBase64(name: string, symbol: string, mint: string): string {
  const mintBytes = decodeBase58Test(mint);
  const nameBytes = new TextEncoder().encode(name);
  const symbolBytes = new TextEncoder().encode(symbol);
  const paddedName = new Uint8Array(32);
  paddedName.set(nameBytes);
  const paddedSymbol = new Uint8Array(10);
  paddedSymbol.set(symbolBytes);
  const out = new Uint8Array(1 + 32 + 32 + 4 + 32 + 4 + 10 + 4 + 200);
  const view = new DataView(out.buffer);
  let offset = 0;
  out[offset] = 4; // MetadataV1 key
  offset += 1 + 32; // update authority (zeros)
  out.set(mintBytes, offset);
  offset += 32;
  view.setUint32(offset, 32, true);
  offset += 4;
  out.set(paddedName, offset);
  offset += 32;
  view.setUint32(offset, 10, true);
  offset += 4;
  out.set(paddedSymbol, offset);
  offset += 10;
  view.setUint32(offset, 200, true); // empty uri, padded to 200
  return Buffer.from(out).toString('base64');
}

function mockSolTransport(overrides: {
  mintNull?: boolean;
  ataNull?: boolean;
  noMetadata?: boolean;
  primaryDown?: boolean;
} = {}): FetchTransportLike {
  return {
    request: vi.fn(async (url: string, init?: RequestInit) => {
      if (overrides.primaryDown === true && url.includes('solana-rpc.publicnode.com')) {
        throw new Error('Network error: primary down');
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string;
        params?: unknown[];
      };
      if (body.method === 'getAccountInfo') {
        const address = String(body.params?.[0] ?? '');
        // Lane A: the metadata read targets the mint's Metaplex
        // metadata PDA (getAccountInfo, base64) — never
        // getProgramAccounts: PublicNode refuses indexed requests
        // (-32602), so the old lookup failed for every mint.
        if (address === deriveMetaplexMetadataAddress(SOL_USDC_MINT)) {
          if (overrides.noMetadata === true) return { result: { value: null } };
          return {
            result: {
              value: {
                data: [
                  metaplexMetadataBase64('USD Coin', 'USDC', SOL_USDC_MINT),
                  'base64',
                ],
                executable: false,
                lamports: 0,
                owner: METAPLEX_PROGRAM,
                rentEpoch: 0,
              },
            },
          };
        }
        // The balance read targets the ATA; the metadata read targets
        // the mint. The mock answers each with its own shape.
        if (address === SOL_USDC_ATA) {
          if (overrides.ataNull === true) return { result: { value: null } };
          return {
            result: {
              value: {
                data: {
                  parsed: {
                    info: {
                      isNative: false,
                      mint: SOL_USDC_MINT,
                      owner: SOL_OWNER,
                      state: 'initialized',
                      tokenAmount: {
                        amount: '2500000',
                        decimals: 6,
                        uiAmount: 2.5,
                      },
                    },
                    type: 'account',
                  },
                  program: 'spl-token',
                  space: 165,
                },
                executable: false,
                lamports: 2039280,
                owner: TOKEN_PROGRAM,
                rentEpoch: 361,
              },
            },
          };
        }
        if (overrides.mintNull === true) return { result: { value: null } };
        return {
          result: {
            value: {
              data: {
                parsed: {
                  info: {
                    decimals: 6,
                    isInitialized: true,
                    mintAuthority: SOL_USDC_MINT,
                    supply: '1000000000000',
                  },
                  program: 'spl-token',
                  type: 'mint',
                },
                program: 'spl-token',
                space: 82,
              },
              executable: false,
              lamports: 2039280,
              owner: TOKEN_PROGRAM,
              rentEpoch: 361,
            },
          },
        };
      }
      // No getProgramAccounts handler: the metadata read must use the
      // PDA getAccountInfo (PublicNode refuses indexed requests,
      // -32602). An unexpected call throws below, which fails the
      // test loudly.
      throw new Error(`unexpected Solana method ${body.method ?? ''}`);
    }),
  };
}

function mockTonApiTransport(overrides: { unknownMaster?: boolean } = {}): FetchTransportLike {
  return {
    request: vi.fn(async (url: string) => {
      if (url.includes(`/v2/jettons/${TON_USDT_MASTER}`)) {
        if (overrides.unknownMaster === true) throw new Error('HTTP 404');
        return {
          metadata: { name: 'Tether USD', symbol: 'USD₮', decimals: 6 },
          total_supply: '1000000000000000',
        };
      }
      if (url.includes(`/v2/accounts/${TON_OWNER}/jettons/${TON_USDT_MASTER}`)) {
        return { balance: '1000000' };
      }
      throw new Error(`unexpected TonAPI url ${url}`);
    }),
  };
}

describe('SPL balanceOf — UI/UX fixes, item 13', () => {
  it('returns the exact base-unit balance with the token decimals', async () => {
    const result = await fetchTokenBalance(
      { chain: 'sol', contract: SOL_USDC_MINT, ownerAddress: SOL_OWNER },
      { transport: mockSolTransport() },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('2500000');
      expect(result.data.decimals).toBe(6);
    }
  });

  it('reads the balance through the backup RPC when the primary is down', async () => {
    const result = await fetchTokenBalance(
      { chain: 'sol', contract: SOL_USDC_MINT, ownerAddress: SOL_OWNER },
      { transport: mockSolTransport({ primaryDown: true }) },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.source).toBe('solana.publicnode.com');
    }
  });

  it('reports an exact zero balance when the owner has no token account', async () => {
    const result = await fetchTokenBalance(
      { chain: 'sol', contract: SOL_USDC_MINT, ownerAddress: SOL_OWNER },
      { transport: mockSolTransport({ ataNull: true }) },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });
});

describe('verifySplToken — UI/UX fixes, item 13', () => {
  it('verifies USDC with on-chain metadata and a real balance', async () => {
    const result = await verifySplToken({
      contract: SOL_USDC_MINT,
      ownerAddress: SOL_OWNER,
      transport: mockSolTransport(),
    });
    expect(result).toEqual({
      ok: true,
      metadata: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
      balanceBaseUnits: '2500000',
    });
  });

  it('rejects a mint with no account', async () => {
    const result = await verifySplToken({
      contract: SOL_USDC_MINT,
      ownerAddress: SOL_OWNER,
      transport: mockSolTransport({ mintNull: true }),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a mint with no Metaplex metadata', async () => {
    const result = await verifySplToken({
      contract: SOL_USDC_MINT,
      ownerAddress: SOL_OWNER,
      transport: mockSolTransport({ noMetadata: true }),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a bad-format mint without touching the network', async () => {
    const transport = mockSolTransport();
    const result = await verifySplToken({
      contract: 'not-a-mint',
      ownerAddress: SOL_OWNER,
      transport,
    });
    expect(result.ok).toBe(false);
    expect(transport.request).not.toHaveBeenCalled();
  });
});

describe('Jetton balanceOf — UI/UX fixes, item 13', () => {
  it('returns the exact base-unit balance with the token decimals', async () => {
    const result = await fetchTokenBalance(
      { chain: 'ton', contract: TON_USDT_MASTER, ownerAddress: TON_OWNER },
      { transport: mockTonApiTransport() },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.valueBaseUnits).toBe('1000000');
      expect(result.data.decimals).toBe(6);
    }
  });

  it('reports an exact zero balance when the owner has no jetton wallet', async () => {
    const transport: FetchTransportLike = {
      request: vi.fn(async (url: string) => {
        if (url.includes('/v2/jettons/')) {
          return { metadata: { name: 'Tether USD', symbol: 'USD₮', decimals: 6 } };
        }
        throw new Error('HTTP 404');
      }),
    };
    const result = await fetchTokenBalance(
      { chain: 'ton', contract: TON_USDT_MASTER, ownerAddress: TON_OWNER },
      { transport },
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.valueBaseUnits).toBe('0');
  });
});

describe('verifyJettonToken — UI/UX fixes, item 13', () => {
  it('verifies USDT with TonAPI metadata and a real balance', async () => {
    const result = await verifyJettonToken({
      contract: TON_USDT_MASTER,
      ownerAddress: TON_OWNER,
      transport: mockTonApiTransport(),
    });
    expect(result).toEqual({
      ok: true,
      metadata: { name: 'Tether USD', symbol: 'USD₮', decimals: 6 },
      balanceBaseUnits: '1000000',
    });
  });

  it('rejects an unknown master (TonAPI 404)', async () => {
    const result = await verifyJettonToken({
      contract: TON_USDT_MASTER,
      ownerAddress: TON_OWNER,
      transport: mockTonApiTransport({ unknownMaster: true }),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a bad-format master without touching the network', async () => {
    const transport = mockTonApiTransport();
    const result = await verifyJettonToken({
      contract: 'not-a-master',
      ownerAddress: TON_OWNER,
      transport,
    });
    expect(result.ok).toBe(false);
    expect(transport.request).not.toHaveBeenCalled();
  });
});

// --- Token-transfer inputs (Lane 2) ----------------------------------------

describe('fetchJettonWalletAddress (Lane 2)', () => {
  // The USDT Jetton wallet of the tether treasury (TonAPI, live
  // 2026-11-24): a real Jetton wallet in raw '0:' form.
  const TREASURY_JETTON_WALLET =
    '0:2626cf30b702bdded845efc883efa45029ff59defdacc4ce7b8b0a5966d75002';

  function mockJettonWalletTransport(
    walletAddress: string | null,
  ): FetchTransportLike {
    return {
      request: vi.fn(async (url: string) => {
        if (
          url.includes(
            `/v2/accounts/${TON_OWNER}/jettons/${TON_USDT_MASTER}`,
          )
        ) {
          if (walletAddress === null) throw new Error('HTTP 404');
          return {
            balance: '1000000',
            wallet_address: {
              address: walletAddress,
              is_scam: false,
              is_wallet: true,
            },
            jetton: {
              address: TON_USDT_MASTER,
              name: 'Tether USD',
              symbol: 'USD₮',
              decimals: 6,
            },
          };
        }
        throw new Error(`unexpected TonAPI url ${url}`);
      }),
    };
  }

  it('returns the raw 0: wallet address from the TonAPI wallet_address object', async () => {
    await expect(
      fetchJettonWalletAddress({
        contract: TON_USDT_MASTER,
        ownerAddress: TON_OWNER,
        transport: mockJettonWalletTransport(TREASURY_JETTON_WALLET),
      }),
    ).resolves.toBe(TREASURY_JETTON_WALLET);
  });

  it('returns null when the owner has no jetton wallet (TonAPI 404)', async () => {
    await expect(
      fetchJettonWalletAddress({
        contract: TON_USDT_MASTER,
        ownerAddress: TON_OWNER,
        transport: mockJettonWalletTransport(null),
      }),
    ).resolves.toBeNull();
  });

  it('throws on a non-404 transport failure', async () => {
    const transport: FetchTransportLike = {
      request: vi.fn(async () => {
        throw new Error('HTTP 500');
      }),
    };
    await expect(
      fetchJettonWalletAddress({
        contract: TON_USDT_MASTER,
        ownerAddress: TON_OWNER,
        transport,
      }),
    ).rejects.toThrow('HTTP 500');
  });
});

describe('deriveAssociatedTokenAddress (Lane 2)', () => {
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  const OWNER_A = '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM';
  const OWNER_B = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

  it('matches @solana/spl-token getAssociatedTokenAddressSync (token program)', () => {
    // Vectors from an independent @solana/spl-token 0.4.9 oracle,
    // 2026-11-24 (scratch only, never a runtime dependency).
    expect(
      deriveAssociatedTokenAddress(OWNER_A, USDC_MINT, TOKEN_PROGRAM),
    ).toBe('BGDSeeSBbHKvgtUiz1oqv3rJtDJvTwc8ToDqiRiSJpYj');
    expect(
      deriveAssociatedTokenAddress(OWNER_B, USDC_MINT, TOKEN_PROGRAM),
    ).toBe('6wzzozWHyumGXyBgFpxnYkpoPN2fserASyYW3Yj882Br');
  });

  it('matches the oracle for the Token-2022 program', () => {
    expect(
      deriveAssociatedTokenAddress(OWNER_A, USDC_MINT, TOKEN_2022_PROGRAM),
    ).toBe('EaM8iM6b7pRm7BUkmHWy3EB4WnKhhnRnwdJfecNjciYi');
  });

  it('returns null on a malformed address', () => {
    expect(
      deriveAssociatedTokenAddress('not-an-address', USDC_MINT),
    ).toBeNull();
    expect(deriveAssociatedTokenAddress(OWNER_A, 'not-a-mint')).toBeNull();
  });
});

describe('deriveMetaplexMetadataAddress (Lane A)', () => {
  it('matches the live chain for BONK', () => {
    // Ground truth: api.mainnet-beta.solana.com getProgramAccounts
    // on the Metaplex program filtered to the BONK mint, 2026-11-24
    // — the returned account pubkey is this PDA.
    expect(
      deriveMetaplexMetadataAddress(
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      ),
    ).toBe('FDZZbyY9XGpL3CNKUZxLk3wFTTQYL3TkDiDzqxrizcPN');
  });

  it('returns null on a malformed mint', () => {
    expect(deriveMetaplexMetadataAddress('not-a-mint')).toBeNull();
  });
});
