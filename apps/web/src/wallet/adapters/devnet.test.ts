import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createBtcAdapter } from './btc';
import { createEthAdapter } from './eth';
import { createTronAdapter } from './trx';
import { createTonAdapter } from './ton';
import {
  getAdapter,
  getAdapterForMode,
  getDevnetAdapter,
  registerAllAdapters,
  registerDevnetAdapters,
  registeredChains,
  registeredDevnetChains,
} from './index';
import {
  DEVNET_CHAIN_CONFIGS,
  createDevnetBtcBroadcast,
  createDevnetEthBroadcast,
  createDevnetTonBroadcast,
  createDevnetTrxBroadcast,
} from '../devnet-endpoints';
import type { FetchTransport } from './types';
import { BROADCAST_DISABLED_MESSAGE } from './types';

const TESTNET4_GENESIS =
  '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043';
const MAINNET_GENESIS =
  '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
const TB1Q = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const BC1Q = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
// Testnet-flagged TON address (0Q, non-bounceable testnet).
const TON_TESTNET = '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkT';
const TON_MAINNET = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';
const TXID = 'ab'.repeat(32);
const ETH_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const TRX_ADDRESS = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';

// Same shape as eth.test.ts's mockClient: a fake viem client.
function mockClient(overrides: Record<string, unknown> = {}): PublicClient {
  return {
    getChainId: vi.fn(async () => 1),
    getBalance: vi.fn(async () => 1000000000000000000n),
    getGasPrice: vi.fn(async () => 20000000000n),
    getTransactionCount: vi.fn(async () => 7),
    ...overrides,
  } as unknown as PublicClient;
}

function fakeTransport(response: unknown): FetchTransport {
  return {
    request: vi.fn(async () => response),
  };
}

