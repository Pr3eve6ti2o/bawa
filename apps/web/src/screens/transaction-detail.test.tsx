// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TransactionDetailScreen } from './transaction-detail';
import { useWallet } from '../state/wallet-context';
import { lookupTransactionAnyChain } from '../wallet/tracker';
import { availableFor, chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';
import type { HistoryState } from '../state/wallet-context';

vi.mock('../state/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../wallet/tracker', () => ({
  // Lane P2-B (F30): the screen calls the any-chain lookup, and the
  // shape classifier is the tracker's own — reimplemented here so the
  // mock keeps the real classification (the lookup itself is stubbed).
  lookupTransactionAnyChain: vi.fn(),
  hashShape: (id: string) => {
    if (/^0x[0-9a-fA-F]{64}$/.test(id)) return 'evm';
    if (/^[0-9a-fA-F]{64}$/.test(id)) return 'utxo';
    if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(id)) return 'sol';
    return null;
  },
}));

vi.mock('../wallet/chains', () => ({
  availableFor: vi.fn(),
  chainConfig: vi.fn(),
  // P0-6: the detail imports Track's result card, which pulls in the
  // chain search picker — the picker reads SUPPORTED_CHAINS at
  // import time, so the mock supplies the same chain ids the test's
  // CHAINS record below covers. filterChains only runs when the
  // picker itself renders (never in this screen's tests).
  SUPPORTED_CHAINS: [
    'btc', 'eth', 'trx', 'ton', 'sol', 'bsc', 'matic', 'arb', 'op',
    'base', 'avax', 'gnosis', 'celo', 'linea', 'mantle', 'scroll',
    'opbnb', 'metis', 'aurora', 'fantom', 'ltc', 'doge',
  ],
  filterChains: vi.fn((_query: string, chains: unknown) => chains),
}));

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const CHAINS = {
  btc: { displayName: 'Bitcoin', symbol: 'BTC' },
  eth: { displayName: 'Ethereum', symbol: 'ETH' },
  trx: { displayName: 'TRON', symbol: 'TRX' },
  ton: { displayName: 'TON', symbol: 'TON' },
  sol: { displayName: 'Solana', symbol: 'SOL' },
  bsc: { displayName: 'BNB Smart Chain', symbol: 'BNB' },
  matic: { displayName: 'Polygon', symbol: 'POL' },
  arb: { displayName: 'Arbitrum One', symbol: 'ETH' },
  op: { displayName: 'OP Mainnet', symbol: 'ETH' },
  base: { displayName: 'Base', symbol: 'ETH' },
  avax: { displayName: 'Avalanche C-Chain', symbol: 'AVAX' },
  gnosis: { displayName: 'Gnosis', symbol: 'XDAI' },
  celo: { displayName: 'Celo', symbol: 'CELO' },
  linea: { displayName: 'Linea', symbol: 'ETH' },
  mantle: { displayName: 'Mantle', symbol: 'MNT' },
  scroll: { displayName: 'Scroll', symbol: 'ETH' },
  opbnb: { displayName: 'opBNB', symbol: 'BNB' },
  metis: { displayName: 'Metis', symbol: 'METIS' },
  aurora: { displayName: 'Aurora', symbol: 'ETH' },
  fantom: { displayName: 'Fantom', symbol: 'FTM' },
  ltc: { displayName: 'Litecoin', symbol: 'LTC' },
  doge: { displayName: 'Dogecoin', symbol: 'DOGE' },
} as const;

type ChainKey = keyof typeof CHAINS;

const emptyHistory: HistoryState = { status: 'empty', txs: [] };

function setWallet(
  history: Record<ChainKey, HistoryState>,
  refreshHistory: () => Promise<void> = () => Promise.resolve(),
  devnetEnabled = false,
): void {
  vi.mocked(useWallet).mockReturnValue({
    history,
    refreshHistory,
    devnetEnabled,
  } as unknown as ReturnType<typeof useWallet>);
}

