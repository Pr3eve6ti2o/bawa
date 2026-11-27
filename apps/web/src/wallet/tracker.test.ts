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

  it('excludes change from the BTC amount and takes "to" from the recipient output (A-9)', () => {
    const sender = 'bc1qsender0000000000000000000000000000000000';
    const recipient = 'bc1qrecipient0000000000000000000000000000000';
    const tx = {
      ...BTC_TX,
      fee: 10000,
      vin: [
        {
          ...BTC_TX.vin[0],
          prevout: { scriptpubkey_address: sender, value: 100000 },
        },
      ],
      vout: [
        { scriptpubkey_address: sender, value: 40000 },
        { scriptpubkey_address: recipient, value: 50000 },
      ],
    };
    expect(parseBtcTx(tx, 976624)).toMatchObject({
      ...BTC_FIELDS,
      amountBaseUnits: '50000',
      feeBaseUnits: '10000',
      from: sender,
      to: recipient,
    });
  });

  it('reports a zero BTC amount for a self-send whose outputs are all change (A-9)', () => {
    const sender = 'bc1qsender0000000000000000000000000000000000';
    const tx = {
      ...BTC_TX,
      fee: 10000,
      vin: [
        {
          ...BTC_TX.vin[0],
          prevout: { scriptpubkey_address: sender, value: 100000 },
        },
      ],
      vout: [{ scriptpubkey_address: sender, value: 90000 }],
    };
    expect(parseBtcTx(tx, 976624)).toMatchObject({
      amountBaseUnits: '0',
      from: sender,
      to: sender,
    });
  });

  it('reports unknown confirmations when the tip is behind the block (A-9)', () => {
    expect(parseBtcTx(BTC_TX, 100)).toMatchObject({ confirmations: null });
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

// Lane B (Finish the Product, 2026-11-23): the /track hash lookup now
// covers the four newly-wired Blockscout chains (Optimism, Scroll, Celo,
// Aurora) with their own host, network id and explorer. Avalanche and
// Mantle stay unsupported for lookup — their history runs on Routescan,
// whose tx-info shape differs from Blockscout v2.
// (Appended to wallet/tracker.test.ts.)
describe('tracker — Blockscout v2 chains (Lane B)', () => {
  const queue: unknown[] = [];

  beforeEach(() => {
    queue.length = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => queue.shift(),
    })));
  });

  it('parses an Optimism transaction with its own chain, network and explorer', () => {
    expect(
      parseEthTx(ETH_TX, false, {
        chain: 'op',
        networkId: 'eip155:10',
        explorerBase: 'https://explorer.optimism.io',
      }),
    ).toMatchObject({
      chain: 'op',
      networkId: 'eip155:10',
      status: 'confirmed',
      explorerUrl: `https://explorer.optimism.io/tx/${ETH_TX.hash}`,
      source: 'blockscout',
    });
  });

  it('keeps the ETH parse exactly as before when no options are passed', () => {
    expect(parseEthTx(ETH_TX)).toMatchObject({
      chain: 'eth',
      networkId: 'eip155:1',
      explorerUrl: `https://eth.blockscout.com/tx/${ETH_TX.hash}`,
    });
  });

  it.each([
    { chain: 'op' as const, host: 'explorer.optimism.io', networkId: 'eip155:10' },
    { chain: 'scroll' as const, host: 'scrollscan.com', networkId: 'eip155:534352' },
    { chain: 'celo' as const, host: 'celo.blockscout.com', networkId: 'eip155:42220' },
    { chain: 'aurora' as const, host: 'explorer.aurora.dev', networkId: 'eip155:1313161554' },
    { chain: 'matic' as const, host: 'polygon.blockscout.com', networkId: 'eip155:137' },
    { chain: 'base' as const, host: 'base.blockscout.com', networkId: 'eip155:8453' },
    { chain: 'arb' as const, host: 'arbitrum.blockscout.com', networkId: 'eip155:42161' },
  ])('looks up a $chain transaction from its own Blockscout host', async ({ chain, host, networkId }) => {
    queue.push(ETH_TX);
    const result = await lookupTransaction(chain, ETH_TX.hash);
    expect(result).toMatchObject({
      status: 'ok',
      data: { chain, networkId, status: 'confirmed' },
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      `${host}/api/v2/transactions/${ETH_TX.hash}`,
    );
  });

  it('rejects a malformed hash for a Blockscout chain', async () => {
    expect(await lookupTransaction('op', 'not-a-hash')).toMatchObject({
      status: 'error',
    });
  });

  it('reports lookup unsupported for Avalanche and Mantle (Routescan shape)', async () => {
    expect(await lookupTransaction('avax', ETH_TX.hash)).toMatchObject({
      status: 'unsupported',
    });
    expect(await lookupTransaction('mantle', ETH_TX.hash)).toMatchObject({
      status: 'unsupported',
    });
  });

  it('reports lookup mainnet-only for the new chains in devnet mode', async () => {
    expect(
      await lookupTransaction('op', ETH_TX.hash, { devnet: true }),
    ).toMatchObject({ status: 'unsupported' });
  });
});

// Lane B (token-verify, 2026-11-24): the ten expanded chains whose
// Blockscout v2 API hash-matched live (mode, manta, ronin, fuse,
// syscoin, songbird, etc, flare, zetachain, hemi) are looked up from
// their own host, like the eight original chains. The wiring lane
// set their historyExplorerBase but never extended the lookup gate,
// so /track answered "not supported" for all ten.
describe('tracker — Blockscout v2 expanded chains (Lane B)', () => {
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
    { chain: 'mode' as const, host: 'explorer.mode.network', networkId: 'eip155:34443' },
    { chain: 'manta' as const, host: 'pacific-explorer.manta.network', networkId: 'eip155:169' },
    { chain: 'ronin' as const, host: 'explorer.roninchain.com', networkId: 'eip155:2020' },
    { chain: 'fuse' as const, host: 'explorer.fuse.io', networkId: 'eip155:122' },
    { chain: 'syscoin' as const, host: 'explorer.syscoin.org', networkId: 'eip155:57' },
    { chain: 'songbird' as const, host: 'songbird-explorer.flare.network', networkId: 'eip155:19' },
    { chain: 'etc' as const, host: 'etc.blockscout.com', networkId: 'eip155:61' },
    { chain: 'flare' as const, host: 'flare-explorer.flare.network', networkId: 'eip155:14' },
    { chain: 'zetachain' as const, host: 'zetascan.com', networkId: 'eip155:7000' },
    { chain: 'hemi' as const, host: 'explorer.hemi.xyz', networkId: 'eip155:43111' },
  ])('looks up a $chain transaction from its own Blockscout host', async ({ chain, host, networkId }) => {
    queue.push(ETH_TX);
    const result = await lookupTransaction(chain, ETH_TX.hash);
    expect(result).toMatchObject({
      status: 'ok',
      data: { chain, networkId, status: 'confirmed' },
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      `${host}/api/v2/transactions/${ETH_TX.hash}`,
    );
  });

  it('rejects a malformed hash for an expanded Blockscout chain', async () => {
    expect(await lookupTransaction('mode', 'not-a-hash')).toMatchObject({
      status: 'error',
    });
  });

  it('reports lookup mainnet-only for an expanded chain in devnet mode', async () => {
    expect(
      await lookupTransaction('mode', ETH_TX.hash, { devnet: true }),
    ).toMatchObject({ status: 'unsupported' });
  });
});