describe('devnet adapters (temporary devnet mode)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('BTC devnet adapter: accepts tb1q, pins the testnet4 genesis, uses the testnet4 explorer', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: TESTNET4_GENESIS }])),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([])));
    const adapter = createBtcAdapter({
      baseUrl: DEVNET_CHAIN_CONFIGS.btc.apiBaseUrl,
      networkId: DEVNET_CHAIN_CONFIGS.btc.networkId,
      genesisHash: DEVNET_CHAIN_CONFIGS.btc.genesisHash,
      explorerBaseUrl: 'https://mempool.space/testnet4',
      acceptTestnetAddresses: true,
    });
    expect(adapter.networkId).toBe(
      'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
    );
    const balance = await adapter.getBalance(TB1Q);
    expect(balance.status).toBe('ok');
    if (balance.status === 'ok') {
      expect(balance.data.networkId).toBe(adapter.networkId);
      expect(balance.data.valueBaseUnits).toBe('0');
    }
    const history = await adapter.getHistory(TB1Q);
    expect(history.status).toBe('ok');
    if (history.status === 'ok') {
      expect(history.data).toEqual([]);
    }
    // Identity check hit the testnet4 endpoint, not mainnet.
    expect(fetchMock.mock.calls[0]![0]).toContain('/testnet4/api');
  });

  it('BTC devnet adapter: rejects a mainnet bc1q address and a mainnet genesis', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: MAINNET_GENESIS }])),
    );
    const adapter = createBtcAdapter({
      baseUrl: DEVNET_CHAIN_CONFIGS.btc.apiBaseUrl,
      networkId: DEVNET_CHAIN_CONFIGS.btc.networkId,
      genesisHash: DEVNET_CHAIN_CONFIGS.btc.genesisHash,
      explorerBaseUrl: 'https://mempool.space/testnet4',
      acceptTestnetAddresses: true,
    });
    // bc1q is a mainnet form: the devnet adapter refuses it outright.
    const rejected = await adapter.getBalance(BC1Q);
    expect(rejected.status).toBe('error');
    // A mainnet genesis behind a testnet4 pin fails closed.
    const wrongGenesis = await adapter.getBalance(TB1Q);
    expect(wrongGenesis.status).toBe('error');
  });

  it('BTC devnet broadcast: posts the raw tx to mempool testnet4 and returns the txid', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(TXID, { status: 200 }));
    const broadcast = createDevnetBtcBroadcast();
    const result = await broadcast('0200000001deadbeef');
    expect(result.txHash).toBe(TXID);
    expect(result.explorerUrl).toBe(
      `https://mempool.space/testnet4/tx/${TXID}`,
    );
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${DEVNET_CHAIN_CONFIGS.btc.apiBaseUrl}/tx`,
    );
  });

  it('ETH devnet adapter: pins Sepolia chain id 11155111 and the Sepolia explorer', async () => {
    const client = mockClient({
      getChainId: vi.fn(async () => 11155111),
      getBalance: vi.fn(async () => 1_000_000_000_000_000_000n),
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: '1', result: [] })),
    );
    const adapter = createEthAdapter({
      client,
      rpcUrl: DEVNET_CHAIN_CONFIGS.eth.rpcUrl,
      historyBaseUrl: DEVNET_CHAIN_CONFIGS.eth.historyBaseUrl,
      networkId: DEVNET_CHAIN_CONFIGS.eth.networkId,
      expectedChainId: DEVNET_CHAIN_CONFIGS.eth.evmChainId,
      explorerBaseUrl: 'https://sepolia.etherscan.io',
    });
    expect(adapter.networkId).toBe('eip155:11155111');
    const balance = await adapter.getBalance(ETH_ADDRESS);
    expect(balance.status).toBe('ok');
    const history = await adapter.getHistory(ETH_ADDRESS);
    expect(history.status).toBe('ok');
    if (history.status === 'ok') {
      expect(history.data).toEqual([]);
    }
  });

  it('ETH devnet adapter: fails closed when the RPC reports chain 1', async () => {
    const client = mockClient({ getChainId: vi.fn(async () => 1) });
    const adapter = createEthAdapter({
      client,
      rpcUrl: DEVNET_CHAIN_CONFIGS.eth.rpcUrl,
      historyBaseUrl: DEVNET_CHAIN_CONFIGS.eth.historyBaseUrl,
      networkId: DEVNET_CHAIN_CONFIGS.eth.networkId,
      expectedChainId: DEVNET_CHAIN_CONFIGS.eth.evmChainId,
      explorerBaseUrl: 'https://sepolia.etherscan.io',
    });
    const balance = await adapter.getBalance(ETH_ADDRESS);
    expect(balance.status).toBe('error');
    if (balance.status === 'error') {
      expect(balance.reason).toContain('11155111');
    }
  });

  it('ETH devnet broadcast: sends the raw tx via the Sepolia client', async () => {
    const hash = `0x${TXID}`;
    const client = mockClient({
      sendRawTransaction: vi.fn(async () => hash),
    });
    const broadcast = createDevnetEthBroadcast(
      client as unknown as Parameters<
        typeof createDevnetEthBroadcast
      >[0],
    );
    const result = await broadcast(hash);
    expect(result.txHash).toBe(hash);
    expect(result.explorerUrl).toBe(`https://sepolia.etherscan.io/tx/${hash}`);
  });

  it('TRX devnet adapter: uses Nile and the Nile explorer', async () => {
    const fetchMock = vi.mocked(fetch);
    const block = {
      blockID:
        '0000000000000000000000000000000000000000000000000000000000000000',
      block_header: {
        raw_data: { number: 72938490, timestamp: 1763820000000, version: 1 },
      },
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(block)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ balance: 1_000_000 }] })),
      );
    const adapter = createTronAdapter({
      baseUrl: DEVNET_CHAIN_CONFIGS.trx.apiBaseUrl,
      networkId: DEVNET_CHAIN_CONFIGS.trx.networkId,
      explorerBaseUrl: 'https://nile.tronscan.org',
    });
    expect(adapter.networkId).toBe('tron:nile');
    const balance = await adapter.getBalance(TRX_ADDRESS);
    expect(balance.status).toBe('ok');
    if (balance.status === 'ok') {
      expect(balance.data.networkId).toBe('tron:nile');
      expect(balance.data.valueBaseUnits).toBe('1000000');
    }
    expect(fetchMock.mock.calls[0]![0]).toContain('nile.trongrid.io');
  });

  it('TRX devnet broadcast: posts to Nile and throws on result:false', async () => {
    const transport = fakeTransport({ result: true, txid: TXID });
    const broadcast = createDevnetTrxBroadcast(
      transport,
      DEVNET_CHAIN_CONFIGS.trx.apiBaseUrl,
    );
    const result = await broadcast(JSON.stringify({ txID: TXID }));
    expect(result.txHash).toBe(TXID);
    expect(result.explorerUrl).toBe(
      `https://nile.tronscan.org/#/transaction/${TXID}`,
    );

    const failing = createDevnetTrxBroadcast(
      fakeTransport({ result: false, code: 'SIGERROR', message: 'bad sig' }),
      DEVNET_CHAIN_CONFIGS.trx.apiBaseUrl,
    );
    await expect(failing(JSON.stringify({ txID: TXID }))).rejects.toThrow(
      'TRON broadcast failed',
    );
  });

  it('TON devnet adapter: accepts kQ/0Q, rejects UQ, uses the testnet explorer', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, result: { last: { seqno: 99646762 } } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: '1000000000' })),
      );
    const adapter = createTonAdapter({
      baseUrl: DEVNET_CHAIN_CONFIGS.ton.apiBaseUrl,
      networkId: DEVNET_CHAIN_CONFIGS.ton.networkId,
      explorerBaseUrl: 'https://testnet.tonviewer.com',
      acceptTestnetAddresses: true,
      minCallGapMs: 0,
    });
    expect(adapter.networkId).toBe('ton:-3');
    const rejected = await adapter.getBalance(TON_MAINNET);
    expect(rejected.status).toBe('error');
    const balance = await adapter.getBalance(TON_TESTNET);
    expect(balance.status).toBe('ok');
    if (balance.status === 'ok') {
      expect(balance.data.networkId).toBe('ton:-3');
      expect(balance.data.valueBaseUnits).toBe('1000000000');
    }
    // Bounceable testnet form (kQ) is accepted too.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: '0' })),
    );
    const bounceable = await adapter.getBalance(
      'kQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHTW',
    );
    expect(bounceable.status).toBe('ok');
    expect(fetchMock.mock.calls[0]![0]).toContain('testnet.toncenter.com');
  });

  it('TON devnet broadcast: sends the BOC via sendBoc and returns the hex message hash', async () => {
    const hashBytes = Buffer.from(TXID, 'hex');
    const transport = fakeTransport({
      ok: true,
      result: hashBytes.toString('base64'),
    });
    const broadcast = createDevnetTonBroadcast(
      transport,
      DEVNET_CHAIN_CONFIGS.ton.apiBaseUrl,
    );
    const result = await broadcast('te6ccgEBAQEAAgAA');
    expect(result.txHash).toBe(TXID);
    expect(result.explorerUrl).toBe(
      `https://testnet.tonviewer.com/transaction/${TXID}`,
    );
  });

  it('devnet registry: registers four devnet adapters and leaves the mainnet registry untouched', () => {
    registerAllAdapters();
    const mainnetBefore = registeredChains().sort();
    registerDevnetAdapters();
    expect(registeredDevnetChains().sort()).toEqual([
      'btc',
      'eth',
      'ton',
      'trx',
    ]);
    expect(registeredChains().sort()).toEqual(mainnetBefore);
    for (const chain of ['btc', 'eth', 'trx', 'ton'] as const) {
      const mainnet = getAdapter(chain);
      const devnet = getDevnetAdapter(chain);
      expect(mainnet).toBeDefined();
      expect(devnet).toBeDefined();
      expect(devnet?.networkId).not.toBe(mainnet?.networkId);
      expect(getAdapterForMode(chain, true)).toBe(devnet);
      expect(getAdapterForMode(chain, false)).toBe(mainnet);
    }
    expect(getDevnetAdapter('btc')?.networkId).toBe(
      'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
    );
    expect(getDevnetAdapter('eth')?.networkId).toBe('eip155:11155111');
    expect(getDevnetAdapter('trx')?.networkId).toBe('tron:nile');
    expect(getDevnetAdapter('ton')?.networkId).toBe('ton:-3');
  });

  it('mainnet adapters still throw on broadcast and still reject testnet addresses', async () => {
    registerAllAdapters();
    const btc = getAdapter('btc');
    const ton = getAdapter('ton');
    expect(btc).toBeDefined();
    expect(ton).toBeDefined();
    await expect(btc?.broadcast('0200000001deadbeef')).rejects.toThrow(
      BROADCAST_DISABLED_MESSAGE,
    );
    const tonRejected = await ton?.getBalance(TON_TESTNET);
    expect(tonRejected?.status).toBe('error');
    const btcRejected = await btc?.getBalance(TB1Q);
    expect(btcRejected?.status).toBe('error');
  });
});
