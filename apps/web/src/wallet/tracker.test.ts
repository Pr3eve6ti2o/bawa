import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdapter, registerAdapter, registerDevnetAdapter } from './adapters/index';
import { base64ToHex } from './adapters/ton';
import type { ChainAdapter } from './adapters/types';
import {
  getRecentActivity,
  lookupTransaction,
  parseBtcTx,
  parseEthTx,
  parseTonTxEntry,
  parseTrxTx,
} from './tracker';

const BTC_TX = {
  txid: 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16',
  fee: 0,
  status: {
    confirmed: true,
    block_height: 170,
    block_hash: '00000000d1145790a8694403d4063f323d499e655c83426834d4ce2f8dd4a2ee',
    block_time: 1231731025,
  },
  vin: [{
    txid: '0437cd7f8525ceed2324359c2d0ba26006d92d856a9c20fa0241106ee5a597c9',
    vout: 0,
    prevout: { scriptpubkey_address: null, value: 5000000000 },
    is_coinbase: false,
  }],
  vout: [
    { scriptpubkey_address: null, value: 1000000000 },
    { scriptpubkey_address: null, value: 4000000000 },
  ],
};

const ETH_TX = {
  hash: '0xbb4b3fc2b746877dce70862850602f1d19bd890ab4db47e6b7ee1da1fe578a0d',
  status: 'ok',
  block_number: 20000000,
  confirmations: 6451173,
  fee: { type: 'actual', value: '1584659750723964' },
  value: '1050180096',
  from: { hash: '0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13' },
  to: { hash: '0x6b75d8AF000000e20B7a7DDf000Ba900b4009A80' },
  timestamp: '2024-06-01T22:36:47.000000Z',
};

const TRX_TX = {
  txID: '0ef4ce5930da667a1b70189bbb959ce37c7a18688b86db2303abd3517382b7a3',
  raw_data: {
    timestamp: 1795115756363,
    contract: [{
      type: 'TransferContract',
      parameter: {
        value: {
          owner_address: '411240838d48c12297c0de7b81498550e2f727c6cb',
          to_address: '41fd7b2568bff923aa93f3674696f4df25cd7b6c71',
          amount: 4746000,
        },
      },
    }],
  },
  ret: [{ contractRet: 'SUCCESS' }],
};

const TON_ENTRY = {
  transaction_id: {
    lt: '117514529000003',
    hash: 'PvYm0C79pRYIX/Y8mn6pf/HWH6G4hGE06DOnKyxkhSk=',
  },
  fee: '6668',
  utime: 1795020702,
  in_msg: {
    source: 'EQB6GAOYDXeH-mbkLsP7OoXF1a8RUCPIajHI1QDF9TGg-68I',
    value: '2000000000',
  },
  out_msgs: [],
};

const TON_HASH = base64ToHex(TON_ENTRY.transaction_id.hash)!;
const TON_ADDRESS = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';

const BTC_FIELDS = {
  hash: BTC_TX.txid,
  status: 'confirmed',
  blockHeight: 170,
  confirmations: 976455,
  amountBaseUnits: '5000000000',
  feeBaseUnits: '0',
  from: null,
  to: null,
  timestamp: 1231731025 * 1000,
  source: 'mempool.space',
  explorerUrl: `https://mempool.space/tx/${BTC_TX.txid}`,
};

