// @vitest-environment jsdom
// Bookkeeping only: recording, listing, removing and reconciling
// pending broadcasts. Nothing here sends, resubmits or fetches.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listPendingBroadcasts,
  recordPendingBroadcast,
  reconcilePendingBroadcasts,
  removePendingBroadcast,
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
