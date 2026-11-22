import { describe, expect, it, vi } from 'vitest';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

import { CHAINS } from './chains';
import {
  DEVNET_CHAIN_CONFIGS,
  DEVNET_NETWORK_IDS,
  chainConfigForDevnetNetwork,
  createDevnetBtcBroadcast,
  createDevnetEthBroadcast,
  createDevnetTonBroadcast,
  createDevnetTrxBroadcast,
  devnetExplorerTxUrl,
  isDevnetNetworkId,
} from './devnet-endpoints';
import type { FetchTransport } from './adapters/types';

const TXID = 'a'.repeat(64);

describe('devnet chain configs', () => {
  it('covers exactly the four adapter chains', () => {
    expect(Object.keys(DEVNET_CHAIN_CONFIGS).sort()).toEqual([
      'btc',
      'eth',
      'ton',
      'trx',
    ]);
  });

  it('uses network ids that never collide with mainnet', () => {
    const mainnetIds = new Set(
      Object.values(CHAINS).map((config) => config.networkId),
    );
    for (const id of DEVNET_NETWORK_IDS) {
      expect(mainnetIds.has(id)).toBe(false);
      expect(isDevnetNetworkId(id)).toBe(true);
    }
    expect(isDevnetNetworkId('eip155:1')).toBe(false);
    expect(isDevnetNetworkId('bip122:000000000019d6689c085ae165831e93')).toBe(
      false,
    );
  });

  it('names the verified devnet endpoints (live-checked 2026-11-22)', () => {
    expect(DEVNET_CHAIN_CONFIGS.btc.apiBaseUrl).toBe(
      'https://mempool.space/testnet4/api',
    );
    expect(DEVNET_CHAIN_CONFIGS.btc.genesisHash).toBe(
      '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
    );
    expect(DEVNET_CHAIN_CONFIGS.eth.rpcUrl).toBe(
      'https://ethereum-sepolia-rpc.publicnode.com',
    );
    expect(DEVNET_CHAIN_CONFIGS.eth.evmChainId).toBe(11155111);
    expect(DEVNET_CHAIN_CONFIGS.trx.apiBaseUrl).toBe(
      'https://nile.trongrid.io',
    );
    expect(DEVNET_CHAIN_CONFIGS.ton.apiBaseUrl).toBe(
      'https://testnet.toncenter.com/api/v2/jsonRPC',
    );
  });

  it('resolves chains by devnet network id and throws for anything else', () => {
    expect(chainConfigForDevnetNetwork('eip155:11155111').id).toBe('eth');
    expect(
      chainConfigForDevnetNetwork(
        'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      ).id,
    ).toBe('btc');
    expect(chainConfigForDevnetNetwork('tron:nile').id).toBe('trx');
    expect(chainConfigForDevnetNetwork('ton:-3').id).toBe('ton');
    expect(() => chainConfigForDevnetNetwork('eip155:1')).toThrow(
      /Unsupported network/,
    );
    expect(() => chainConfigForDevnetNetwork('bogus')).toThrow(
      /Unsupported network/,
    );
  });

  it('builds testnet explorer urls, never mainnet ones', () => {
    expect(devnetExplorerTxUrl('btc', TXID)).toBe(
      `https://mempool.space/testnet4/tx/${TXID}`,
    );
    expect(devnetExplorerTxUrl('eth', `0x${TXID}`)).toBe(
      `https://sepolia.etherscan.io/tx/0x${TXID}`,
    );
    expect(devnetExplorerTxUrl('trx', TXID)).toBe(
      `https://nile.tronscan.org/#/transaction/${TXID}`,
    );
    expect(devnetExplorerTxUrl('ton', TXID)).toBe(
      `https://testnet.tonviewer.com/transaction/${TXID}`,
    );
  });
});

describe('devnet broadcast closures', () => {
  it('BTC posts raw hex to mempool testnet4 and returns the txid', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => TXID,
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const broadcast = createDevnetBtcBroadcast();
      const result = await broadcast(`0x${'ab'.repeat(100)}`);
      expect(result.txHash).toBe(TXID);
      expect(result.explorerUrl).toBe(
        `https://mempool.space/testnet4/tx/${TXID}`,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://mempool.space/testnet4/api/tx');
      expect(init.method).toBe('POST');
      expect(init.body).toBe('ab'.repeat(100));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('BTC broadcast throws on an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 400, text: async () => 'bad' })),
    );
    try {
      await expect(createDevnetBtcBroadcast()('abcd')).rejects.toThrow(
        /HTTP 400/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ETH sends the raw transaction through the Sepolia client', async () => {
    const hash = `0x${TXID}`;
    const client = {
      sendRawTransaction: vi.fn(async () => hash),
    } as unknown as ReturnType<typeof createPublicClient>;
    const broadcast = createDevnetEthBroadcast(client);
    const result = await broadcast(hash);
    expect(result.txHash).toBe(hash);
    expect(result.explorerUrl).toBe(
      `https://sepolia.etherscan.io/tx/${hash}`,
    );
    expect(client.sendRawTransaction).toHaveBeenCalledWith({
      serializedTransaction: hash,
    });
  });

  it('ETH broadcast rejects a non-hex payload', async () => {
    const client = createPublicClient({
      chain: sepolia,
      transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
    });
    await expect(
      createDevnetEthBroadcast(client)('not-hex'),
    ).rejects.toThrow();
  });

  it('TRX posts the signed JSON to Nile and returns the txid', async () => {
    const transport: FetchTransport = {
      request: vi.fn(async () => ({ result: true, txid: TXID })),
    };
    const broadcast = createDevnetTrxBroadcast(
      transport,
      'https://nile.trongrid.io',
    );
    const signedJson = JSON.stringify({ txID: 'unsigned', raw_data: {} });
    const result = await broadcast(signedJson);
    expect(result.txHash).toBe(TXID);
    expect(result.explorerUrl).toBe(
      `https://nile.tronscan.org/#/transaction/${TXID}`,
    );
    expect(transport.request).toHaveBeenCalledWith(
      'https://nile.trongrid.io/wallet/broadcasttransaction',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('TRX broadcast throws when Nile rejects the transaction', async () => {
    const transport: FetchTransport = {
      request: vi.fn(async () => ({
        result: false,
        code: 'SIGERROR',
        message: 'Signature format is error',
      })),
    };
    const broadcast = createDevnetTrxBroadcast(
      transport,
      'https://nile.trongrid.io',
    );
    await expect(broadcast('{}')).rejects.toThrow(/SIGERROR/);
  });

  it('TON sends the BOC to testnet TonCenter and returns the hex hash', async () => {
    const hashBytes = Buffer.from(
      Array.from({ length: 32 }, (_, i) => i),
    );
    const transport: FetchTransport = {
      request: vi.fn(async () => ({
        ok: true,
        result: hashBytes.toString('base64'),
      })),
    };
    const broadcast = createDevnetTonBroadcast(
      transport,
      'https://testnet.toncenter.com/api/v2/jsonRPC',
    );
    const result = await broadcast('BOCBASE64');
    expect(result.txHash).toBe(hashBytes.toString('hex'));
    expect(result.explorerUrl).toBe(
      `https://testnet.tonviewer.com/transaction/${hashBytes.toString('hex')}`,
    );
  });
});