const TON_FIELDS = {
  hash: TON_HASH,
  amountBaseUnits: '2000000000',
  feeBaseUnits: '6668',
  from: 'EQB6GAOYDXeH-mbkLsP7OoXF1a8RUCPIajHI1QDF9TGg-68I',
  to: null,
  timestamp: 1795020702 * 1000,
  status: 'confirmed',
  source: 'toncenter',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tracker (offline)', () => {
  const queue: unknown[] = [];

  beforeEach(() => {
    queue.length = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => queue.shift(),
    })));
  });

  it.each([
    { tipHeight: 976624, confirmations: 976455 },
    { tipHeight: null, confirmations: null },
  ])('parses recorded BTC with tip $tipHeight', ({ tipHeight, confirmations }) => {
    expect(parseBtcTx(BTC_TX, tipHeight)).toMatchObject({ ...BTC_FIELDS, confirmations });
  });

  it('rejects wrong-shaped BTC and empty TRX transactions', () => {
    expect(parseBtcTx({ nope: true }, null)).toBeNull();
    expect(parseTrxTx({})).toBeNull();
  });

  it('parses recorded ETH', () => {
    expect(parseEthTx(ETH_TX)).toMatchObject({
      status: 'confirmed',
      blockHeight: 20000000,
      confirmations: 6451173,
      amountBaseUnits: '1050180096',
      feeBaseUnits: '1584659750723964',
      from: '0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13',
      to: '0x6b75d8AF000000e20B7a7DDf000Ba900b4009A80',
      timestamp: Date.parse('2024-06-01T22:36:47.000000Z'),
      source: 'blockscout',
    });
  });

  it('distinguishes pending and failed ETH transactions', () => {
    expect(parseEthTx({ ...ETH_TX, block_number: null, confirmations: 0 }))
      .toMatchObject({ status: 'pending' });
    expect(parseEthTx({ ...ETH_TX, status: 'error' })).toMatchObject({ status: 'failed' });
  });

  it('parses recorded TRX', () => {
    expect(parseTrxTx(TRX_TX)).toMatchObject({
      status: 'confirmed',
      statusLabel: 'SUCCESS',
      amountBaseUnits: '4746000',
      from: '411240838d48c12297c0de7b81498550e2f727c6cb',
      to: '41fd7b2568bff923aa93f3674696f4df25cd7b6c71',
      blockHeight: null,
      confirmations: null,
      timestamp: 1795115756363,
      source: 'trongrid',
    });
  });

  it('parses recorded TON and converts its base64 hash', () => {
    expect(parseTonTxEntry(TON_ENTRY)).toMatchObject(TON_FIELDS);
  });

  it('looks up BTC using the transaction and tip responses', async () => {
    queue.push(BTC_TX, 976624);
    expect(await lookupTransaction('btc', BTC_TX.txid))
      .toMatchObject({ status: 'ok', data: BTC_FIELDS });
  });

  it('reports HTTP 404 as not-found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })));
    expect(await lookupTransaction('btc', '0'.repeat(64)))
      .toMatchObject({ status: 'not-found' });
  });

  it.each([
    { chain: 'eth' as const, hash: '0x' + '0'.repeat(64), raw: { message: 'Not found' } },
    { chain: 'trx' as const, hash: '0'.repeat(64), raw: {} },
  ])('reports an empty $chain response as not-found', async ({ chain, hash, raw }) => {
    queue.push(raw);
    expect(await lookupTransaction(chain, hash)).toMatchObject({ status: 'not-found' });
  });

  it('requires an address for TON lookup', async () => {
    expect(await lookupTransaction('ton', TON_ENTRY.transaction_id.hash))
      .toMatchObject({ status: 'unsupported' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('looks up TON by hexadecimal hash with an address', async () => {
    queue.push({ ok: true, result: [TON_ENTRY] });
    expect(await lookupTransaction('ton', TON_HASH, { address: TON_ADDRESS }))
      .toMatchObject({ status: 'ok', data: TON_FIELDS });
  });

  // Issue 6 (Lane B): the send result screen shows the message hash, so
  // /track must resolve it — a user pasting the hash they were just shown
  // must not get a false "not found".
  it('looks up TON by the message hash the send screen displays', async () => {
    const messageHash =
      '97a806498152ff9003aabef57a84e1b702d3af99e2e4315fda964ed63c88a975';
    const entry = {
      ...TON_ENTRY,
      in_msg: {
        ...TON_ENTRY.in_msg,
        hash: 'l6gGSYFS/5ADqr71eoThtwLTr5ni5DFf2pZO1jyIqXU=',
      },
    };
    queue.push({ ok: true, result: [entry] });
    expect(
      await lookupTransaction('ton', messageHash, { address: TON_ADDRESS }),
    ).toMatchObject({ status: 'ok', data: TON_FIELDS });
  });

  it('looks up TON by a 0x-prefixed message hash, as the result screen shows it', async () => {
    const entry = {
      ...TON_ENTRY,
      in_msg: {
        ...TON_ENTRY.in_msg,
        hash: 'l6gGSYFS/5ADqr71eoThtwLTr5ni5DFf2pZO1jyIqXU=',
      },
    };
    queue.push({ ok: true, result: [entry] });
    expect(
      await lookupTransaction(
        'ton',
        '0x97a806498152ff9003aabef57a84e1b702d3af99e2e4315fda964ed63c88a975',
        { address: TON_ADDRESS },
      ),
    ).toMatchObject({ status: 'ok', data: TON_FIELDS });
  });

  it('explains the 10-most-recent TON lookup window when not found', async () => {
    queue.push({ ok: true, result: [] });
    const result = await lookupTransaction('ton', TON_HASH, { address: TON_ADDRESS });
    expect(result).toMatchObject({
      status: 'not-found',
      note: expect.stringMatching(/10 most recent/i),
    });
  });

  it('reports a network failure as error, not not-found or ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('boom');
    }));
    expect(await lookupTransaction('btc', BTC_TX.txid)).toMatchObject({ status: 'error' });
  });

  it('rejects an invalid BTC hash before fetching', async () => {
    expect(await lookupTransaction('btc', 'not-a-hash')).toMatchObject({ status: 'error' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('defaults recent activity to 10 entries and clamps its limit to 20', async () => {
    const address = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    const previous = getAdapter('btc');
    const getHistory = vi.fn(async (_address: string, _limit: number) => ({
      status: 'ok',
      data: [],
      source: 'stub',
      fetchedAt: 1,
    }));
    registerAdapter({ chain: 'btc', getHistory } as unknown as ChainAdapter);

    try {
      // An empty ok list means 'no transactions found', never 'unused address'.
      expect(await getRecentActivity('btc', address)).toMatchObject({ status: 'ok', data: [] });
      expect(getHistory).toHaveBeenNthCalledWith(1, address, 10);
      expect(await getRecentActivity('btc', address, 100))
        .toMatchObject({ status: 'ok', data: [] });
      expect(getHistory).toHaveBeenNthCalledWith(2, address, 20);
    } finally {
      if (previous) {
        registerAdapter(previous);
      }
    }
  });
});

// Live-only: skipped in normal runs and deliberately uses the real fetch.
it.skipIf(process.env.BAWA_LIVE_TRACKER !== '1')('live: known BTC hash returns real data', async () => {
  const result = await lookupTransaction('btc', BTC_TX.txid);
  expect(result).toMatchObject({
    status: 'ok',
    data: { hash: BTC_TX.txid, status: 'confirmed' },
  });
}, 30_000);

describe('tracker devnet (temporary devnet mode)', () => {
  const queue: unknown[] = [];

  beforeEach(() => {
    queue.length = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => queue.shift(),
    })));
  });

  it('parses devnet transactions with devnet network ids and explorers', () => {
    expect(parseBtcTx(BTC_TX, 976624, true)).toMatchObject({
      networkId:
        'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      explorerUrl: `https://mempool.space/testnet4/tx/${BTC_TX.txid}`,
    });
    expect(parseEthTx(ETH_TX, true)).toMatchObject({
      networkId: 'eip155:11155111',
      explorerUrl: `https://sepolia.etherscan.io/tx/${ETH_TX.hash}`,
    });
    expect(parseTrxTx(TRX_TX, true)).toMatchObject({
      networkId: 'tron:nile',
      explorerUrl: `https://nile.tronscan.org/#/transaction/${TRX_TX.txID}`,
    });
    expect(parseTonTxEntry(TON_ENTRY, true)).toMatchObject({
      networkId: 'ton:-3',
      explorerUrl: `https://testnet.tonviewer.com/transaction/${TON_HASH}`,
    });
  });

  it('mainnet parses are unchanged', () => {
    expect(parseBtcTx(BTC_TX, 976624)).toMatchObject({
      networkId: 'bip122:000000000019d6689c085ae165831e93',
      explorerUrl: `https://mempool.space/tx/${BTC_TX.txid}`,
    });
    expect(parseEthTx(ETH_TX)).toMatchObject({
      networkId: 'eip155:1',
      explorerUrl: `https://eth.blockscout.com/tx/${ETH_TX.hash}`,
    });
    expect(parseTrxTx(TRX_TX)).toMatchObject({
      networkId: 'tron:0x2b6653dc',
      explorerUrl: `https://tronscan.org/#/transaction/${TRX_TX.txID}`,
    });
    expect(parseTonTxEntry(TON_ENTRY)).toMatchObject({
      networkId: 'ton:-239',
      explorerUrl: `https://tonviewer.com/transaction/${TON_HASH}`,
    });
  });

  it('looks up devnet BTC from the testnet4 endpoints', async () => {
    queue.push(BTC_TX, 162786);
    const result = await lookupTransaction('btc', BTC_TX.txid, {
      devnet: true,
    });
    expect(result).toMatchObject({
      status: 'ok',
      data: {
        networkId:
          'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      },
    });
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[0]?.[0]).toContain('/testnet4/api/tx/');
    expect(calls[1]?.[0]).toContain('/testnet4/api/blocks/tip/height');
  });

  it('looks up devnet ETH from Sepolia Blockscout', async () => {
    queue.push(ETH_TX);
    const result = await lookupTransaction('eth', ETH_TX.hash, {
      devnet: true,
    });
    expect(result).toMatchObject({
      status: 'ok',
      data: { networkId: 'eip155:11155111' },
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      'eth-sepolia.blockscout.com',
    );
  });

  it('looks up devnet TRX from Nile', async () => {
    queue.push(TRX_TX);
    const result = await lookupTransaction('trx', TRX_TX.txID, {
      devnet: true,
    });
    expect(result).toMatchObject({
      status: 'ok',
      data: { networkId: 'tron:nile' },
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('nile.trongrid.io');
  });

  it('looks up devnet TON from testnet TonCenter', async () => {
    queue.push({ ok: true, result: [TON_ENTRY] });
    const result = await lookupTransaction('ton', TON_HASH, {
      address: TON_ADDRESS,
      devnet: true,
    });
    expect(result).toMatchObject({
      status: 'ok',
      data: { networkId: 'ton:-3' },
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      'testnet.toncenter.com',
    );
  });

  it('getRecentActivity uses the devnet adapter in devnet mode', async () => {
    const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
    const getHistory = vi.fn(async (_address: string, _limit: number) => ({
      status: 'ok' as const,
      data: [],
      source: 'stub',
      fetchedAt: 1,
    }));
    registerDevnetAdapter({
      chain: 'btc',
      networkId:
        'bip122:00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
      getHistory,
    } as unknown as ChainAdapter);
    const result = await getRecentActivity('btc', address, 10, {
      devnet: true,
    });
    expect(result).toMatchObject({ status: 'ok', data: [] });
    expect(getHistory).toHaveBeenCalledWith(address, 10);
  });
});