async function mountScreen(path: string) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/transactions/:id" element={<TransactionDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return {
    div,
    cleanup: async () => {
      try {
        await act(async () => {
          root.unmount();
        });
      } finally {
        div.remove();
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupTransactionAnyChain).mockReset();
  vi.mocked(chainConfig).mockImplementation(
    (chain: ChainId) => CHAINS[chain as ChainKey] as unknown as ReturnType<typeof chainConfig>,
  );
  // History is verified for the original four chains plus SOL, LTC and
  // DOGE (chains.ts: capabilitiesForBalanceChain with historyVerified).
  vi.mocked(availableFor).mockImplementation(
    (capability) =>
      (capability === 'history'
        ? ['btc', 'eth', 'trx', 'ton', 'sol', 'ltc', 'doge']
        : []) as unknown as ReturnType<typeof availableFor>,
  );
});

describe('transaction detail screen', () => {
  it('shows the transaction found in loaded history', async () => {
    setWallet({
      btc: emptyHistory,
      eth: {
        status: 'loaded',
        txs: [
          {
            hash: '0xabc',
            chain: 'eth',
            networkId: 'eip155:1',
            direction: 'out',
            amountBaseUnits: '250000000000000000',
            counterparty: '0xRecipient',
            timestamp: 1700000000000,
            status: 'confirmed',
            explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
          },
        ],
      },
      trx: emptyHistory,
      ton: emptyHistory,
      sol: { status: 'empty', txs: [] },
      bsc: { status: 'empty', txs: [] },
      matic: { status: 'empty', txs: [] },
      arb: { status: 'empty', txs: [] },
      op: { status: 'empty', txs: [] },
      base: { status: 'empty', txs: [] },
      avax: { status: 'empty', txs: [] },
      gnosis: { status: 'empty', txs: [] },
      celo: { status: 'empty', txs: [] },
      linea: { status: 'empty', txs: [] },
      mantle: { status: 'empty', txs: [] },
      scroll: { status: 'empty', txs: [] },
      opbnb: { status: 'empty', txs: [] },
      metis: { status: 'empty', txs: [] },
      aurora: { status: 'empty', txs: [] },
      fantom: { status: 'empty', txs: [] },
      ltc: { status: 'empty', txs: [] },
      doge: { status: 'empty', txs: [] },
    });
    const mounted = await mountScreen('/transactions/0xabc');
    try {
      expect(mounted.div.textContent).toContain('Ethereum mainnet');
      // The app shell provides the one main landmark; this screen must
      // not render a second one.
      expect(mounted.div.querySelector('main')).toBeNull();
      expect(mounted.div.textContent).toContain('Sent');
      expect(mounted.div.textContent).toContain('0.25 ETH');
      expect(mounted.div.textContent).toContain('0xRecipient');
      const explorerLink = mounted.div.querySelector(
        'a[href="https://eth.blockscout.com/tx/0xabc"]',
      );
      expect(explorerLink).not.toBeNull();
      expect(explorerLink?.textContent).toContain('View on explorer');
      expect(mounted.div.textContent).toContain('confirmed as reported by the network');
      expect(mounted.div.textContent).toContain('Checked at');
      // Lane 2: the full hash carries a copy button — the row that
      // links here shows only the shortened hash.
      expect(
        mounted.div.querySelector('button[aria-label="Copy transaction hash"]'),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('finds a transaction on a history chain beyond the original four', async () => {
    // Lane J: the lookup used to iterate only BTC/ETH/TRX/TON, so a
    // Dogecoin transaction sitting in loaded history reported "not in
    // the loaded history". History is verified for SOL, LTC and DOGE
    // too (chains.ts), and refreshHistory loads it for all of them.
    setWallet({
      btc: emptyHistory,
      eth: emptyHistory,
      trx: emptyHistory,
      ton: emptyHistory,
      sol: emptyHistory,
      bsc: emptyHistory,
      matic: emptyHistory,
      arb: emptyHistory,
      op: emptyHistory,
      base: emptyHistory,
      avax: emptyHistory,
      gnosis: emptyHistory,
      celo: emptyHistory,
      linea: emptyHistory,
      mantle: emptyHistory,
      scroll: emptyHistory,
      opbnb: emptyHistory,
      metis: emptyHistory,
      aurora: emptyHistory,
      fantom: emptyHistory,
      ltc: emptyHistory,
      doge: {
        status: 'loaded',
        txs: [
          {
            hash: 'doge-tx-hash',
            chain: 'doge',
            networkId:
              'bip122:1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691',
            direction: 'in',
            amountBaseUnits: '250000000',
            counterparty: 'DH5yaieqoZN36fDVgNNW9K2dLyBnK4oP9m',
            timestamp: 1700000000000,
            status: 'confirmed',
            explorerUrl: null,
          },
        ],
      },
    });
    const mounted = await mountScreen('/transactions/doge-tx-hash');
    try {
      expect(mounted.div.textContent).toContain('Dogecoin mainnet');
      expect(mounted.div.textContent).toContain('Received');
      expect(mounted.div.textContent).toContain('2.5 DOGE');
      expect(mounted.div.textContent).toContain('DH5yaieqoZN36fDVgNNW9K2dLyBnK4oP9m');
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports a hash that is not in the loaded history', async () => {
    setWallet({
      btc: emptyHistory,
      eth: emptyHistory,
      trx: emptyHistory,
      ton: emptyHistory,
      sol: emptyHistory,
      bsc: emptyHistory,
      matic: emptyHistory,
      arb: emptyHistory,
      op: emptyHistory,
      base: emptyHistory,
      avax: emptyHistory,
      gnosis: emptyHistory,
      celo: emptyHistory,
      linea: emptyHistory,
      mantle: emptyHistory,
      scroll: emptyHistory,
      opbnb: emptyHistory,
      metis: emptyHistory,
      aurora: emptyHistory,
      fantom: emptyHistory,
      ltc: emptyHistory,
      doge: emptyHistory,
    });
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      // Lane X (Lane D #108): "Not in loaded history — status unknown."
      expect(mounted.div.textContent).toContain('Not in loaded history — status unknown.');
      expect(mounted.div.textContent).toContain('0xmissing');
      expect(mounted.div.textContent).toContain('Checked at');
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows a refresh-failed banner when the network refresh fails', async () => {
    setWallet(
      {
        btc: emptyHistory,
        eth: emptyHistory,
        trx: emptyHistory,
        ton: emptyHistory,
        sol: emptyHistory,
        bsc: emptyHistory,
        matic: emptyHistory,
        arb: emptyHistory,
        op: emptyHistory,
        base: emptyHistory,
        avax: emptyHistory,
        gnosis: emptyHistory,
        celo: emptyHistory,
        linea: emptyHistory,
        mantle: emptyHistory,
        scroll: emptyHistory,
        opbnb: emptyHistory,
        metis: emptyHistory,
        aurora: emptyHistory,
        fantom: emptyHistory,
        ltc: emptyHistory,
        doge: emptyHistory,
      },
      () => Promise.reject(new Error('network down')),
    );
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      // Lane X (Lane D #107): "Couldn't refresh — showing loaded history."
      expect(mounted.div.textContent).toContain("Couldn't refresh — showing loaded history.");
      expect(mounted.div.textContent).toContain('Checked at');
    } finally {
      await mounted.cleanup();
    }
  });

  it('lays the detail out in two columns on desktop widths', async () => {
    // Follow-up: the v2 wider cap (672 -> 768px) was invisible, so the
    // detail now lays out in two columns at lg. Below lg it stays a
    // single max-w-2xl column, so the mobile layout is untouched.
    setWallet({
      btc: emptyHistory,
      eth: emptyHistory,
      trx: emptyHistory,
      ton: emptyHistory,
      sol: emptyHistory,
      bsc: emptyHistory,
      matic: emptyHistory,
      arb: emptyHistory,
      op: emptyHistory,
      base: emptyHistory,
      avax: emptyHistory,
      gnosis: emptyHistory,
      celo: emptyHistory,
      linea: emptyHistory,
      mantle: emptyHistory,
      scroll: emptyHistory,
      opbnb: emptyHistory,
      metis: emptyHistory,
      aurora: emptyHistory,
      fantom: emptyHistory,
      ltc: emptyHistory,
      doge: emptyHistory,
    });
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      const wrapper = mounted.div.querySelector('div.max-w-2xl');
      expect(wrapper).not.toBeNull();
      expect(wrapper?.className).toContain('max-w-2xl');
      expect(wrapper?.className).toContain('lg:max-w-none');
      expect(wrapper?.className).not.toContain('lg:max-w-3xl');
      const section = mounted.div.querySelector('section');
      expect(section?.className).toContain('lg:grid');
      expect(section?.className).toContain('lg:grid-cols-2');
    } finally {
      await mounted.cleanup();
    }
  });

  it('splits a found transaction into two detail columns on desktop widths', async () => {    setWallet({
      btc: emptyHistory,
      eth: {
        status: 'loaded',
        txs: [
          {
            hash: '0xabc',
            chain: 'eth',
            networkId: 'eip155:1',
            direction: 'out',
            amountBaseUnits: '250000000000000000',
            counterparty: '0xRecipient',
            timestamp: 1700000000000,
            status: 'confirmed',
            explorerUrl: 'https://eth.blockscout.com/tx/0xabc',
          },
        ],
      },
      trx: emptyHistory,
      ton: emptyHistory,
      sol: { status: 'empty', txs: [] },
      bsc: { status: 'empty', txs: [] },
      matic: { status: 'empty', txs: [] },
      arb: { status: 'empty', txs: [] },
      op: { status: 'empty', txs: [] },
      base: { status: 'empty', txs: [] },
      avax: { status: 'empty', txs: [] },
      gnosis: { status: 'empty', txs: [] },
      celo: { status: 'empty', txs: [] },
      linea: { status: 'empty', txs: [] },
      mantle: { status: 'empty', txs: [] },
      scroll: { status: 'empty', txs: [] },
      opbnb: { status: 'empty', txs: [] },
      metis: { status: 'empty', txs: [] },
      aurora: { status: 'empty', txs: [] },
      fantom: { status: 'empty', txs: [] },
      ltc: { status: 'empty', txs: [] },
      doge: { status: 'empty', txs: [] },
    });
    const mounted = await mountScreen('/transactions/0xabc');
    try {
      const lists = mounted.div.querySelectorAll('dl');
      expect(lists.length).toBe(2);
      const wrapper = lists[0]?.parentElement;
      expect(wrapper?.className).toContain('lg:grid');
      expect(wrapper?.className).toContain('lg:grid-cols-2');
    } finally {
      await mounted.cleanup();
    }
  });

  // P0-6: the detail used to be a dead end for a real hash — "not in
  // the loaded history" with no way forward. It now runs the same
  // public-indexer lookup Track uses (BTC, then TRON, for a 64-hex
  // hash) and renders Track's result card.
  const genesisHash =
    'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16';
  const genesisTx = {
    hash: genesisHash,
    chain: 'btc',
    networkId: 'bip122:000000000019d6689c085ae165831e93',
    status: 'confirmed',
    statusLabel: 'confirmed',
    confirmations: 977607,
    blockHeight: 170,
    from: null,
    to: null,
    amountBaseUnits: '5000000000',
    feeBaseUnits: '0',
    timestamp: 1231731025000,
    explorerUrl: `https://mempool.space/tx/${genesisHash}`,
    source: 'mempool.space',
    fetchedAt: 1231731025000,
  } as const;

  function emptyWallet(): Record<ChainKey, HistoryState> {
    return {
      btc: emptyHistory,
      eth: emptyHistory,
      trx: emptyHistory,
      ton: emptyHistory,
      sol: emptyHistory,
      bsc: emptyHistory,
      matic: emptyHistory,
      arb: emptyHistory,
      op: emptyHistory,
      base: emptyHistory,
      avax: emptyHistory,
      gnosis: emptyHistory,
      celo: emptyHistory,
      linea: emptyHistory,
      mantle: emptyHistory,
      scroll: emptyHistory,
      opbnb: emptyHistory,
      metis: emptyHistory,
      aurora: emptyHistory,
      fantom: emptyHistory,
      ltc: emptyHistory,
      doge: emptyHistory,
    };
  }

  async function flushLookup(): Promise<void> {
    // The mount refresh, then the indexer lookup, each resolve in
    // their own microtask round — flush both.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  it('resolves a real hash through the public indexer when it is not in loaded history', async () => {
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({
      status: 'ok',
      data: genesisTx,
      chain: 'btc',
    });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${genesisHash}`);
    try {
      await flushLookup();
      expect(lookupTransactionAnyChain).toHaveBeenCalledWith(genesisHash, {
        devnet: false,
      });
      expect(mounted.div.textContent).toContain(
        'Found on Bitcoin via the public indexer',
      );
      expect(mounted.div.textContent).toContain('977,607 confirmations');
      expect(mounted.div.textContent).toContain('50 BTC');
      const explorerLink = mounted.div.querySelector(
        `a[href="https://mempool.space/tx/${genesisHash}"]`,
      );
      expect(explorerLink).not.toBeNull();
      expect(mounted.div.textContent).not.toContain('Its status is unknown');
    } finally {
      await mounted.cleanup();
    }
  });

  it('offers Track, explorer and Retry when the indexer finds nothing', async () => {
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({ status: 'not-found' });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${genesisHash}`);
    try {
      await flushLookup();
      // Lane X (Lane D #108): "Not in loaded history — status unknown."
      expect(mounted.div.textContent).toContain('Not in loaded history — status unknown.');
      const trackLink = mounted.div.querySelector(
        `a[href="/track?chain=btc&hash=${genesisHash}"]`,
      );
      expect(trackLink).not.toBeNull();
      expect(trackLink?.textContent).toContain('Look it up on Track');
      const explorerLink = mounted.div.querySelector(
        `a[href="https://mempool.space/tx/${genesisHash}"]`,
      );
      expect(explorerLink).not.toBeNull();
      // T1-3: a 64-hex hash is shared by four chains — the panel offers
      // every candidate explorer, never a single guessed Bitcoin link.
      expect(
        mounted.div.querySelector(
          `a[href="https://litecoinspace.org/tx/${genesisHash}"]`,
        ),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector(
          `a[href="https://dogechain.info/tx/${genesisHash}"]`,
        ),
      ).not.toBeNull();
      expect(
        mounted.div.querySelector(
          `a[href="https://tronscan.org/#/transaction/${genesisHash}"]`,
        ),
      ).not.toBeNull();
      // Lane P2-B: a 64-hex hash could also be TON — the TON
      // explorer joins the candidate links.
      expect(
        mounted.div.querySelector(
          `a[href="https://tonviewer.com/transaction/${genesisHash}"]`,
        ),
      ).not.toBeNull();
      const callsBefore = vi.mocked(lookupTransactionAnyChain).mock.calls.length;
      const retry = Array.from(mounted.div.querySelectorAll('button')).find(
        (button) => button.textContent === 'Retry',
      );
      expect(retry).not.toBeUndefined();
      await act(async () => {
        retry?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await flushLookup();
      expect(vi.mocked(lookupTransactionAnyChain).mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows no Retry for a hash that is not shaped like one', async () => {
    setWallet(emptyWallet());
    const mounted = await mountScreen('/transactions/0xmissing');
    try {
      await flushLookup();
      // A malformed hash can never succeed on refetch, so there is no
      // Retry — but the Track link is still there.
      expect(lookupTransactionAnyChain).not.toHaveBeenCalled();
      expect(mounted.div.textContent).toContain('Look it up on Track');
      expect(mounted.div.textContent).toContain(
        'doesn’t look like a transaction hash',
      );
      expect(
        Array.from(mounted.div.querySelectorAll('button')).find(
          (button) => button.textContent === 'Retry',
        ),
      ).toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  // Lane P2-B (F30): the detail route resolves ANY real hash, not
  // just wallet-known transactions — a 0x hash on a non-Ethereum
  // EVM chain, a Litecoin hash, and the honest states for Solana
  // and for a hash no chain has.
  it('resolves a real Optimism hash, not just an Ethereum one', async () => {
    const opHash =
      '0x2bfcadb4c53025f00c074e7990a5240aca38b1f0bf772f4b40eeb190e33c70ca';
    const opTx = {
      hash: opHash,
      chain: 'op',
      networkId: 'eip155:10',
      status: 'confirmed',
      statusLabel: 'ok',
      confirmations: 123,
      blockHeight: 160110409,
      from: '0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13',
      to: '0x6b75d8AF000000e20B7a7DDf000Ba900b4009A80',
      amountBaseUnits: '1050180096',
      feeBaseUnits: '1584659750723964',
      timestamp: 1795819000000,
      explorerUrl: `https://explorer.optimism.io/tx/${opHash}`,
      source: 'blockscout',
      fetchedAt: 1795819000000,
    } as const;
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({
      status: 'ok',
      data: opTx,
      chain: 'op',
    });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${opHash}`);
    try {
      await flushLookup();
      expect(lookupTransactionAnyChain).toHaveBeenCalledWith(opHash, {
        devnet: false,
      });
      expect(mounted.div.textContent).toContain(
        'Found on OP Mainnet via the public indexer',
      );
      expect(mounted.div.textContent).toContain('123 confirmations');
      expect(mounted.div.textContent).toContain('160,110,409');
      expect(
        mounted.div.querySelector(`a[href="${opTx.explorerUrl}"]`),
      ).not.toBeNull();
    } finally {
      await mounted.cleanup();
    }
  });

  it('resolves a real Litecoin hash', async () => {
    const ltcHash =
      '3869fed5d5b58005977830385d0310986abbc9140b6b61491992ca5ca93203c4';
    const ltcTx = {
      hash: ltcHash,
      chain: 'ltc',
      networkId:
        'bip122:12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
      status: 'confirmed',
      statusLabel: 'confirmed',
      confirmations: 1,
      blockHeight: 3220509,
      from: 'ltc1qsenderaddress0000000000000000000000',
      to: 'ltc1qrecipient0000000000000000000000000000',
      amountBaseUnits: '1000000000',
      feeBaseUnits: '1000',
      timestamp: 1795819000000,
      explorerUrl: `https://litecoinspace.org/tx/${ltcHash}`,
      source: 'litecoinspace',
      fetchedAt: 1795819000000,
    } as const;
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({
      status: 'ok',
      data: ltcTx,
      chain: 'ltc',
    });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${ltcHash}`);
    try {
      await flushLookup();
      expect(mounted.div.textContent).toContain(
        'Found on Litecoin via the public indexer',
      );
      expect(mounted.div.textContent).toContain('10 LTC');
    } finally {
      await mounted.cleanup();
    }
  });

  it('names Solana as unsupported with a Solscan link, not malformed', async () => {
    const solSig =
      '4Bq5kEwFejLnvu8khYxbFPzU9JKbpXgHnvmsvBMK2xjkPo7Km2zwf1X2jhsZpDXXMdrRMWXHVCmBSc1N3QEuPQUd';
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({
      status: 'unsupported',
      reason:
        'Solana transactions cannot be looked up in the wallet yet. Check the transaction on Solscan.',
    });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${solSig}`);
    try {
      await flushLookup();
      expect(mounted.div.textContent).toContain(
        'Solana transactions cannot be looked up in the wallet yet',
      );
      expect(mounted.div.textContent).not.toContain(
        'doesn’t look like a transaction hash',
      );
      expect(
        mounted.div.querySelector(`a[href="https://solscan.io/tx/${solSig}"]`),
      ).not.toBeNull();
      // No lookup exists to retry, so there is no Retry.
      expect(
        Array.from(mounted.div.querySelectorAll('button')).find(
          (button) => button.textContent === 'Retry',
        ),
      ).toBeUndefined();
    } finally {
      await mounted.cleanup();
    }
  });

  it('says a 64-hex hash could be TON when no chain has it', async () => {
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({ status: 'not-found' });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${genesisHash}`);
    try {
      await flushLookup();
      expect(mounted.div.textContent).toContain(
        'This could also be a TON transaction',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('passes the devnet flag through, like Track does', async () => {
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({
      status: 'ok',
      data: genesisTx,
      chain: 'btc',
    });
    setWallet(emptyWallet(), undefined, true);
    const mounted = await mountScreen(`/transactions/${genesisHash}`);
    try {
      await flushLookup();
      expect(lookupTransactionAnyChain).toHaveBeenCalledWith(genesisHash, {
        devnet: true,
      });
      expect(mounted.div.textContent).toContain(
        'Found on Bitcoin test network via the public indexer',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('shows the note when some networks could not be reached', async () => {
    vi.mocked(lookupTransactionAnyChain).mockResolvedValue({
      status: 'not-found',
      note: 'Some networks could not be reached; Retry may help.',
    });
    setWallet(emptyWallet());
    const mounted = await mountScreen(`/transactions/${genesisHash}`);
    try {
      await flushLookup();
      expect(mounted.div.textContent).toContain(
        'Some networks could not be reached; Retry may help.',
      );
    } finally {
      await mounted.cleanup();
    }
  });
});
