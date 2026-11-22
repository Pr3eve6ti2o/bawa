// @vitest-environment jsdom
// Bookkeeping only: recording, listing, removing and reconciling
// pending broadcasts. Nothing here sends, resubmits or fetches.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listPendingBroadcasts,
  listPendingBroadcastsDevnet,
  recordPendingBroadcast,
  recordPendingBroadcastDevnet,
  reconcilePendingBroadcasts,
  reconcilePendingBroadcastsDevnet,
  removePendingBroadcast,
  removePendingBroadcastDevnet,
} from './pending-broadcasts';

beforeEach(() => {
  localStorage.clear();
});

describe('pending-broadcasts', () => {
  it('records and lists a pending broadcast as unknown', () => {
    const recorded = recordPendingBroadcast({
      txHash: '0xabc',
      chain: 'eth',
      nonce: 7,
    });
    expect(recorded.status).toBe('unknown');
    expect(recorded.txHash).toBe('0xabc');
    expect(recorded.nonce).toBe(7);
    expect(listPendingBroadcasts()).toHaveLength(1);
  });

  it('re-recording the same hash replaces it instead of duplicating', () => {
    recordPendingBroadcast({ txHash: '0xabc', chain: 'eth' });
    recordPendingBroadcast({ txHash: '0xabc', chain: 'eth', nonce: 8 });
    const listed = listPendingBroadcasts();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.nonce).toBe(8);
  });

  it('removes an entry by hash and chain', () => {
    recordPendingBroadcast({ txHash: '0xabc', chain: 'eth' });
    recordPendingBroadcast({ txHash: '0xdef', chain: 'btc' });
    removePendingBroadcast('0xabc', 'eth');
    expect(listPendingBroadcasts().map((entry) => entry.txHash)).toEqual([
      '0xdef',
    ]);
  });

  it('reconcile removes confirmed entries, keeps the rest, and never resubmits', async () => {
    recordPendingBroadcast({ txHash: '0xconfirmed', chain: 'eth' });
    recordPendingBroadcast({ txHash: '0xmissing', chain: 'btc' });
    recordPendingBroadcast({ txHash: '0xunknown', chain: 'ton' });
    const resolved = vi.fn(async (entry: { txHash: string }) => {
      if (entry.txHash === '0xconfirmed') return 'confirmed' as const;
      if (entry.txHash === '0xmissing') return 'not-found' as const;
      return 'unknown' as const;
    });
    const outcome = await reconcilePendingBroadcasts(resolved);
    expect(outcome).toEqual({ confirmed: 1, stillUnknown: 2 });
    expect(resolved).toHaveBeenCalledTimes(3);
    expect(listPendingBroadcasts().map((entry) => entry.txHash)).toEqual([
      '0xmissing',
      '0xunknown',
    ]);
  });
});

describe('pending-broadcasts devnet (temporary devnet mode)', () => {
  it('records devnet broadcasts under a separate key', () => {
    recordPendingBroadcastDevnet({ txHash: '0xdev', chain: 'eth' });
    expect(listPendingBroadcasts()).toHaveLength(0);
    expect(listPendingBroadcastsDevnet()).toHaveLength(1);
    expect(listPendingBroadcastsDevnet()[0]?.txHash).toBe('0xdev');
    recordPendingBroadcast({ txHash: '0xmain', chain: 'eth' });
    expect(listPendingBroadcasts()).toHaveLength(1);
    expect(listPendingBroadcastsDevnet()).toHaveLength(1);
  });

  it('removes devnet entries without touching mainnet entries', () => {
    recordPendingBroadcast({ txHash: '0xmain', chain: 'eth' });
    recordPendingBroadcastDevnet({ txHash: '0xdev', chain: 'eth' });
    removePendingBroadcastDevnet('0xdev', 'eth');
    expect(listPendingBroadcastsDevnet()).toHaveLength(0);
    expect(listPendingBroadcasts()).toHaveLength(1);
  });

  it('reconciles devnet entries only', async () => {
    recordPendingBroadcast({ txHash: '0xmain', chain: 'eth' });
    recordPendingBroadcastDevnet({ txHash: '0xconfirmed', chain: 'eth' });
    recordPendingBroadcastDevnet({ txHash: '0xunknown', chain: 'btc' });
    const resolved = vi.fn(async (entry: { txHash: string }) => {
      if (entry.txHash === '0xconfirmed') return 'confirmed' as const;
      return 'unknown' as const;
    });
    const outcome = await reconcilePendingBroadcastsDevnet(resolved);
    expect(outcome).toEqual({ confirmed: 1, stillUnknown: 1 });
    expect(resolved).toHaveBeenCalledTimes(2);
    expect(listPendingBroadcastsDevnet().map((entry) => entry.txHash)).toEqual([
      '0xunknown',
    ]);
    expect(listPendingBroadcasts()).toHaveLength(1);
  });
});
