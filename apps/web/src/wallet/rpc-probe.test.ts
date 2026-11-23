// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { probeRpcEndpoint } from './rpc-probe';

type Handler = (body: unknown) => unknown;

function stubFetch(handlers: Handler[], failWith?: Error) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    if (failWith !== undefined) throw failWith;
    let parsed: unknown = undefined;
    if (typeof init?.body === 'string' && init.body.length > 0) {
      parsed = JSON.parse(init.body) as unknown;
    }
    const handler = handlers.shift();
    if (handler === undefined) {
      return new Response('no handler', { status: 500 });
    }
    const result = handler(parsed);
    if (typeof result === 'string') {
      return new Response(result, { status: 200 });
    }
    return new Response(JSON.stringify(result), { status: 200 });
  };
}

function jsonRpc(result: unknown) {
  return { jsonrpc: '2.0', result, id: 1 };
}

describe('probeRpcEndpoint (Lane F, FIX-ALL)', () => {
  it('proves an EVM endpoint with its chain id and block height', async () => {
    const fetchFn = stubFetch([
      () => jsonRpc('0x1'),
      () => jsonRpc('0x1940ddc'),
    ]);
    const result = await probeRpcEndpoint(
      'eth',
      'https://ethereum-rpc.publicnode.com',
      fetchFn,
    );
    expect(result.status).toBe('working');
    if (result.status === 'working') {
      expect(result.detail).toBe(
        `block ${Number.parseInt('0x1940ddc', 16).toLocaleString('en-GB')}`,
      );
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('fails an EVM endpoint answering as the wrong chain', async () => {
    const fetchFn = stubFetch([() => jsonRpc('0x38')]);
    const result = await probeRpcEndpoint(
      'eth',
      'https://bsc-rpc.publicnode.com',
      fetchFn,
    );
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toMatch(/expected 1/);
    }
  });

  it('still counts an EVM endpoint as working when it refuses the block height (Cloudflare shape)', async () => {
    const fetchFn = stubFetch([
      () => jsonRpc('0x1'),
      () => ({
        jsonrpc: '2.0',
        error: { code: -32046, message: 'Cannot fulfill request' },
        id: 2,
      }),
    ]);
    const result = await probeRpcEndpoint(
      'eth',
      'https://cloudflare-eth.com',
      fetchFn,
    );
    expect(result.status).toBe('working');
    if (result.status === 'working') {
      expect(result.detail).toBe('chain 1 confirmed');
    }
  });

  it('fails an EVM endpoint whose chain id errors (1rpc usage-limit shape)', async () => {
    const fetchFn = stubFetch([
      () => ({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'usage limit' },
        id: 1,
      }),
    ]);
    const result = await probeRpcEndpoint(
      'aurora',
      'https://1rpc.io/aurora',
      fetchFn,
    );
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toMatch(/usage limit/);
    }
  });

  it('proves Solana with its slot', async () => {
    const fetchFn = stubFetch([() => jsonRpc(473069044)]);
    const result = await probeRpcEndpoint(
      'sol',
      'https://solana-rpc.publicnode.com',
      fetchFn,
    );
    expect(result.status).toBe('working');
    if (result.status === 'working') {
      expect(result.detail).toBe(
        `slot ${(473069044).toLocaleString('en-GB')}`,
      );
    }
  });

  it('proves Bitcoin with its tip height', async () => {
    const fetchFn = stubFetch([() => '977262']);
    const result = await probeRpcEndpoint(
      'btc',
      'https://mempool.space/api',
      fetchFn,
    );
    expect(result.status).toBe('working');
    if (result.status === 'working') {
      expect(result.detail).toBe(
        `block ${(977262).toLocaleString('en-GB')}`,
      );
    }
  });

  it('proves TRON with its current block', async () => {
    const fetchFn = stubFetch([
      () => ({
        blockID: 'abc',
        block_header: { raw_data: { number: 88263304 } },
      }),
    ]);
    const result = await probeRpcEndpoint(
      'trx',
      'https://api.trongrid.io',
      fetchFn,
    );
    expect(result.status).toBe('working');
    if (result.status === 'working') {
      expect(result.detail).toBe(
        `block ${(88263304).toLocaleString('en-GB')}`,
      );
    }
  });

  it('proves TON with its masterchain seqno', async () => {
    const fetchFn = stubFetch([
      () => jsonRpc({ last: { seqno: 107351869 } }),
    ]);
    const result = await probeRpcEndpoint(
      'ton',
      'https://toncenter.com/api/v2/jsonRPC',
      fetchFn,
    );
    expect(result.status).toBe('working');
    if (result.status === 'working') {
      expect(result.detail).toBe(
        `seqno ${(107351869).toLocaleString('en-GB')}`,
      );
    }
  });

  it('proves Dogecoin through BlockCypher and leaves SoChain unchecked', async () => {
    const blockcypher = stubFetch([() => ({ height: 6469965 })]);
    const bc = await probeRpcEndpoint(
      'doge',
      'https://api.blockcypher.com/v1/doge/main',
      blockcypher,
    );
    expect(bc.status).toBe('working');
    if (bc.status === 'working') {
      expect(bc.detail).toBe(`block ${(6469965).toLocaleString('en-GB')}`);
    }
    const sochain = stubFetch([]);
    const sc = await probeRpcEndpoint(
      'doge',
      'https://sochain.com/api/v3',
      sochain,
    );
    expect(sc.status).toBe('unchecked');
    if (sc.status === 'unchecked') {
      expect(sc.reason).toMatch(/balance reads/);
    }
  });

  it('reports a dead endpoint as failed, never throws', async () => {
    const fetchFn = stubFetch([], new TypeError('fetch failed'));
    const result = await probeRpcEndpoint(
      'eth',
      'https://dead.invalid',
      fetchFn,
    );
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toMatch(/fetch failed/);
    }
  });

  it('reports an HTTP error as failed', async () => {
    const fetchFn = async (): Promise<Response> =>
      new Response('error code: 525', { status: 525 });
    const result = await probeRpcEndpoint(
      'eth',
      'https://eth.llamarpc.com',
      fetchFn,
    );
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toBe('HTTP 525');
    }
  });
});
